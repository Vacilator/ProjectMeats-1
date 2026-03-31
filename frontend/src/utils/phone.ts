export const extractDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * Format a US-style 10-digit phone number as (XXX)XXX-XXXX.
 * - Accepts any input (digits or already-formatted)
 * - Returns a progressively formatted string as digits are entered
 */
export const formatUsPhone = (value: string): string => {
  const digits = extractDigits(value).slice(0, 10);
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
