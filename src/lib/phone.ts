/** Phone number rules for students, guardians and teachers.
 * Bangladeshi mobiles: 11 digits starting with 013 to 019 (e.g. 01712345678). +880 / 880 in
 * front is accepted and dropped. Overseas numbers must start with + and the country code.
 * Spaces, dashes, dots and brackets are ignored. */
export const PHONE_PLACEHOLDER = "01XXXXXXXXX";
export const PHONE_HINT = "11 digits starting with 01. Overseas: start with + and country code.";
export const PHONE_ERROR =
  "Enter a valid mobile number: 11 digits starting with 01 (e.g. 01712345678), or an overseas number starting with + and the country code.";

/** Returns the cleaned number, or null when it is not valid. */
export function cleanPhone(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").replace(/[\s\-().]/g, "");
  if (!s) return null;
  const bd = s.replace(/^(\+?880)(?=1)/, "0");
  if (/^01[3-9]\d{8}$/.test(bd)) return bd;
  if (/^\+(?!880)[1-9]\d{6,14}$/.test(s)) return s;
  return null;
}

/** For a form field: empty is allowed unless required; otherwise it must be valid. */
export function checkPhone(raw: string | null | undefined, required = false): { value: string | null } | { error: string } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return required ? { error: "Enter the mobile number." } : { value: null };
  const v = cleanPhone(trimmed);
  return v ? { value: v } : { error: PHONE_ERROR };
}
