import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNotificationSettings, logNotification } from "./bridge.server";

type Settings = {
  resend_api_key: string;
  resend_from: string;
  lead_recipients: string[];
  report_recipients: string[];
  telegram_bot_token: string;
  telegram_chat_id: string;
  email_enabled: boolean;
  telegram_enabled: boolean;
  alert_on_lead: boolean;
  alert_on_failure: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendEmail(s: Settings, kind: string, to: string[], subject: string, lines: string[]): Promise<boolean> {
  const recipients = to.map((t) => t.trim()).filter((t) => t.includes("@"));
  if (!s.email_enabled || !s.resend_api_key || !s.resend_from || recipients.length === 0) return false;

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#111">
    <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
    ${lines.map((l) => `<p style="margin:4px 0">${escapeHtml(l)}</p>`).join("")}
    <p style="margin-top:18px;color:#666;font-size:12px">Sent automatically by the website.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${s.resend_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: s.resend_from, to: recipients, subject, html }),
    });
    const ok = res.ok;
    await logNotification({
      channel: "email", kind, target: recipients.join(", "), status: ok ? "sent" : "failed",
      detail: ok ? null : `${res.status} ${await res.text().catch(() => "")}`,
    });
    return ok;
  } catch (err) {
    await logNotification({ channel: "email", kind, target: recipients.join(", "), status: "failed", detail: err instanceof Error ? err.message : "Unknown error" });
    return false;
  }
}

async function sendTelegram(s: Settings, kind: string, text: string): Promise<boolean> {
  if (!s.telegram_enabled || !s.telegram_bot_token || !s.telegram_chat_id) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const ok = res.ok;
    await logNotification({ channel: "telegram", kind, target: s.telegram_chat_id, status: ok ? "sent" : "failed", detail: ok ? null : `${res.status} ${await res.text().catch(() => "")}` });
    return ok;
  } catch (err) {
    await logNotification({ channel: "telegram", kind, target: s.telegram_chat_id, status: "failed", detail: err instanceof Error ? err.message : "Unknown error" });
    return false;
  }
}

export const notifyNewLead = createServerFn({ method: "POST" })
  .validator((input: { type: string; name: string; phone: string; email?: string | null; vehicle?: string | null; source?: string | null; message?: string | null }) => input)
  .handler(async ({ data }) => {
    try {
      const s = await getNotificationSettings() as Settings | null;
      if (!s || !s.alert_on_lead) return { ok: false };

      const label = data.type.replace(/[-_]/g, " ");
      const lines = [
        `Type: ${label}`, `Name: ${data.name}`, `Phone: ${data.phone}`,
        data.email ? `Email: ${data.email}` : "", data.vehicle ? `Vehicle: ${data.vehicle.replace(/-/g, " ")}` : "",
        data.source ? `Page: ${data.source}` : "", data.message ? `Message: ${data.message}` : "",
      ].filter(Boolean);

      const emailed = await sendEmail(s, "lead", s.lead_recipients, `New ${label} enquiry from ${data.name}`, lines);
      const messaged = await sendTelegram(s, "lead", `🚗 <b>New ${escapeHtml(label)} enquiry</b>\n${lines.map(escapeHtml).join("\n")}`);
      return { ok: emailed || messaged };
    } catch {
      return { ok: false };
    }
  });

export const sendTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { channel: "email" | "telegram" }) => input)
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("get_my_staff_role");
    if (role !== "super_admin") throw new Error("Only a Super Admin can send test alerts");

    const s = await getNotificationSettings() as Settings | null;
    if (!s) throw new Error("Alert settings are not available");

    if (data.channel === "email") {
      const to = s.report_recipients.length > 0 ? s.report_recipients : s.lead_recipients;
      if (!s.email_enabled) throw new Error("Email alerts are switched off");
      if (!s.resend_api_key) throw new Error("Add your Resend key first");
      if (!s.resend_from) throw new Error("Add the sender address first");
      if (to.length === 0) throw new Error("Add at least one recipient first");

      const ok = await sendEmail(s, "test", to, "Test alert", ["This is a test alert.", "If you can read this, email alerts are working."]);
      if (!ok) throw new Error("Resend did not accept the message. Check the key and sender address.");
      return { ok: true };
    }

    if (!s.telegram_enabled) throw new Error("Telegram alerts are switched off");
    if (!s.telegram_bot_token || !s.telegram_chat_id) throw new Error("Add the bot token and chat ID first");

    const ok = await sendTelegram(s, "test", "✅ <b>Test alert</b>\nTelegram alerts are working.");
    if (!ok) throw new Error("Telegram did not accept the message. Check the bot token and chat ID.");
    return { ok: true };
  });
