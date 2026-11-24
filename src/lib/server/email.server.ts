import { firstName, renderTemplate } from "@/lib/templating";
import { STAGE_LABELS } from "@/lib/constants";
import { getAdminClient } from "./admin-client.server";
import { getEmailConfig } from "./settings.server";

type EmailConfig = NonNullable<Awaited<ReturnType<typeof getEmailConfig>>>;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function emailHtml(body: string) {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f7f3ea;font-family:Helvetica,Arial,sans-serif;color:#2b2925">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="font-family:Georgia,serif;font-size:22px;color:#1f4a37;margin-bottom:24px">Steve Safari</div>
<div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e8e0cf">${paragraphs}</div>
<p style="font-size:12px;color:#7a7266;margin-top:20px">KES 500 is the only registration fee. Registration does not guarantee sponsorship, flights, visas or programme acceptance.</p>
</div></body></html>`;
}

export async function deliverEmail(cfg: EmailConfig, to: string, subject: string, text: string) {
  const html = emailHtml(text);
  const from = `${cfg.fromName} <${cfg.fromEmail}>`;
  let res: Response;
  if (cfg.provider === "resend") {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html, ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}) }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true as const, id: body.id ?? null } : { ok: false as const, error: body.message ?? `Resend error ${res.status}` };
  }
  if (cfg.provider === "sendgrid") {
    res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: cfg.fromEmail, name: cfg.fromName },
        ...(cfg.replyTo ? { reply_to: { email: cfg.replyTo } } : {}),
        subject,
        content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
      }),
    });
    if (res.ok) return { ok: true as const, id: res.headers.get("x-message-id") };
    const body = (await res.json().catch(() => ({}))) as { errors?: { message: string }[] };
    return { ok: false as const, error: body.errors?.[0]?.message ?? `SendGrid error ${res.status}` };
  }
  res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cfg.apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: cfg.fromEmail, name: cfg.fromName },
      to: [{ email: to }],
      ...(cfg.replyTo ? { replyTo: { email: cfg.replyTo } } : {}),
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
  return res.ok ? { ok: true as const, id: body.messageId ?? null } : { ok: false as const, error: body.message ?? `Brevo error ${res.status}` };
}

/** Sends (or records as not configured) one email and writes it to the email history. */
export async function sendAndLog(args: {
  to: string;
  subject: string;
  body: string;
  category: string;
  applicationId?: string | null;
  sentBy?: string | null;
  batchId?: string | null;
}): Promise<{ status: "sent" | "failed" | "not_configured"; error: string | null }> {
  const { hasServiceKey, callPrimaryBridge } = await import("@/lib/server/bridge.server");
  if (!hasServiceKey()) {
    try {
      return await callPrimaryBridge({ action: "send_email", ...args });
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  }
  const db = await getAdminClient();
  const cfg = await getEmailConfig();
  let status: "sent" | "failed" | "not_configured" = "not_configured";
  let error: string | null = "Email provider is not configured";
  let providerId: string | null = null;
  if (cfg) {
    try {
      const r = await deliverEmail(cfg, args.to, args.subject, args.body);
      if (r.ok) {
        status = "sent";
        error = null;
        providerId = r.id;
      } else {
        status = "failed";
        error = r.error;
      }
    } catch (e) {
      status = "failed";
      error = (e as Error).message;
    }
  }
  await db.from("email_logs").insert({
    to_email: args.to,
    subject: args.subject,
    body: args.body,
    category: args.category,
    status,
    error,
    provider: cfg?.provider ?? null,
    provider_message_id: providerId,
    application_id: args.applicationId ?? null,
    sent_by: args.sentBy ?? null,
    batch_id: args.batchId ?? null,
  });
  return { status, error };
}

export async function sendTemplateToApplication(
  slug: string,
  applicationId: string,
  extra: Record<string, string>,
  sentBy: string | null,
  category?: string,
) {
  const bridge = await import("@/lib/server/bridge.server");
  if (!bridge.hasServiceKey()) {
    try {
      return await bridge.callPrimaryBridge<{ status: "sent" | "failed" | "not_configured"; error: string | null }>({ action: "send_template", slug, applicationId, extra, sentBy, ...(category ? { category } : {}) });
    } catch (e) {
      return { status: "failed" as const, error: (e as Error).message };
    }
  }
  const db = await getAdminClient();
  const [{ data: tpl }, { data: app }] = await Promise.all([
    db.from("email_templates").select("*").eq("slug", slug).maybeSingle(),
    db.from("applications").select("id, full_name, email, reference, stage").eq("id", applicationId).maybeSingle(),
  ]);
  if (!tpl || !app) return { status: "failed" as const, error: "Template or application not found" };
  const vars = {
    first_name: firstName(app.full_name),
    full_name: app.full_name,
    reference: app.reference,
    stage: STAGE_LABELS[app.stage],
    message: "",
    receipt: "",
    ...extra,
  };
  return sendAndLog({
    to: app.email,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
    category: category ?? slug,
    applicationId,
    sentBy,
  });
}
