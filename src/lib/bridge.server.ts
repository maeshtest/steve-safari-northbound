import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if the server has the master service role key (e.g., running on Lovable).
 */
export function hasServiceKey(): boolean {
  return !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}

/**
 * Returns the bridge token from environment variables.
 */
function getBridgeToken(): string {
  // You can use HL_SERVER_KEY or STEVE_SAFARI_BRIDGE_KEY
  const token = process.env.HL_SERVER_KEY || process.env.STEVE_SAFARI_BRIDGE_KEY;
  if (!token) throw new Error("Missing server bridge key (HL_SERVER_KEY)");
  return token;
}

// ── Bridge Methods ───────────────────────────────────────────────────────────

export async function readSetting(key: string): Promise<any> {
  if (hasServiceKey()) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", key).single();
    return data?.value;
  } else {
    const { data, error } = await supabase.rpc("bridge_setting", {
      _token: getBridgeToken(),
      _key: key,
    });
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function getNotificationSettings(): Promise<any | null> {
  if (hasServiceKey()) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("notification_settings").select("*").eq("id", true).maybeSingle();
    return data;
  } else {
    const { data, error } = await supabase.rpc("bridge_notification_settings", {
      _token: getBridgeToken(),
    });
    if (error) return null;
    return data;
  }
}

export async function logNotification(row: { channel: string; kind: string; target?: string | null; status: string; detail?: string | null }): Promise<void> {
  try {
    if (hasServiceKey()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notification_log").insert({
        channel: row.channel, kind: row.kind, target: row.target ?? null, status: row.status, detail: row.detail ? row.detail.slice(0, 500) : null,
      });
    } else {
      await supabase.rpc("bridge_log_notification", {
        _token: getBridgeToken(),
        _channel: row.channel,
        _kind: row.kind,
        _target: row.target ?? null,
        _status: row.status,
        _detail: row.detail ? row.detail.slice(0, 500) : null,
      });
    }
  } catch {
    // Logging must never break the main flow
  }
}

export async function logWebhook(payload: any): Promise<any> {
  if (hasServiceKey()) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin.from("webhook_logs").insert(payload);
  } else {
    const { data, error } = await supabase.rpc("bridge_log_webhook", {
      _token: getBridgeToken(),
      _payload: payload,
    });
    if (error) throw new Error(error.message);
    return data;
  }
}
