import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAGE_EMAIL_TEMPLATE, STAGE_ORDER, type AppRole } from "@/lib/constants";
import { firstName, renderTemplate } from "@/lib/templating";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertRole(ctx: Ctx, level: "staff" | "admin" | "super_admin") {
  const fn = level === "staff" ? "is_staff" : "is_admin";
  if (level === "super_admin") {
    const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
    if (!data) throw new Error("Only a Super Admin can do this.");
    return;
  }
  const { data } = await ctx.supabase.rpc(fn, { _user_id: ctx.userId });
  if (!data) throw new Error("You do not have permission to do this.");
}

async function logActivity(ctx: Ctx, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await ctx.supabase.rpc("log_admin_activity", { _action: action, _target_type: targetType, _target_id: targetId, _details: details as never });
}

/** Idempotent: creates the initial Super Admin from the deployment secret if no Super Admin exists yet. */
export const ensureInitialAdmin = createServerFn({ method: "POST" }).handler(async () => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("ensureInitialAdmin", undefined) as never; }
  const { getAdminClient } = await import("@/lib/server/admin-client.server");
  const db = await getAdminClient();
  const { count } = await db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  if ((count ?? 0) > 0) return { ok: true };
  const password = process.env["INITIAL_ADMIN_PASSWORD"];
  if (!password) return { ok: false };
  const email = "dereknash@usa.com";
  let userId: string | null = null;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data.user) userId = created.data.user.id;
  else {
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
      userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (!data.users.length) break;
    }
  }
  if (!userId) return { ok: false };
  await db.from("profiles").upsert({ id: userId, email, full_name: "Super Admin", active: true, must_change_password: true });
  await db.from("user_roles").upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });
  await db.from("admin_activity_logs").insert({ action: "admin.bootstrap", target_type: "user", target_id: userId, actor_email: "system" });
  return { ok: true };
});

export const getMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    return {
      userId: context.userId,
      email: profile?.email ?? (context.claims as { email?: string }).email ?? "",
      fullName: profile?.full_name ?? null,
      active: profile?.active ?? false,
      mustChangePassword: profile?.must_change_password ?? false,
      roles: (profile?.active ? (roles ?? []).map((r) => r.role) : []) as AppRole[],
    };
  });

export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("completePasswordChange", undefined) as never; }
    await assertRole(context, "staff");
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    await db.from("profiles").update({ must_change_password: false }).eq("id", context.userId);
    await logActivity(context, "account.password_changed", "user", context.userId);
    return { ok: true };
  });

export const changeStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationIds: z.array(z.string().uuid()).min(1).max(500),
        stage: z.enum(STAGE_ORDER as [string, ...string[]]),
        note: z.string().max(2000).optional(),
        notify: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context, "admin");
    const { sendTemplateToApplication } = await import("@/lib/server/email.server");
    const stage = data.stage as (typeof STAGE_ORDER)[number];
    let changed = 0;
    const emailResults: Record<string, number> = { sent: 0, failed: 0, not_configured: 0 };
    for (const id of data.applicationIds) {
      const { error } = await context.supabase.rpc("change_application_stage", { _application_id: id, _to_stage: stage, _note: data.note ?? "" });
      if (error) continue;
      changed++;
      const slug = STAGE_EMAIL_TEMPLATE[stage];
      if (data.notify && slug) {
        const r = await sendTemplateToApplication(slug, id, { message: data.note ?? "" }, context.userId);
        emailResults[r.status] = (emailResults[r.status] ?? 0) + 1;
      }
    }
    return { changed, emailResults };
  });

export const requestMoreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid(), message: z.string().trim().min(5).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, "admin");
    const { error } = await context.supabase
      .from("applications")
      .update({ info_requested: data.message, info_requested_at: new Date().toISOString() })
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    await logActivity(context, "application.info_requested", "application", data.applicationId, { message: data.message });
    const { sendTemplateToApplication } = await import("@/lib/server/email.server");
    const r = await sendTemplateToApplication("info_requested", data.applicationId, { message: data.message }, context.userId);
    return { emailStatus: r.status };
  });

/** Records (or clears) the required Zoom meeting; approval is blocked by the database until it is recorded. */
export const setZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid(), completed: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, "admin");
    const value = data.completed ? new Date().toISOString() : null;
    const { error } = await context.supabase.from("applications").update({ zoom_meeting_completed_at: value }).eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    await logActivity(context, data.completed ? "application.zoom_completed" : "application.zoom_cleared", "application", data.applicationId);
    return { zoomMeetingCompletedAt: value };
  });

export const clearInfoRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, "admin");
    await context.supabase.from("applications").update({ info_requested: null, info_requested_at: null }).eq("id", data.applicationId);
    await logActivity(context, "application.info_request_cleared", "application", data.applicationId);
    return { ok: true };
  });

export const recheckPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, "admin");
    const { verifyPayment } = await import("@/lib/server/payhero.server");
    const r = await verifyPayment(data.paymentId);
    await logActivity(context, "payment.rechecked", "payment", data.paymentId, { result: r.status });
    return r;
  });

// ---------- Email ----------
const sendSchema = z.object({
  mode: z.enum(["applications", "stages", "manual"]),
  applicationIds: z.array(z.string().uuid()).max(2000).optional(),
  stages: z.array(z.enum(STAGE_ORDER as [string, ...string[]])).optional(),
  paidOnly: z.boolean().optional(),
  manualEmail: z.string().email().optional(),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(20000),
});

export const sendEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, "admin");
    const { sendAndLog } = await import("@/lib/server/email.server");
    const batchId = crypto.randomUUID();
    type Recipient = { id: string | null; email: string; full_name: string; reference: string; stage: string };
    let recipients: Recipient[] = [];
    if (data.mode === "manual") {
      if (!data.manualEmail) throw new Error("Enter an email address");
      recipients = [{ id: null, email: data.manualEmail, full_name: "", reference: "", stage: "" }];
    } else {
      let q = context.supabase.from("applications").select("id, email, full_name, reference, stage");
      if (data.mode === "applications") q = q.in("id", data.applicationIds ?? []);
      else q = q.in("stage", (data.stages ?? []) as (typeof STAGE_ORDER)[number][]);
      if (data.paidOnly) q = q.eq("payment_status", "paid");
      const { data: rows, error } = await q.limit(2000);
      if (error) throw new Error(error.message);
      recipients = rows ?? [];
    }
    if (recipients.length === 0) throw new Error("No recipients match your selection.");
    const results = { sent: 0, failed: 0, not_configured: 0 };
    for (const r of recipients) {
      const vars = { first_name: r.full_name ? firstName(r.full_name) : "there", full_name: r.full_name, reference: r.reference, stage: r.stage, message: "", receipt: "" };
      const out = await sendAndLog({
        to: r.email,
        subject: renderTemplate(data.subject, vars),
        body: renderTemplate(data.body, vars),
        category: recipients.length > 1 ? "bulk" : "individual",
        applicationId: r.id,
        sentBy: context.userId,
        batchId,
      });
      results[out.status]++;
    }
    await logActivity(context, "email.sent", "email_batch", batchId, { recipients: recipients.length, ...results });
    return { total: recipients.length, ...results };
  });

// ---------- Integrations ----------
export const getIntegrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("getIntegrationStatus", undefined) as never; }
    await assertRole(context, "admin");
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const { data } = await db.from("integration_settings").select("key, public_config, secret_ciphertext, last_test_at, last_test_ok, last_test_message, updated_at");
    const pick = (key: string) => {
      const row = data?.find((r) => r.key === key);
      return {
        publicConfig: (row?.public_config ?? {}) as Record<string, string>,
        hasSecret: Boolean(row?.secret_ciphertext),
        lastTestAt: row?.last_test_at ?? null,
        lastTestOk: row?.last_test_ok ?? null,
        lastTestMessage: row?.last_test_message ?? null,
        updatedAt: row?.updated_at ?? null,
      };
    };
    const payhero = pick("payhero");
    const email = pick("email");
    return {
      payhero: { ...payhero, configured: Boolean(payhero.publicConfig["channel_id"] && payhero.hasSecret) },
      email: { ...email, configured: Boolean(email.publicConfig["provider"] && email.publicConfig["from_email"] && email.hasSecret) },
      defaultCallbackUrl: `${new URL(getRequest().url).origin}/api/public/payhero/callback`,
    };
  });

export const savePayhero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        api_token: z.string().max(500).optional(),
        channel_id: z.string().trim().regex(/^\d+$/, "Channel ID must be a number"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("savePayhero", data) as never; }
    await assertRole(context, "super_admin");
    const { saveSetting, loadSetting } = await import("@/lib/server/settings.server");
    const existing = await loadSetting<Record<string, string>, { api_token: string }>("payhero");
    if (!data.api_token && !existing?.secret?.api_token) throw new Error("Enter the API Token");
    
    await saveSetting(
      "payhero",
      { channel_id: data.channel_id },
      data.api_token ? { api_token: data.api_token } : null,
      context.userId,
    );
    await logActivity(context, "settings.payhero_updated", "integration", "payhero", { token_changed: Boolean(data.api_token) });
    return { ok: true };
  });

export const testPayhero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("testPayhero", undefined) as never; }
    await assertRole(context, "admin");
    const { getPayheroConfig, recordTest } = await import("@/lib/server/settings.server");
    const { payheroTestConnection } = await import("@/lib/server/payhero.server");
    const cfg = await getPayheroConfig();
    if (!cfg) return { ok: false, message: "PayHero is not configured yet." };
    const r = await payheroTestConnection(cfg);
    await recordTest("payhero", r.ok, r.message);
    return r;
  });

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.enum(["resend", "sendgrid", "brevo"]),
        api_key: z.string().max(500).optional(),
        from_name: z.string().trim().min(1).max(100),
        from_email: z.string().trim().email(),
        reply_to: z.string().trim().email().optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("saveEmailSettings", data) as never; }
    await assertRole(context, "super_admin");
    const { saveSetting, loadSetting } = await import("@/lib/server/settings.server");
    const existing = await loadSetting<Record<string, string>, { api_key: string }>("email");
    if (!data.api_key && !existing?.secret?.api_key) throw new Error("Enter the API key");
    await saveSetting(
      "email",
      { provider: data.provider, from_name: data.from_name, from_email: data.from_email, reply_to: data.reply_to || "" },
      data.api_key ? { api_key: data.api_key } : null,
      context.userId,
    );
    await logActivity(context, "settings.email_updated", "integration", "email", { provider: data.provider, key_changed: Boolean(data.api_key) });
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ to: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("sendTestEmail", data) as never; }
    await assertRole(context, "admin");
    const { sendAndLog } = await import("@/lib/server/email.server");
    const { recordTest } = await import("@/lib/server/settings.server");
    const r = await sendAndLog({
      to: data.to,
      subject: "Steve Safari — test email",
      body: "This is a test email from the Steve Safari admin dashboard. If you received it, email sending is working.",
      category: "test",
      sentBy: context.userId,
    });
    const ok = r.status === "sent";
    await recordTest("email", ok, ok ? `Test email sent to ${data.to}` : (r.error ?? "Failed"));
    return { ok, message: ok ? `Test email sent to ${data.to}.` : (r.error ?? "Failed to send") };
  });

// ---------- Administrators ----------
export const listAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context, "super_admin");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("*").order("created_at"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
  });

const roleEnum = z.enum(["super_admin", "admin", "editor"]);

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        fullName: z.string().trim().min(2).max(120),
        role: roleEnum,
        tempPassword: z.string().min(12, "Temporary password must be at least 12 characters").max(128),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("createAdmin", data) as never; }
    await assertRole(context, "super_admin");
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const { data: created, error } = await db.auth.admin.createUser({ email: data.email, password: data.tempPassword, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");
    await db.from("profiles").insert({ id: created.user.id, email: data.email, full_name: data.fullName, must_change_password: true });
    await db.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    await logActivity(context, "admin.created", "user", created.user.id, { email: data.email, role: data.role });
    return { ok: true };
  });

export const updateAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean().optional(), role: roleEnum.optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    { const { hasServiceKey, forwardServerFn } = await import("@/lib/server/bridge.server"); if (!hasServiceKey()) return forwardServerFn("updateAdmin", data) as never; }
    await assertRole(context, "super_admin");
    if (data.userId === context.userId && (data.active === false || (data.role && data.role !== "super_admin"))) {
      throw new Error("You cannot deactivate or demote your own account.");
    }
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    if (data.active !== undefined) {
      await db.from("profiles").update({ active: data.active }).eq("id", data.userId);
    }
    if (data.role) {
      await db.from("user_roles").delete().eq("user_id", data.userId);
      await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
    }
    await logActivity(context, data.active === false ? "admin.deactivated" : data.active ? "admin.reactivated" : "admin.role_changed", "user", data.userId, data);
    return { ok: true };
  });
