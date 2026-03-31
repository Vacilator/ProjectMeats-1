/**
 * Format a FlowEditor entityType into a human-readable label.
 *
 * Examples:
 * - purchase_order -> Purchase Order
 * - purchase-order -> Purchase Order
 */
export function formatEntityTypeLabel(entityType?: string | null): string {
  if (!entityType) return '';

  const normalized = String(entityType)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
