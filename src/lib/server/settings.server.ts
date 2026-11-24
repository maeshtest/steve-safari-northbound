import { getAdminClient } from "./admin-client.server";
import { decryptJson, encryptJson } from "./crypto.server";

export type PayheroPublic = { channel_id?: string };
export type PayheroSecret = { api_token: string };
export type EmailProvider = "resend" | "sendgrid" | "brevo";
export type EmailPublic = { provider?: EmailProvider; from_name?: string; from_email?: string; reply_to?: string };
export type EmailSecret = { api_key: string };

export async function loadSetting<P, S>(key: "payhero" | "email") {
  const db = await getAdminClient();
  const { data } = await db.from("integration_settings").select("*").eq("key", key).maybeSingle();
  const pub = (data?.public_config ?? {}) as P;
  const secret = data?.secret_ciphertext ? await decryptJson<S>(data.secret_ciphertext) : null;
  return { row: data, pub, secret };
}

export async function saveSetting(
  key: "payhero" | "email",
  pub: Record<string, unknown>,
  secret: Record<string, unknown> | null,
  userId: string,
) {
  const db = await getAdminClient();
  const update: {
    key: string;
    public_config: Record<string, unknown>;
    updated_by: string;
    updated_at: string;
    secret_ciphertext?: string;
  } = { key, public_config: pub, updated_by: userId, updated_at: new Date().toISOString() };
  if (secret) update.secret_ciphertext = await encryptJson(secret);
  const { error } = await db.from("integration_settings").upsert(update as never, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function recordTest(key: "payhero" | "email", ok: boolean, message: string) {
  const db = await getAdminClient();
  await db
    .from("integration_settings")
    .update({ last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_message: message.slice(0, 500) })
    .eq("key", key);
}

export async function getPayheroConfig() {
  const { pub, secret } = await loadSetting<PayheroPublic, PayheroSecret>("payhero");
  
  // We only need the channel_id and the single api_token now
  if (!pub.channel_id || !secret?.api_token) return null;
  
  return {
    apiToken: secret.api_token,
    channelId: pub.channel_id,
  };
}

export async function getEmailConfig() {
  const { pub, secret } = await loadSetting<EmailPublic, EmailSecret>("email");
  if (!pub.provider || !pub.from_email || !secret?.api_key) return null;
  return {
    provider: pub.provider,
    fromName: pub.from_name || "Steve Safari",
    fromEmail: pub.from_email,
    replyTo: pub.reply_to || null,
    apiKey: secret.api_key,
  };
}
