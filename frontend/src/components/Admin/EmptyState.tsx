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

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
}) => {
  return (
    <Container>
      <Icon>{icon}</Icon>
      <Title>{title}</Title>
      <Message>{message}</Message>
      {action && (
        <ActionButton onClick={action.onClick}>
          {action.label}
        </ActionButton>
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

const ActionButton = styled.button`
  padding: 12px 24px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.9;
  }
`;
