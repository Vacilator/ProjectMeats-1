/**
 * FormProcessModal Component (formerly FormMultiStepContainerModal)
 * 
 * Configuration modal for Form Process nodes.
 * Allows users to configure container properties, navigation settings, and link to workflows.
 * 
 * Phase 4.3 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 * Renamed: 2026-02-14 - Phase 2: FormMultiStepContainer → FormProcess
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { X, ArrowLeft, Save, AlertCircle, Package, Settings, Navigation } from 'lucide-react';
import { FormSelectionPanel } from '../ConfigPanel';

// ============================================================================
// TypeScript Types
// ============================================================================

export interface ContainerModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when container is saved */
  onSave: (containerData: ContainerData) => void;
  /** Initial container data (for editing existing container) */
  initialData?: ContainerData;
  /** Node ID (for context) */
  nodeId?: string;
}

export interface ContainerData {
  /** Container ID (if using existing workflow) */
  workflowId?: string;
  /** Container name */
  containerName: string;
  /** Container description */
  containerDescription?: string;
  /** Configuration mode: 'new' or 'existing' */
  mode: 'new' | 'existing';
  /** Show progress indicator during execution */
  showProgressIndicator: boolean;
  /** Allow users to navigate back to previous steps */
  allowBackNavigation: boolean;
  /** Allow users to skip optional steps */
  allowSkipSteps: boolean;
  /** Auto-advance to next step on completion */
  autoAdvance: boolean;
  /** Require confirmation before exit */
  confirmOnExit: boolean;
}

type WizardStep = 1 | 2;

interface ModalState {
  /** Current wizard step */
  currentStep: WizardStep;
  /** Configuration mode */
  mode: 'new' | 'existing' | null;
  /** Container name */
  containerName: string;
  /** Container description */
  containerDescription: string;
  /** Selected workflow ID (if using existing) */
  selectedWorkflowId: string | null;
  /** Navigation and behavior settings */
  showProgressIndicator: boolean;
  allowBackNavigation: boolean;
  allowSkipSteps: boolean;
  autoAdvance: boolean;
  confirmOnExit: boolean;
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
  background: rgb(var(--color-background));
  border-radius: 12px;
  width: 90vw;
  height: 85vh;
  max-width: 1200px;
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
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const ContainerIcon = styled.div`
  font-size: 28px;
  line-height: 1;
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(var(--color-danger), 0.1);
    color: rgb(var(--color-danger));
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: rgb(var(--color-surface));
`;

const StepIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
`;

const StepBadge = styled.div<{ $active: boolean; $completed: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: ${props =>
    props.$active
      ? 'rgba(139, 92, 246, 0.15)'
      : props.$completed
      ? 'rgba(34, 197, 94, 0.15)'
      : 'transparent'};
  border: 1px solid ${props =>
    props.$active
      ? 'rgb(139, 92, 246)'
      : props.$completed
      ? 'rgb(34, 197, 94)'
      : 'rgb(var(--color-border))'};
  color: ${props =>
    props.$active
      ? 'rgb(139, 92, 246)'
      : props.$completed
      ? 'rgb(34, 197, 94)'
      : 'rgb(var(--color-text-secondary))'};
  font-size: 14px;
  font-weight: 600;
`;

const ConfigSection = styled.div`
  background: rgb(var(--color-surface-hover));
  border-radius: 8px;
  padding: 20px;
  border: 1px solid rgb(var(--color-border));
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  
  .icon {
    color: rgb(139, 92, 246);
  }
  
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
  }
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(139, 92, 246);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(139, 92, 246);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const CheckboxGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: rgb(139, 92, 246);
    background: rgba(139, 92, 246, 0.05);
  }
  
  input[type="checkbox"] {
    margin-top: 2px;
    cursor: pointer;
  }
  
  .label-text {
    flex: 1;
    
    .title {
      font-size: 14px;
      font-weight: 500;
      color: rgb(var(--color-text-primary));
      margin-bottom: 4px;
    }
    
    .description {
      font-size: 12px;
      color: rgb(var(--color-text-secondary));
      line-height: 1.4;
    }
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--color-danger), 0.1);
  border: 1px solid rgba(var(--color-danger), 0.3);
  border-radius: 6px;
  color: rgb(var(--color-danger));
  font-size: 14px;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface-hover));
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: linear-gradient(135deg, rgb(139, 92, 246), rgb(109, 40, 217));
        color: white;
        
        &:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
      `;
    } else if (props.$variant === 'secondary') {
      return `
        background: rgb(var(--color-bg-tertiary));
        color: rgb(var(--color-text-primary));
        border: 1px solid rgb(var(--color-border));
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-surface-hover));
        }
      `;
    } else {
      return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        
        &:hover:not(:disabled) {
          background: rgb(var(--color-bg-tertiary));
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
    transform: translateY(0);
  }
`;

// ============================================================================
// Component
// ============================================================================

export const FormProcessModal: React.FC<ContainerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  nodeId,
}) => {
  const [state, setState] = useState<ModalState>({
    currentStep: 1,
    mode: null,
    containerName: '',
    containerDescription: '',
    selectedWorkflowId: null,
    showProgressIndicator: true,
    allowBackNavigation: true,
    allowSkipSteps: false,
    autoAdvance: false,
    confirmOnExit: true,
    loading: false,
    error: null,
  });

  // Initialize with initial data
  useEffect(() => {
    if (isOpen && initialData) {
      setState(prev => ({
        ...prev,
        mode: initialData.mode,
        containerName: initialData.containerName,
        containerDescription: initialData.containerDescription || '',
        selectedWorkflowId: initialData.workflowId || null,
        showProgressIndicator: initialData.showProgressIndicator,
        allowBackNavigation: initialData.allowBackNavigation,
        allowSkipSteps: initialData.allowSkipSteps,
        autoAdvance: initialData.autoAdvance,
        confirmOnExit: initialData.confirmOnExit,
        currentStep: initialData.mode === 'existing' ? 2 : 1,
      }));
    }
  }, [isOpen, initialData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        currentStep: 1,
        mode: null,
        containerName: '',
        containerDescription: '',
        selectedWorkflowId: null,
        showProgressIndicator: true,
        allowBackNavigation: true,
        allowSkipSteps: false,
        autoAdvance: false,
        confirmOnExit: true,
        loading: false,
        error: null,
      });
    }
  }, [isOpen]);

  // Handlers
  const handleContainerSelection = useCallback((selection: { 
    mode: 'new' | 'existing'; 
    formName?: string; 
    formId?: string;
    form?: any;
  }) => {
    console.log('[FormProcessModal] Selection changed:', selection);
    setState(prev => ({
      ...prev,
      mode: selection.mode,
      containerName: selection.formName || prev.containerName,
      selectedWorkflowId: selection.formId || null,
      error: null,
    }));
  }, []);

  const handleProceedFromStep1 = useCallback(() => {
    console.log('[FormProcessModal] Proceeding from step 1:', {
      mode: state.mode,
      containerName: state.containerName,
      selectedWorkflowId: state.selectedWorkflowId
    });
    if (state.mode === 'new' && state.containerName) {
      setState(prev => ({ ...prev, currentStep: 2 }));
    } else if (state.mode === 'existing' && state.selectedWorkflowId) {
      setState(prev => ({ ...prev, currentStep: 2 }));
    } else {
      console.error('[FormProcessModal] Cannot proceed - invalid state');
    }
  }, [state.mode, state.containerName, state.selectedWorkflowId]);

  const handleBack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as WizardStep,
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (!state.containerName) {
      setState(prev => ({ ...prev, error: 'Container name is required' }));
      return;
    }

    const containerData: ContainerData = {
      workflowId: state.selectedWorkflowId || undefined,
      containerName: state.containerName,
      containerDescription: state.containerDescription || undefined,
      mode: state.mode || 'new',
      showProgressIndicator: state.showProgressIndicator,
      allowBackNavigation: state.allowBackNavigation,
      allowSkipSteps: state.allowSkipSteps,
      autoAdvance: state.autoAdvance,
      confirmOnExit: state.confirmOnExit,
    };

    onSave(containerData);
    onClose();
  }, [state, onSave, onClose]);

  const canProceedFromStep1 = 
    (state.mode === 'new' && state.containerName.trim().length > 0) ||
    (state.mode === 'existing' && state.selectedWorkflowId !== null);

  const canSave = state.containerName.trim().length > 0;

  // Render step content
  const renderStepContent = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <FormSelectionPanel
            nodeType="formMultiStepContainer"
            selectedFormId={state.selectedWorkflowId || undefined}
            onSelectionChange={handleContainerSelection}
            onProceed={handleProceedFromStep1}
            filterType="multi_step"
          />
        );
      
      case 2:
        return (
          <>
            <ConfigSection>
              <SectionHeader>
                <Settings className="icon" size={20} />
                <h3>Container Details</h3>
              </SectionHeader>
              
              <FormGroup>
                <Label htmlFor="containerName">Container Name *</Label>
                <Input
                  id="containerName"
                  type="text"
                  value={state.containerName}
                  onChange={(e) => setState(prev => ({ ...prev, containerName: e.target.value }))}
                  placeholder="e.g., Customer Onboarding Flow"
                  autoFocus
                />
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="containerDescription">Description (Optional)</Label>
                <TextArea
                  id="containerDescription"
                  value={state.containerDescription}
                  onChange={(e) => setState(prev => ({ ...prev, containerDescription: e.target.value }))}
                  placeholder="Describe the purpose and flow of this container..."
                />
              </FormGroup>
            </ConfigSection>
            
            <ConfigSection>
              <SectionHeader>
                <Navigation className="icon" size={20} />
                <h3>Navigation & Behavior</h3>
              </SectionHeader>
              
              <CheckboxGroup>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={state.showProgressIndicator}
                    onChange={(e) => setState(prev => ({ ...prev, showProgressIndicator: e.target.checked }))}
                  />
                  <div className="label-text">
                    <div className="title">Show Progress Indicator</div>
                    <div className="description">Display step progress during execution</div>
                  </div>
                </CheckboxLabel>
                
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={state.allowBackNavigation}
                    onChange={(e) => setState(prev => ({ ...prev, allowBackNavigation: e.target.checked }))}
                  />
                  <div className="label-text">
                    <div className="title">Allow Back Navigation</div>
                    <div className="description">Users can return to previous steps</div>
                  </div>
                </CheckboxLabel>
                
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={state.allowSkipSteps}
                    onChange={(e) => setState(prev => ({ ...prev, allowSkipSteps: e.target.checked }))}
                  />
                  <div className="label-text">
                    <div className="title">Allow Skip Steps</div>
                    <div className="description">Users can skip optional steps</div>
                  </div>
                </CheckboxLabel>
                
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={state.autoAdvance}
                    onChange={(e) => setState(prev => ({ ...prev, autoAdvance: e.target.checked }))}
                  />
                  <div className="label-text">
                    <div className="title">Auto-Advance</div>
                    <div className="description">Automatically proceed to next step on completion</div>
                  </div>
                </CheckboxLabel>
                
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={state.confirmOnExit}
                    onChange={(e) => setState(prev => ({ ...prev, confirmOnExit: e.target.checked }))}
                  />
                  <div className="label-text">
                    <div className="title">Confirm on Exit</div>
                    <div className="description">Require confirmation before leaving the flow</div>
                  </div>
                </CheckboxLabel>
              </CheckboxGroup>
            </ConfigSection>
          </>
        );
      
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay $isOpen={isOpen} onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <HeaderLeft>
            <ContainerIcon>📦</ContainerIcon>
            <div>
              <ModalTitle>Configure Form Process</ModalTitle>
            </div>
          </HeaderLeft>
          <CloseButton onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </CloseButton>
        </ModalHeader>
        
        <ModalBody>
          <StepIndicator>
            <StepBadge $active={state.currentStep === 1} $completed={state.currentStep > 1}>
              Step 1: Selection
            </StepBadge>
            <StepBadge $active={state.currentStep === 2} $completed={false}>
              Step 2: Configuration
            </StepBadge>
          </StepIndicator>
          
          {state.error && (
            <ErrorMessage>
              <AlertCircle size={16} />
              {state.error}
            </ErrorMessage>
          )}
          
          {renderStepContent()}
        </ModalBody>
        
        <ModalFooter>
          <ButtonGroup>
            {state.currentStep > 1 && (
              <Button $variant="ghost" onClick={handleBack}>
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
          </ButtonGroup>
          
          <ButtonGroup>
            <Button $variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            
            {state.currentStep === 1 ? (
              <Button 
                $variant="primary" 
                onClick={handleProceedFromStep1}
                disabled={!canProceedFromStep1}
              >
                Next
                <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
              </Button>
            ) : (
              <Button 
                $variant="primary" 
                onClick={handleSave}
                disabled={!canSave}
              >
                <Save size={16} />
                Save Container
              </Button>
            )}
          </ButtonGroup>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default FormProcessModal;
