import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string };

async function assertSuper(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (!data) throw new Error("Only a Super Admin can do this.");
}
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_admin", { _user_id: ctx.userId });
  if (!data) throw new Error("You do not have permission to do this.");
}

// ---------- Team (public read) ----------
export const getTeam = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient } = await import("@/lib/server/public-client.server");
  const { data, error } = await getPublicClient()
    .from("team_members")
    .select("id, full_name, role_title, bio, photo_url, sort_order")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error("Could not load the team");
  return data ?? [];
});

// ---------- Sample data ----------
export const getDemoCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { count } = await context.supabase.from("applications").select("id", { count: "exact", head: true }).eq("is_demo", true);
    return { count: count ?? 0 };
  });

export const removeDemoMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const { error, count } = await db.from("applications").delete({ count: "exact" }).eq("is_demo", true);
    if (error) throw new Error(error.message);
    await context.supabase.rpc("log_admin_activity", { _action: "demo.removed", _target_type: "applications", _target_id: "demo", _details: { count } as never });
    return { removed: count ?? 0 };
  });

// ---------- Server bridge keys ----------
export const listBridgeKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    const { data } = await db.from("bridge_keys").select("id, label, key_prefix, created_at, last_used_at, revoked_at").order("created_at", { ascending: false });
    return data ?? [];
  });

export const createBridgeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ label: z.string().trim().min(2).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { randomToken, sha256Hex } = await import("@/lib/server/crypto.server");
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const key = `ssb_${randomToken(32)}`;
    const db = await getAdminClient();
    const { error } = await db.from("bridge_keys").insert({ label: data.label, key_prefix: key.slice(0, 12), key_hash: await sha256Hex(key), created_by: context.userId });
    if (error) throw new Error(error.message);
    await context.supabase.rpc("log_admin_activity", { _action: "bridge.created", _target_type: "bridge_key", _target_id: key.slice(0, 12), _details: {} as never });
    return { key };
  });

export const revokeBridgeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { getAdminClient } = await import("@/lib/server/admin-client.server");
    const db = await getAdminClient();
    await db.from("bridge_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });
