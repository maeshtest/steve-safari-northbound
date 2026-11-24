import { REGISTRATION_FEE_KES } from "@/lib/constants";
import { getAdminClient } from "./admin-client.server";
import { getPayheroConfig } from "./settings.server";
import { sendTemplateToApplication } from "./email.server";

const BASE = "https://backend.payhero.co.ke/api/v2";

type PayheroConfig = NonNullable<Awaited<ReturnType<typeof getPayheroConfig>>>;

function authHeader(cfg: PayheroConfig) {
  // If the user pasted the "Basic " prefix, don't duplicate it. Otherwise, prepend it.
  return cfg.apiToken.startsWith("Basic ") ? cfg.apiToken : `Basic ${cfg.apiToken}`;
}

export async function payheroTestConnection(cfg: PayheroConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE}/payment_channels`, { headers: { Authorization: authHeader(cfg) } });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "PayHero rejected the API token." };
    if (!res.ok) return { ok: false, message: `PayHero responded with status ${res.status}.` };
    const body = (await res.json().catch(() => null)) as unknown;
    const list = Array.isArray(body) ? body : (body as { data?: unknown[] } | null)?.data;
    if (Array.isArray(list)) {
      const found = list.some((c) => String((c as { id?: unknown }).id) === String(cfg.channelId));
      return found
        ? { ok: true, message: `Connected. Channel ${cfg.channelId} found on this account.` }
        : { ok: true, message: `Connected, but channel ${cfg.channelId} was not in the channel list — please double-check it.` };
    }
    return { ok: true, message: "Connected to PayHero successfully." };
  } catch (e) {
    return { ok: false, message: `Could not reach PayHero: ${(e as Error).message}` };
  }
}

export async function payheroInitiate(
  cfg: PayheroConfig,
  args: { amount: number; phoneLocal: string; externalReference: string; customerName: string; callbackUrl: string },
) {
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: args.amount,
      phone_number: args.phoneLocal,
      channel_id: Number(cfg.channelId),
      provider: "m-pesa",
      external_reference: args.externalReference,
      customer_name: args.customerName,
      callback_url: args.callbackUrl,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok && body["success"] !== false, status: res.status, body };
}

export async function payheroStatus(cfg: PayheroConfig, reference: string) {
  const res = await fetch(`${BASE}/transaction-status?reference=${encodeURIComponent(reference)}`, {
    headers: { Authorization: authHeader(cfg) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

/**
 * Asks PayHero for the authoritative status of a payment and settles it.
 */
export async function verifyPayment(paymentId: string, hint?: { amount?: number; receipt?: string }) {
  const db = await getAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return { status: "not_found" as const };
  if (payment.status === "success") return { status: "success" as const };
  if (!payment.provider_reference) return { status: payment.status };

  const cfg = await getPayheroConfig();
  if (!cfg) return { status: payment.status };

  const res = await payheroStatus(cfg, payment.provider_reference);
  await db.from("payments").update({ last_checked_at: new Date().toISOString() }).eq("id", payment.id);
  if (!res.ok) return { status: payment.status };

  const state = String(res.body["status"] ?? "").toUpperCase();
  const receipt =
    (res.body["provider_reference"] as string | undefined) ||
    (res.body["third_party_reference"] as string | undefined) ||
    hint?.receipt ||
    null;
  const reportedAmount = typeof res.body["amount"] === "number" ? (res.body["amount"] as number) : hint?.amount;

  if (state === "SUCCESS" && res.body["success"] !== false) {
    if (reportedAmount !== undefined && reportedAmount < REGISTRATION_FEE_KES) {
      await db.from("payments").update({ status: "failed", result_desc: `Amount ${reportedAmount} is below the KES ${REGISTRATION_FEE_KES} fee` }).eq("id", payment.id);
      return { status: "failed" as const };
    }
    const { data: updated } = await db
      .from("payments")
      .update({ status: "success", mpesa_receipt: receipt, verified_at: new Date().toISOString(), result_desc: "Verified with PayHero" })
      .eq("id", payment.id)
      .neq("status", "success")
      .select("id")
      .maybeSingle();
    if (updated) await settleApplication(payment.application_id, receipt);
    return { status: "success" as const };
  }
  if (state === "FAILED") {
    await db.from("payments").update({ status: "failed", result_desc: String(res.body["error_message"] ?? res.body["message"] ?? "Payment failed or was cancelled") }).eq("id", payment.id).neq("status", "success");
    const { data: app } = await db.from("applications").select("payment_status").eq("id", payment.application_id).maybeSingle();
    if (app && app.payment_status !== "paid") await db.from("applications").update({ payment_status: "failed" }).eq("id", payment.application_id);
    return { status: "failed" as const };
  }
  return { status: "queued" as const };
}

async function settleApplication(applicationId: string, receipt: string | null) {
  const db = await getAdminClient();
  const { data: app } = await db.from("applications").select("*").eq("id", applicationId).maybeSingle();
  if (!app || app.payment_status === "paid") return;
  const nextStage = app.stage === "registered" ? "pending_approval" : app.stage;
  await db.from("applications").update({ payment_status: "paid", paid_at: new Date().toISOString(), stage: nextStage }).eq("id", applicationId);
  if (nextStage !== app.stage) {
    await db.from("status_history").insert({
      application_id: applicationId,
      from_stage: app.stage,
      to_stage: nextStage,
      note: `Registration fee verified with PayHero${receipt ? ` (receipt ${receipt})` : ""}`,
    });
  }
  await sendTemplateToApplication("payment_confirmed", applicationId, { receipt: receipt ?? "—" }, null, "payment_confirmation");
}
