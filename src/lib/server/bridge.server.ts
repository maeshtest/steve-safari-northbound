const DEFAULT_PRIMARY_BRIDGE_URL = "https://68c9ac80-9ca4-43ae-9e15-c5b2e683e078.lovableproject.com/api/public/bridge";

export function hasServiceKey(): boolean {
  return Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SECRET_KEY"]);
}

export async function callPrimaryBridge<T>(body: Record<string, unknown>): Promise<T> {
  const key = process.env["HL_SERVER_KEY"] || process.env["STEVE_SAFARI_BRIDGE_KEY"];
  if (!key) throw new Error("The server bridge key is missing. Add HL_SERVER_KEY to the external site's server environment.");

  const url = process.env["STEVE_SAFARI_BRIDGE_URL"] || DEFAULT_PRIMARY_BRIDGE_URL;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Key": key },
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