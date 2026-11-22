export async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Returns true when the action is allowed, false when the limit is reached. */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const db = await getAdminClient();
  const { data, error } = await db.rpc("hit_rate_limit", { _key: key, _max: max, _window_seconds: windowSeconds });
  if (error) {
    console.error("rate limit error", error.message);
    return true;
  }
  return data === true;
}
