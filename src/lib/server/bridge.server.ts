// The published Lovable site holds the database keys. The preview host (lovableproject.com) blocks outside callers.
const DEFAULT_PRIMARY_BRIDGE_URL = "https://steve-safari-northbound.lovable.app/api/public/bridge";

async function resolveBridgeUrl(): Promise<string> {
  const override = process.env["STEVE_SAFARI_BRIDGE_URL"];
  if (!override) return DEFAULT_PRIMARY_BRIDGE_URL;
  try {
    const target = new URL(override);
    // Never call ourselves (e.g. the Vercel domain) or the access-protected preview host.
    if (target.hostname.endsWith("lovableproject.com")) return DEFAULT_PRIMARY_BRIDGE_URL;
    const { getRequest } = await import("@tanstack/react-start/server");
    const ownHost = new URL(getRequest().url).hostname;
    if (target.hostname === ownHost) return DEFAULT_PRIMARY_BRIDGE_URL;
    return override;
  } catch {
    return DEFAULT_PRIMARY_BRIDGE_URL;
  }
}

export function hasServiceKey(): boolean {
  return Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SECRET_KEY"]);
}

export async function callPrimaryBridge<T>(body: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Promise<T> {
  const key = process.env["HL_SERVER_KEY"] || process.env["STEVE_SAFARI_BRIDGE_KEY"];
  if (!key) throw new Error("The server bridge key is missing. Add HL_SERVER_KEY to the external site's server environment.");

  const url = await resolveBridgeUrl();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Key": key, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      result !== null && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : `The primary site could not complete the request (${response.status}).`;
    throw new Error(message);
  }
  return result as T;
}

/** Runs a named admin server function on the primary host, forwarding the signed-in staff member's session. */
export async function forwardServerFn(fn: string, data: unknown): Promise<unknown> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const auth = getRequest().headers.get("authorization");
  const result = await callPrimaryBridge<{ result?: unknown }>({ action: "server_fn", fn, data: data ?? null }, auth ? { Authorization: auth } : {});
  return result.result;
}
