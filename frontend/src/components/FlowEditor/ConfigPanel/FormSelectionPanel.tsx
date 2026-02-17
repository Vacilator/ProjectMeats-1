/**
 * FormSelectionPanel Component
 * 
 * First panel shown when configuring Form Step or Form Multi-Step Container nodes.
 * Allows user to choose between:
 * - Creating a new form (shows name input)
 * - Using an existing form (shows cascading dropdown)
 * 
 * Phase 2.2 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import workformsApi, { TenantForm } from '../../../services/workformsApi';

// ============================================================================
// Types
// ============================================================================

export interface FormSelectionPanelProps {
  /** Node type: 'formStep' or 'formMultiStepContainer' */
  nodeType: 'formStep' | 'formMultiStepContainer';
  
  /** Currently selected form ID (if editing existing node) */
  selectedFormId?: string;
  
  /** Callback when selection changes */
  onSelectionChange: (selection: {
    mode: 'new' | 'existing';
    formId?: string;
    formName?: string;
    form?: TenantForm;
  }) => void;
  
  /** Callback when user wants to proceed */
  onProceed: () => void;
  
  /** Optional: Filter forms by type */
  filterType?: 'single_step' | 'multi_step';
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: rgb(var(--color-surface));
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

const OptionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const OptionCard = styled.button<{ selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  background: ${props => props.selected ? 'rgba(var(--color-primary), 0.1)' : 'rgb(var(--color-background))'};
  border: 2px solid ${props => props.selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.2);
  }
`;

const OptionTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const OptionDescription = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const Select = styled.select`
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingText = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
  padding: 20px;
`;

const ErrorText = styled.div`
  font-size: 14px;
  color: rgb(239, 68, 68); /* error color */
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.3);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${props => props.variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;

    &:hover:not(:disabled) {
      background: rgba(var(--color-primary), 0.9);
    }
  ` : `
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));

    &:hover:not(:disabled) {
      background: rgb(var(--color-surface));
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.2);
  }
`;

// ============================================================================
// Component
// ============================================================================

export const FormSelectionPanel: React.FC<FormSelectionPanelProps> = ({
  nodeType,
  selectedFormId,
  onSelectionChange,
  onProceed,
  filterType,
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [newFormName, setNewFormName] = useState('');
  const [existingForms, setExistingForms] = useState<TenantForm[]>([]);
  const [selectedExistingFormId, setSelectedExistingFormId] = useState<string>(selectedFormId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing forms when mode switches to 'existing'
  useEffect(() => {
    if (mode === 'existing') {
      loadExistingForms();
    }
  }, [mode, filterType]);

  const loadExistingForms = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const forms = await workformsApi.listTenantForms({
        type: filterType,
      });
      setExistingForms(forms);
    } catch (err: any) {
      console.error('[FormSelectionPanel] Failed to load forms:', err);
      setError(err.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: 'new' | 'existing') => {
    setMode(newMode);
    setError(null);
    
    if (newMode === 'new') {
      onSelectionChange({
        mode: 'new',
        formName: newFormName,
      });
    } else {
      onSelectionChange({
        mode: 'existing',
        formId: selectedExistingFormId,
        form: existingForms.find(f => f.id === selectedExistingFormId),
      });
    }
  };

  const handleNewFormNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewFormName(name);
    onSelectionChange({
      mode: 'new',
      formName: name,
    });
  };

  const handleExistingFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const formId = e.target.value;
    setSelectedExistingFormId(formId);
    const selectedForm = existingForms.find(f => f.id === formId);
    onSelectionChange({
      mode: 'existing',
      formId: formId,
      form: selectedForm,
    });
  };

  const canProceed = mode === 'new' ? newFormName.trim().length > 0 : !!selectedExistingFormId;

  const nodeTypeLabel = nodeType === 'formStep' ? 'Form Step' : 'Multi-Step Form Container';

  return (
    <Container>
      <div>
        <Title>Configure {nodeTypeLabel}</Title>
        <Description>
          {nodeType === 'formStep' 
            ? 'Choose whether to create a new form or use an existing one from your library.'
            : 'Choose whether to create a new multi-step form container or use an existing one.'}
        </Description>
      </div>

      <OptionGroup>
        <OptionCard
          selected={mode === 'new'}
          onClick={() => handleModeChange('new')}
          type="button"
        >
          <OptionTitle>✨ Create New Form</OptionTitle>
          <OptionDescription>
            Start with a blank form and configure fields from entity schemas.
          </OptionDescription>
        </OptionCard>

        {mode === 'new' && (
          <InputGroup>
            <Label htmlFor="new-form-name">Form Name *</Label>
            <Input
              id="new-form-name"
              type="text"
              placeholder="e.g., Supplier Contact Form"
              value={newFormName}
              onChange={handleNewFormNameChange}
              autoFocus
              required
            />
          </InputGroup>
        )}

        <OptionCard
          selected={mode === 'existing'}
          onClick={() => handleModeChange('existing')}
          type="button"
        >
          <OptionTitle>📋 Use Existing Form</OptionTitle>
          <OptionDescription>
            Select a form from your library to reuse in this workflow.
          </OptionDescription>
        </OptionCard>

        {mode === 'existing' && (
          <InputGroup>
            {loading ? (
              <LoadingText>Loading forms...</LoadingText>
            ) : error ? (
              <ErrorText>{error}</ErrorText>
            ) : (
              <>
                <Label htmlFor="existing-form-select">Select Form *</Label>
                <Select
                  id="existing-form-select"
                  value={selectedExistingFormId}
                  onChange={handleExistingFormChange}
                  disabled={existingForms.length === 0}
                >
                  <option value="">-- Select a form --</option>
                  {existingForms.map(form => (
                    <option key={form.id} value={form.id}>
                      {form.name} ({form.type === 'single_step' ? 'Single' : 'Multi'}-step, v{form.version})
                    </option>
                  ))}
                </Select>
                {existingForms.length === 0 && (
                  <Description>No existing forms found. Create a new one instead.</Description>
                )}
              </>
            )}
          </InputGroup>
        )}
      </OptionGroup>

      <ButtonGroup>
        <Button
          variant="primary"
          onClick={onProceed}
          disabled={!canProceed}
        >
          {mode === 'new' ? 'Create & Configure' : 'Use Selected Form'}
        </Button>
      </ButtonGroup>
    </Container>
  );
};

export default FormSelectionPanel;
