/**
 * FormStep Component
 *
 * Renders a single step within a form submission with fields and notes.
 */
import React, { useCallback, useState, useMemo } from 'react';
import styled from 'styled-components';
import FormField, { FieldConfig } from './FormField';
import StepNotes from './StepNotes';
import { StepSubmission } from '../../services/quickActionsService';

export interface StepConfig {
  id: string;
  name: string;
  order: number;
  entity_type: string;
  fields: FieldConfig[];
}

interface FormStepProps {
  step: StepConfig;
  stepSubmission: StepSubmission;
  submissionId: string;
  values: Record<string, any>;
  onFieldChange: (fieldKey: string, value: any) => void;
  onFieldBlur: (fieldKey: string) => void;
  onCompleteStep: () => void;
  savingFields: Set<string>;
  errors: Record<string, string>;
  disabled?: boolean;
  isActive?: boolean;
  showNotes?: boolean;
  onCreateEntity?: (entityType: string) => void;
}

const StepContainer = styled.div<{ isActive?: boolean }>`
  background: var(--card-bg, rgb(var(--color-surface)));
  border: 1px solid var(--border-color, rgb(var(--color-border)));
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  ${({ isActive }) => isActive && `
    border-color: var(--color-primary, rgb(var(--color-primary)));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  `}
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color, rgb(var(--color-border)));
`;

const StepTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, rgb(var(--color-text-primary)));
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StepNumber = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 600;

  ${({ status }) => {
    switch (status) {
      case 'completed':
        return `
          background: var(--color-success, rgb(var(--color-success)));
          color: rgb(var(--color-text-inverse));
        `;
      case 'in_progress':
        return `
          background: var(--color-primary, rgb(var(--color-primary)));
          color: rgb(var(--color-text-inverse));
        `;
      case 'action_needed':
        return `
          background: var(--color-warning, rgb(var(--color-warning)));
          color: rgb(var(--color-text-primary));
        `;
      default:
        return `
          background: var(--bg-secondary, rgb(var(--color-border)));
          color: var(--text-secondary, rgb(var(--color-text-muted)));
        `;
    }
  }}
`;

const EntityBadge = styled.span`
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary, rgb(var(--color-surface)));
  color: var(--text-secondary, rgb(var(--color-text-muted)));
  border-radius: 0.25rem;
  text-transform: capitalize;
`;

const StatusBadge = styled.span<{ status: string }>`
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-weight: 500;

  ${({ status }) => {
    switch (status) {
      case 'completed':
        return `
          background: var(--color-success-light, rgba(var(--color-success), 0.14));
          color: var(--color-success, rgb(var(--color-success)));
        `;
      case 'in_progress':
        return `
          background: var(--color-primary-light, rgba(var(--color-primary), 0.14));
          color: var(--color-primary, rgb(var(--color-primary)));
        `;
      case 'action_needed':
        return `
          background: var(--color-warning-light, rgb(var(--color-surface))3cd);
          color: rgb(var(--color-warning));
        `;
      case 'skipped':
        return `
          background: var(--bg-secondary, rgb(var(--color-border)));
          color: var(--text-secondary, rgb(var(--color-text-muted)));
        `;
      default:
        return `
          background: var(--bg-secondary, rgb(var(--color-border)));
          color: var(--text-secondary, rgb(var(--color-text-muted)));
        `;
    }
  }}
`;

const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 700px;
  margin: 0 auto;
`;

const NoFieldsMessage = styled.p`
  color: var(--text-secondary, rgb(var(--color-text-muted)));
  text-align: center;
  padding: 1rem;
  margin: 0;
  font-style: italic;
`;

const StepFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, rgb(var(--color-border)));
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'success' }>`
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  ${({ variant }) => {
    switch (variant) {
      case 'success':
        return `
          background: var(--color-success, rgb(var(--color-success)));
          color: rgb(var(--color-text-inverse));
          &:hover:not(:disabled) {
            background: var(--color-success-dark, rgb(var(--color-success)));
          }
        `;
      case 'secondary':
        return `
          background: var(--bg-secondary, rgb(var(--color-surface)));
          color: var(--text-primary, rgb(var(--color-text-primary)));
          border-color: var(--border-color, rgb(var(--color-border)));
          &:hover:not(:disabled) {
            background: var(--bg-tertiary, rgb(var(--color-border)));
          }
        `;
      default:
        return `
          background: var(--color-primary, rgb(var(--color-primary)));
          color: rgb(var(--color-text-inverse));
          &:hover:not(:disabled) {
            background: var(--color-primary-dark, rgb(var(--color-primary)));
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'completed':
      return '✓ Completed';
    case 'in_progress':
      return 'In Progress';
    case 'action_needed':
      return 'Action Needed';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Not Started';
  }
};

const FormStep: React.FC<FormStepProps> = ({
  step,
  stepSubmission,
  submissionId,
  values,
  onFieldChange,
  onFieldBlur,
  onCompleteStep,
  savingFields,
  errors,
  disabled = false,
  isActive = false,
  showNotes = true,
  onCreateEntity,
}) => {
  const [isCompleting, setIsCompleting] = useState(false);

  // Check if all required fields are filled
  const canComplete = useMemo(() => {
    const requiredFields = step.fields.filter(f => f.required);
    return requiredFields.every(field => {
      const value = values[field.key];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });
  }, [step.fields, values]);

  const hasErrors = Object.keys(errors).length > 0;
  const isCompleted = stepSubmission.status === 'completed';

  const handleComplete = useCallback(async () => {
    if (!canComplete || hasErrors || isCompleting) return;

    setIsCompleting(true);
    try {
      await onCompleteStep();
    } finally {
      setIsCompleting(false);
    }
  }, [canComplete, hasErrors, isCompleting, onCompleteStep]);

  return (
    <StepContainer isActive={isActive}>
      <StepHeader>
        <StepTitle>
          <StepNumber status={stepSubmission.status}>
            {isCompleted ? '✓' : step.order + 1}
          </StepNumber>
          {step.name}
          <EntityBadge>{step.entity_type.replace(/_/g, ' ')}</EntityBadge>
        </StepTitle>
        <StatusBadge status={stepSubmission.status}>
          {getStatusLabel(stepSubmission.status)}
        </StatusBadge>
      </StepHeader>

      {step.fields.length > 0 ? (
        <FieldsList>
          {step.fields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(value) => onFieldChange(field.key, value)}
              onBlur={() => onFieldBlur(field.key)}
              disabled={disabled || isCompleted}
              error={errors[field.key]}
              isSaving={savingFields.has(field.key)}
              onCreateEntity={onCreateEntity}
            />
          ))}
        </FieldsList>
      ) : (
        <NoFieldsMessage>
          No fields configured for this step.
        </NoFieldsMessage>
      )}

      {!isCompleted && step.fields.length > 0 && (
        <StepFooter>
          <Button
            variant="success"
            onClick={handleComplete}
            disabled={disabled || !canComplete || hasErrors || isCompleting}
          >
            {isCompleting ? 'Completing...' : '✓ Complete Step'}
          </Button>
        </StepFooter>
      )}

      {/* Step Notes */}
      {showNotes && (
        <StepNotes
          submissionId={submissionId}
          stepId={step.id}
          stepName={step.name}
          disabled={disabled}
        />
      )}
    </StepContainer>
  );
};

export default FormStep;
