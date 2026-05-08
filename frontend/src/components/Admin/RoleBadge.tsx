/**
 * Role Badge Component
 *
 * Displays a user's role with appropriate styling.
 */
import React from 'react';
import styled from 'styled-components';

interface RoleBadgeProps {
  role: 'owner' | 'admin' | 'manager' | 'user' | 'readonly';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  return <Badge role={role}>{getRoleLabel(role)}</Badge>;
};

const Badge = styled.span<{ role: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
  background: ${({ role }) => getRoleColor(role).bg};
  color: ${({ role }) => getRoleColor(role).text};
`;

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    user: 'User',
    readonly: 'Read Only',
  };
  return labels[role] || role;
}

function getRoleColor(role: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    owner: { bg: 'rgba(var(--color-primary), 0.12)', text: 'rgb(var(--color-primary))' },
    admin: { bg: 'rgba(var(--color-info), 0.12)', text: 'rgb(var(--color-info))' },
    manager: { bg: 'rgba(var(--color-success), 0.12)', text: 'rgb(var(--color-success))' },
    user: { bg: 'rgba(var(--color-text-secondary), 0.12)', text: 'rgb(var(--color-text-secondary))' },
    readonly: { bg: 'rgba(var(--color-text-secondary), 0.12)', text: 'rgb(var(--color-text-secondary))' },
  };
  return colors[role] || colors.user;
}
