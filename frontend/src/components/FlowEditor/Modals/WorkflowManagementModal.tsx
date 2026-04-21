/**
 * Workflow Management Modal Component
 * 
 * Phase 8.2: Professional workflow creation/editing UI
 * - Replace prompt() with proper modal
 * - Add workflow name, description, status fields
 * - Form validation
 * 
 * Created: 2026-02-08
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, Save, AlertCircle } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface WorkflowMetadata {
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
}

interface WorkflowManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (metadata: WorkflowMetadata) => void;
  initialData?: Partial<WorkflowMetadata>;
  mode: 'create' | 'edit';
}

// ============================================================================
// Styled Components
// ============================================================================

const ModalOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--color-overlay), 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  
  /* Phase 8.4: Smooth fade-in animation */
  animation: ${props => props.$isOpen ? 'fadeIn 0.2s ease' : 'none'};
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ModalContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(var(--color-overlay), 0.1), 0 10px 10px -5px rgba(var(--color-overlay), 0.04);
  
  /* Phase 8.4: Smooth scale-in animation */
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const ModalHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const ModalBody = styled.div`
  padding: 24px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const RequiredIndicator = styled.span`
  color: rgb(var(--color-error));
  margin-left: 4px;
`;

const Input = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px ${props => props.$hasError ? 'rgba(var(--color-error), 0.1)' : 'rgba(var(--color-primary-rgb), 0.1)'};
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  resize: vertical;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
  }
`;

const HelpText = styled.p`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin: 6px 0 0 0;
`;

const ErrorText = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-error));
  margin-top: 6px;
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const ModalFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$variant === 'primary' ? 'white' : 'rgb(var(--color-text-primary))'};
  background: ${props => props.$variant === 'primary' ? 'rgb(var(--color-primary))' : 'transparent'};
  border: 1px solid ${props => props.$variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.$variant === 'primary' ? 'rgba(var(--color-primary-rgb), 0.9)' : 'rgb(var(--color-background))'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.div<{ $status: 'draft' | 'active' | 'archived' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: ${props => {
    switch (props.$status) {
      case 'draft': return 'rgba(var(--color-warning), 0.1)';
      case 'active': return 'rgba(var(--color-success), 0.1)';
      case 'archived': return 'rgba(var(--color-border), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'draft': return 'rgb(var(--color-warning))';
      case 'active': return 'rgb(var(--color-success))';
      case 'archived': return 'rgb(var(--color-text-tertiary))';
    }
  }};
`;

// ============================================================================
// Component
// ============================================================================

export const WorkflowManagementModal: React.FC<WorkflowManagementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(initialData?.status || 'draft');
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setStatus(initialData?.status || 'draft');
      setErrors({});
    }
  }, [isOpen, initialData]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Workflow name is required';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Workflow name must be at least 3 characters';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Workflow name must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (validate()) {
      onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });
      onClose();
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  // Prevent closing when clicking inside modal
  const handleContentClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <ModalOverlay $isOpen={isOpen} onClick={onClose}>
      <ModalContent onClick={handleContentClick} onKeyDown={handleKeyDown}>
        <ModalHeader>
          <ModalTitle>
            {mode === 'create' ? 'Create New Workflow' : 'Edit Workflow'}
          </ModalTitle>
          <CloseButton onClick={onClose} title="Close (ESC)">
            <X size={18} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          {/* Workflow Name */}
          <FormGroup>
            <Label htmlFor="workflow-name">
              Workflow Name
              <RequiredIndicator>*</RequiredIndicator>
            </Label>
            <Input
              id="workflow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Supplier Onboarding Flow"
              $hasError={!!errors.name}
              autoFocus
            />
            {errors.name && (
              <ErrorText>
                <AlertCircle />
                {errors.name}
              </ErrorText>
            )}
            <HelpText>
              Choose a descriptive name that identifies the workflow's purpose
            </HelpText>
          </FormGroup>

          {/* Description */}
          <FormGroup>
            <Label htmlFor="workflow-description">
              Description
            </Label>
            <Textarea
              id="workflow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does and when to use it..."
            />
            <HelpText>
              Optional. Add details to help team members understand this workflow.
            </HelpText>
          </FormGroup>

          {/* Status */}
          <FormGroup>
            <Label htmlFor="workflow-status">
              Status
            </Label>
            <Select
              id="workflow-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}
            >
              <option value="draft">Draft - Work in progress</option>
              <option value="active">Active - Ready for use</option>
              <option value="archived">Archived - No longer in use</option>
            </Select>
            <HelpText>
              Current status: <StatusBadge $status={status}>{status}</StatusBadge>
            </HelpText>
          </FormGroup>
        </ModalBody>

        <ModalFooter>
          <Button $variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button $variant="primary" onClick={handleSave}>
            <Save size={16} />
            {mode === 'create' ? 'Create Workflow' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};
