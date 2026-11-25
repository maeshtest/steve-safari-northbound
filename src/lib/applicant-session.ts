// Keeps the applicant's one-time access token for this browser tab only.
export function saveApplicantToken(reference: string, token: string) {
  sessionStorage.setItem(`ss_app_${reference}`, token);
}
export function readApplicantToken(reference: string): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(`ss_app_${reference}`);
}
export function savePhoneHint(reference: string, phone: string) {
  sessionStorage.setItem(`ss_phone_${reference}`, phone);
}
export function readPhoneHint(reference: string): string {
  return typeof window === "undefined" ? "" : (sessionStorage.getItem(`ss_phone_${reference}`) ?? "");
}

const RESUME_NATIONAL_ID_KEY = "ss_application_resume_national_id";

export function saveResumeNationalId(nationalId: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(RESUME_NATIONAL_ID_KEY, nationalId.trim());
}

export function consumeResumeNationalId(): string | null {
  if (typeof window === "undefined") return null;
  const nationalId = sessionStorage.getItem(RESUME_NATIONAL_ID_KEY);
  sessionStorage.removeItem(RESUME_NATIONAL_ID_KEY);
  return nationalId;
}
