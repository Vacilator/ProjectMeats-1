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
    active: { bg: 'rgba(34, 197, 94, 0.1)', text: 'rgb(34, 197, 94)' },
    inactive: { bg: 'rgba(107, 114, 128, 0.1)', text: 'rgb(107, 114, 128)' },
    invited: { bg: 'rgba(234, 179, 8, 0.1)', text: 'rgb(234, 179, 8)' },
  };
  return colors[status] || colors.active;
}
