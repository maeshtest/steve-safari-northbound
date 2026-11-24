import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ALLOWED_DOC_TYPES, KENYAN_COUNTIES, MAX_DOCS, MAX_DOC_BYTES, POLICY_VERSION, REGISTRATION_FEE_KES } from "@/lib/constants";
import { hasExactlyOneApplicantIdentifier } from "@/lib/applicant-identifier";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Key",
};

const referenceSchema = z.string().trim().toUpperCase().regex(/^SS-\d{2}-[A-F0-9]{6}$/);
const nationalIdSchema = z.string().trim().regex(/^[0-9A-Za-z]{6,12}$/);
const applicantFields = z.object({
  reference: referenceSchema.optional(),
  nationalId: nationalIdSchema.optional(),
  token: z.string().min(32).max(200).optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("health") }),
  z.object({ action: z.literal("directory"), list: z.enum(["members", "sponsorship", "flight", "alumni"]) }),
  z.object({ action: z.literal("directory_counts") }),
  z.object({ action: z.literal("team") }),
  z.object({ action: z.literal("testimonials") }),
  z.object({ action: z.literal("site_content") }),
  z.object({
    action: z.literal("register"),
    fullName: z.string().trim().min(3).max(120),
    nationalId: nationalIdSchema,
    phone: z.string().regex(/^254[17]\d{8}$/),
    email: z.string().trim().email().max(200),
    county: z.enum(KENYAN_COUNTIES),
    publicConsent: z.boolean(),
    acceptedTerms: z.literal(true),
    policyVersion: z.string().max(40),
    userAgent: z.string().max(300),
    callerIp: z.string().max(100).optional(),
  }),
  z.object({ action: z.literal("lookup"), ...applicantFields.shape, callerIp: z.string().max(100).optional() }),
  z.object({ action: z.literal("payment_progress"), ...applicantFields.shape }),
  z.object({
    action: z.literal("initiate_payment"),
    ...applicantFields.shape,
    phone: z.string().regex(/^254[17]\d{8}$/),
    callerIp: z.string().max(100).optional(),
  }),
  z.object({ action: z.literal("contact"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), phone: z.string().trim().max(30).optional(), message: z.string().trim().min(5).max(3000), callerIp: z.string().max(100).optional() }),
  z.object({ action: z.literal("request_document_uploads"), reference: referenceSchema, token: z.string().min(32).max(200), files: z.array(z.object({ name: z.string().min(1).max(200), type: z.enum(ALLOWED_DOC_TYPES), size: z.number().int().positive().max(MAX_DOC_BYTES) })).min(1).max(MAX_DOCS) }),
  z.object({ action: z.literal("confirm_document_uploads"), reference: referenceSchema, token: z.string().min(32).max(200), documentIds: z.array(z.string().uuid()).max(MAX_DOCS) }),
  z.object({ action: z.literal("payhero_callback"), payload: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("send_email"), to: z.string().email(), subject: z.string().min(2).max(200), body: z.string().min(2).max(20000), category: z.string().min(1).max(80), applicationId: z.string().uuid().nullable().optional(), sentBy: z.string().uuid().nullable().optional(), batchId: z.string().uuid().nullable().optional() }),
  z.object({ action: z.literal("send_template"), slug: z.string().min(1).max(80), applicationId: z.string().uuid(), extra: z.record(z.string(), z.string()), sentBy: z.string().uuid().nullable(), category: z.string().max(80).optional() }),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function hasValidLookup(b: { reference?: string | undefined; nationalId?: string | undefined; token?: string | undefined }) {
  return hasExactlyOneApplicantIdentifier(b.reference, b.nationalId) || Boolean(b.reference && (b.token || b.nationalId));
}

function publicView(app: { reference: string; full_name: string; stage: string; payment_status: string; info_requested: string | null; phone: string; created_at: string }) {
  return {
    reference: app.reference,
    firstName: app.full_name.trim().split(/\s+/)[0] ?? "",
    stage: app.stage,
    paymentStatus: app.payment_status,
    infoRequested: app.info_requested,
    phoneHint: `0${app.phone.slice(3, 6)}***${app.phone.slice(-3)}`,
    createdAt: app.created_at,
  };
}

/** Privileged calls from a secondary host are validated with the generated server key. */
export const Route = createFileRoute("/api/public/bridge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 25_000) return json({ error: "Payload too large" }, 413);
        let input: unknown;
        try {
          input = JSON.parse(raw);
        } catch {
          return json({ error: "Invalid request" }, 400);
        }
        const parsed = bodySchema.safeParse(input);
        if (!parsed.success) return json({ error: "Invalid request" }, 400);

        const key = request.headers.get("x-bridge-key") ?? "";
        if (!((key.startsWith("hlsk_") || key.startsWith("ssb_")) && key.length <= 200)) return json({ error: "Unauthorized" }, 401);

        const { getAdminClient, clientIp, rateLimit } = await import("@/lib/server/admin-client.server");
        const { randomToken, safeEqual, sha256Hex } = await import("@/lib/server/crypto.server");
        const db = await getAdminClient();
        let authorized = false;
        if (key.startsWith("hlsk_")) {
          const { data } = await db.rpc("bridge_ok", { _token: key });
          authorized = data === true;
        } else {
          const { data: row } = await db.from("bridge_keys").select("id, revoked_at").eq("key_hash", await sha256Hex(key)).maybeSingle();
          authorized = Boolean(row && !row.revoked_at);
          if (row && !row.revoked_at) await db.from("bridge_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
        }
        if (!authorized) return json({ error: "Unauthorized" }, 401);

        const b = parsed.data;
        try {
          switch (b.action) {
            case "health":
              return json({ ok: true });
            case "directory": {
              const { data, error } = await db.rpc("public_directory", { _list: b.list });
              if (error) throw error;
              return json({ data: data ?? [] });
            }
            case "directory_counts": {
              const { data, error } = await db.rpc("public_directory_counts");
              if (error) throw error;
              return json({ data: data ?? { members: 0, sponsorship: 0, flight: 0, alumni: 0 } });
            }
            case "team": {
              const { data, error } = await db.from("team_members").select("id, full_name, role_title, bio, photo_url, sort_order").eq("is_visible", true).order("sort_order").order("created_at");
              if (error) throw error;
              return json({ data: data ?? [] });
            }
            case "testimonials": {
              const { data, error } = await db.from("testimonials").select("id, name, location, role_title, quote, photo_url, featured").eq("published", true).eq("consent_confirmed", true).order("featured", { ascending: false }).order("sort_order");
              if (error) throw error;
              return json({ data: data ?? [] });
            }
            case "site_content": {
              const { data, error } = await db.from("site_content").select("key, value");
              if (error) throw error;
              return json({ data: data ?? [] });
            }
            case "register": {
              const ip = b.callerIp || clientIp(request.headers);
              if (!(await rateLimit(`register:${ip}`, 8, 3600))) return json({ ok: false, error: "Too many registration attempts from this connection. Please try again in an hour." }, 429);
              if (b.policyVersion !== POLICY_VERSION) return json({ ok: false, error: "Our terms have been updated. Please refresh the page and accept the latest version." }, 400);
              const normalizedId = b.nationalId.toUpperCase();
              const { data: existing } = await db.from("applications").select("reference").ilike("national_id", normalizedId).maybeSingle();
              if (existing) return json({ ok: true, existing: true, reference: existing.reference });

              const token = randomToken(32);
              const { data: app, error } = await db.from("applications").insert({
                reference: "",
                full_name: b.fullName.replace(/\s+/g, " "),
                national_id: normalizedId,
                phone: b.phone,
                email: b.email.toLowerCase(),
                county: b.county,
                public_consent: b.publicConsent,
                terms_version: POLICY_VERSION,
                applicant_token_hash: await sha256Hex(token),
              }).select("id, reference").single();
              if (error || !app) {
                if (error?.code === "23505") {
                  const { data: duplicate } = await db.from("applications").select("reference").ilike("national_id", normalizedId).maybeSingle();
                  if (duplicate) return json({ ok: true, existing: true, reference: duplicate.reference });
                }
                return json({ ok: false, error: "We could not save your registration. Please try again." }, 500);
              }
              await db.from("terms_acceptances").insert({ application_id: app.id, policy_version: POLICY_VERSION, user_agent: b.userAgent });
              await db.from("status_history").insert({ application_id: app.id, to_stage: "registered", note: "Registration submitted" });
              try {
                const { sendTemplateToApplication } = await import("@/lib/server/email.server");
                await sendTemplateToApplication("registration_received", app.id, {}, null, "registration");
              } catch (error) {
                console.error("Registration email could not be sent through the bridge.", error instanceof Error ? error.message : "unknown error");
              }
              return json({ ok: true, reference: app.reference, token });
            }
            case "lookup": {
              if (!hasValidLookup(b)) return json({ ok: false, error: "Enter either a reference number or national ID." }, 400);
              const ip = b.callerIp || clientIp(request.headers);
              if (!(await rateLimit(`lookup:${ip}`, 30, 600))) return json({ ok: false, error: "Too many lookups. Please wait a few minutes and try again." }, 429);
              const identifier = b.reference ?? b.nationalId ?? "";
              const lookupHash = await sha256Hex(identifier.toLowerCase());
              if (!(await rateLimit(`lookup-id:${lookupHash}`, 12, 600))) return json({ ok: false, error: "Too many lookups for that identifier. Please wait a few minutes and try again." }, 429);
              const query = b.reference
                ? await db.from("applications").select("*").eq("reference", b.reference).maybeSingle()
                : await db.from("applications").select("*").ilike("national_id", b.nationalId ?? "").maybeSingle();
              if (!query.data) return json({ ok: false, error: "No application matches that reference or national ID." }, 404);
              if (b.reference && b.nationalId && query.data.national_id.toLowerCase() !== b.nationalId.toLowerCase()) return json({ ok: false, error: "No application matches that reference or national ID." }, 404);
              if (b.token && !safeEqual(await sha256Hex(b.token), query.data.applicant_token_hash)) return json({ ok: false, error: "We could not verify this application." }, 401);
              return json({ ok: true, application: publicView(query.data) });
            }
            case "payment_progress": {
              if (!hasValidLookup(b)) return json({ ok: false, error: "Enter one valid application identifier." }, 400);
              const query = b.reference
                ? await db.from("applications").select("*").eq("reference", b.reference).maybeSingle()
                : await db.from("applications").select("*").ilike("national_id", b.nationalId ?? "").maybeSingle();
              const app = query.data;
              if (!app) return json({ ok: false, error: "We could not verify this application." }, 404);
              if (b.reference && b.nationalId && app.national_id.toLowerCase() !== b.nationalId.toLowerCase()) return json({ ok: false, error: "We could not verify this application." }, 404);
              if (b.token) {
                const stored = await sha256Hex(b.token);
                if (!safeEqual(stored, app.applicant_token_hash)) return json({ ok: false, error: "We could not verify this application." }, 401);
              }
              const { data: latest } = await db.from("payments").select("id, status, result_desc, last_checked_at, created_at, mpesa_receipt").eq("application_id", app.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
              let paymentStatus = latest?.status ?? null;
              if (latest?.status === "queued") {
                const lastChecked = latest.last_checked_at ? new Date(latest.last_checked_at).getTime() : 0;
                if (Date.now() - lastChecked > 8000) {
                  const { verifyPayment } = await import("@/lib/server/payhero.server");
                  const checked = await verifyPayment(latest.id);
                  paymentStatus = checked.status === "not_found" ? paymentStatus : checked.status;
                }
              }
              const { data: fresh } = await db.from("applications").select("*").eq("id", app.id).maybeSingle();
              if (!fresh) return json({ ok: false, error: "We could not load this application." }, 404);
              return json({ ok: true, application: publicView(fresh), latestPayment: latest ? { status: paymentStatus, message: latest.result_desc, createdAt: latest.created_at } : null });
            }
            case "initiate_payment": {
              if (!hasValidLookup(b)) return json({ ok: false, error: "Enter one valid application identifier." }, 400);
              const query = b.reference
                ? await db.from("applications").select("*").eq("reference", b.reference).maybeSingle()
                : await db.from("applications").select("*").ilike("national_id", b.nationalId ?? "").maybeSingle();
              const app = query.data;
              if (!app) return json({ ok: false, error: "We could not verify this application." }, 404);
              if (b.reference && b.nationalId && app.national_id.toLowerCase() !== b.nationalId.toLowerCase()) return json({ ok: false, error: "We could not verify this application." }, 404);
              if (b.token && !safeEqual(await sha256Hex(b.token), app.applicant_token_hash)) return json({ ok: false, error: "We could not verify this application." }, 401);
              if (app.payment_status === "paid") return json({ ok: false, error: "This registration fee has already been paid." }, 400);
              if (app.stage === "rejected" || app.stage === "withdrawn") return json({ ok: false, error: "This application is closed." }, 400);
              const ip = b.callerIp || clientIp(request.headers);
              if (!(await rateLimit(`pay:${app.id}`, 5, 1800))) return json({ ok: false, error: "Too many payment attempts. Please wait 30 minutes before trying again." }, 429);
              const { data: recent } = await db.from("payments").select("id").eq("application_id", app.id).in("status", ["initiated", "queued"]).gte("created_at", new Date(Date.now() - 60_000).toISOString()).limit(1);
              if (recent?.length) return json({ ok: false, error: "A payment prompt was sent less than a minute ago. Check your phone, or wait a moment before retrying." }, 429);
              const { getPayheroConfig } = await import("@/lib/server/settings.server");
              const { payheroInitiate } = await import("@/lib/server/payhero.server");
              const config = await getPayheroConfig();
              if (!config) return json({ ok: false, error: "Online payment is temporarily unavailable. Please try again later or contact us." }, 503);
              const phone = b.phone;
              const externalReference = `PAY-${Date.now().toString(36).toUpperCase()}`;
              const { data: payment, error: paymentError } = await db.from("payments").insert({ application_id: app.id, amount: REGISTRATION_FEE_KES, phone, external_reference: externalReference, status: "initiated" }).select("id").single();
              if (paymentError || !payment) return json({ ok: false, error: "Could not start the payment. Please try again." }, 500);
              let result;
              try {
                result = await payheroInitiate(config, {
                  amount: REGISTRATION_FEE_KES,
                  phoneLocal: `0${phone.slice(3)}`,
                  externalReference,
                  customerName: app.full_name.split(/\s+/)[0] ?? "Applicant",
                  callbackUrl: `${new URL(request.url).origin}/api/public/payhero/callback`,
                });
              } catch {
                await db.from("payments").update({ status: "failed", result_desc: "Could not reach PayHero" }).eq("id", payment.id);
                return json({ ok: false, error: "We could not reach the payment provider. Please try again." }, 502);
              }
              if (!result.ok) {
                const message = String(result.body["error_message"] ?? result.body["message"] ?? result.body["error"] ?? `PayHero error ${result.status}`).slice(0, 500);
                await db.from("payments").update({ status: "failed", result_desc: message }).eq("id", payment.id);
                return json({ ok: false, error: "The payment request was not accepted. Check the number and try again." }, 502);
              }
              await db.from("payments").update({ status: "queued", provider_reference: typeof result.body["reference"] === "string" ? result.body["reference"] : null, checkout_request_id: typeof result.body["CheckoutRequestID"] === "string" ? result.body["CheckoutRequestID"] : null, result_desc: "M-Pesa prompt sent" }).eq("id", payment.id);
              await db.from("applications").update({ payment_status: "pending" }).eq("id", app.id);
              return json({ ok: true });
            }
            case "contact": {
              const ip = b.callerIp || clientIp(request.headers);
              if (!(await rateLimit(`contact:${ip}`, 5, 3600))) return json({ ok: false, error: "Too many messages. Please try again later." }, 429);
              const { error } = await db.from("contact_messages").insert({ name: b.name, email: b.email.toLowerCase(), phone: b.phone || null, message: b.message });
              if (error) return json({ ok: false, error: "Could not send your message. Please try again." }, 500);
              return json({ ok: true });
            }
            case "request_document_uploads": {
              const { data: app } = await db.from("applications").select("id, applicant_token_hash").eq("reference", b.reference).maybeSingle();
              if (!app || !safeEqual(await sha256Hex(b.token), app.applicant_token_hash)) return json({ ok: false, error: "We could not verify this application." }, 401);
              const { count } = await db.from("application_documents").select("id", { count: "exact", head: true }).eq("application_id", app.id);
              if ((count ?? 0) + b.files.length > MAX_DOCS) return json({ ok: false, error: `You can upload up to ${MAX_DOCS} documents.` }, 400);
              const uploads: { documentId: string; path: string; token: string }[] = [];
              for (const file of b.files) {
                const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
                const path = `${app.id}/${crypto.randomUUID()}.${ext}`;
                const { data: signed, error } = await db.storage.from("application-documents").createSignedUploadUrl(path);
                if (error || !signed) return json({ ok: false, error: "Could not prepare the upload. Please try again." }, 500);
                const { data: doc, error: docError } = await db.from("application_documents").insert({ application_id: app.id, storage_path: path, file_name: file.name.replace(/[^\w.\- ]/g, "_"), mime_type: file.type, size_bytes: file.size }).select("id").single();
                if (docError || !doc) return json({ ok: false, error: "Could not save the document record. Please try again." }, 500);
                uploads.push({ documentId: doc.id, path, token: signed.token });
              }
              return json({ ok: true, uploads });
            }
            case "confirm_document_uploads": {
              const { data: app } = await db.from("applications").select("id, applicant_token_hash").eq("reference", b.reference).maybeSingle();
              if (!app || !safeEqual(await sha256Hex(b.token), app.applicant_token_hash)) return json({ ok: false, error: "We could not verify this application." }, 401);
              const { data: docs } = await db.from("application_documents").select("id, storage_path").eq("application_id", app.id).in("id", b.documentIds);
              for (const doc of docs ?? []) {
                const parts = doc.storage_path.split("/");
                const folder = parts[0];
                const name = parts[1];
                if (!folder || !name) continue;
                const { data: listed } = await db.storage.from("application-documents").list(folder, { search: name });
                if (listed?.some((item) => item.name === name)) await db.from("application_documents").update({ uploaded: true }).eq("id", doc.id);
                else await db.from("application_documents").delete().eq("id", doc.id);
              }
              return json({ ok: true });
            }
            case "payhero_callback": {
              const { processPayheroCallback } = await import("@/lib/server/payhero.server");
              return json(await processPayheroCallback(b.payload));
            }
            case "send_email": {
              const { sendAndLog } = await import("@/lib/server/email.server");
              const result = await sendAndLog({ to: b.to, subject: b.subject, body: b.body, category: b.category, ...(b.applicationId ? { applicationId: b.applicationId } : {}), ...(b.sentBy ? { sentBy: b.sentBy } : {}), ...(b.batchId ? { batchId: b.batchId } : {}) });
              return json(result);
            }
            case "send_template": {
              const { sendTemplateToApplication } = await import("@/lib/server/email.server");
              return json(await sendTemplateToApplication(b.slug, b.applicationId, b.extra, b.sentBy, b.category));
            }
          }
        } catch (error) {
          console.error("Bridge request failed", b.action, error instanceof Error ? error.message : "unknown error");
          return json({ error: "The primary site could not complete this request. Please try again." }, 500);
        }
      },
    },
  },
});
