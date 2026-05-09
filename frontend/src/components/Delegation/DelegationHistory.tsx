/**
 * DelegationHistory Component
 *
 * Displays the delegation history for a task, showing who delegated
 * to whom, when, and any notes associated with each delegation.
 */
import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { formatDateLocal } from '@/utils/formatters';

// ============================================================================
// TYPES
// ============================================================================

export interface DelegationRecord {
  id: string;
  fromUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  toUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  delegatedAt: string;
  reason?: string;
  dueDate?: string;
  status: 'active' | 'completed' | 'revoked' | 'expired';
  completedAt?: string;
}

export interface DelegationHistoryProps {
  delegations: DelegationRecord[];
  currentUserId?: string;
  onRevoke?: (delegationId: string) => void;
  className?: string;
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-size: 14px;
`;

const EmptyIcon = styled.span`
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
`;

const DelegationCard = styled.div<{ $status: DelegationRecord['status'] }>`
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  animation: ${fadeIn} 0.3s ease;

  ${props => props.$status === 'active' && css`
    border-left: 3px solid rgb(var(--color-info));
  `}

  ${props => props.$status === 'completed' && css`
    border-left: 3px solid rgb(var(--color-success));
  `}

  ${props => props.$status === 'revoked' && css`
    border-left: 3px solid rgb(var(--color-error));
    opacity: 0.7;
  `}

  ${props => props.$status === 'expired' && css`
    border-left: 3px solid rgb(var(--color-warning));
    opacity: 0.7;
  `}
`;

const DelegationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const DelegationFlow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const UserBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Avatar = styled.div<{ $hasImage: boolean; $size?: number }>`
  width: ${props => props.$size || 32}px;
  height: ${props => props.$size || 32}px;
  border-radius: 50%;
  background: ${props => props.$hasImage ? 'transparent' : 'rgb(var(--color-primary, 102 126 234))'};
  color: rgb(var(--color-text-inverse));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: ${props => (props.$size || 32) * 0.4}px;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const UserName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
`;

const Arrow = styled.span`
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-size: 16px;
`;

const StatusBadge = styled.span<{ $status: DelegationRecord['status'] }>`
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;

  ${props => {
    switch (props.$status) {
      case 'active':
        return css`
          background: rgba(var(--color-info), 0.1);
          color: rgb(var(--color-info));
        `;
      case 'completed':
        return css`
          background: rgba(var(--color-success), 0.1);
          color: rgb(var(--color-success));
        `;
      case 'revoked':
        return css`
          background: rgba(var(--color-error), 0.1);
          color: rgb(var(--color-error));
        `;
      case 'expired':
        return css`
          background: rgba(var(--color-warning), 0.1);
          color: rgb(var(--color-warning));
        `;
      default:
        return '';
    }
  }}
`;

const DelegationMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin-bottom: 8px;
`;

const MetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const MetaIcon = styled.span`
  font-size: 14px;
`;

const ReasonText = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-style: italic;
  padding: 8px 12px;
  background: rgb(var(--color-background, 248 249 250));
  border-radius: 6px;
  margin-top: 8px;
`;

const RevokeButton = styled.button`
  background: none;
  border: 1px solid rgb(var(--color-error));
  color: rgb(var(--color-error));
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(var(--color-error), 0.1);
  }
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border, 224 224 224));
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getStatusLabel = (status: DelegationRecord['status']): string => {
  switch (status) {
    case 'active': return 'Active';
    case 'completed': return 'Completed';
    case 'revoked': return 'Revoked';
    case 'expired': return 'Expired';
    default: return status;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const DelegationHistory: React.FC<DelegationHistoryProps> = ({
  delegations,
  currentUserId,
  onRevoke,
  className,
}) => {
  if (delegations.length === 0) {
    return (
      <Container className={className}>
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          No delegation history for this task
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container className={className}>
      {delegations.map((delegation) => {
        const canRevoke = delegation.status === 'active' &&
                          currentUserId === delegation.fromUser.id &&
                          onRevoke;

        return (
          <DelegationCard key={delegation.id} $status={delegation.status}>
            <DelegationHeader>
              <DelegationFlow>
                <UserBadge>
                  <Avatar $hasImage={!!delegation.fromUser.avatar}>
                    {delegation.fromUser.avatar ? (
                      <img src={delegation.fromUser.avatar} alt={delegation.fromUser.name} />
                    ) : (
                      getInitials(delegation.fromUser.name)
                    )}
                  </Avatar>
                  <UserName>{delegation.fromUser.name}</UserName>
                </UserBadge>
                <Arrow>→</Arrow>
                <UserBadge>
                  <Avatar $hasImage={!!delegation.toUser.avatar}>
                    {delegation.toUser.avatar ? (
                      <img src={delegation.toUser.avatar} alt={delegation.toUser.name} />
                    ) : (
                      getInitials(delegation.toUser.name)
                    )}
                  </Avatar>
                  <UserName>{delegation.toUser.name}</UserName>
                </UserBadge>
              </DelegationFlow>
              <StatusBadge $status={delegation.status}>
                {getStatusLabel(delegation.status)}
              </StatusBadge>
            </DelegationHeader>

            <DelegationMeta>
              <MetaItem>
                <MetaIcon>📅</MetaIcon>
                Delegated {formatDateLocal(delegation.delegatedAt)}
              </MetaItem>
              {delegation.dueDate && (
                <MetaItem>
                  <MetaIcon>⏰</MetaIcon>
                  Due {formatShortDate(delegation.dueDate)}
                </MetaItem>
              )}
              {delegation.completedAt && (
                <MetaItem>
                  <MetaIcon>✓</MetaIcon>
                  Completed {formatDateLocal(delegation.completedAt)}
                </MetaItem>
              )}
            </DelegationMeta>

            {delegation.reason && (
              <ReasonText>"{delegation.reason}"</ReasonText>
            )}

            {canRevoke && (
              <ActionRow>
                <RevokeButton onClick={() => onRevoke!(delegation.id)}>
                  Revoke Delegation
                </RevokeButton>
              </ActionRow>
            )}
          </DelegationCard>
        );
      })}
    </Container>
  );
};

export default DelegationHistory;
