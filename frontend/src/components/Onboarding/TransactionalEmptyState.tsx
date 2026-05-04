import React from 'react';
import styled from 'styled-components';
import { EmptyState } from '../Admin/EmptyState';

interface TransactionalEmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface TransactionalEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  actions: TransactionalEmptyStateAction[];
  children?: React.ReactNode;
}

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: rgb(var(--color-primary) / 0.12);
  color: rgb(var(--color-primary));
`;

const GuidanceList = styled.ul`
  margin: 0 0 24px;
  padding-left: 20px;
  max-width: 520px;
  text-align: left;
  color: rgb(var(--color-text-secondary));
  line-height: 1.6;
`;

const GuidanceItem = styled.li`
  margin-bottom: 8px;
`;

export const TransactionalEmptyState: React.FC<TransactionalEmptyStateProps> = ({
  icon,
  title,
  message,
  actions,
  children,
}) => (
  <EmptyState
    icon={<IconWrapper>{icon}</IconWrapper>}
    title={title}
    message={message}
    actions={actions}
  >
    {children}
  </EmptyState>
);

export const TransactionalEmptyStateGuidance = GuidanceList;
export const TransactionalEmptyStateGuidanceItem = GuidanceItem;
