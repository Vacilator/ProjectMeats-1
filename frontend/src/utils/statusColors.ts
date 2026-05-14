/**
 * Centralized status color utility — WCAG AA compliant.
 *
 * Uses CSS custom properties from index.css. Every component that renders
 * a status pill, badge, or colored indicator MUST use these helpers instead
 * of hardcoded hex/rgb values.
 */

export type StatusLevel =
  | 'success'
  | 'warning'
  | 'error'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'draft'
  | 'halted'
  | 'overdue'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'inactive'
  | 'invited';

/** Maps any status string to a semantic color token name. */
function resolveToken(
  status: string,
): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  const s = status.toLowerCase().replace(/[_-]/g, '');
  switch (s) {
    case 'success':
    case 'completed':
    case 'approved':
    case 'active':
    case 'paid':
    case 'resolved':
    case 'done':
    case 'low':
    case 'accepted':
    case 'fulfilled':
    case 'delivered':
    case 'settled':
      return 'success';

    case 'warning':
    case 'pending':
    case 'review':
    case 'partial':
    case 'medium':
    case 'halted':
    case 'inreview':
    case 'pendingapproval':
    case 'draft':
    case 'partialpaid':
    case 'invited':
      return 'warning';

    case 'error':
    case 'danger':
    case 'cancelled':
    case 'rejected':
    case 'overdue':
    case 'unpaid':
    case 'failed':
    case 'high':
    case 'critical':
    case 'denied':
      return 'error';

    case 'info':
    case 'inprogress':
    case 'running':
    case 'processing':
    case 'quoted':
    case 'sent':
    case 'confirmed':
    case 'shipped':
    case 'dispatched':
    case 'intransit':
    case 'carrierassigned':
    case 'invoiced':
      return 'info';

    default:
      return 'neutral';
  }
}

export interface StatusColorSet {
  /** Text color — WCAG AA safe on white/dark surfaces */
  text: string;
  /** Light background for badges/pills */
  bg: string;
  /** Subtle border for badges/pills */
  border: string;
  /** Ant Design color keyword (green/orange/red/blue/default) */
  antd: string;
}

/**
 * Returns CSS-variable–based color strings for a given status.
 *
 * Usage:
 * ```tsx
 * const c = getStatusColors('completed');
 * <span style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
 *   Done
 * </span>
 * // Or with Ant Design:
 * <Tag color={c.antd}>Done</Tag>
 * ```
 */
export function getStatusColors(status: string): StatusColorSet {
  const token = resolveToken(status);
  const map: Record<string, StatusColorSet> = {
    success: {
      text: 'rgb(var(--color-success))',
      bg: 'rgb(var(--color-success-bg))',
      border: 'rgb(var(--color-success-border))',
      antd: 'green',
    },
    warning: {
      text: 'rgb(var(--color-warning))',
      bg: 'rgb(var(--color-warning-bg))',
      border: 'rgb(var(--color-warning-border))',
      antd: 'orange',
    },
    error: {
      text: 'rgb(var(--color-error))',
      bg: 'rgb(var(--color-error-bg))',
      border: 'rgb(var(--color-error-border))',
      antd: 'red',
    },
    info: {
      text: 'rgb(var(--color-info))',
      bg: 'rgb(var(--color-info-bg))',
      border: 'rgb(var(--color-info-border))',
      antd: 'blue',
    },
    neutral: {
      text: 'rgb(var(--color-neutral))',
      bg: 'rgb(var(--color-neutral-bg))',
      border: 'rgb(var(--color-neutral-border))',
      antd: 'default',
    },
  };
  return map[token];
}

/** Convenience: returns just the Ant Design color keyword for a status. */
export function getAntdStatusColor(status: string): string {
  return getStatusColors(status).antd;
}

/**
 * Risk-level color helper (high/medium/low → error/warning/success).
 * Replaces all ad-hoc `riskColor()` functions.
 */
export function getRiskColors(level: string): StatusColorSet {
  return getStatusColors(level);
}
