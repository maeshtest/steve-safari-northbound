export type ApplicantIdentifier =
  | { reference: string; nationalId?: never }
  | { nationalId: string; reference?: never };

export function hasExactlyOneApplicantIdentifier(reference?: string, nationalId?: string): boolean {
  return Boolean(reference?.trim()) !== Boolean(nationalId?.trim());
}