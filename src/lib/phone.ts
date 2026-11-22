/**
 * Normalises a Kenyan mobile number to the 2547XXXXXXXX / 2541XXXXXXXX form.
 * Returns null when the number is not a valid Safaricom-style mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local: string | null = null;
  if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^[17]\d{8}$/.test(digits)) local = digits;
  return local ? `254${local}` : null;
}

/** 2547XXXXXXXX -> 07XXXXXXXX (format PayHero accepts). */
export function toLocalPhone(normalized: string): string {
  return `0${normalized.slice(3)}`;
}

export function maskPhone(normalized: string): string {
  const local = toLocalPhone(normalized);
  return `${local.slice(0, 4)}***${local.slice(-3)}`;
}
