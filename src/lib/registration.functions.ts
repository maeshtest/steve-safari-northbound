import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ALLOWED_DOC_TYPES, KENYAN_COUNTIES, MAX_DOCS, MAX_DOC_BYTES, POLICY_VERSION, REGISTRATION_FEE_KES } from "@/lib/constants";
import { normalizeKenyanPhone } from "@/lib/phone";
import { hasExactlyOneApplicantIdentifier } from "@/lib/applicant-identifier";

const registrationSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name").max(120).refine((v) => v.split(/\s+/).length >= 2, "Enter at least two names"),
  nationalId: z.string().trim().regex(/^[0-9A-Za-z]{6,12}$/, "Enter a valid national ID number"),
  phone: z.string().trim().refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid Kenyan mobile number"),
  email: z.string().trim().email("Enter a valid email").max(200),
  county: z.enum(KENYAN_COUNTIES),
  publicConsent: z.boolean(),
  acceptedTerms: z.literal(true),
  policyVersion: z.string(),
});

const applicantAuth = z.object({
  reference: z.string().trim().toUpperCase().regex(/^SS-\d{2}-[A-F0-9]{6}$/),
  token: z.string().optional(),
  nationalId: z.string().trim().optional(),
});
type ApplicantAuth = z.infer<typeof applicantAuth>;

const statusLookupSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^SS-\d{2}-[A-F0-9]{6}$/).optional(),
  nationalId: z.string().trim().regex(/^[0-9A-Za-z]{6,12}$/).optional(),
}).refine((input) => hasExactlyOneApplicantIdentifier(input.reference, input.nationalId), "Enter either a reference number or national ID.");

function hasServiceKey() {
  return !!(process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SECRET_KEY"]);
}

async function viaBridge(action: string, data: Record<string, unknown>, fallbackError: string) {
  const { callPrimaryBridge } = await import("@/lib/server/bridge.server");
  const headers = getRequest().headers;
  const callerIp = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? undefined;
  try {
    return await callPrimaryBridge<Record<string, unknown>>({ action, ...data, ...(callerIp ? { callerIp } : {}) });
  } catch (error) {
    console.error(`Bridge ${action} failed`, error);
    return { ok: false, error: error instanceof Error && error.message ? error.message : fallbackError };
  }
}

async function resolveApplicantDirect(auth: ApplicantAuth) {
  const { getAdminClient } = await import("@/lib/server/admin-client.server");
  const { sha256Hex, safeEqual } = await import("@/lib/server/crypto.server");
  const db = await getAdminClient();
  const { data: app } = await db.from("applications").select("*").eq("reference", auth.reference).maybeSingle();
  if (!app) return null;
  if (auth.token) {
    if (safeEqual(await sha256Hex(auth.token), app.applicant_token_hash)) return app;
  }
  if (auth.nationalId && auth.nationalId.toLowerCase() === app.national_id.toLowerCase()) return app;
  return null;
}

// ── 1. submitRegistration ────────────────────────────────────────────────────
export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registrationSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const r = await viaBridge("register", { fullName: data.fullName.replace(/\s+/g, " "), nationalId: data.nationalId.toUpperCase(), phone: normalizeKenyanPhone(data.phone)!, email: data.email.toLowerCase(), county: data.county, publicConsent: data.publicConsent, acceptedTerms: true, policyVersion: data.policyVersion, userAgent: getRequest().headers.get("user-agent")?.slice(0, 300) ?? "" }, "Could not save your registration. Please try again.");
      if (r["existing"]) return { ok: false as const, existing: true as const, error: "This national ID is already registered." };
      if (!r["ok"]) return { ok: false as const, error: String(r["error"] ?? "Could not save your registration. Please try again.") };
      return { ok: true as const, reference: String(r["reference"]), token: String(r["token"]) };
    }
    const request = getRequest();
    const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "";
    const normalizedPhone = normalizeKenyanPhone(data.phone)!;


    // ── Branch A: Direct Admin (Lovable) ──────────────────────────────────
    const { getAdminClient, rateLimit, clientIp } = await import("@/lib/server/admin-client.server");
    const { randomToken, sha256Hex } = await import("@/lib/server/crypto.server");
    const { sendTemplateToApplication } = await import("@/lib/server/email.server");
    const ip = clientIp(request.headers);

    if (!(await rateLimit(`register:${ip}`, 8, 3600))) {
      return { ok: false as const, error: "Too many registration attempts from this connection. Please try again in an hour." };
    }
    if (data.policyVersion !== POLICY_VERSION) {
      return { ok: false as const, error: "Our terms have been updated. Please refresh the page and accept the latest version." };
    }

    const db = await getAdminClient();
    const { data: existing } = await db.from("applications").select("reference").ilike("national_id", data.nationalId).maybeSingle();
    if (existing) {
      return { ok: false as const, existing: true as const, error: "This national ID is already registered." };
    }

    const token = randomToken();
    const { data: app, error } = await db
      .from("applications")
      .insert({
        reference: "",
        full_name: data.fullName.replace(/\s+/g, " "),
        national_id: data.nationalId.toUpperCase(),
        phone: normalizedPhone,
        email: data.email.toLowerCase(),
        county: data.county,
        public_consent: data.publicConsent,
        terms_version: POLICY_VERSION,
        applicant_token_hash: await sha256Hex(token),
      })
      .select("id, reference")
      .single();

    if (error || !app) {
      if (error?.code === "23505") {
        const { data: duplicate } = await db.from("applications").select("reference").ilike("national_id", data.nationalId).maybeSingle();
        if (duplicate) return { ok: false as const, existing: true as const, error: "This national ID is already registered." };
      }
      console.error("registration insert failed", error?.message);
      return { ok: false as const, error: "We could not save your registration. Please try again." };
    }

    try {
      await db.from("terms_acceptances").insert({ application_id: app.id, policy_version: POLICY_VERSION, user_agent: userAgent });
      await db.from("status_history").insert({ application_id: app.id, to_stage: "registered", note: "Registration submitted" });
    } catch (e) {
      console.error("Failed to log registration details:", e);
    }

    try {
      await sendTemplateToApplication("registration_received", app.id, {}, null, "registration");
    } catch (e) {
      console.error("Failed to send registration email:", e);
    }

    return { ok: true as const, reference: app.reference, token };
  });

// ── 2. requestDocumentUploads ────────────────────────────────────────────────
const uploadRequestSchema = applicantAuth.extend({
  files: z
    .array(z.object({ name: z.string().min(1).max(200), type: z.enum(ALLOWED_DOC_TYPES), size: z.number().int().positive().max(MAX_DOC_BYTES) }))
    .min(1)
    .max(MAX_DOCS),
});

export const requestDocumentUploads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadRequestSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const r = await viaBridge("request_document_uploads", { reference: data.reference, token: data.token ?? "", files: data.files }, "Could not prepare the upload. Please try again.");
      if (!r["ok"]) return { ok: false as const, error: String(r["error"] ?? "Could not prepare the upload.") };
      return { ok: true as const, uploads: r["uploads"] as { documentId: string; path: string; token: string }[] };
    }
    const app = await resolveApplicantDirect(data);
    if (!app) return { ok: false as const, error: "We could not verify this application." };
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const { count } = await db.from("application_documents").select("id", { count: "exact", head: true }).eq("application_id", app.id);
    if ((count ?? 0) + data.files.length > MAX_DOCS) return { ok: false as const, error: `You can upload up to ${MAX_DOCS} documents.` };
    const uploads: { documentId: string; path: string; token: string }[] = [];
    for (const f of data.files) {
      const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : "jpg";
      const path = `${app.id}/${crypto.randomUUID()}.${ext}`;
      const { data: signed, error } = await db.storage.from("application-documents").createSignedUploadUrl(path);
      if (error || !signed) return { ok: false as const, error: "Could not prepare the upload. Please try again." };
      const { data: doc } = await db
        .from("application_documents")
        .insert({ application_id: app.id, storage_path: path, file_name: f.name.replace(/[^\w.\- ]/g, "_"), mime_type: f.type, size_bytes: f.size })
        .select("id")
        .single();
      uploads.push({ documentId: doc!.id, path, token: signed.token });
    }
    return { ok: true as const, uploads };
  });

// ── 3. confirmDocumentUploads ────────────────────────────────────────────────
export const confirmDocumentUploads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicantAuth.extend({ documentIds: z.array(z.string().uuid()).max(MAX_DOCS) }).parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const r = await viaBridge("confirm_document_uploads", { reference: data.reference, token: data.token ?? "", documentIds: data.documentIds }, "Could not confirm uploads.");
      return r["ok"] ? { ok: true as const } : { ok: false as const };
    }
    const app = await resolveApplicantDirect(data);
    if (!app) return { ok: false as const };
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const { data: docs } = await db.from("application_documents").select("id, storage_path").eq("application_id", app.id).in("id", data.documentIds);
    for (const d of docs ?? []) {
      const folder = d.storage_path.split("/")[0]!;
      const name = d.storage_path.split("/")[1]!;
      const { data: listed } = await db.storage.from("application-documents").list(folder, { search: name });
      if (listed && listed.some((o) => o.name === name)) {
        await db.from("application_documents").update({ uploaded: true }).eq("id", d.id);
      } else {
        await db.from("application_documents").delete().eq("id", d.id);
      }
    }
    return { ok: true as const };
  });

// ── 4. lookupApplication ─────────────────────────────────────────────────────
function publicView(app: {
  reference: string; full_name: string; stage: string; payment_status: string; info_requested: string | null; phone: string; created_at: string;
}) {
  return {
    reference: app.reference,
    firstName: app.full_name.split(" ")[0] ?? "",
    stage: app.stage,
    paymentStatus: app.payment_status,
    infoRequested: app.info_requested,
    phoneHint: `0${app.phone.slice(3, 6)}***${app.phone.slice(-3)}`,
    createdAt: app.created_at,
  };
}

export const lookupApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const r = await viaBridge("lookup", { ...(data.reference ? { reference: data.reference } : {}), ...(data.nationalId ? { nationalId: data.nationalId } : {}) }, "Lookup failed.");
      if (!r["ok"]) return { ok: false as const, error: String(r["error"] ?? "Lookup failed.") };
      return { ok: true as const, application: r["application"] as ReturnType<typeof publicView> };
    }

    const { rateLimit, clientIp } = await import("@/lib/server/admin-client.server");
    const ip = clientIp(getRequest().headers);
    if (!(await rateLimit(`lookup:${ip}`, 30, 600))) {
      return { ok: false as const, error: "Too many lookups. Please wait a few minutes and try again." };
    }
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const query = data.reference
      ? await db.from("applications").select("*").eq("reference", data.reference).maybeSingle()
      : await db.from("applications").select("*").ilike("national_id", data.nationalId ?? "").maybeSingle();
    const app = query.data;
    if (!app) return { ok: false as const, error: "No application matches that reference or national ID." };
    return { ok: true as const, application: publicView(app) };
  });

// ── 5. getPaymentProgress ────────────────────────────────────────────────────
export const getPaymentProgress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicantAuth.parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const r = await viaBridge("payment_progress", { reference: data.reference, ...(data.token ? { token: data.token } : {}), ...(data.nationalId ? { nationalId: data.nationalId } : {}) }, "Could not load progress.");
      if (!r["ok"]) return { ok: false as const, error: String(r["error"] ?? "Could not load progress.") };
      return { ok: true as const, application: r["application"] as ReturnType<typeof publicView>, latestPayment: r["latestPayment"] as { status: string | null; message: string | null; createdAt: string } | null };
    }

    const app = await resolveApplicantDirect(data);
    if (!app) return { ok: false as const, error: "We could not verify this application." };
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const { verifyPayment } = await import("@/lib/server/payhero.server");
    const db = await getAdminClient();
    const { data: latest } = await db
      .from("payments")
      .select("id, status, result_desc, last_checked_at, created_at, mpesa_receipt")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let paymentStatus = latest?.status ?? null;
    if (latest && latest.status === "queued") {
      const last = latest.last_checked_at ? new Date(latest.last_checked_at).getTime() : 0;
      if (Date.now() - last > 8000) {
        const r = await verifyPayment(latest.id);
        paymentStatus = r.status === "not_found" ? paymentStatus : r.status;
      }
    }
    const { data: fresh } = await db.from("applications").select("*").eq("id", app.id).single();
    return {
      ok: true as const,
      application: publicView(fresh!),
      latestPayment: latest ? { status: paymentStatus, message: latest.result_desc, createdAt: latest.created_at } : null,
    };
  });

// ── 6. initiatePayment ───────────────────────────────────────────────────────
export const initiatePayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    applicantAuth.extend({ phone: z.string().refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid M-Pesa number") }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const r = await viaBridge("initiate_payment", { reference: data.reference, ...(data.token ? { token: data.token } : {}), ...(data.nationalId ? { nationalId: data.nationalId } : {}), phone: normalizeKenyanPhone(data.phone)! }, "We could not start the payment. Please try again.");
      if (!r["ok"]) return { ok: false as const, error: String(r["error"] ?? "We could not start the payment. Please try again.") };
      return { ok: true as const };
    }
    const phone = normalizeKenyanPhone(data.phone)!;
    const externalReference = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const origin = new URL(getRequest().url).origin;
    const callbackUrl = `${origin}/api/public/payhero/callback`;

    const { getPayheroConfig } = await import("@/lib/server/settings.server");
    const { payheroInitiate } = await import("@/lib/server/payhero.server");

    let cfg;
    try {
      cfg = await getPayheroConfig();
    } catch (e) {
      console.error("Failed to load PayHero config:", e);
      return { ok: false as const, error: "Payment settings are currently unavailable. Please contact support." };
    }
    if (!cfg) return { ok: false as const, error: "Online payment is temporarily unavailable. Please try again later or contact us." };


    // ── Branch A: Direct Admin (Lovable) ──────────────────────────────────
    const app = await resolveApplicantDirect(data);
    if (!app) return { ok: false as const, error: "We could not verify this application." };
    if (app.payment_status === "paid") return { ok: false as const, error: "This registration fee has already been paid." };
    if (app.stage === "rejected" || app.stage === "withdrawn") return { ok: false as const, error: "This application is closed." };

    const { getAdminClient, rateLimit } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();

    const { data: recent } = await db
      .from("payments")
      .select("id, created_at")
      .eq("application_id", app.id)
      .in("status", ["initiated", "queued"])
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1);
    if (recent && recent.length > 0) {
      return { ok: false as const, error: "A payment prompt was sent less than a minute ago. Check your phone, or wait a moment before retrying." };
    }
    if (!(await rateLimit(`pay:${app.id}`, 5, 1800))) {
      return { ok: false as const, error: "Too many payment attempts. Please wait 30 minutes before trying again." };
    }

    const { data: payment, error } = await db
      .from("payments")
      .insert({ application_id: app.id, amount: REGISTRATION_FEE_KES, phone, external_reference: externalReference, status: "initiated" })
      .select("id")
      .single();
    if (error || !payment) return { ok: false as const, error: "Could not start the payment. Please try again." };

    let result: Awaited<ReturnType<typeof payheroInitiate>>;
    try {
      result = await payheroInitiate(cfg, {
        amount: REGISTRATION_FEE_KES,
        phoneLocal: `0${phone.slice(3)}`,
        externalReference,
        customerName: app.full_name,
        callbackUrl,
      });
    } catch (e) {
      await db.from("payments").update({ status: "failed", result_desc: `Network error: ${(e as Error).message}` }).eq("id", payment.id);
      return { ok: false as const, error: "We could not reach the payment provider. Please try again." };
    }
    if (!result.ok) {
      const msg = String(result.body["error_message"] ?? result.body["message"] ?? result.body["error"] ?? `PayHero error ${result.status}`);
      await db.from("payments").update({ status: "failed", result_desc: msg.slice(0, 500) }).eq("id", payment.id);
      return { ok: false as const, error: "The payment request was not accepted. Check the number and try again." };
    }
    await db
      .from("payments")
      .update({
        status: "queued",
        provider_reference: (result.body["reference"] as string | undefined) ?? null,
        checkout_request_id: (result.body["CheckoutRequestID"] as string | undefined) ?? null,
        result_desc: "M-Pesa prompt sent",
      })
      .eq("id", payment.id);
    await db.from("applications").update({ payment_status: "pending" }).eq("id", app.id);
    return { ok: true as const };
  });
