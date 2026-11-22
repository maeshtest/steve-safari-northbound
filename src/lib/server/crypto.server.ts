// AES-GCM encryption for integration credentials stored in the database.
const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(): Promise<CryptoKey> {
  const secret = process.env["SETTINGS_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Encryption key is not configured");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function encryptJson(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), enc.encode(JSON.stringify(value)));
  return `${toB64(iv)}:${toB64(new Uint8Array(ct))}`;
}

export async function decryptJson<T>(payload: string | null | undefined): Promise<T | null> {
  if (!payload) return null;
  const [ivB64, ctB64] = payload.split(":");
  if (!ivB64 || !ctB64) return null;
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(ivB64) as BufferSource }, await getKey(), fromB64(ctB64) as BufferSource);
  return JSON.parse(dec.decode(pt)) as T;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 24): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
