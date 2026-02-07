/**
 * EntityFormStepModal Component
 * 
 * Full-screen wizard modal for creating/editing entity-driven form steps.
 * Integrates FormSelectionPanel, EntityFieldPicker, and FieldConfigurationPanel.
 * 
 * Phase 3 - WorkForms Enhancement Project (WF-ENH-2026-Q1)
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { X, ArrowLeft, ArrowRight, Save, AlertCircle } from 'lucide-react';
import {
  FormSelectionPanel,
  EntityFieldPicker,
  FieldConfigurationPanel,
  type SelectedField,
  type FieldConfig,
} from '../ConfigPanel';
import { workformsApi, type TenantForm } from '../../../services/workformsApi';

// ============================================================================
// TypeScript Types
// ============================================================================

export interface EntityFormStepModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when form is saved */
  onSave: (formData: FormStepData) => void;
  /** Initial form data (for editing existing form) */
  initialData?: FormStepData;
  /** Node ID (for context) */
  nodeId?: string;
}

export interface FormStepData {
  /** Form ID (if using existing form) */
  formId?: string;
  /** Form name */
  formName: string;
  /** Entity type */
  entityType: string;
  /** Selected and configured fields */
  fields: FieldConfig[];
  /** Form mode: 'new' or 'existing' */
  mode: 'new' | 'existing';
}

type WizardStep = 1 | 2 | 3;

interface ModalState {
  /** Current wizard step */
  currentStep: WizardStep;
  /** Form selection mode */
  mode: 'new' | 'existing' | null;
  /** Form name */
  formName: string;
  /** Selected form ID (if using existing) */
  selectedFormId: string | null;
  /** Selected entity type */
  entityType: string | null;
  /** Selected and configured fields */
  fields: FieldConfig[];
  /** Currently selected field (for configuration panel) */
  selectedFieldIndex: number | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

// ============================================================================
// Styled Components
// ============================================================================

const ModalOverlay = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 9999;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
`;

const ModalContainer = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 95vw;
  height: 90vh;
  max-width: 1800px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid rgb(var(--color-border));
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const WizardProgress = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ProgressStep = styled.div<{ $active: boolean; $completed: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  background: ${props =>
    props.$active
      ? 'rgba(var(--color-primary), 0.1)'
      : props.$completed
      ? 'rgba(var(--color-success), 0.1)'
      : 'transparent'};
  border: 1px solid ${props =>
    props.$active
      ? 'rgb(var(--color-primary))'
      : props.$completed
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-border))'};
  font-size: 14px;
  color: ${props =>
    props.$active || props.$completed
      ? 'rgb(var(--color-text-primary))'
      : 'rgb(var(--color-text-tertiary))'};
  font-weight: ${props => (props.$active ? 600 : 400)};
`;

const StepNumber = styled.span<{ $active: boolean; $completed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props =>
    props.$active
      ? 'rgb(var(--color-primary))'
      : props.$completed
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-border))'};
  color: ${props =>
    props.$active || props.$completed
      ? 'white'
      : 'rgb(var(--color-text-tertiary))'};
  font-size: 12px;
  font-weight: 600;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid rgb(var(--color-border));
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-border-hover));
    color: rgb(var(--color-text-primary));
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ModalBody = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
  background: rgb(var(--color-surface));
`;

const ContentArea = styled.div<{ $step: WizardStep; $currentStep: WizardStep }>`
  flex: 1;
  display: ${props => (props.$step === props.$currentStep ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow-y: auto;
  background: rgb(var(--color-surface));
`;

const SplitLayout = styled.div<{ $visible: boolean }>`
  display: ${props => (props.$visible ? 'flex' : 'none')};
  width: 100%;
  height: 100%;
  gap: 1px;
  background: rgb(var(--color-border));
`;

const LeftPanel = styled.div`
  flex: 3;
  background: rgb(var(--color-surface));
  overflow-y: auto;
  padding: 24px;
`;

const RightPanel = styled.div`
  flex: 2;
  background: rgb(var(--color-background));
  overflow-y: auto;
  padding: 24px;
  border-left: 1px solid rgb(var(--color-border));
`;

const RightPanelEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(var(--color-text-tertiary));
  text-align: center;
  padding: 40px;
`;

const EmptyIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(var(--color-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: rgb(var(--color-primary));
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FooterRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          border-color: rgb(var(--color-primary));
          color: white;
          &:hover:not(:disabled) {
            background: rgb(var(--color-primary-hover));
            border-color: rgb(var(--color-primary-hover));
          }
        `;
      case 'secondary':
        return `
          background: transparent;
          border-color: rgb(var(--color-border));
          color: rgb(var(--color-text-primary));
          &:hover:not(:disabled) {
            background: rgb(var(--color-surface-hover));
            border-color: rgb(var(--color-border-hover));
          }
        `;
      case 'ghost':
      default:
        return `
          background: transparent;
          border-color: transparent;
          color: rgb(var(--color-text-secondary));
          &:hover:not(:disabled) {
            background: rgb(var(--color-surface-hover));
            color: rgb(var(--color-text-primary));
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(var(--color-error), 0.1);
  border: 1px solid rgb(var(--color-error));
  border-radius: 6px;
  color: rgb(var(--color-error));
  font-size: 14px;
`;

// ============================================================================
// Component
// ============================================================================

export const EntityFormStepModal: React.FC<EntityFormStepModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  nodeId,
}) => {
  // State
  const [state, setState] = useState<ModalState>({
    currentStep: 1,
    mode: null,
    formName: '',
    selectedFormId: null,
    entityType: null,
    fields: [],
    selectedFieldIndex: null,
    loading: false,
    error: null,
  });

  // Initialize with initial data
  useEffect(() => {
    if (isOpen && initialData) {
      // Determine the correct step based on configuration state
      let startStep = 1;
      
      if (initialData.mode === 'existing' && initialData.formId) {
        // Editing an existing form - skip to preview (step 3)
        startStep = 3;
      } else if (initialData.entityType && initialData.fields && initialData.fields.length > 0) {
        // Already configured - skip to entity/field selection (step 2)
        startStep = 2;
      }
      // Otherwise, start at step 1 for new/unconfigured forms
      
      setState(prev => ({
        ...prev,
        mode: initialData.mode,
        formName: initialData.formName,
        selectedFormId: initialData.formId || null,
        entityType: initialData.entityType,
        fields: initialData.fields,
        currentStep: startStep,
      }));
    }
  }, [isOpen, initialData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        currentStep: 1,
        mode: null,
        formName: '',
        selectedFormId: null,
        entityType: null,
        fields: [],
        selectedFieldIndex: null,
        loading: false,
        error: null,
      });
    }
  }, [isOpen]);

  // Handlers
  const handleFormSelection = useCallback((selection: { mode: 'new' | 'existing'; formName?: string; formId?: string }) => {
    setState(prev => ({
      ...prev,
      mode: selection.mode,
      formName: selection.formName || '',
      selectedFormId: selection.formId || null,
      error: null,
    }));
  }, []);

  const handleProceedFromStep1 = useCallback(async () => {
    if (state.mode === 'existing' && state.selectedFormId) {
      // Load existing form data
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const form = await workformsApi.getTenantForm(state.selectedFormId);
        
        // Safely extract fields from form_definition
        const fields = form.form_definition?.fields 
          ? form.form_definition.fields.map((field, index) => ({
              ...field,
              fieldId: `field-${index}`,
            }))
          : [];
        
        setState(prev => ({
          ...prev,
          entityType: form.entity_type || '',
          fields,
          currentStep: 3,
          loading: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load form',
          loading: false,
        }));
      }
    } else if (state.mode === 'new' && state.formName) {
      // Proceed to field selection
      setState(prev => ({ ...prev, currentStep: 2 }));
    }
  }, [state.mode, state.selectedFormId, state.formName]);

  const handleFieldsChange = useCallback((fields: SelectedField[]) => {
    setState(prev => ({
      ...prev,
      fields: fields as FieldConfig[],
      selectedFieldIndex: fields.length > 0 && prev.selectedFieldIndex === null ? 0 : prev.selectedFieldIndex,
    }));
  }, []);

  const handleFieldConfigChange = useCallback((updatedField: FieldConfig) => {
    setState(prev => {
      if (prev.selectedFieldIndex === null) return prev;
      const newFields = [...prev.fields];
      newFields[prev.selectedFieldIndex] = updatedField;
      return { ...prev, fields: newFields };
    });
  }, []);

  const handleFieldSelect = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedFieldIndex: index }));
  }, []);

  const handleBack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as WizardStep,
    }));
  }, []);

  const handleNext = useCallback(() => {
    if (state.currentStep === 2 && state.fields.length === 0) {
      setState(prev => ({ ...prev, error: 'Please select at least one field' }));
      return;
    }
    setState(prev => ({
      ...prev,
      currentStep: Math.min(3, prev.currentStep + 1) as WizardStep,
      error: null,
    }));
  }, [state.currentStep, state.fields.length]);

  const handleSave = useCallback(async () => {
    if (!state.entityType || state.fields.length === 0) {
      setState(prev => ({ ...prev, error: 'Invalid form configuration' }));
      return;
    }

    const formData: FormStepData = {
      formId: state.selectedFormId || undefined,
      formName: state.formName,
      entityType: state.entityType,
      fields: state.fields,
      mode: state.mode!,
    };

    onSave(formData);
  }, [state.entityType, state.fields, state.formName, state.mode, state.selectedFormId, onSave]);

  // Computed values
  const canProceedStep1 = state.mode === 'new' ? !!state.formName : !!state.selectedFormId;
  const canProceedStep2 = !!state.entityType && state.fields.length > 0;
  const isStepCompleted = (step: WizardStep) => state.currentStep > step;

  return (
    <ModalOverlay $isOpen={isOpen} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader>
          <HeaderLeft>
            <ModalTitle>Configure Form Step</ModalTitle>
            <WizardProgress>
              <ProgressStep $active={state.currentStep === 1} $completed={isStepCompleted(1)}>
                <StepNumber $active={state.currentStep === 1} $completed={isStepCompleted(1)}>
                  1
                </StepNumber>
                <span>Form Selection</span>
              </ProgressStep>
              <ProgressStep $active={state.currentStep === 2} $completed={isStepCompleted(2)}>
                <StepNumber $active={state.currentStep === 2} $completed={isStepCompleted(2)}>
                  2
                </StepNumber>
                <span>Field Selection</span>
              </ProgressStep>
              <ProgressStep $active={state.currentStep === 3} $completed={false}>
                <StepNumber $active={state.currentStep === 3} $completed={false}>
                  3
                </StepNumber>
                <span>Review & Save</span>
              </ProgressStep>
            </WizardProgress>
          </HeaderLeft>
          <CloseButton onClick={onClose} title="Close modal">
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        {/* Body */}
        <ModalBody>
          {/* Step 1: Form Selection */}
          <ContentArea $step={1} $currentStep={state.currentStep}>
            <FormSelectionPanel
              nodeType="formStep"
              onSelectionChange={handleFormSelection}
              onProceed={handleProceedFromStep1}
            />
          </ContentArea>

          {/* Step 2: Field Selection */}
          <SplitLayout $visible={state.currentStep === 2}>
            <LeftPanel>
              <EntityFieldPicker
                selectedFields={state.fields}
                onFieldsChange={handleFieldsChange}
                initialEntityType={state.entityType || undefined}
              />
            </LeftPanel>
            <RightPanel>
              {state.selectedFieldIndex !== null && state.fields[state.selectedFieldIndex] ? (
                <FieldConfigurationPanel
                  field={state.fields[state.selectedFieldIndex]}
                  onChange={handleFieldConfigChange}
                />
              ) : (
                <RightPanelEmpty>
                  <EmptyIcon>
                    <AlertCircle size={32} />
                  </EmptyIcon>
                  <h3>No field selected</h3>
                  <p>Select a field from the left panel to configure it</p>
                </RightPanelEmpty>
              )}
            </RightPanel>
          </SplitLayout>

          {/* Step 3: Review & Save */}
          <ContentArea $step={3} $currentStep={state.currentStep}>
            <div>
              <h3>Review Form Configuration</h3>
              <p>Form Name: {state.formName}</p>
              <p>Entity: {state.entityType}</p>
              <p>Fields: {state.fields.length}</p>
              {/* TODO: Add complete form preview */}
            </div>
          </ContentArea>
        </ModalBody>

        {/* Footer */}
        <ModalFooter>
          <FooterLeft>
            {state.error && (
              <ErrorMessage>
                <AlertCircle size={16} />
                <span>{state.error}</span>
              </ErrorMessage>
            )}
          </FooterLeft>
          <FooterRight>
            {state.currentStep > 1 && (
              <Button $variant="ghost" onClick={handleBack} disabled={state.loading}>
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
            {state.currentStep < 3 && (
              <Button
                $variant="primary"
                onClick={state.currentStep === 1 ? handleProceedFromStep1 : handleNext}
                disabled={state.currentStep === 1 ? !canProceedStep1 : !canProceedStep2 || state.loading}
              >
                Next
                <ArrowRight size={16} />
              </Button>
            )}
            {state.currentStep === 3 && (
              <>
                <Button $variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  $variant="primary"
                  onClick={handleSave}
                  disabled={!canProceedStep2 || state.loading}
                >
                  <Save size={16} />
                  Save Form
                </Button>
              </>
            )}
          </FooterRight>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
};
