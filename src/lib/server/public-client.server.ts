import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Publishable values are safe to ship; they let an external host (e.g. Vercel) read public data
// even when its environment variables are missing.
const FALLBACK_URL = "https://ravbehslfwnqyqvbktyi.supabase.co";
const FALLBACK_KEY = "sb_publishable_tLxsTBQlJTMMza3iddEINg_QfQhoJRg";

export function getPublicClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || FALLBACK_URL;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_KEY;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Public read that never crashes a page: tries the database directly, then the primary-site bridge,
 * and finally returns the fallback so the page still renders.
 */
export async function resilientPublicRead<T>(label: string, direct: () => Promise<T>, bridgeBody: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    return await direct();
  } catch (error) {
    console.error(`Direct public read failed (${label})`, error);
  }
  try {
    const { callPrimaryBridge } = await import("@/lib/server/bridge.server");
    const result = await callPrimaryBridge<{ data?: T }>(bridgeBody);
    if (result.data !== undefined && result.data !== null) return result.data;
  } catch (error) {
    console.error(`Bridge public read failed (${label})`, error);
  }
  return fallback;
}
