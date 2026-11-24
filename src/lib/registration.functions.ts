import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ALLOWED_DOC_TYPES, KENYAN_COUNTIES, MAX_DOCS, MAX_DOC_BYTES, POLICY_VERSION, REGISTRATION_FEE_KES } from "@/lib/constants";
import { normalizeKenyanPhone } from "@/lib/phone";

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

function hasServiceKey() {
  return !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}

function getBridgeToken() {
  const token = process.env.HL_SERVER_KEY || process.env.STEVE_SAFARI_BRIDGE_KEY;
  if (!token) throw new Error("Missing server bridge key");
  return token;
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

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registrationSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "";
    const normalizedPhone = normalizeKenyanPhone(data.phone)!;

    // ── Branch B: Bridge (Vercel) ──────────────────────────────────────────
    if (!hasServiceKey()) {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: result, error } = await supabase.rpc("bridge_submit_registration", {
        _token: getBridgeToken(),
        _full_name: data.fullName.replace(/\s+/g, " "),
        _national_id: data.nationalId.toUpperCase(),
        _phone: normalizedPhone,
        _email: data.email.toLowerCase(),
        _county: data.county,
        _public_consent: data.publicConsent,
        _policy_version: POLICY_VERSION,
        _user_agent: userAgent,
      });

      if (error) return { ok: false as const, error: "Could not save your registration. Please try again." };
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      if (!parsed.ok) return { ok: false as const, error: parsed.error };
      return { ok: true as const, reference: parsed.reference, token: parsed.token };
    }

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
      return {
        ok: false as const,
        error: `An application already exists for this national ID (reference ${existing.reference}). Use "Check status" to continue it.`,
      };
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
      if (error?.code === "23505") return { ok: false as const, error: "An application already exists for this national ID." };
      console.error("registration insert failed", error?.message);
      return { ok: false as const, error: "We could not save your registration. Please try again." };
    }

    // Post-insert side effects (fire and forget)
    try {
      await db.from("terms_acceptances").insert({ application_id: app.id, policy_version: POLICY_VERSION, user_agent: userAgent });
      await db.from("status_history").insert({ application_id: app.id, to_stage: "registered", note: "Registration submitted" });
      await sendTemplateToApplication("registration_received", app.id, {}, null, "registration");
    } catch (e) {
      console.error("Failed post-registration steps:", e);
    }

    return { ok: true as const, reference: app.reference, token };
  });

// ... requestDocumentUploads, confirmDocumentUploads remain the same ...

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
  .inputValidator((input: unknown) => applicantAuth.parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: result, error } = await supabase.rpc("bridge_lookup_application", {
        _token: getBridgeToken(),
        _reference: data.reference,
        _national_id: data.nationalId ?? "",
      });
      if (error) return { ok: false as const, error: "Lookup failed." };
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      if (!parsed.ok) return { ok: false as const, error: parsed.error };
      return { ok: true as const, application: parsed.application };
    }

    const { rateLimit, clientIp } = await import("@/lib/server/admin-client.server");
    const ip = clientIp(getRequest().headers);
    if (!(await rateLimit(`lookup:${ip}`, 30, 600))) {
      return { ok: false as const, error: "Too many lookups. Please wait a few minutes and try again." };
    }
    const app = await resolveApplicantDirect(data);
    if (!app) return { ok: false as const, error: "No application matches that reference and national ID." };
    return { ok: true as const, application: publicView(app) };
  });

export const getPaymentProgress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicantAuth.parse(input))
  .handler(async ({ data }) => {
    if (!hasServiceKey()) {
      // On Vercel, we use the bridge to get the status.
      // We skip active re-verification here for simplicity, the callback handles it.
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { data: lookupRes } = await supabase.rpc("bridge_lookup_application", {
        _token: getBridgeToken(), _reference: data.reference, _national_id: data.nationalId ?? "",
      });
      if (!lookupRes) return { ok: false as const, error: "Could not verify application." };
      const lookup = typeof lookupRes === "string" ? JSON.parse(lookupRes) : lookupRes;
      if (!lookup.ok) return { ok: false as const, error: lookup.error };

      const { data: progressRes, error: progressErr } = await supabase.rpc("bridge_get_payment_progress", {
        _token: getBridgeToken(),
        _application_id: lookup.id,
      });
      
      if (progressErr) return { ok: false as const, error: "Could not load progress." };
      const progress = typeof progressRes === "string" ? JSON.parse(progressRes) : progressRes;
      if (!progress.ok) return { ok: false as const, error: progress.error };
      
      return { ok: true as const, application: progress.application, latestPayment: progress.latestPayment };
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

export const initiatePayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    applicantAuth.extend({ phone: z.string().refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid M-Pesa number") }).parse(input),
  )
  .handler(async ({ data }) => {
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

    // ── Branch B: Bridge (Vercel) ──────────────────────────────────────────
    if (!hasServiceKey()) {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { data: lookupRes, error: lookupErr } = await supabase.rpc("bridge_lookup_application", {
        _token: getBridgeToken(), _reference: data.reference, _national_id: data.nationalId ?? "",
      });
      if (lookupErr) return { ok: false as const, error: "Could not verify application." };
      const lookup = typeof lookupRes === "string" ? JSON.parse(lookupRes) : lookupRes;
      if (!lookup.ok) return { ok: false as const, error: lookup.error };

      const { data: payRes, error: payErr } = await supabase.rpc("bridge_initiate_payment", {
        _token: getBridgeToken(),
        _application_id: lookup.id,
        _amount: REGISTRATION_FEE_KES,
        _phone: phone,
        _external_reference: externalReference,
      });
      if (payErr) return { ok: false as const, error: "Could not start payment." };
      const pay = typeof payRes === "string" ? JSON.parse(payRes) : payRes;
      if (!pay.ok) return { ok: false as const, error: pay.error };

      let result: Awaited<ReturnType<typeof payheroInitiate>>;
      try {
        result = await payheroInitiate(cfg, {
          amount: REGISTRATION_FEE_KES,
          phoneLocal: `0${phone.slice(3)}`,
          externalReference,
          customerName: lookup.application.firstName,
          callbackUrl,
        });
      } catch (e) {
        await supabase.rpc("bridge_confirm_payment", {
          _token: getBridgeToken(), _payment_id: pay.payment_id,
          _status: "failed", _provider_reference: null, _checkout_request_id: null,
          _result_desc: `Network error: ${(e as Error).message}`,
        });
        return { ok: false as const, error: "We could not reach the payment provider. Please try again." };
      }

      if (!result.ok) {
        await supabase.rpc("bridge_confirm_payment", {
          _token: getBridgeToken(), _payment_id: pay.payment_id,
          _status: "failed", _provider_reference: null, _checkout_request_id: null,
          _result_desc: "PayHero rejected the request.",
        });
        return { ok: false as const, error: "Payment request not accepted." };
      }

      await supabase.rpc("bridge_confirm_payment", {
        _token: getBridgeToken(), _payment_id: pay.payment_id,
        _status: "queued",
        _provider_reference: (result.body["reference"] as string) ?? null,
        _checkout_request_id: (result.body["CheckoutRequestID"] as string) ?? null,
        _result_desc: "M-Pesa prompt sent",
      });

      return { ok: true as const };
    }

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
