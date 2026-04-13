/**
 * Enhanced Schedule Call Modal - CRUD Support
 * 
 * Features:
 * - Create new calls
 * - Edit existing calls (via initialData prop)
 * - Full form validation
 * - Theme-compliant styling
 * - Call timer for tracking call duration
 * 
 * Usage:
 * ```tsx
 * // Create new
 * <ScheduleCallModal isOpen={show} onClose={...} onSuccess={...} />
 * 
 * // Edit existing
 * <ScheduleCallModal 
 *   isOpen={show}
 *   initialData={call}
 *   onClose={...}
 *   onSuccess={...}
 * />
 * ```
 * 
 * Updated: 2026-02-03 - Added CallTimer support
 */
import React, { useEffect, useState } from 'react';
import { z } from 'zod';

import { useZodForm } from '@/hooks/useZodForm';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import { EntityFormSurface } from './EntityFormSurface';
import { CallTimer } from '../Calls';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ScheduledCallData {
  id?: number;
  tenant?: string;
  entity_type: string;
  entity_id: number;
  title: string;
  description: string;
  scheduled_for: string;
  duration_minutes: number;
  call_purpose: string;
  outcome?: string;
  is_completed?: boolean;
  created_by?: number | null;
  created_by_name?: string;
  created_on?: string;
  updated_on?: string;
}

interface ScheduleCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: ScheduledCallData | null; // For editing
  /**
   * Used by entry points that pre-select a purpose before opening the modal.
   * Only applied in create mode.
   */
  defaultCallPurpose?: string;
  /**
   * Used by entry points that already know the target entity (e.g. Cockpit entity detail).
   * Only applied in create mode.
   */
  defaultEntityType?: EntityType;
  defaultEntityId?: string | number;
}

// Restrict to only Supplier and Customer per requirements
type EntityType = 'supplier' | 'customer';

interface EntityOption {
  id: number;
  name: string;
}

const scheduleCallFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  entityType: z.enum(['supplier', 'customer']),
  entityId: z.string().trim().regex(/^\d+$/, 'Valid supplier/customer is required'),
  scheduledFor: z.string().min(1, 'Scheduled date and time is required'),
  durationMinutes: z.string().trim().regex(/^\d+$/, 'Duration must be a number'),
  callPurpose: z.string().trim().min(1),
  outcome: z.string().optional().default(''),
});

type ScheduleCallFormValues = z.infer<typeof scheduleCallFormSchema>;

// ============================================================================
// Styled Components (Theme-Compliant)
// ============================================================================

const Overlay = styled.div<{ isOpen: boolean }>`
  display: \${props => props.isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 550px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const ModalHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
  
  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const ModalFooter = styled.div`
  padding: 1.5rem;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
`;

const CancelButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    background: rgba(var(--color-text-primary), 0.05);
  }
`;

const SubmitButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary));
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-md);
`;

const HelpText = styled.p`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  margin-top: 0.25rem;
`;

const NewInquiryButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: 2px solid rgb(var(--color-primary));
  border-radius: var(--radius-md);
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.2);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalFooterLeft = styled.div`
  display: flex;
  align-items: center;
`;

const ModalFooterRight = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const TimerSection = styled.div`
  padding: 1rem;
  background: rgba(var(--color-primary), 0.05);
  border-radius: var(--radius-md);
  border: 1px solid rgba(var(--color-primary), 0.1);
  margin-top: 0.5rem;
`;

const TimerLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TimerWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

// ============================================================================
// Component
// ============================================================================

export const ScheduleCallModal: React.FC<ScheduleCallModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultCallPurpose,
  defaultEntityType,
  defaultEntityId,
}) => {
  const isEditMode = !!initialData?.id;

  const scheduleCallForm = useZodForm<ScheduleCallFormValues>(scheduleCallFormSchema, {
    defaultValues: {
      title: '',
      description: '',
      entityType: (defaultEntityType || 'supplier') as EntityType,
      entityId:
        defaultEntityId !== undefined && defaultEntityId !== null && String(defaultEntityId).trim() !== ''
          ? String(defaultEntityId)
          : '',
      scheduledFor: '',
      durationMinutes: '30',
      callPurpose: defaultCallPurpose || 'follow_up',
      outcome: '',
    },
    mode: 'onBlur',
  });

  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = scheduleCallForm;

  const entityType = watch('entityType') as EntityType;
  const entityId = watch('entityId');
  const title = watch('title');
  const description = watch('description');
  const scheduledFor = watch('scheduledFor');
  const durationMinutes = watch('durationMinutes');
  const callPurpose = watch('callPurpose');
  const outcome = watch('outcome');

  const [error, setError] = useState<string | null>(null);

  // Call timer state (for logging call duration)
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState(0);
  
  // Inquiry modal state
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  // Dynamic entity options
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Load initial data for editing / initialize create defaults
  useEffect(() => {
    if (!isOpen) return;

    setError(null);

    if (initialData) {
      const formattedDate = initialData.scheduled_for
        ? new Date(initialData.scheduled_for).toISOString().slice(0, 16)
        : '';

      reset({
        title: initialData.title || '',
        description: initialData.description || '',
        entityType: ((initialData.entity_type as EntityType) || 'supplier') as EntityType,
        entityId: String(initialData.entity_id || ''),
        scheduledFor: formattedDate,
        durationMinutes: String(initialData.duration_minutes || 30),
        callPurpose: initialData.call_purpose || 'follow_up',
        outcome: initialData.outcome || '',
      });

      return;
    }

    reset({
      title: '',
      description: '',
      entityType: (defaultEntityType || 'supplier') as EntityType,
      entityId:
        defaultEntityId !== undefined && defaultEntityId !== null && String(defaultEntityId).trim() !== ''
          ? String(defaultEntityId)
          : '',
      scheduledFor: '',
      durationMinutes: '30',
      callPurpose: defaultCallPurpose || 'follow_up',
      outcome: '',
    });
  }, [defaultCallPurpose, defaultEntityId, defaultEntityType, initialData, isOpen, reset]);

  // Fetch entity options when entity type changes
  useEffect(() => {
    if (isOpen && entityType) {
      fetchEntityOptions(entityType);
    }
  }, [entityType, isOpen]);

  const fetchEntityOptions = async (type: EntityType) => {
    setLoadingEntities(true);
    try {
      const endpoint = type === 'supplier' ? '/suppliers/' : '/customers/';
      const response = await businessApi.get(endpoint);
      const data = response.data.results || response.data;
      
      // Map to consistent format
      const options = data.map((item: any) => ({
        id: item.id,
        name: item.name || item.company_name || item.title || `${type} #${item.id}`,
      }));
      
      setEntityOptions(options);
    } catch (err) {
      console.error(`Failed to fetch ${type} options:`, err);
      setEntityOptions([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  const resetForm = () => {
    reset({
      title: '',
      description: '',
      entityType: (defaultEntityType || 'supplier') as EntityType,
      entityId:
        defaultEntityId !== undefined && defaultEntityId !== null && String(defaultEntityId).trim() !== ''
          ? String(defaultEntityId)
          : '',
      scheduledFor: '',
      durationMinutes: '30',
      callPurpose: defaultCallPurpose || 'follow_up',
      outcome: '',
    });
    setError(null);
    setEntityOptions([]);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const onValidSubmit = async (values: ScheduleCallFormValues) => {
    setError(null);

    try {
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        entity_type: values.entityType,
        entity_id: Number(values.entityId),
        scheduled_for: values.scheduledFor,
        duration_minutes: Number(values.durationMinutes),
        call_purpose: values.callPurpose,
        ...(values.outcome?.trim() ? { outcome: values.outcome.trim() } : {}),
      };

      if (isEditMode && initialData?.id) {
        await businessApi.patch(`/workspace/scheduled-calls/${initialData.id}/`, payload);
      } else {
        await businessApi.post('/workspace/scheduled-calls/', payload);
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(`Failed to ${isEditMode ? 'update' : 'schedule'} call:`, err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          `Failed to ${isEditMode ? 'update' : 'schedule'} call. Please try again.`
      );
    }
  };

  const onInvalidSubmit = (formErrors: Record<string, unknown>) => {
    const first = Object.values(formErrors)[0] as any;
    const msg = first && typeof first.message === 'string' ? String(first.message) : 'Please fix the highlighted fields.';
    setError(msg);
  };

  if (!isOpen) return null;

  return (
    <Overlay isOpen={isOpen} onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => void handleSubmit(onValidSubmit, onInvalidSubmit)(e)}>
          <ModalHeader>
            <ModalTitle>{isEditMode ? 'Edit Call' : 'Schedule New Call'}</ModalTitle>
            <CloseButton type="button" onClick={handleClose}>&times;</CloseButton>
          </ModalHeader>

          <ModalBody>
            <FormGroup>
              <Label>Call Title *</Label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setValue('title', e.target.value, { shouldValidate: true })}
                placeholder="e.g., Follow-up on order inquiry"
                maxLength={200}
                disabled={isSubmitting}
              />
            </FormGroup>

            <FormGroup>
              <Label>Description</Label>
              <TextArea
                value={description}
                onChange={(e) => setValue('description', e.target.value)}
                placeholder="Add notes about what to discuss..."
                disabled={isSubmitting}
              />
            </FormGroup>

            <FormGroup>
              <Label>Entity Type *</Label>
              <Select
                value={entityType}
                onChange={(e) => {
                  setValue('entityType', e.target.value as EntityType, { shouldValidate: true });
                  setValue('entityId', '', { shouldValidate: true });
                }}
                disabled={isSubmitting}
              >
                <option value="supplier">Supplier</option>
                <option value="customer">Customer</option>
              </Select>
              <HelpText>Select Supplier or Customer</HelpText>
            </FormGroup>

            <FormGroup>
              <Label>
                {entityType === 'supplier' ? 'Supplier' : 'Customer'} *
              </Label>
              <Select
                value={entityId}
                onChange={(e) => setValue('entityId', e.target.value, { shouldValidate: true })}
                disabled={isSubmitting || loadingEntities}
              >
                <option value="">
                  {loadingEntities 
                    ? 'Loading...' 
                    : `Select ${entityType === 'supplier' ? 'Supplier' : 'Customer'}`
                  }
                </option>
                {entityOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
              {entityOptions.length === 0 && !loadingEntities && (
                <HelpText style={{ color: 'rgb(239, 68, 68)' }}>
                  No {entityType}s found. Please create one first.
                </HelpText>
              )}
            </FormGroup>

            <FormGroup>
              <Label>Scheduled For *</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setValue('scheduledFor', e.target.value, { shouldValidate: true })}
                disabled={isSubmitting}
                step="900"
                aria-label="Schedule date and time in 15-minute increments"
              />
              <HelpText>Time selector uses 15-minute increments (e.g., 9:00, 9:15, 9:30, 9:45)</HelpText>
            </FormGroup>

            <FormGroup>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={durationMinutes}
                onChange={(e) => setValue('durationMinutes', e.target.value, { shouldValidate: true })}
                min="5"
                max="480"
                step="5"
                disabled={isSubmitting}
              />
            </FormGroup>

            <FormGroup>
              <Label>Call Purpose</Label>
              <Select
                value={callPurpose}
                onChange={(e) => setValue('callPurpose', e.target.value, { shouldValidate: true })}
                disabled={isSubmitting}
              >
                <option value="follow_up">Follow-up</option>
                <option value="inquiry">Inquiry</option>
                <option value="complaint">Complaint</option>
                <option value="order">Order</option>
                <option value="support">Support</option>
                <option value="other">Other</option>
              </Select>
            </FormGroup>

            {isEditMode && initialData?.is_completed && (
              <FormGroup>
                <Label>Outcome</Label>
                <TextArea
                  value={outcome}
                  onChange={(e) => setValue('outcome', e.target.value)}
                  placeholder="What was the outcome of this call?"
                  disabled={isSubmitting}
                />
              </FormGroup>
            )}

            {/* Call Timer - shown in edit mode for logging calls */}
            {isEditMode && !initialData?.is_completed && (
              <TimerSection>
                <TimerLabel>Call Timer (optional)</TimerLabel>
                <TimerWrapper>
                  <CallTimer
                    mode="full"
                    onStop={(seconds) => {
                      setTimerDurationSeconds(seconds);
                      // Update duration in minutes, rounded up
                      setValue('durationMinutes', String(Math.ceil(seconds / 60)), { shouldValidate: true });
                      setIsTimerActive(false);
                    }}
                    onTick={(seconds) => setTimerDurationSeconds(seconds)}
                    isActive={isTimerActive}
                  />
                </TimerWrapper>
                <HelpText style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  Start the timer when you begin your call. Duration will be saved automatically.
                </HelpText>
              </TimerSection>
            )}

            {error && <ErrorMessage>{error}</ErrorMessage>}
          </ModalBody>

          <ModalFooter>
            <ModalFooterLeft>
              {isEditMode && initialData?.id && entityId && (
                <NewInquiryButton
                  type="button"
                  onClick={() => setShowInquiryModal(true)}
                  disabled={isSubmitting}
                >
                  📋 New Inquiry
                </NewInquiryButton>
              )}
            </ModalFooterLeft>
            <ModalFooterRight>
              <CancelButton type="button" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </CancelButton>
              <SubmitButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? (isEditMode ? 'Updating...' : 'Scheduling...') : (isEditMode ? 'Update Call' : 'Schedule Call')}
              </SubmitButton>
            </ModalFooterRight>
          </ModalFooter>
        </form>
      </Modal>

      {/* Inquiry Modal */}
      {showInquiryModal && initialData?.id && (
        <EntityFormSurface
          entityType="inquiries"
          mode="create"
          isOpen={showInquiryModal}
          onClose={() => setShowInquiryModal(false)}
          onSuccess={() => {
            setShowInquiryModal(false);
          }}
          context={{
            sourceCallId: initialData.id,
            ...(String(entityType).toLowerCase() === 'supplier'
              ? { supplierId: entityId }
              : { customerId: entityId }),
          }}
        />
      )}
    </Overlay>
  );
};
