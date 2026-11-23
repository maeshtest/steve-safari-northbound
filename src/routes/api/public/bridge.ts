import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Key",
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("health") }),
  z.object({ action: z.literal("directory"), list: z.enum(["members", "sponsorship", "flight", "alumni"]) }),
  z.object({ action: z.literal("directory_counts") }),
  z.object({ action: z.literal("team") }),
  z.object({ action: z.literal("testimonials") }),
  z.object({ action: z.literal("site_content") }),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

/** Server bridge: lets an externally hosted copy of the site (e.g. on Vercel) read public data through this backend with a generated key. */
export const Route = createFileRoute("/api/public/bridge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const key = request.headers.get("x-bridge-key") ?? "";
        if (!key.startsWith("ssb_") || key.length > 200) return json({ error: "Unauthorized" }, 401);
        const { sha256Hex } = await import("@/lib/server/crypto.server");
        const { getAdminClient } = await import("@/lib/server/admin-client.server");
        const db = await getAdminClient();
        const { data: row } = await db.from("bridge_keys").select("id, revoked_at").eq("key_hash", await sha256Hex(key)).maybeSingle();
        if (!row || row.revoked_at) return json({ error: "Unauthorized" }, 401);
        await db.from("bridge_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid request" }, 400);
        const b = parsed.data;
        switch (b.action) {
          case "health":
            return json({ ok: true });
          case "directory":
            return json({ data: (await db.rpc("public_directory", { _list: b.list })).data ?? [] });
          case "directory_counts":
            return json({ data: (await db.rpc("public_directory_counts")).data });
          case "team":
            return json({ data: (await db.from("team_members").select("full_name, role_title, bio, photo_url, sort_order").eq("is_visible", true).order("sort_order")).data ?? [] });
          case "testimonials":
            return json({ data: (await db.from("testimonials").select("name, location, role_title, quote, photo_url, featured").eq("published", true).eq("consent_confirmed", true)).data ?? [] });
          case "site_content":
            return json({ data: (await db.from("site_content").select("key, value")).data ?? [] });
        }
      },
    },
  },
});
