/**
 * WorkflowStatusTimeline Component
 *
 * Vertical timeline showing the complete history and status of a workflow.
 * Shows each step's status, completion time, and assignee information.
 */
import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { formatDateLocal } from '@/utils/formatters';

// ============================================================================
// TYPES
// ============================================================================

export type TimelineStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'blocked';

export interface TimelineStep {
  id: string;
  name: string;
  order: number;
  status: TimelineStepStatus;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  completedAt?: string;
  completedBy?: {
    id: string;
    name: string;
  };
  notes?: string;
  duration?: string; // e.g., "2h 15m"
}

export interface WorkflowStatusTimelineProps {
  steps: TimelineStep[];
  currentStepIndex: number;
  showDurations?: boolean;
  showAssignees?: boolean;
  className?: string;
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-info), 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(var(--color-info), 0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const StepWrapper = styled.div<{ $isLast: boolean }>`
  display: flex;
  position: relative;
  padding-bottom: ${props => props.$isLast ? '0' : '24px'};

  /* Vertical connector line */
  &::before {
    content: '';
    position: absolute;
    left: 15px;
    top: 32px;
    bottom: 0;
    width: 2px;
    background: ${props => props.$isLast ? 'transparent' : 'rgb(var(--color-border, 224 224 224))'};
  }
`;

const StepConnectorLine = styled.div<{ $completed: boolean; $isLast: boolean }>`
  position: absolute;
  left: 15px;
  top: 32px;
  bottom: 0;
  width: 2px;
  background: ${props => props.$completed ? 'rgb(var(--color-success))' : 'transparent'};
  z-index: 1;
  display: ${props => props.$isLast ? 'none' : 'block'};
`;

const StepIndicator = styled.div<{ $status: TimelineStepStatus; $isCurrent: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 2;
  font-size: 14px;
  transition: all 0.3s ease;

  ${props => {
    if (props.$isCurrent) {
      return css`
        background: rgb(var(--color-info));
        color: rgb(var(--color-text-inverse));
        animation: ${pulse} 2s infinite;
      `;
    }

    switch (props.$status) {
      case 'completed':
        return css`
          background: rgb(var(--color-success));
          color: rgb(var(--color-text-inverse));
        `;
      case 'approved':
        return css`
          background: rgb(var(--color-success));
          color: rgb(var(--color-text-inverse));
        `;
      case 'rejected':
        return css`
          background: rgb(var(--color-error));
          color: rgb(var(--color-text-inverse));
        `;
      case 'skipped':
        return css`
          background: rgb(var(--color-background, 248 249 250));
          color: rgb(var(--color-text-secondary, 127 140 141));
          border: 2px dashed rgb(var(--color-border, 224 224 224));
        `;
      case 'blocked':
        return css`
          background: rgb(var(--color-warning));
          color: rgb(var(--color-text-inverse));
        `;
      case 'in_progress':
        return css`
          background: rgb(var(--color-info));
          color: rgb(var(--color-text-inverse));
          animation: ${pulse} 2s infinite;
        `;
      default: // pending
        return css`
          background: rgb(var(--color-background, 248 249 250));
          color: rgb(var(--color-text-secondary, 127 140 141));
          border: 2px solid rgb(var(--color-border, 224 224 224));
        `;
    }
  }}
`;

const StepContent = styled.div`
  flex: 1;
  margin-left: 16px;
  animation: ${fadeIn} 0.3s ease;
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const StepName = styled.h4<{ $status: TimelineStepStatus; $isCurrent: boolean }>`
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: ${props => {
    if (props.$isCurrent) return 'rgb(var(--color-info))';
    if (props.$status === 'completed' || props.$status === 'approved') {
      return 'rgb(var(--color-text-primary, 44 62 80))';
    }
    if (props.$status === 'rejected') return 'rgb(var(--color-error))';
    return 'rgb(var(--color-text-secondary, 127 140 141))';
  }};
`;

const StepBadge = styled.span<{ $status: TimelineStepStatus }>`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;

  ${props => {
    switch (props.$status) {
      case 'completed':
        return css`
          background: rgba(var(--color-success), 0.1);
          color: rgb(var(--color-success));
        `;
      case 'approved':
        return css`
          background: rgba(var(--color-success), 0.1);
          color: rgb(var(--color-success));
        `;
      case 'rejected':
        return css`
          background: rgba(var(--color-error), 0.1);
          color: rgb(var(--color-error));
        `;
      case 'in_progress':
        return css`
          background: rgba(var(--color-info), 0.1);
          color: rgb(var(--color-info));
        `;
      case 'blocked':
        return css`
          background: rgba(var(--color-warning), 0.1);
          color: rgb(180, 140, 8);
        `;
      case 'skipped':
        return css`
          background: rgba(127, 140, 141, 0.1);
          color: rgb(127, 140, 141);
        `;
      default:
        return css`
          background: rgba(127, 140, 141, 0.1);
          color: rgb(127, 140, 141);
        `;
    }
  }}
`;

const StepMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
`;

const MetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const MetaIcon = styled.span`
  font-size: 14px;
`;

const AssigneeAvatar = styled.div<{ $hasImage: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${props => props.$hasImage ? 'transparent' : 'rgb(var(--color-primary, 102 126 234))'};
  color: rgb(var(--color-text-inverse));
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StepNotes = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  background: rgb(var(--color-background, 248 249 250));
  border-radius: 6px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-style: italic;
`;

const CurrentStepActions = styled.div`
  margin-top: 12px;
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant: 'primary' | 'secondary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return css`
          background: rgb(var(--color-primary, 102 126 234));
          color: rgb(var(--color-text-inverse));
          border: none;

          &:hover { opacity: 0.9; }
        `;
      case 'danger':
        return css`
          background: rgba(var(--color-error), 0.1);
          color: rgb(var(--color-error));
          border: 1px solid rgb(var(--color-error));

          &:hover { background: rgba(var(--color-error), 0.2); }
        `;
      default:
        return css`
          background: rgb(var(--color-background, 248 249 250));
          color: rgb(var(--color-text-primary, 44 62 80));
          border: 1px solid rgb(var(--color-border, 224 224 224));

          &:hover { background: rgb(var(--color-border, 224 224 224)); }
        `;
    }
  }}
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getStepIcon = (status: TimelineStepStatus, isCurrent: boolean): string => {
  if (isCurrent && status === 'in_progress') return '▶';
  switch (status) {
    case 'completed': return '✓';
    case 'approved': return '✓';
    case 'rejected': return '✕';
    case 'skipped': return '—';
    case 'blocked': return '⚠';
    case 'in_progress': return '▶';
    default: return '';
  }
};

const getStatusLabel = (status: TimelineStepStatus): string => {
  switch (status) {
    case 'completed': return 'Completed';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'skipped': return 'Skipped';
    case 'blocked': return 'Blocked';
    case 'in_progress': return 'In Progress';
    default: return 'Pending';
  }
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ============================================================================
// COMPONENT
// ============================================================================

export const WorkflowStatusTimeline: React.FC<WorkflowStatusTimelineProps> = ({
  steps,
  currentStepIndex,
  showDurations = true,
  showAssignees = true,
  className,
}) => {
  return (
    <Container className={className}>
      {steps.map((step, index) => {
        const isCurrent = index === currentStepIndex;
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === 'completed' || step.status === 'approved';

        return (
          <StepWrapper key={step.id} $isLast={isLast}>
            <StepConnectorLine $completed={isCompleted} $isLast={isLast} />

            <StepIndicator $status={step.status} $isCurrent={isCurrent}>
              {getStepIcon(step.status, isCurrent) || index + 1}
            </StepIndicator>

            <StepContent>
              <StepHeader>
                <StepName $status={step.status} $isCurrent={isCurrent}>
                  {step.name}
                </StepName>
                <StepBadge $status={step.status}>
                  {getStatusLabel(step.status)}
                </StepBadge>
              </StepHeader>

              <StepMeta>
                {showAssignees && step.assignee && (
                  <MetaItem>
                    <AssigneeAvatar $hasImage={!!step.assignee.avatar}>
                      {step.assignee.avatar ? (
                        <img src={step.assignee.avatar} alt={step.assignee.name} />
                      ) : (
                        getInitials(step.assignee.name)
                      )}
                    </AssigneeAvatar>
                    {step.assignee.name}
                  </MetaItem>
                )}

                {step.completedAt && (
                  <MetaItem>
                    <MetaIcon>📅</MetaIcon>
                    {formatDateLocal(step.completedAt)}
                  </MetaItem>
                )}

                {showDurations && step.duration && (
                  <MetaItem>
                    <MetaIcon>⏱</MetaIcon>
                    {step.duration}
                  </MetaItem>
                )}

                {step.completedBy && step.completedBy.id !== step.assignee?.id && (
                  <MetaItem>
                    <MetaIcon>👤</MetaIcon>
                    Completed by {step.completedBy.name}
                  </MetaItem>
                )}
              </StepMeta>

              {step.notes && (
                <StepNotes>"{step.notes}"</StepNotes>
              )}

              {isCurrent && step.status === 'in_progress' && (
                <CurrentStepActions>
                  <ActionButton $variant="primary">Complete Step</ActionButton>
                  <ActionButton $variant="secondary">Add Note</ActionButton>
                  <ActionButton $variant="danger">Reject</ActionButton>
                </CurrentStepActions>
              )}
            </StepContent>
          </StepWrapper>
        );
      })}
    </Container>
  );
};

export default WorkflowStatusTimeline;
