/**
 * WorkflowProgressCard Component
 * 
 * Displays the progress of a workflow submission with step visualization.
 * Shows current step, completed steps, and remaining steps in a compact card format.
 */
import React from 'react';
import styled, { css, keyframes } from 'styled-components';

// ============================================================================
// TYPES
// ============================================================================

export type WorkflowStepStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'blocked';

export interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  status: WorkflowStepStatus;
  assignee?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export interface WorkflowProgressCardProps {
  workflowName: string;
  submissionId: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  status: 'draft' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Card = styled.div<{ $clickable: boolean; $compact: boolean }>`
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: ${props => props.$compact ? '16px' : '20px 24px'};
  transition: all 0.2s ease;
  
  ${props => props.$clickable && css`
    cursor: pointer;
    
    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }
  `}
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

const TitleSection = styled.div`
  flex: 1;
`;

const WorkflowTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0 0 4px 0;
`;

const SubmissionId = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-family: monospace;
`;

const StatusBadge = styled.span<{ $status: WorkflowProgressCardProps['status'] }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  
  ${props => {
    switch (props.$status) {
      case 'completed':
        return css`
          background: rgba(var(--color-success), 0.1);
          color: rgb(var(--color-success));
        `;
      case 'in_progress':
        return css`
          background: rgba(var(--color-info), 0.1);
          color: rgb(var(--color-info));
        `;
      case 'rejected':
        return css`
          background: rgba(var(--color-error), 0.1);
          color: rgb(var(--color-error));
        `;
      case 'cancelled':
        return css`
          background: rgba(127, 140, 141, 0.1);
          color: rgb(127, 140, 141);
        `;
      default: // draft
        return css`
          background: rgba(var(--color-warning), 0.1);
          color: rgb(180, 140, 8);
        `;
    }
  }}
`;

const ProgressSection = styled.div`
  margin-bottom: 16px;
`;

const ProgressBar = styled.div`
  height: 8px;
  background: rgb(var(--color-border, 224 224 224));
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ $progress: number; $status: WorkflowProgressCardProps['status'] }>`
  height: 100%;
  width: ${props => props.$progress}%;
  border-radius: 4px;
  transition: width 0.3s ease;
  
  ${props => {
    if (props.$status === 'rejected' || props.$status === 'cancelled') {
      return css`background: rgb(var(--color-error));`;
    }
    if (props.$status === 'completed') {
      return css`background: rgb(var(--color-success));`;
    }
    return css`
      background: linear-gradient(90deg, rgb(var(--color-info)), rgb(102, 126, 234));
      background-size: 200% 100%;
      animation: ${shimmer} 2s infinite linear;
    `;
  }}
`;

const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const StepsTimeline = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border, 224 224 224));
    border-radius: 2px;
  }
`;

const StepDot = styled.div<{ $status: WorkflowStepStatus; $isCurrent: boolean }>`
  width: ${props => props.$isCurrent ? '12px' : '8px'};
  height: ${props => props.$isCurrent ? '12px' : '8px'};
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.2s ease;
  
  ${props => {
    if (props.$isCurrent) {
      return css`
        background: rgb(var(--color-info));
        box-shadow: 0 0 0 3px rgba(var(--color-info), 0.3);
        animation: ${pulse} 2s infinite;
      `;
    }
    
    switch (props.$status) {
      case 'completed':
      case 'approved':
        return css`background: rgb(var(--color-success));`;
      case 'rejected':
        return css`background: rgb(var(--color-error));`;
      case 'skipped':
        return css`
          background: transparent;
          border: 2px dashed rgb(var(--color-border, 224 224 224));
        `;
      case 'blocked':
        return css`background: rgb(var(--color-warning));`;
      case 'in_progress':
        return css`
          background: rgb(var(--color-info));
          animation: ${pulse} 2s infinite;
        `;
      default:
        return css`background: rgb(var(--color-border, 224 224 224));`;
    }
  }}
`;

const StepConnector = styled.div<{ $completed: boolean }>`
  flex: 1;
  min-width: 12px;
  max-width: 24px;
  height: 2px;
  background: ${props => props.$completed 
    ? 'rgb(var(--color-success))' 
    : 'rgb(var(--color-border, 224 224 224))'};
  transition: background 0.3s ease;
`;

const CurrentStepInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--color-info), 0.05);
  border-radius: 8px;
  border-left: 3px solid rgb(var(--color-info));
`;

const CurrentStepIcon = styled.span`
  font-size: 16px;
`;

const CurrentStepText = styled.div`
  flex: 1;
`;

const CurrentStepLabel = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-info));
  display: block;
`;

const CurrentStepName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
`;

const AssigneeBadge = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  background: rgb(var(--color-background, 248 249 250));
  padding: 4px 8px;
  border-radius: 4px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border, 224 224 224));
`;

const Timestamp = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const ActionLink = styled.button`
  background: none;
  border: none;
  font-size: 13px;
  color: rgb(var(--color-primary, 102 126 234));
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(102, 126, 234, 0.1);
  }
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getStatusLabel = (status: WorkflowProgressCardProps['status']): string => {
  switch (status) {
    case 'completed': return 'Completed';
    case 'in_progress': return 'In Progress';
    case 'rejected': return 'Rejected';
    case 'cancelled': return 'Cancelled';
    default: return 'Draft';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const WorkflowProgressCard: React.FC<WorkflowProgressCardProps> = ({
  workflowName,
  submissionId,
  steps,
  currentStepIndex,
  status,
  createdAt,
  updatedAt,
  onClick,
  compact = false,
  className,
}) => {
  // Calculate progress
  const completedSteps = steps.filter(s => 
    s.status === 'completed' || s.status === 'approved'
  ).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);
  
  // Get current step
  const currentStep = steps[currentStepIndex];
  
  return (
    <Card 
      $clickable={!!onClick} 
      $compact={compact}
      onClick={onClick}
      className={className}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <Header>
        <TitleSection>
          <WorkflowTitle>{workflowName}</WorkflowTitle>
          <SubmissionId>#{submissionId.slice(0, 8)}</SubmissionId>
        </TitleSection>
        <StatusBadge $status={status}>
          {getStatusLabel(status)}
        </StatusBadge>
      </Header>
      
      <ProgressSection>
        <ProgressBar>
          <ProgressFill $progress={progressPercent} $status={status} />
        </ProgressBar>
        <ProgressText>
          <span>{completedSteps} of {steps.length} steps completed</span>
          <span>{progressPercent}%</span>
        </ProgressText>
      </ProgressSection>
      
      {!compact && (
        <>
          <StepsTimeline>
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <StepDot 
                  $status={step.status} 
                  $isCurrent={index === currentStepIndex}
                  title={`${step.name}: ${step.status}`}
                />
                {index < steps.length - 1 && (
                  <StepConnector 
                    $completed={step.status === 'completed' || step.status === 'approved'} 
                  />
                )}
              </React.Fragment>
            ))}
          </StepsTimeline>
          
          {currentStep && status === 'in_progress' && (
            <CurrentStepInfo>
              <CurrentStepIcon>📋</CurrentStepIcon>
              <CurrentStepText>
                <CurrentStepLabel>Current Step</CurrentStepLabel>
                <CurrentStepName>{currentStep.name}</CurrentStepName>
              </CurrentStepText>
              {currentStep.assignee && (
                <AssigneeBadge>@{currentStep.assignee}</AssigneeBadge>
              )}
            </CurrentStepInfo>
          )}
        </>
      )}
      
      <Footer>
        <Timestamp>Updated {formatTimeAgo(updatedAt)}</Timestamp>
        {onClick && <ActionLink>View Details →</ActionLink>}
      </Footer>
    </Card>
  );
};

export default WorkflowProgressCard;
