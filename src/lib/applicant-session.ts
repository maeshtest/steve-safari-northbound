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
