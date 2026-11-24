
// Server-side Supabase client.
// Supports the newer Supabase Secret API key and legacy service-role key.
// NEVER import this module into browser/client-side code.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return (
    value.startsWith("sb_publishable_") ||
    value.startsWith("sb_secret_")
  );
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    // New Supabase API keys are opaque strings, not JWTs.
    // Send them through the apikey header, not as a Bearer token.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"];

  // Prefer the newer Secret API key.
  // Fall back to the legacy service-role key.
  const SUPABASE_SECRET_KEY =
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SECRET_KEY
        ? ["SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY"]
        : []),
    ];

    const message =
      `Missing Supabase server environment variable(s): ${missing.join(", ")}. ` +
      "Configure the Supabase URL and a server-side Secret API key.";

    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  // Do not accidentally use a publishable key for admin operations.
  if (SUPABASE_SECRET_KEY.startsWith("sb_publishable_")) {
    throw new Error(
      "Invalid Supabase admin credential: a publishable key cannot be used for privileged server operations. Use an sb_secret_ key."
    );
  }

  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
      global: {
        fetch: createSupabaseFetch(SUPABASE_SECRET_KEY),
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

// Lazy initialization: the client is created only when first accessed.
let _supabaseAdmin:
  | ReturnType<typeof createSupabaseAdminClient>
  | undefined;

// Server-only client.
// Import inside server handlers:
// const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createSupabaseAdminClient>,
  {
    get(_, prop, receiver) {
      if (!_supabaseAdmin) {
        _supabaseAdmin = createSupabaseAdminClient();
      }

      return Reflect.get(_supabaseAdmin, prop, receiver);
    },
  }
);
