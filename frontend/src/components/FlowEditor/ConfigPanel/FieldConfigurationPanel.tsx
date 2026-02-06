/**
 * FieldConfigurationPanel Component
 * 
 * Inline field editor for configuring individual form fields.
 * Features:
 * - Field label editing
 * - Required toggle
 * - Validation rules
 * - Field type-specific options (choices, references, etc.)
 * - Help text
 * - Placeholder text
 * - Default value
 * 
 * Phase 2.4 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { SelectedField } from './EntityFieldPicker';

// ============================================================================
// Types
// ============================================================================

export interface ValidationRule {
  type: 'min_length' | 'max_length' | 'min_value' | 'max_value' | 'pattern' | 'custom';
  value: string | number;
  message?: string;
}

export interface FieldConfig extends SelectedField {
  /** Custom label override */
  customLabel?: string;
  /** Help text override */
  customHelpText?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: any;
  /** Custom validation rules */
  customValidation?: ValidationRule[];
  /** For choice fields: custom choices */
  customChoices?: Array<{ value: string; label: string }>;
  /** For reference fields: lookup filter */
  lookupFilter?: string;
}

export interface FieldConfigurationPanelProps {
  /** Field being configured */
  field: FieldConfig;
  
  /** Callback when field configuration changes */
  onChange: (field: FieldConfig) => void;
  
  /** Callback when done editing */
  onClose?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: rgb(var(--color-surface));
  border-left: 1px solid rgb(var(--color-border));
  height: 100%;
  overflow-y: auto;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 4px;
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

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Textarea = styled.textarea`
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
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

const CheckboxWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
`;

const HintText = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

const Badge = styled.span<{ variant?: 'info' | 'warning' }>`
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 3px;
  background: ${props => {
    if (props.variant === 'warning') return 'rgba(234, 179, 8, 0.1)';
    return 'rgba(var(--color-primary), 0.1)';
  }};
  color: ${props => {
    if (props.variant === 'warning') return 'rgb(234, 179, 8)';
    return 'rgb(var(--color-primary))';
  }};
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgb(var(--color-border));
  margin: 12px 0;
`;

const ValidationRulesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ValidationRuleItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
`;

const RemoveButton = styled.button`
  padding: 4px 8px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  }
`;

const AddButton = styled.button`
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  border: 1px dashed rgb(var(--color-border));
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--color-primary));
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;

const PreviewSection = styled.div`
  padding: 16px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
`;

const PreviewLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const PreviewField = styled.div`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: white;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

// ============================================================================
// Component
// ============================================================================

export const FieldConfigurationPanel: React.FC<FieldConfigurationPanelProps> = ({
  field,
  onChange,
  onClose,
}) => {
  const [localField, setLocalField] = useState<FieldConfig>(field);

  // Sync with external changes
  useEffect(() => {
    setLocalField(field);
  }, [field]);

  const handleChange = (updates: Partial<FieldConfig>) => {
    const updatedField = { ...localField, ...updates };
    setLocalField(updatedField);
    onChange(updatedField);
  };

  const handleAddValidationRule = () => {
    const newRule: ValidationRule = {
      type: 'min_length',
      value: 1,
      message: 'Validation failed',
    };
    
    handleChange({
      customValidation: [...(localField.customValidation || []), newRule],
    });
  };

  const handleRemoveValidationRule = (index: number) => {
    const rules = localField.customValidation || [];
    handleChange({
      customValidation: rules.filter((_, i) => i !== index),
    });
  };

  const displayLabel = localField.customLabel || localField.label;
  const displayHelpText = localField.customHelpText || localField.help_text || '';

  return (
    <Container>
      <Title>Configure Field</Title>

      {/* Original Field Info */}
      <FieldGroup>
        <Label>Original Field</Label>
        <Badge variant="info">
          {field.name} ({field.type})
        </Badge>
        {field.required && <Badge variant="warning">Required</Badge>}
      </FieldGroup>

      <Divider />

      {/* Custom Label */}
      <FieldGroup>
        <Label htmlFor="custom-label">
          Display Label
          <HintText>(Override the default field label)</HintText>
        </Label>
        <Input
          id="custom-label"
          type="text"
          value={localField.customLabel || ''}
          onChange={(e) => handleChange({ customLabel: e.target.value })}
          placeholder={field.label}
        />
      </FieldGroup>

      {/* Help Text */}
      <FieldGroup>
        <Label htmlFor="help-text">
          Help Text
          <HintText>(Additional context for users)</HintText>
        </Label>
        <Textarea
          id="help-text"
          value={localField.customHelpText || ''}
          onChange={(e) => handleChange({ customHelpText: e.target.value })}
          placeholder={field.help_text || 'Enter help text...'}
        />
      </FieldGroup>

      {/* Placeholder */}
      {['text', 'email', 'number', 'textarea'].includes(field.type) && (
        <FieldGroup>
          <Label htmlFor="placeholder">Placeholder Text</Label>
          <Input
            id="placeholder"
            type="text"
            value={localField.placeholder || ''}
            onChange={(e) => handleChange({ placeholder: e.target.value })}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </FieldGroup>
      )}

      {/* Default Value */}
      <FieldGroup>
        <Label htmlFor="default-value">Default Value</Label>
        {field.type === 'checkbox' ? (
          <CheckboxWrapper>
            <Checkbox
              id="default-value"
              type="checkbox"
              checked={!!localField.defaultValue}
              onChange={(e) => handleChange({ defaultValue: e.target.checked })}
            />
            <CheckboxLabel htmlFor="default-value">
              Checked by default
            </CheckboxLabel>
          </CheckboxWrapper>
        ) : (
          <Input
            id="default-value"
            type={field.type === 'number' ? 'number' : 'text'}
            value={localField.defaultValue || ''}
            onChange={(e) => handleChange({ defaultValue: e.target.value })}
            placeholder="Leave empty for no default"
          />
        )}
      </FieldGroup>

      <Divider />

      {/* Validation Rules */}
      <FieldGroup>
        <Label>Validation Rules</Label>
        <ValidationRulesList>
          {/* Show original required rule */}
          {field.required && (
            <ValidationRuleItem>
              <Badge variant="warning">Required</Badge>
              <span style={{ fontSize: '13px', color: 'rgb(var(--color-text-secondary))' }}>
                This field is required by the entity
              </span>
            </ValidationRuleItem>
          )}

          {/* Show max_length from field definition */}
          {field.max_length && (
            <ValidationRuleItem>
              <Badge variant="info">Max Length</Badge>
              <span style={{ fontSize: '13px', color: 'rgb(var(--color-text-secondary))' }}>
                Maximum {field.max_length} characters
              </span>
            </ValidationRuleItem>
          )}

          {/* Custom validation rules */}
          {localField.customValidation?.map((rule, index) => (
            <ValidationRuleItem key={index}>
              <Badge>{rule.type}</Badge>
              <span style={{ fontSize: '13px', color: 'rgb(var(--color-text-secondary))' }}>
                {rule.value}
              </span>
              <RemoveButton onClick={() => handleRemoveValidationRule(index)}>
                Remove
              </RemoveButton>
            </ValidationRuleItem>
          ))}
        </ValidationRulesList>
        
        <AddButton onClick={handleAddValidationRule}>
          + Add Custom Validation
        </AddButton>
      </FieldGroup>

      <Divider />

      {/* Live Preview */}
      <FieldGroup>
        <Label>Live Preview</Label>
        <PreviewSection>
          <PreviewLabel>
            {displayLabel}
            {field.required && <span style={{ color: 'rgb(239, 68, 68)' }}> *</span>}
          </PreviewLabel>
          {displayHelpText && (
            <HintText style={{ marginBottom: '8px' }}>{displayHelpText}</HintText>
          )}
          <PreviewField>
            {localField.placeholder || localField.defaultValue || `Enter ${displayLabel.toLowerCase()}...`}
          </PreviewField>
        </PreviewSection>
      </FieldGroup>
    </Container>
  );
};

export default FieldConfigurationPanel;
