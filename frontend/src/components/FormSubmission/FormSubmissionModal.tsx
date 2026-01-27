/**
 * FormSubmissionModal Component
 * 
 * Main modal for executing a form submission with multi-step support.
 * Includes conditional rules engine for dynamic field/step visibility.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import FormStep, { StepConfig } from './FormStep';
import { FieldConfig } from './FormField';
import { 
  FormSubmission, 
  StepSubmission,
  formSubmissionService 
} from '../../services/quickActionsService';
import {
  ConditionalRule,
  evaluateRules,
  isFieldVisible,
  isStepVisible,
  getFilteredOptions,
  VisibilityState,
  FormData as RuleFormData,
} from '../../utils/formRuleEngine';

interface FormSubmissionModalProps {
  submission: FormSubmission;
  isOpen: boolean;
  onClose: () => void;
  onSubmissionUpdate?: (submission: FormSubmission) => void;
}

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  align-items: flex-start;
  justify-content: center;
  padding: 2rem;
  z-index: 1000;
  overflow-y: auto;
`;

const ModalContainer = styled.div`
  background: var(--modal-bg, #ffffff);
  border-radius: 0.75rem;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  margin: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #dee2e6);
  background: var(--card-bg, #f8f9fa);
  border-radius: 0.75rem 0.75rem 0 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const FormIcon = styled.span`
  font-size: 1.5rem;
`;

const HeaderInfo = styled.div``;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
`;

const FormDescription = styled.p`
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #6c757d);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #6c757d);
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.15s ease;

  &:hover {
    color: var(--text-primary, #1a1a2e);
  }
`;

const ProgressBar = styled.div`
  padding: 1rem 1.5rem;
  background: var(--bg-secondary, #f8f9fa);
  border-bottom: 1px solid var(--border-color, #dee2e6);
`;

const ProgressTrack = styled.div`
  height: 0.5rem;
  background: var(--bg-tertiary, #e9ecef);
  border-radius: 0.25rem;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ percent: number }>`
  height: 100%;
  width: ${({ percent }) => `${percent}%`};
  background: var(--color-success, #198754);
  border-radius: 0.25rem;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary, #6c757d);
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const StepNavigation = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #dee2e6);
`;

const StepNavButton = styled.button<{ active?: boolean; completed?: boolean }>`
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid var(--border-color, #dee2e6);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 0.375rem;

  ${({ active }) => active && `
    background: var(--color-primary, #0d6efd);
    color: white;
    border-color: var(--color-primary, #0d6efd);
  `}

  ${({ completed, active }) => completed && !active && `
    background: var(--color-success-light, #d1e7dd);
    color: var(--color-success, #198754);
    border-color: var(--color-success-light, #d1e7dd);
  `}

  ${({ active, completed }) => !active && !completed && `
    background: var(--bg-secondary, #f8f9fa);
    color: var(--text-primary, #1a1a2e);
    
    &:hover {
      background: var(--bg-tertiary, #e9ecef);
    }
  `}
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #dee2e6);
  background: var(--card-bg, #f8f9fa);
  border-radius: 0 0 0.75rem 0.75rem;
`;

const FooterLeft = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const FooterRight = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'success' | 'danger' }>`
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  ${({ variant }) => {
    switch (variant) {
      case 'success':
        return `
          background: var(--color-success, #198754);
          color: white;
          &:hover:not(:disabled) {
            background: var(--color-success-dark, #157347);
          }
        `;
      case 'danger':
        return `
          background: var(--color-error, #dc3545);
          color: white;
          &:hover:not(:disabled) {
            background: #bb2d3b;
          }
        `;
      case 'secondary':
        return `
          background: var(--bg-secondary, #f8f9fa);
          color: var(--text-primary, #1a1a2e);
          border-color: var(--border-color, #dee2e6);
          &:hover:not(:disabled) {
            background: var(--bg-tertiary, #e9ecef);
          }
        `;
      default:
        return `
          background: var(--color-primary, #0d6efd);
          color: white;
          &:hover:not(:disabled) {
            background: var(--color-primary-dark, #0b5ed7);
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const AutoSaveIndicator = styled.span`
  font-size: 0.75rem;
  color: var(--text-secondary, #6c757d);
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const FormSubmissionModal: React.FC<FormSubmissionModalProps> = ({
  submission: initialSubmission,
  isOpen,
  onClose,
  onSubmissionUpdate,
}) => {
  const [submission, setSubmission] = useState<FormSubmission>(initialSubmission);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [localValues, setLocalValues] = useState<Record<string, Record<string, any>>>({});
  const [savingFields, setSavingFields] = useState<Record<string, Set<string>>>({});
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Parse form structure from snapshot
  const steps: StepConfig[] = useMemo(() => {
    const snapshot = submission.form_snapshot;
    if (!snapshot?.steps) return [];

    return snapshot.steps
      .sort((a: any, b: any) => a.order - b.order)
      .map((step: any) => ({
        id: step.id,
        name: step.name,
        order: step.order,
        entity_type: step.entity_type,
        fields: (step.fields || []).map((f: any) => ({
          key: f.key,
          label: f.label || f.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          type: f.type || 'text',
          required: f.required || false,
          placeholder: f.placeholder,
          helpText: f.help_text,
          options: f.options,
          min: f.min,
          max: f.max,
          step: f.step,
          rows: f.rows,
          autoPopulateSource: f.auto_populate_source,
          validationRules: f.validation_rules,
        })),
      }));
  }, [submission.form_snapshot]);

  // Parse conditional rules from snapshot
  const rules: ConditionalRule[] = useMemo(() => {
    const snapshot = submission.form_snapshot;
    if (!snapshot?.rules) return [];
    return snapshot.rules as ConditionalRule[];
  }, [submission.form_snapshot]);

  // Compute visibility state based on rules and current values
  const visibilityState: VisibilityState = useMemo(() => {
    if (rules.length === 0) {
      return {
        hiddenFields: new Set<string>(),
        hiddenSteps: new Set<string>(),
        filteredOptions: new Map<string, string[]>(),
        setValues: new Map<string, unknown>(),
      };
    }
    // Convert localValues to RuleFormData format
    const formData: RuleFormData = localValues;
    return evaluateRules(rules, formData);
  }, [rules, localValues]);

  // Filter visible steps based on rules
  const visibleSteps: StepConfig[] = useMemo(() => {
    return steps.filter(step => isStepVisible(step.id, visibilityState));
  }, [steps, visibilityState]);

  // Get step submission map
  const stepSubmissionMap: Record<string, StepSubmission> = useMemo(() => {
    const map: Record<string, StepSubmission> = {};
    submission.step_submissions.forEach(ss => {
      map[ss.step] = ss;
    });
    return map;
  }, [submission.step_submissions]);

  // Initialize local values from submission data
  useEffect(() => {
    const values: Record<string, Record<string, any>> = {};
    steps.forEach(step => {
      values[step.id] = submission.data[step.id] || {};
    });
    setLocalValues(values);
  }, [steps, submission.data]);

  // Find current step based on submission or navigation
  useEffect(() => {
    if (submission.current_step) {
      const idx = visibleSteps.findIndex(s => s.id === submission.current_step);
      if (idx >= 0) {
        setCurrentStepIndex(idx);
      }
    }
  }, [submission.current_step, visibleSteps]);

  // Ensure current step index is valid within visible steps
  useEffect(() => {
    if (currentStepIndex >= visibleSteps.length && visibleSteps.length > 0) {
      setCurrentStepIndex(visibleSteps.length - 1);
    }
  }, [currentStepIndex, visibleSteps.length]);

  const currentStep = visibleSteps[currentStepIndex];
  const currentStepSubmission = currentStep ? stepSubmissionMap[currentStep.id] : null;

  // Filter visible fields for current step based on rules
  const visibleFields: FieldConfig[] = useMemo(() => {
    if (!currentStep) return [];
    return currentStep.fields.filter(field => 
      isFieldVisible(currentStep.id, field.key, visibilityState)
    );
  }, [currentStep, visibilityState]);

  // Apply filtered options to visible fields
  const fieldsWithFilteredOptions: FieldConfig[] = useMemo(() => {
    return visibleFields.map(field => {
      if (field.options && field.options.length > 0) {
        const filtered = getFilteredOptions(
          currentStep?.id || '', 
          field.key, 
          field.options,
          visibilityState
        );
        return { ...field, options: filtered };
      }
      return field;
    });
  }, [visibleFields, currentStep?.id, visibilityState]);

  const handleFieldChange = useCallback((stepId: string, fieldKey: string, value: any) => {
    setLocalValues(prev => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        [fieldKey]: value,
      },
    }));
    
    // Clear error on change
    setErrors(prev => {
      const stepErrors = { ...prev[stepId] };
      delete stepErrors[fieldKey];
      return { ...prev, [stepId]: stepErrors };
    });
  }, []);

  const handleFieldBlur = useCallback(async (stepId: string, fieldKey: string) => {
    const value = localValues[stepId]?.[fieldKey];
    
    // Mark as saving
    setSavingFields(prev => {
      const stepFields = new Set(prev[stepId] || []);
      stepFields.add(fieldKey);
      return { ...prev, [stepId]: stepFields };
    });

    try {
      await formSubmissionService.autoSave(submission.id, stepId, fieldKey, value);
      setLastSaved(new Date());
      
      // Update local submission data
      setSubmission(prev => ({
        ...prev,
        data: {
          ...prev.data,
          [stepId]: {
            ...prev.data[stepId],
            [fieldKey]: value,
          },
        },
      }));
    } catch (err: any) {
      console.error('Auto-save failed:', err);
      setErrors(prev => ({
        ...prev,
        [stepId]: {
          ...prev[stepId],
          [fieldKey]: 'Failed to save. Please try again.',
        },
      }));
    } finally {
      setSavingFields(prev => {
        const stepFields = new Set(prev[stepId] || []);
        stepFields.delete(fieldKey);
        return { ...prev, [stepId]: stepFields };
      });
    }
  }, [localValues, submission.id]);

  const handleCompleteStep = useCallback(async (stepId: string) => {
    try {
      const result = await formSubmissionService.completeStep(submission.id, stepId);
      
      // Update step submission status
      setSubmission(prev => ({
        ...prev,
        step_submissions: prev.step_submissions.map(ss =>
          ss.step === stepId
            ? { ...ss, status: 'completed' as const, completed_at: new Date().toISOString() }
            : ss
        ),
        progress: {
          ...prev.progress,
          completed: prev.progress.completed + 1,
          percent: Math.round(((prev.progress.completed + 1) / prev.progress.total) * 100),
        },
      }));

      // Navigate to next step if available
      if (result.next_step_id) {
        const nextIdx = visibleSteps.findIndex(s => s.id === result.next_step_id);
        if (nextIdx >= 0) {
          setCurrentStepIndex(nextIdx);
        }
      }
    } catch (err: any) {
      console.error('Failed to complete step:', err);
      alert(err.response?.data?.error || 'Failed to complete step');
    }
  }, [submission.id, visibleSteps]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await formSubmissionService.submit(submission.id);
      
      setSubmission(prev => ({
        ...prev,
        status: 'completed',
        completed_at: result.completed_at,
      }));

      onSubmissionUpdate?.({
        ...submission,
        status: 'completed',
        completed_at: result.completed_at,
      });

      // Close after short delay to show success
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to submit form:', err);
      
      if (err.response?.data?.incomplete_steps) {
        const confirmForce = window.confirm(
          'Some steps are incomplete. Do you want to submit anyway?'
        );
        if (confirmForce) {
          await formSubmissionService.submit(submission.id, true);
          onClose();
        }
      } else {
        alert(err.response?.data?.error || 'Failed to submit form');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [submission, onSubmissionUpdate, onClose]);

  const handleCancel = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this form? All progress will be marked as cancelled.'
    );
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      await formSubmissionService.cancel(submission.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel form:', err);
      alert(err.response?.data?.error || 'Failed to cancel form');
    } finally {
      setIsCancelling(false);
    }
  }, [submission.id, onClose]);

  const handleSaveAndClose = useCallback(() => {
    // Auto-save already handles saving, just close
    onClose();
  }, [onClose]);

  const allStepsCompleted = useMemo(() => {
    // Only check visible steps for completion
    return visibleSteps.every(step => {
      const stepSub = stepSubmissionMap[step.id];
      return stepSub?.status === 'completed';
    });
  }, [visibleSteps, stepSubmissionMap]);

  const formatLastSaved = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  if (!isOpen) return null;

  return (
    <Overlay isOpen={isOpen} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <HeaderLeft>
            <FormIcon>{submission.form_icon || '📋'}</FormIcon>
            <HeaderInfo>
              <FormTitle>{submission.form_name}</FormTitle>
              {submission.form_description && (
                <FormDescription>{submission.form_description}</FormDescription>
              )}
            </HeaderInfo>
          </HeaderLeft>
          <CloseButton onClick={onClose} title="Close">×</CloseButton>
        </ModalHeader>

        <ProgressBar>
          <ProgressTrack>
            <ProgressFill percent={submission.progress.percent} />
          </ProgressTrack>
          <ProgressText>
            <span>{submission.progress.completed} of {visibleSteps.length} steps completed</span>
            <span>{submission.progress.percent}%</span>
          </ProgressText>
        </ProgressBar>

        <ModalBody>
          {visibleSteps.length > 1 && (
            <StepNavigation>
              {visibleSteps.map((step, idx) => {
                const stepSub = stepSubmissionMap[step.id];
                const isCompleted = stepSub?.status === 'completed';
                const isActive = idx === currentStepIndex;
                
                return (
                  <StepNavButton
                    key={step.id}
                    active={isActive}
                    completed={isCompleted}
                    onClick={() => setCurrentStepIndex(idx)}
                  >
                    {isCompleted ? '✓' : idx + 1}. {step.name}
                  </StepNavButton>
                );
              })}
            </StepNavigation>
          )}

          {currentStep && currentStepSubmission && (
            <FormStep
              step={{ ...currentStep, fields: fieldsWithFilteredOptions }}
              stepSubmission={currentStepSubmission}
              submissionId={submission.id}
              values={localValues[currentStep.id] || {}}
              onFieldChange={(fieldKey, value) => 
                handleFieldChange(currentStep.id, fieldKey, value)
              }
              onFieldBlur={(fieldKey) => 
                handleFieldBlur(currentStep.id, fieldKey)
              }
              onCompleteStep={() => handleCompleteStep(currentStep.id)}
              savingFields={savingFields[currentStep.id] || new Set()}
              errors={errors[currentStep.id] || {}}
              isActive
            />
          )}

          {visibleSteps.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              No steps configured for this form.
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <FooterLeft>
            <Button variant="danger" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? 'Cancelling...' : '🗑️ Cancel'}
            </Button>
            {lastSaved && (
              <AutoSaveIndicator>
                💾 Saved at {formatLastSaved(lastSaved)}
              </AutoSaveIndicator>
            )}
          </FooterLeft>
          <FooterRight>
            <Button variant="secondary" onClick={handleSaveAndClose}>
              Save & Close
            </Button>
            {currentStepIndex > 0 && (
              <Button 
                variant="secondary" 
                onClick={() => setCurrentStepIndex(prev => prev - 1)}
              >
                ← Previous
              </Button>
            )}
            {currentStepIndex < visibleSteps.length - 1 && (
              <Button 
                variant="primary" 
                onClick={() => setCurrentStepIndex(prev => prev + 1)}
              >
                Next →
              </Button>
            )}
            {currentStepIndex === visibleSteps.length - 1 && (
              <Button
                variant="success"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : '✓ Submit Form'}
              </Button>
            )}
          </FooterRight>
        </ModalFooter>
      </ModalContainer>
    </Overlay>
  );
};

export default FormSubmissionModal;
