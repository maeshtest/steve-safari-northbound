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
  const token = process.env.HL_SERVER_KEY || process.env.STEVE_SAFARI_BRIDGE_KEY;
  if (!token) throw new Error("Missing server bridge key (HL_SERVER_KEY)");
  return token;
}

/**
 * Reads a secure setting (like Resend API keys or PayHero passwords).
 */
export async function readSetting(key: string): Promise<any> {
  if (hasServiceKey()) {
    // Branch A: Direct Admin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", key).single();
    return data?.value;
  } else {
    // Branch B: Bridge RPC
    const { data, error } = await supabase.rpc("bridge_setting", {
      _token: getBridgeToken(),
      _key: key,
    });
    if (error) throw new Error(error.message);
    return data;
  }
}

/**
 * Applies a payment result (credit wallet, update transaction).
 * (You will need to create the bridge_apply_payment RPC in SQL for this to work)
 */
export async function applyPaymentResult(payload: any): Promise<any> {
  if (hasServiceKey()) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Call the direct database function
    return supabaseAdmin.rpc("payment_apply_result", payload);
  } else {
    const { data, error } = await supabase.rpc("bridge_apply_payment", {
      _token: getBridgeToken(),
      _payload: payload,
    });
    if (error) throw new Error(error.message);
    return data;
  }
}

/**
 * Logs a webhook event.
 */
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
