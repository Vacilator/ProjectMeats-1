export const extractDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * Normalize a phone input to a digits-only 10-digit US number.
 *
 * Note: We intentionally keep this US-centric (10 digits) because
 * the UI formatting uses (XXX)XXX-XXXX.
 */
export const normalizeUsPhone = (value: string): string => extractDigits(value).slice(0, 10);

/**
 * Format a US-style 10-digit phone number as (XXX)XXX-XXXX.
 * - Accepts any input (digits or already-formatted)
 * - Returns a progressively formatted string as digits are entered
 */
export const formatUsPhone = (value: string): string => {
  const digits = normalizeUsPhone(value);
  if (!digits) return '';

  if (digits.length <= 3) {
    return digits.length === 3 ? `(${digits})` : `(${digits}`;
  }

  const area = digits.slice(0, 3);
  const rest = digits.slice(3);

  if (rest.length <= 3) {
    return `(${area})${rest}`;
  }

  return `(${area})${rest.slice(0, 3)}-${rest.slice(3)}`;
};
