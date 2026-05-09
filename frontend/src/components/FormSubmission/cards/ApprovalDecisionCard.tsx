/**
 * Approval Decision Card
 *
 * Phase 4: Hybrid Task Renderer
 * Interaction card for manual approval workflow nodes.
 *
 * Features:
 * - Approve/Reject toggle
 * - Required comment field
 * - Context summary display
 * - Timestamp tracking
 * - Approver identification
 *
 * Created: 2026-02-12 - Phase 4 Hybrid Task Renderer Implementation
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { CheckSquare, X, Check, AlertCircle, User, Calendar } from 'lucide-react';
import { InteractionCardProps } from '../InteractionCardRegistry';
import { resolveTemplateString } from '../hooks/useWorkflowContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

type DecisionType = 'approve' | 'reject' | null;

// ============================================================================
// Styled Components
// ============================================================================

const CardContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const CardIcon = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-warning) / 0.1);
  border-radius: var(--radius-md);
  color: rgb(var(--color-warning));

  svg {
    width: 24px;
    height: 24px;
  }
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const SummarySection = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-md);
  border-left: 4px solid rgb(var(--color-warning));
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
`;

const SummaryText = styled.div`
  font-size: 14px;
  line-height: 1.6;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
`;

const DecisionSection = styled.div`
  margin-bottom: 24px;
`;

const DecisionLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 12px;
`;

const DecisionButtons = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const DecisionButton = styled.button<{ $selected: boolean; $variant: 'approve' | 'reject' }>`
  padding: 16px;
  border: 2px solid ${props => {
    if (props.$selected) {
      return props.$variant === 'approve'
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-error))';
    }
    return 'rgb(var(--color-border))';
  }};
  border-radius: var(--radius-md);
  background: ${props => {
    if (props.$selected) {
      return props.$variant === 'approve'
        ? 'rgb(var(--color-success) / 0.1)'
        : 'rgb(var(--color-error) / 0.1)';
    }
    return 'rgb(var(--color-surface))';
  }};
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  &:hover {
    border-color: ${props =>
      props.$variant === 'approve'
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-error))'
    };
    background: ${props =>
      props.$variant === 'approve'
        ? 'rgb(var(--color-success) / 0.05)'
        : 'rgb(var(--color-error) / 0.05)'
    };
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DecisionIcon = styled.div<{ $variant: 'approve' | 'reject' }>`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${props =>
    props.$variant === 'approve'
      ? 'rgb(var(--color-success) / 0.2)'
      : 'rgb(var(--color-error) / 0.2)'
  };
  color: ${props =>
    props.$variant === 'approve'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };

  svg {
    width: 20px;
    height: 20px;
  }
`;

const DecisionText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CommentSection = styled.div`
  margin-bottom: 24px;
`;

const CommentLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const RequiredIndicator = styled.span`
  color: rgb(var(--color-error));
`;

const CommentTextarea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }

  &:disabled {
    background: rgb(var(--color-surface-hover));
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button<{ $variant: 'approve' | 'reject' }>`
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: ${props =>
    props.$variant === 'approve'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };
  color: rgb(var(--color-text-inverse));
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  margin-top: 12px;
  padding: 12px;
  background: rgb(var(--color-error) / 0.1);
  border: 1px solid rgb(var(--color-error) / 0.3);
  border-radius: var(--radius-md);
  color: rgb(var(--color-error));
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

const MetadataSection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  gap: 24px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  svg {
    width: 14px;
    height: 14px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const ApprovalDecisionCard: React.FC<InteractionCardProps> = ({
  node,
  context,
  onComplete,
  readOnly = false,
}) => {
  const [decision, setDecision] = useState<DecisionType>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get config from node
  const config = node.data || {};
  const title = config.title || 'Approval Required';
  const summaryTemplate = config.summary || 'Please review and approve or reject this request.';

  // Resolve summary template with context data
  const summary = context ? resolveTemplateString(summaryTemplate, context) : summaryTemplate;

  // Get current user info (would come from auth context in production)
  const currentUser = {
    id: 'user-123',
    name: 'Current User',
  };

  const handleSubmit = () => {
    setError(null);

    // Validate
    if (!decision) {
      setError('Please select Approve or Reject');
      return;
    }

    if (!comment.trim()) {
      setError('Please provide a comment explaining your decision');
      return;
    }

    // Complete card with decision data
    onComplete({
      decision: decision === 'approve',
      decision_type: decision,
      comment: comment.trim(),
      approver_id: currentUser.id,
      approver_name: currentUser.name,
      timestamp: new Date().toISOString(),
    });
  };

  const canSubmit = !!decision && comment.trim().length > 0;

  return (
    <CardContainer>
      <CardHeader>
        <CardIcon>
          <CheckSquare />
        </CardIcon>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <SummarySection>
        <SummaryLabel>Request Summary</SummaryLabel>
        <SummaryText>{summary}</SummaryText>
      </SummarySection>

      <DecisionSection>
        <DecisionLabel>Your Decision <RequiredIndicator>*</RequiredIndicator></DecisionLabel>
        <DecisionButtons>
          <DecisionButton
            type="button"
            $selected={decision === 'approve'}
            $variant="approve"
            onClick={() => setDecision('approve')}
            disabled={readOnly}
          >
            <DecisionIcon $variant="approve">
              <Check />
            </DecisionIcon>
            <DecisionText>Approve</DecisionText>
          </DecisionButton>

          <DecisionButton
            type="button"
            $selected={decision === 'reject'}
            $variant="reject"
            onClick={() => setDecision('reject')}
            disabled={readOnly}
          >
            <DecisionIcon $variant="reject">
              <X />
            </DecisionIcon>
            <DecisionText>Reject</DecisionText>
          </DecisionButton>
        </DecisionButtons>
      </DecisionSection>

      <CommentSection>
        <CommentLabel>
          Comment <RequiredIndicator>*</RequiredIndicator>
        </CommentLabel>
        <CommentTextarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={decision === 'approve'
            ? 'Explain why you are approving this request...'
            : decision === 'reject'
              ? 'Explain why you are rejecting this request...'
              : 'Select a decision and add your comment...'
          }
          disabled={readOnly}
        />
      </CommentSection>

      {!readOnly && (
        <SubmitButton
          type="button"
          $variant={decision === 'approve' ? 'approve' : 'reject'}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {decision === 'approve' ? 'Submit Approval' : decision === 'reject' ? 'Submit Rejection' : 'Submit Decision'}
        </SubmitButton>
      )}

      {error && (
        <ErrorMessage>
          <AlertCircle />
          <span>{error}</span>
        </ErrorMessage>
      )}

      <MetadataSection>
        <MetadataItem>
          <User />
          <span>{currentUser.name}</span>
        </MetadataItem>
        <MetadataItem>
          <Calendar />
          <span>{new Date().toLocaleDateString()}</span>
        </MetadataItem>
      </MetadataSection>
    </CardContainer>
  );
};

export default ApprovalDecisionCard;
