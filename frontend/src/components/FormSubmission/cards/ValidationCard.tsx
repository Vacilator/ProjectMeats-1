/**
 * Data Validation Card
 *
 * Interaction card for data validation workflow nodes.
 *
 * Features:
 * - Validation rule display from node config
 * - Approve/Reject with comments
 * - Validation checklist with individual statuses
 * - Skippable support
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, CheckCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { InteractionCardProps } from '../InteractionCardRegistry';
import { resolveTemplateString } from '../hooks/useWorkflowContext';

type ValidationStatus = 'pending' | 'approved' | 'rejected';

interface ValidationItem {
  label: string;
  checked: boolean;
}

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
  background: rgb(var(--color-info) / 0.1);
  border-radius: var(--radius-md);
  color: rgb(var(--color-info));

  svg {
    width: 24px;
    height: 24px;
  }
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-tertiary));
  margin: 4px 0 0;
`;

const ChecklistContainer = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 16px;
`;

const ChecklistItem = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  border-bottom: 1px solid rgb(var(--color-border));
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgb(var(--color-bg-secondary));
  }

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: rgb(var(--color-primary));
  }
`;

const CommentArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-bg-primary));
  resize: vertical;
  min-height: 80px;
  box-sizing: border-box;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.15);
  }

  &:disabled {
    background: rgb(var(--color-bg-tertiary));
    cursor: not-allowed;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
`;

const ActionButton = styled.button<{ $variant: 'approve' | 'reject' }>`
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  ${({ $variant }) =>
    $variant === 'approve'
      ? `
        background: rgb(var(--color-success));
        color: rgb(var(--color-text-inverse));
      `
      : `
        background: rgb(var(--color-error));
        color: rgb(var(--color-text-inverse));
      `}

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusDisplay = styled.div<{ $status: ValidationStatus }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  margin-top: 16px;

  ${({ $status }) =>
    $status === 'approved'
      ? `
        background: rgb(var(--color-success) / 0.1);
        color: rgb(var(--color-success));
      `
      : `
        background: rgb(var(--color-error) / 0.1);
        color: rgb(var(--color-error));
      `}
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 6px;
`;

export const ValidationCard: React.FC<InteractionCardProps> = ({
  node,
  context,
  onComplete,
  readOnly = false,
}) => {
  const nodeData = (node?.data || {}) as Record<string, unknown>;
  const rawRules: string[] = (Array.isArray(nodeData.validationRules) ? nodeData.validationRules : []) as string[];
  const rules = rawRules.map((r: string) => resolveTemplateString(r, context));

  const [checklist, setChecklist] = useState<ValidationItem[]>(
    rules.length > 0
      ? rules.map((r: string) => ({ label: r, checked: false }))
      : [{ label: 'Data is accurate and complete', checked: false }],
  );
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<ValidationStatus>('pending');

  const allChecked = checklist.every((item) => item.checked);

  const handleToggle = (index: number) => {
    if (readOnly || status !== 'pending') return;
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  };

  const handleDecision = (decision: 'approved' | 'rejected') => {
    setStatus(decision);
    onComplete({
      validation_status: decision,
      checklist: checklist.map((c) => ({ rule: c.label, passed: c.checked })),
      comment: comment.trim(),
      decided_at: new Date().toISOString(),
    });
  };

  return (
    <CardContainer>
      <CardHeader>
        <CardIcon>
          <ClipboardCheck />
        </CardIcon>
        <div>
          <Title>Data Validation Required</Title>
          <Subtitle>
            {nodeData.description
              ? resolveTemplateString(String(nodeData.description), context)
              : 'Review the data below and approve or reject'}
          </Subtitle>
        </div>
      </CardHeader>

      <ChecklistContainer>
        {checklist.map((item, index) => (
          <ChecklistItem key={index}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleToggle(index)}
              disabled={readOnly || status !== 'pending'}
              aria-label={item.label}
            />
            {item.label}
          </ChecklistItem>
        ))}
      </ChecklistContainer>

      <div style={{ marginBottom: 16 }}>
        <Label htmlFor="validation-comment">Comments (optional)</Label>
        <CommentArea
          id="validation-comment"
          placeholder="Add any notes about the validation..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={readOnly || status !== 'pending'}
        />
      </div>

      {status === 'pending' && !readOnly && (
        <ButtonRow>
          <ActionButton
            $variant="approve"
            onClick={() => handleDecision('approved')}
            disabled={!allChecked}
          >
            <CheckCircle size={16} />
            Approve
          </ActionButton>
          <ActionButton
            $variant="reject"
            onClick={() => handleDecision('rejected')}
          >
            <XCircle size={16} />
            Reject
          </ActionButton>
        </ButtonRow>
      )}

      {status !== 'pending' && (
        <StatusDisplay $status={status}>
          {status === 'approved' ? (
            <>
              <CheckCircle size={18} />
              Validation Approved
            </>
          ) : (
            <>
              <AlertCircle size={18} />
              Validation Rejected
            </>
          )}
        </StatusDisplay>
      )}
    </CardContainer>
  );
};
