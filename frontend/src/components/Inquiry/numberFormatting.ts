export const coerceFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const formatCurrencyValue = (value: unknown): string => {
  const numericValue = coerceFiniteNumber(value);
  if (numericValue === null) {
    return '-';
  }

  return `$${numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatFixedWithFallback = (value: unknown, fractionDigits: number): string => {
  const numericValue = coerceFiniteNumber(value) ?? 0;
  return numericValue.toFixed(fractionDigits);
};

export const formatIntegerValue = (value: unknown): string => {
  const numericValue = coerceFiniteNumber(value);
  return numericValue === null ? '-' : String(numericValue);
};
