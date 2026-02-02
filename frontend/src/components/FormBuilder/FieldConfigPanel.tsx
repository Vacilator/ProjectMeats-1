/**
 * FieldConfigPanel Component
 * 
 * Panel for configuring individual form field properties.
 * Used in form builder to set validation, display, and behavior options.
 */
import React, { useState, useCallback } from 'react';
import styled, { css, keyframes } from 'styled-components';

// ============================================================================
// TYPES
// ============================================================================

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'signature'
  | 'currency';

export interface FieldOption {
  value: string;
  label: string;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: string | number;
  message?: string;
}

export interface FieldConfig {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation: ValidationRule[];
  readonly?: boolean;
  hidden?: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  // Number specific
  min?: number;
  max?: number;
  step?: number;
  // Text specific
  minLength?: number;
  maxLength?: number;
  // File specific
  acceptedTypes?: string[];
  maxFileSize?: number;
  // Currency specific
  currency?: string;
  // Conditional
  conditionalRules?: string[];
}

export interface FieldConfigPanelProps {
  field: FieldConfig;
  onChange: (field: FieldConfig) => void;
  onClose?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'textarea', label: 'Long Text', icon: '📄' },
  { value: 'number', label: 'Number', icon: '🔢' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'datetime', label: 'Date & Time', icon: '🕐' },
  { value: 'time', label: 'Time', icon: '⏰' },
  { value: 'select', label: 'Dropdown', icon: '📋' },
  { value: 'multiselect', label: 'Multi-Select', icon: '☑️' },
  { value: 'checkbox', label: 'Checkbox', icon: '✅' },
  { value: 'radio', label: 'Radio Buttons', icon: '🔘' },
  { value: 'file', label: 'File Upload', icon: '📁' },
  { value: 'signature', label: 'Signature', icon: '✍️' },
  { value: 'currency', label: 'Currency', icon: '💰' },
];

const WIDTH_OPTIONS: { value: FieldConfig['width']; label: string }[] = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half Width' },
  { value: 'third', label: 'One Third' },
  { value: 'quarter', label: 'One Quarter' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-surface, 255 255 255));
  animation: ${fadeIn} 0.2s ease-out;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border, 229 231 235));
  background: rgb(var(--color-surface-alt, 249 250 251));
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 17 24 39));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  padding: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary, 107 114 128));
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;
  
  &:hover {
    background: rgb(var(--color-surface-hover, 243 244 246));
    color: rgb(var(--color-text-primary, 17 24 39));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const Section = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary, 107 114 128));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 17 24 39));
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  font-size: 14px;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 17 24 39));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary, 102 126 234), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary, 156 163 175));
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  font-size: 14px;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 17 24 39));
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary, 102 126 234), 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  font-size: 14px;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 17 24 39));
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary, 102 126 234), 0.1);
  }
`;

const TypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`;

const TypeButton = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: ${props => props.$selected 
    ? 'rgb(var(--color-primary-bg, 238 242 255))' 
    : 'rgb(var(--color-surface, 255 255 255))'};
  border: 1px solid ${props => props.$selected 
    ? 'rgb(var(--color-primary, 102 126 234))' 
    : 'rgb(var(--color-border, 229 231 235))'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    ${props => !props.$selected && css`
      border-color: rgb(var(--color-primary, 102 126 234));
      background: rgb(var(--color-surface-hover, 243 244 246));
    `}
  }
  
  .icon {
    font-size: 20px;
  }
  
  .label {
    font-size: 11px;
    color: ${props => props.$selected 
      ? 'rgb(var(--color-primary, 102 126 234))' 
      : 'rgb(var(--color-text-secondary, 107 114 128))'};
    font-weight: ${props => props.$selected ? 600 : 400};
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgb(var(--color-text-primary, 17 24 39));
  cursor: pointer;
  
  input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
`;

const OptionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const OptionRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const OptionInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 4px;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }
`;

const RemoveOptionButton = styled.button`
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-tertiary, 156 163 175));
  cursor: pointer;
  font-size: 14px;
  border-radius: 4px;
  
  &:hover {
    background: rgb(var(--color-error-bg, 254 242 242));
    color: rgb(var(--color-error, 239 68 68));
  }
`;

const AddOptionButton = styled.button`
  padding: 8px 12px;
  background: transparent;
  border: 1px dashed rgb(var(--color-border, 229 231 235));
  border-radius: 4px;
  color: rgb(var(--color-text-secondary, 107 114 128));
  cursor: pointer;
  font-size: 13px;
  
  &:hover {
    border-color: rgb(var(--color-primary, 102 126 234));
    color: rgb(var(--color-primary, 102 126 234));
  }
`;

const ValidationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ValidationRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: rgb(var(--color-surface-alt, 249 250 251));
  border-radius: 6px;
`;

const ValidationSelect = styled.select`
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 4px;
  font-size: 13px;
  background: rgb(var(--color-surface, 255 255 255));
  min-width: 120px;
`;

const ValidationInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 4px;
  font-size: 13px;
  min-width: 80px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }
`;

const RowPair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const HelpText = styled.p`
  margin: 4px 0 0 0;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary, 156 163 175));
`;

// ============================================================================
// HELPERS
// ============================================================================

const needsOptions = (type: FieldType): boolean => {
  return ['select', 'multiselect', 'radio'].includes(type);
};

const getValidationOptions = (type: FieldType): { value: ValidationRule['type']; label: string }[] => {
  const common = [
    { value: 'required' as const, label: 'Required' },
  ];
  
  const textValidations = [
    { value: 'minLength' as const, label: 'Min Length' },
    { value: 'maxLength' as const, label: 'Max Length' },
    { value: 'pattern' as const, label: 'Pattern (Regex)' },
  ];
  
  const numberValidations = [
    { value: 'min' as const, label: 'Minimum' },
    { value: 'max' as const, label: 'Maximum' },
  ];
  
  switch (type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
      return [...common, ...textValidations];
    case 'number':
    case 'currency':
      return [...common, ...numberValidations];
    default:
      return common;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const FieldConfigPanel: React.FC<FieldConfigPanelProps> = ({
  field,
  onChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'validation' | 'advanced'>('basic');
  
  const updateField = useCallback((updates: Partial<FieldConfig>) => {
    onChange({ ...field, ...updates });
  }, [field, onChange]);
  
  const updateOption = useCallback((index: number, updates: Partial<FieldOption>) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = { ...newOptions[index], ...updates };
    updateField({ options: newOptions });
  }, [field.options, updateField]);
  
  const addOption = useCallback(() => {
    const newOptions = [...(field.options || []), { value: '', label: '' }];
    updateField({ options: newOptions });
  }, [field.options, updateField]);
  
  const removeOption = useCallback((index: number) => {
    const newOptions = (field.options || []).filter((_, i) => i !== index);
    updateField({ options: newOptions });
  }, [field.options, updateField]);
  
  const addValidation = useCallback((type: ValidationRule['type']) => {
    const newValidation: ValidationRule = { type };
    updateField({ validation: [...field.validation, newValidation] });
  }, [field.validation, updateField]);
  
  const updateValidation = useCallback((index: number, updates: Partial<ValidationRule>) => {
    const newValidation = [...field.validation];
    newValidation[index] = { ...newValidation[index], ...updates };
    updateField({ validation: newValidation });
  }, [field.validation, updateField]);
  
  const removeValidation = useCallback((index: number) => {
    const newValidation = field.validation.filter((_, i) => i !== index);
    updateField({ validation: newValidation });
  }, [field.validation, updateField]);
  
  const currentType = FIELD_TYPES.find(t => t.value === field.type);
  
  return (
    <Panel>
      <Header>
        <Title>
          <span>{currentType?.icon}</span>
          Configure Field
        </Title>
        {onClose && (
          <CloseButton onClick={onClose} aria-label="Close panel">
            ✕
          </CloseButton>
        )}
      </Header>
      
      <Content>
        <Section>
          <SectionTitle>Field Type</SectionTitle>
          <TypeGrid>
            {FIELD_TYPES.map(type => (
              <TypeButton
                key={type.value}
                $selected={field.type === type.value}
                onClick={() => updateField({ type: type.value })}
                type="button"
                aria-pressed={field.type === type.value}
              >
                <span className="icon">{type.icon}</span>
                <span className="label">{type.label}</span>
              </TypeButton>
            ))}
          </TypeGrid>
        </Section>
        
        <Section>
          <SectionTitle>Basic Settings</SectionTitle>
          
          <FormGroup>
            <Label htmlFor="field-name">Field Name (ID)</Label>
            <Input
              id="field-name"
              value={field.name}
              onChange={(e) => updateField({ name: e.target.value })}
              placeholder="field_name"
            />
            <HelpText>Used in code and API. Use snake_case.</HelpText>
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={field.label}
              onChange={(e) => updateField({ label: e.target.value })}
              placeholder="Field Label"
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              value={field.placeholder || ''}
              onChange={(e) => updateField({ placeholder: e.target.value })}
              placeholder="Enter placeholder text..."
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-help">Help Text</Label>
            <Textarea
              id="field-help"
              value={field.helpText || ''}
              onChange={(e) => updateField({ helpText: e.target.value })}
              placeholder="Add help text to guide users..."
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="field-width">Width</Label>
            <Select
              id="field-width"
              value={field.width || 'full'}
              onChange={(e) => updateField({ width: e.target.value as FieldConfig['width'] })}
            >
              {WIDTH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </FormGroup>
        </Section>
        
        {needsOptions(field.type) && (
          <Section>
            <SectionTitle>Options</SectionTitle>
            <OptionsList>
              {(field.options || []).map((option, index) => (
                <OptionRow key={index}>
                  <OptionInput
                    value={option.value}
                    onChange={(e) => updateOption(index, { value: e.target.value })}
                    placeholder="Value"
                  />
                  <OptionInput
                    value={option.label}
                    onChange={(e) => updateOption(index, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <RemoveOptionButton
                    onClick={() => removeOption(index)}
                    aria-label="Remove option"
                  >
                    ✕
                  </RemoveOptionButton>
                </OptionRow>
              ))}
              <AddOptionButton onClick={addOption} type="button">
                + Add Option
              </AddOptionButton>
            </OptionsList>
          </Section>
        )}
        
        {(field.type === 'number' || field.type === 'currency') && (
          <Section>
            <SectionTitle>Number Settings</SectionTitle>
            <RowPair>
              <FormGroup>
                <Label htmlFor="field-min">Minimum</Label>
                <Input
                  id="field-min"
                  type="number"
                  value={field.min ?? ''}
                  onChange={(e) => updateField({ min: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0"
                />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="field-max">Maximum</Label>
                <Input
                  id="field-max"
                  type="number"
                  value={field.max ?? ''}
                  onChange={(e) => updateField({ max: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="1000"
                />
              </FormGroup>
            </RowPair>
            <FormGroup>
              <Label htmlFor="field-step">Step</Label>
              <Input
                id="field-step"
                type="number"
                value={field.step ?? ''}
                onChange={(e) => updateField({ step: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="1"
              />
            </FormGroup>
            {field.type === 'currency' && (
              <FormGroup>
                <Label htmlFor="field-currency">Currency</Label>
                <Select
                  id="field-currency"
                  value={field.currency || 'USD'}
                  onChange={(e) => updateField({ currency: e.target.value })}
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </FormGroup>
            )}
          </Section>
        )}
        
        {(field.type === 'text' || field.type === 'textarea') && (
          <Section>
            <SectionTitle>Text Settings</SectionTitle>
            <RowPair>
              <FormGroup>
                <Label htmlFor="field-minlength">Min Length</Label>
                <Input
                  id="field-minlength"
                  type="number"
                  value={field.minLength ?? ''}
                  onChange={(e) => updateField({ minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="0"
                />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="field-maxlength">Max Length</Label>
                <Input
                  id="field-maxlength"
                  type="number"
                  value={field.maxLength ?? ''}
                  onChange={(e) => updateField({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="255"
                />
              </FormGroup>
            </RowPair>
          </Section>
        )}
        
        {field.type === 'file' && (
          <Section>
            <SectionTitle>File Settings</SectionTitle>
            <FormGroup>
              <Label htmlFor="field-accepted">Accepted File Types</Label>
              <Input
                id="field-accepted"
                value={(field.acceptedTypes || []).join(', ')}
                onChange={(e) => updateField({ 
                  acceptedTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                })}
                placeholder=".pdf, .doc, .docx"
              />
              <HelpText>Comma-separated file extensions</HelpText>
            </FormGroup>
            <FormGroup>
              <Label htmlFor="field-maxsize">Max File Size (MB)</Label>
              <Input
                id="field-maxsize"
                type="number"
                value={field.maxFileSize ?? ''}
                onChange={(e) => updateField({ maxFileSize: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="10"
              />
            </FormGroup>
          </Section>
        )}
        
        <Section>
          <SectionTitle>Validation Rules</SectionTitle>
          <ValidationList>
            {field.validation.map((rule, index) => (
              <ValidationRow key={index}>
                <ValidationSelect
                  value={rule.type}
                  onChange={(e) => updateValidation(index, { type: e.target.value as ValidationRule['type'] })}
                >
                  {getValidationOptions(field.type).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </ValidationSelect>
                {rule.type !== 'required' && (
                  <ValidationInput
                    value={rule.value ?? ''}
                    onChange={(e) => updateValidation(index, { value: e.target.value })}
                    placeholder="Value"
                  />
                )}
                <ValidationInput
                  value={rule.message || ''}
                  onChange={(e) => updateValidation(index, { message: e.target.value })}
                  placeholder="Error message"
                  style={{ flex: 2 }}
                />
                <RemoveOptionButton
                  onClick={() => removeValidation(index)}
                  aria-label="Remove validation rule"
                >
                  ✕
                </RemoveOptionButton>
              </ValidationRow>
            ))}
            <AddOptionButton 
              onClick={() => addValidation('required')}
              type="button"
            >
              + Add Validation Rule
            </AddOptionButton>
          </ValidationList>
        </Section>
        
        <Section>
          <SectionTitle>Behavior</SectionTitle>
          <FormGroup>
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={field.readonly || false}
                onChange={(e) => updateField({ readonly: e.target.checked })}
              />
              Read-only field
            </CheckboxLabel>
          </FormGroup>
          <FormGroup>
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={field.hidden || false}
                onChange={(e) => updateField({ hidden: e.target.checked })}
              />
              Hidden by default
            </CheckboxLabel>
          </FormGroup>
        </Section>
      </Content>
    </Panel>
  );
};

export default FieldConfigPanel;
