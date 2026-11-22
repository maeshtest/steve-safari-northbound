import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { mergeContent } from "@/lib/site-content";

export const getSiteContent = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient } = await import("@/lib/server/public-client.server");
  const { data, error } = await getPublicClient().from("site_content").select("key, value");
  if (error) throw new Error("Could not load site content");
  return mergeContent(data ?? []);
});

const listSchema = z.object({ list: z.enum(["members", "sponsorship", "flight", "alumni"]) });

export const getDirectory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("@/lib/server/public-client.server");
    const { data: rows, error } = await getPublicClient().rpc("public_directory", { _list: data.list });
    if (error) throw new Error("Could not load the list");
    return rows ?? [];
  });

export const getDirectoryCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient } = await import("@/lib/server/public-client.server");
  const { data, error } = await getPublicClient().rpc("public_directory_counts");
  if (error) throw new Error("Could not load counts");
  return (data ?? { members: 0, sponsorship: 0, flight: 0, alumni: 0 }) as Record<"members" | "sponsorship" | "flight" | "alumni", number>;
});

export const getPublishedTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient } = await import("@/lib/server/public-client.server");
  const { data, error } = await getPublicClient()
    .from("testimonials")
    .select("id, name, location, role_title, quote, photo_url, featured")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load testimonials");
  return data ?? [];
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
