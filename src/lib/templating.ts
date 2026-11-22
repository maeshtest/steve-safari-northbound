/** Replaces {{placeholders}} with values; unknown placeholders become empty strings. */
export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => vars[key] ?? "");
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export const TEMPLATE_PLACEHOLDERS = ["first_name", "full_name", "reference", "stage", "message", "receipt"] as const;
