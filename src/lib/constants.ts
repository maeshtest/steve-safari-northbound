import type { Database } from "@/integrations/supabase/types";

export type MemberStage = Database["public"]["Enums"]["member_stage"];
export type PaymentState = Database["public"]["Enums"]["payment_state"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/** The only fee Steve Safari charges applicants, in Kenyan shillings. */
export const REGISTRATION_FEE_KES = 500;

/** Bump when the Terms or Privacy Policy text changes; acceptances are stored with this value. */
export const POLICY_VERSION = "2026-11-v1";

export const STAGE_ORDER: MemberStage[] = [
  "registered",
  "pending_approval",
  "approved",
  "sponsorship_approved",
  "waiting_for_flight",
  "alumni",
  "rejected",
  "withdrawn",
];

export const STAGE_LABELS: Record<MemberStage, string> = {
  registered: "Registered",
  pending_approval: "Pending Approval",
  approved: "Approved",
  sponsorship_approved: "Sponsorship Approved",
  waiting_for_flight: "Waiting for Flight",
  alumni: "Programme Alumni",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STAGE_DESCRIPTIONS: Record<MemberStage, string> = {
  registered: "Your details have been received. Complete the KES 500 payment to continue.",
  pending_approval: "Payment confirmed. Our team will contact you by email or phone to book your required Zoom meeting with Steve Safari and the team before approval.",
  approved: "You are an approved member and will be considered for sponsorship.",
  sponsorship_approved: "A sponsorship has been approved for you.",
  waiting_for_flight: "You are on the flight waiting list. Travel details will follow.",
  alumni: "You have completed the programme. Welcome to the alumni.",
  rejected: "Your application was not approved at this time.",
  withdrawn: "This application has been withdrawn.",
};

/** Email template sent automatically (when the admin chooses to notify) after a stage change. */
export const STAGE_EMAIL_TEMPLATE: Partial<Record<MemberStage, string>> = {
  approved: "approved",
  rejected: "rejected",
  sponsorship_approved: "sponsorship_approved",
  waiting_for_flight: "waiting_for_flight",
  alumni: "alumni",
};

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: "Not paid",
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  editor: "Content Editor",
};

export const DIRECTORY_LISTS = {
  members: { title: "Registered Members", path: "/members" },
  sponsorship: { title: "Approved Sponsorship List", path: "/sponsorship" },
  flight: { title: "Flight Waiting List", path: "/flight-waiting-list" },
  alumni: { title: "Programme Alumni", path: "/alumni" },
} as const;
export type DirectoryList = keyof typeof DIRECTORY_LISTS;

export const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay",
  "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu",
  "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru",
  "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot", "Outside Kenya",
] as const;

export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const MAX_DOCS = 5;
