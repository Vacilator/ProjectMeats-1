/**
 * StatusBadge — Shared WCAG-compliant status pill.
 *
 * Replaces all ad-hoc status rendering across the app. Uses CSS custom
 * properties from index.css via the statusColors utility.
 *
 * Usage:
 * ```tsx
 * <StatusBadge status="completed" />
 * <StatusBadge status="pending" label="Awaiting Review" />
 * <StatusBadge status="high" size="small" />
 * ```
 */

import React from 'react';
import styled from 'styled-components';
import { getStatusColors, type StatusLevel } from '@/utils/statusColors';

export interface StatusBadgeProps {
  /** Status key — mapped to semantic color automatically */
  status: StatusLevel | string;
  /** Override the displayed label (defaults to capitalized status) */
  label?: string;
  /** Badge size */
  size?: 'small' | 'default';
  /** Optional className for styled-component overrides */
  className?: string;
}

const Pill = styled.span<{
  $text: string;
  $bg: string;
  $border: string;
  $small: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: ${(p) => (p.$small ? '1px 6px' : '2px 10px')};
  font-size: ${(p) => (p.$small ? '11px' : '12px')};
  font-weight: 600;
  line-height: 1.5;
  border-radius: 9999px;
  white-space: nowrap;
  color: ${(p) => p.$text};
  background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$border};
  text-transform: capitalize;
`;

function formatLabel(status: string): string {
  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  label,
  size = 'default',
  className,
}: StatusBadgeProps): React.ReactElement {
  const colors = getStatusColors(status);
  return (
    <Pill
      $text={colors.text}
      $bg={colors.bg}
      $border={colors.border}
      $small={size === 'small'}
      className={className}
    >
      {label ?? formatLabel(status)}
    </Pill>
  );
}

export default StatusBadge;
