// Default copy used until (or if) an administrator edits it in the dashboard.
export type HomeContent = { eyebrow: string; headline: string; subheadline: string; cta_label: string; hero_image: string };
export type AboutContent = { title: string; intro: string; body: string; mission: string; image: string };
export type ContactContent = { phone: string; email: string; whatsapp: string; address: string; hours: string };
export type SocialContent = { facebook: string; instagram: string; x: string; tiktok: string; youtube: string; linkedin: string };
export type ProgrammeItem = { title: string; description: string };
export type SiteContent = {
  home: HomeContent;
  about: AboutContent;
  contact: ContactContent;
  social: SocialContent;
  programmes: { items: ProgrammeItem[] };
};

export const DEFAULT_CONTENT: SiteContent = {
  home: {
    eyebrow: "Sponsored work travel · Kenya to Canada",
    headline: "Your journey to working in Canada starts with one honest step.",
    subheadline:
      "Steve Safari connects committed Kenyan applicants with sponsored work opportunities in Canada, with clear stages, transparent records and one fixed registration fee of KES 500.",
    cta_label: "Register for KES 500",
    hero_image: "",
  },
  about: {
    title: "About Steve Safari",
    intro:
      "Steve Safari is a Kenyan programme that guides applicants through every step of pursuing sponsored employment in Canada.",
    body: "",
    mission: "To give hard-working Kenyans a clear, honest and well-guided path to sponsored work in Canada.",
    image: "",
  },
  contact: { phone: "", email: "", whatsapp: "", address: "Nairobi, Kenya", hours: "" },
  social: { facebook: "", instagram: "", x: "", tiktok: "", youtube: "", linkedin: "" },
  programmes: { items: [] },
};

export function mergeContent(rows: { key: string; value: unknown }[]): SiteContent {
  const out = structuredClone(DEFAULT_CONTENT) as Record<string, Record<string, unknown>>;
  for (const row of rows) {
    if (row.key in out && row.value && typeof row.value === "object") {
      out[row.key] = { ...out[row.key], ...(row.value as Record<string, unknown>) };
    }
  }
  return out as unknown as SiteContent;
}
