/**
 * Status Badge Component
 *
 * Displays a user's status (active, inactive, invited).
 */
import React from 'react';
import styled from 'styled-components';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'invited';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return <Badge status={status}>{getStatusLabel(status)}</Badge>;
};

const Badge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
  background: ${({ status }) => getStatusColor(status).bg};
  color: ${({ status }) => getStatusColor(status).text};
`;

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    invited: 'Invited',
  };
  return labels[status] || status;
}

function getStatusColor(status: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(var(--color-success), 0.12)', text: 'rgb(var(--color-success))' },
    inactive: { bg: 'rgba(var(--color-text-secondary), 0.12)', text: 'rgb(var(--color-text-secondary))' },
    invited: { bg: 'rgba(var(--color-warning), 0.12)', text: 'rgb(var(--color-warning))' },
  };
  return colors[status] || colors.active;
}
