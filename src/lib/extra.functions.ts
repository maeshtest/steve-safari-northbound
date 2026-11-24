import { createServerFn } from "@tanstack/react-start";
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
  const { getPublicClient, resilientPublicRead } = await import("@/lib/server/public-client.server");
  type TeamRow = { id: string; full_name: string; role_title: string; bio: string | null; photo_url: string | null; sort_order: number };
  return resilientPublicRead<TeamRow[]>(
    "team",
    async () => {
      const { data, error } = await getPublicClient()
        .from("team_members")
        .select("id, full_name, role_title, bio, photo_url, sort_order")
        .eq("is_visible", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TeamRow[];
    },
    { action: "team" },
    [],
  );
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
    
    // Guard: Admin client won't work on Vercel
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"] && !process.env["SUPABASE_SECRET_KEY"]) {
      throw new Error("Admin operations must be performed on the primary dashboard, not Vercel.");
    }

    const db = await getAdminClient();
    const { error, count } = await db.from("applications").delete({ count: "exact" }).eq("is_demo", true);
    if (error) throw new Error(error.message);
    await context.supabase.rpc("log_admin_activity", { _action: "demo.removed", _target_type: "applications", _target_id: "demo", _details: { count } as never });
    return { removed: count ?? 0 };
  });

// ---------- Server bridge keys ----------
export const createBridgeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    
    // On Vercel, this will fail cleanly because Vercel doesn't have the Service Role.
    // But Lovable will generate it perfectly using this secure RPC.
    const { data, error } = await context.supabase.rpc("admin_generate_server_key");
    
    if (error) {
      if (error.message.includes("Only a Super Admin")) {
         throw new Error("You must be a Super Admin to generate this key.");
      }
      throw new Error(error.message);
    }
    
    return { key: data };
  });
