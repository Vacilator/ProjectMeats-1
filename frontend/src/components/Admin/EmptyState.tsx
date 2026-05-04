/**
 * Empty State Component
 * 
 * Displays an empty state with icon, message, and optional call-to-action.
 * Used across admin pages when no data is available.
 * 
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon="👥"
 *   title="No users yet"
 *   message="Get started by inviting your first team member."
 *   action={{
 *     label: "Invite User",
 *     onClick: () => openInviteModal()
 *   }}
 * />
 * ```
 */

import React from 'react';
import styled from 'styled-components';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: EmptyStateAction;
  actions?: EmptyStateAction[];
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  actions,
  children,
}) => {
  const resolvedActions = actions ?? (action ? [action] : []);

  return (
    <Container>
      <Icon>{icon}</Icon>
      <Title>{title}</Title>
      <Message>{message}</Message>
      {children}
      {resolvedActions.length > 0 && (
        <ActionGroup>
          {resolvedActions.map((item) => (
            <ActionButton
              key={item.label}
              type="button"
              $variant={item.variant ?? 'primary'}
              onClick={item.onClick}
            >
              {item.label}
            </ActionButton>
          ))}
        </ActionGroup>
      )}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
`;

const Icon = styled.div`
  font-size: 64px;
  margin-bottom: 24px;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 12px 0;
`;

const Message = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 24px 0;
  max-width: 400px;
  line-height: 1.6;
`;

const ActionGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
`;

const ActionButton = styled.button<{ $variant: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  background: ${({ $variant }) =>
    $variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))'};
  color: ${({ $variant }) =>
    $variant === 'primary' ? 'rgb(var(--color-surface))' : 'rgb(var(--color-text-primary))'};
  border: ${({ $variant }) =>
    $variant === 'primary' ? 'none' : '1px solid rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    opacity: 0.95;
    box-shadow: var(--shadow-sm);
  }

  &:active {
    transform: translateY(1px);
  }
`;
