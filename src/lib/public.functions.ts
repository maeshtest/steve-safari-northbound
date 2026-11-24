import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { mergeContent } from "@/lib/site-content";

export const getSiteContent = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, resilientPublicRead } = await import("@/lib/server/public-client.server");
  const rows = await resilientPublicRead<{ key: string; value: unknown }[]>(
    "site_content",
    async () => {
      const { data, error } = await getPublicClient().from("site_content").select("key, value");
      if (error) throw error;
      return data ?? [];
    },
    { action: "site_content" },
    [],
  );
  return mergeContent(rows as never);
});

const listSchema = z.object({ list: z.enum(["members", "sponsorship", "flight", "alumni"]) });
type DirectoryRow = { display_name: string; county: string; listed_since: string };
type Counts = Record<"members" | "sponsorship" | "flight" | "alumni", number>;

export const getDirectory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    const { getPublicClient, resilientPublicRead } = await import("@/lib/server/public-client.server");
    return resilientPublicRead<DirectoryRow[]>(
      `directory:${data.list}`,
      async () => {
        const { data: rows, error } = await getPublicClient().rpc("public_directory", { _list: data.list });
        if (error) throw error;
        return (rows ?? []) as DirectoryRow[];
      },
      { action: "directory", list: data.list },
      [],
    );
  });

export const getDirectoryCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, resilientPublicRead } = await import("@/lib/server/public-client.server");
  return resilientPublicRead<Counts>(
    "directory_counts",
    async () => {
      const { data, error } = await getPublicClient().rpc("public_directory_counts");
      if (error) throw error;
      return (data ?? { members: 0, sponsorship: 0, flight: 0, alumni: 0 }) as Counts;
    },
    { action: "directory_counts" },
    { members: 0, sponsorship: 0, flight: 0, alumni: 0 },
  );
});

type Testimonial = { id: string; name: string; location: string | null; role_title: string | null; quote: string; photo_url: string | null; featured: boolean };

export const getPublishedTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, resilientPublicRead } = await import("@/lib/server/public-client.server");
  return resilientPublicRead<Testimonial[]>(
    "testimonials",
    async () => {
      const { data, error } = await getPublicClient()
        .from("testimonials")
        .select("id, name, location, role_title, quote, photo_url, featured")
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    { action: "testimonials" },
    [],
  );
});

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(3000),
});

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const { hasServiceKey, callPrimaryBridge } = await import("@/lib/server/bridge.server");
    if (!hasServiceKey()) {
      const headers = getRequest().headers;
      const callerIp = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown";
      return callPrimaryBridge<{ ok: boolean; error?: string }>({ action: "contact", ...data, callerIp });
    }
    const { getAdminClient, rateLimit, clientIp } = await import("@/lib/server/admin-client.server");
    const ip = clientIp(getRequest().headers);
    if (!(await rateLimit(`contact:${ip}`, 5, 3600))) {
      return { ok: false as const, error: "Too many messages. Please try again later." };
    }
    const db = await getAdminClient();
    const { error } = await db.from("contact_messages").insert({ name: data.name, email: data.email, phone: data.phone || null, message: data.message });
    if (error) return { ok: false as const, error: "Could not send your message. Please try again." };
    return { ok: true as const };
  });
