/**
 * Form Field Configuration Panel
 * 
 * Comprehensive configuration panel for individual form fields.
 * Supports 12 field types with full validation, conditional visibility,
 * and multi-option configuration.
 * 
 * Features:
 * - 12 field types (text, textarea, number, email, phone, url, date, datetime, select, multi-select, checkbox, radio, file)
 * - Validation rules builder (via ValidationRuleBuilder)
 * - Conditional visibility (via ConditionBuilder)
 * - Multi-option configuration (manual, tenant-list, entity)
 * - Field dependencies
 * - Default values and placeholders
 * 
 * Created: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ValidationRuleBuilder, ValidationRule } from './ValidationRuleBuilder';
import { ConditionBuilder, ConditionRule, ConditionLogic } from './ConditionBuilder';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type FormFieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'file';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  
  // Basic settings
  required: boolean;
  placeholder?: string;
  defaultValue?: any;
  helpText?: string;
  
  // Validation
  validationRules: ValidationRule[];
  
  // Conditional visibility
  visibility?: {
    mode: 'always' | 'conditional';
    conditions?: ConditionRule[];
    logic?: ConditionLogic;
  };
  
  // Multi-option fields (select, radio, multi-select)
  options?: {
    source: 'manual' | 'tenant-list' | 'entity';
    manualOptions?: string[];
    tenantListId?: string;
    entityType?: string;
    entityField?: string;
  };
  
  // Field dependencies
  dependencies?: Array<{
    field: string;
    action: 'enable' | 'disable' | 'show' | 'hide';
    condition: ConditionRule;
  }>;
}

export interface FormFieldConfigPanelProps {
  field: FormField;
  onChange: (field: FormField) => void;
  onClose: () => void;
  availableFields?: Array<{ key: string; label: string; type: string }>;
  tenantLists?: Array<{ id: string; name: string }>;
}

// ============================================================================
// Field Type Definitions
// ============================================================================

const FIELD_TYPE_DEFINITIONS: Record<FormFieldType, {
  label: string;
  icon: string;
  description: string;
  category: 'text' | 'numeric' | 'selection' | 'special';
  supportsValidation: boolean;
  supportsOptions: boolean;
}> = {
  text: {
    label: 'Single Line Text',
    icon: '📝',
    description: 'Short text input (names, titles, etc.)',
    category: 'text',
    supportsValidation: true,
    supportsOptions: false,
  },
  textarea: {
    label: 'Multi-line Text',
    icon: '📄',
    description: 'Long text input (descriptions, notes, etc.)',
    category: 'text',
    supportsValidation: true,
    supportsOptions: false,
  },
  number: {
    label: 'Number',
    icon: '🔢',
    description: 'Numeric input (quantities, prices, etc.)',
    category: 'numeric',
    supportsValidation: true,
    supportsOptions: false,
  },
  email: {
    label: 'Email Address',
    icon: '📧',
    description: 'Email input with validation',
    category: 'text',
    supportsValidation: true,
    supportsOptions: false,
  },
  phone: {
    label: 'Phone Number',
    icon: '📱',
    description: 'Phone number with formatting',
    category: 'text',
    supportsValidation: true,
    supportsOptions: false,
  },
  url: {
    label: 'URL / Website',
    icon: '🔗',
    description: 'Website URL with validation',
    category: 'text',
    supportsValidation: true,
    supportsOptions: false,
  },
  date: {
    label: 'Date',
    icon: '📅',
    description: 'Date picker (YYYY-MM-DD)',
    category: 'special',
    supportsValidation: true,
    supportsOptions: false,
  },
  datetime: {
    label: 'Date & Time',
    icon: '🕐',
    description: 'Date and time picker',
    category: 'special',
    supportsValidation: true,
    supportsOptions: false,
  },
  select: {
    label: 'Dropdown (Single)',
    icon: '📋',
    description: 'Single selection from options',
    category: 'selection',
    supportsValidation: false,
    supportsOptions: true,
  },
  'multi-select': {
    label: 'Dropdown (Multiple)',
    icon: '☑️',
    description: 'Multiple selections from options',
    category: 'selection',
    supportsValidation: false,
    supportsOptions: true,
  },
  checkbox: {
    label: 'Checkbox',
    icon: '✅',
    description: 'Boolean yes/no checkbox',
    category: 'selection',
    supportsValidation: false,
    supportsOptions: false,
  },
  radio: {
    label: 'Radio Buttons',
    icon: '🔘',
    description: 'Single selection from radio group',
    category: 'selection',
    supportsValidation: false,
    supportsOptions: true,
  },
  file: {
    label: 'File Upload',
    icon: '📎',
    description: 'File upload with preview',
    category: 'special',
    supportsValidation: true,
    supportsOptions: false,
  },
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;



const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;



const Section = styled.div`
  margin-bottom: 32px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  cursor: pointer;
  user-select: none;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionContent = styled.div<{ $collapsed?: boolean }>`
  display: ${props => props.$collapsed ? 'none' : 'block'};
`;





const Required = styled.span`
  color: rgb(239, 68, 68);
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  font-family: inherit;
  resize: vertical;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;





const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  
  &:hover {
    color: rgb(var(--color-primary));
  }
`;

const HelpText = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 6px;
  line-height: 1.5;
`;

const FieldTypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
`;

const FieldTypeCard = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: ${props => props.$selected 
    ? 'rgba(var(--color-primary), 0.1)' 
    : 'rgb(var(--color-background))'};
  border: 2px solid ${props => props.$selected 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;

const FieldTypeIcon = styled.div`
  font-size: 24px;
  line-height: 1;
`;

const FieldTypeLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-align: center;
  line-height: 1.3;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: ${props => props.$active 
    ? 'rgba(var(--color-primary), 0.1)' 
    : 'rgb(var(--color-background))'};
  border: 1px solid ${props => props.$active 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  color: ${props => props.$active 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-text-secondary))'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const OptionsEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const OptionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
`;

const OptionInput = styled.input`
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
  }
`;



const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${props => props.$variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;
    
    &:hover {
      opacity: 0.9;
    }
  ` : `
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover {
      background: rgb(var(--color-border));
    }
  `}
`;

// ============================================================================
// Component
// ============================================================================

export const FormFieldConfigPanel: React.FC<FormFieldConfigPanelProps> = ({
  field,
  onChange,
  onClose,
  availableFields = [],
  tenantLists = [],
}) => {
  // Ensure required arrays are always initialized
  const [localField, setLocalField] = useState<FormField>({
    ...field,
    validationRules: field.validationRules || [],
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalField({
      ...field,
      validationRules: field.validationRules || [],
    });
  }, [field]);

  const fieldTypeDef = FIELD_TYPE_DEFINITIONS[localField.type];

  const handleUpdate = (updates: Partial<FormField>) => {
    const updated = { ...localField, ...updates };
    setLocalField(updated);
  };

  const handleSave = () => {
    onChange(localField);
    onClose();
  };

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  return (
    <Container>
      <PanelHeader>
        <PanelTitle>Configure Field</PanelTitle>
        <Subtitle>{fieldTypeDef.icon} {fieldTypeDef.label}</Subtitle>
      </PanelHeader>

      <PanelContent>
        {/* Basic Configuration */}
        <Section>
          <SectionHeader onClick={() => toggleSection('basic')}>
            <SectionTitle>
              Basic Configuration
            </SectionTitle>
            {collapsedSections.has('basic') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('basic')}>
            <FormField>
              <Label>
                Field Type <Required>*</Required>
              </Label>
              <FieldTypeGrid>
                {Object.entries(FIELD_TYPE_DEFINITIONS).map(([type, def]) => (
                  <FieldTypeCard
                    key={type}
                    $selected={localField.type === type}
                    onClick={() => handleUpdate({ type: type as FormFieldType })}
                  >
                    <FieldTypeIcon>{def.icon}</FieldTypeIcon>
                    <FieldTypeLabel>{def.label}</FieldTypeLabel>
                  </FieldTypeCard>
                ))}
              </FieldTypeGrid>
            </FormField>

            <FormField>
              <Label>
                Field Label <Required>*</Required>
              </Label>
              <Input
                type="text"
                value={localField.label}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                placeholder="e.g., Customer Name"
              />
              <HelpText>The label shown above the field</HelpText>
            </FormField>

            <FormField>
              <Label>Placeholder Text</Label>
              <Input
                type="text"
                value={localField.placeholder || ''}
                onChange={(e) => handleUpdate({ placeholder: e.target.value })}
                placeholder="e.g., Enter customer name..."
              />
              <HelpText>Hint text shown inside the field when empty</HelpText>
            </FormField>

            <FormField>
              <Label>Help Text</Label>
              <TextArea
                value={localField.helpText || ''}
                onChange={(e) => handleUpdate({ helpText: e.target.value })}
                placeholder="Additional instructions or help text for users..."
              />
              <HelpText>Helpful guidance shown below the field</HelpText>
            </FormField>

            <FormField>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={localField.required}
                  onChange={(e) => handleUpdate({ required: e.target.checked })}
                />
                Required Field
              </CheckboxLabel>
              <HelpText>User must provide a value before submitting</HelpText>
            </FormField>

            {!['checkbox', 'file'].includes(localField.type) && (
              <FormField>
                <Label>Default Value</Label>
                <Input
                  type={localField.type === 'number' ? 'number' : 'text'}
                  value={localField.defaultValue || ''}
                  onChange={(e) => handleUpdate({ defaultValue: e.target.value })}
                  placeholder="Optional default value..."
                />
                <HelpText>Value pre-filled when the form loads</HelpText>
              </FormField>
            )}
          </SectionContent>
        </Section>

        {/* Validation Rules */}
        {fieldTypeDef.supportsValidation && (
          <Section>
            <SectionHeader onClick={() => toggleSection('validation')}>
              <SectionTitle>
                Validation Rules
              </SectionTitle>
              {collapsedSections.has('validation') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </SectionHeader>
            <SectionContent $collapsed={collapsedSections.has('validation')}>
              <ValidationRuleBuilder
                rules={localField.validationRules}
                onChange={(rules) => handleUpdate({ validationRules: rules })}
                fieldType={localField.type}
              />
            </SectionContent>
          </Section>
        )}

        {/* Options Configuration */}
        {fieldTypeDef.supportsOptions && (
          <Section>
            <SectionHeader onClick={() => toggleSection('options')}>
              <SectionTitle>
                Options Configuration
              </SectionTitle>
              {collapsedSections.has('options') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </SectionHeader>
            <SectionContent $collapsed={collapsedSections.has('options')}>
              <FormField>
                <Label>Options Source</Label>
                <Select
                  value={localField.options?.source || 'manual'}
                  onChange={(e) => handleUpdate({
                    options: {
                      ...localField.options,
                      source: e.target.value as 'manual' | 'tenant-list' | 'entity',
                    }
                  })}
                >
                  <option value="manual">Manual Entry</option>
                  <option value="tenant-list">Tenant List</option>
                  <option value="entity">Entity (Database)</option>
                </Select>
              </FormField>

              {localField.options?.source === 'manual' && (
                <FormField>
                  <Label>Options (one per line)</Label>
                  <TextArea
                    value={localField.options?.manualOptions?.join('\n') || ''}
                    onChange={(e) => handleUpdate({
                      options: {
                        ...localField.options,
                        manualOptions: e.target.value.split('\n').filter(o => o.trim()),
                      }
                    })}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                  <HelpText>Enter each option on a new line</HelpText>
                </FormField>
              )}

              {localField.options?.source === 'tenant-list' && (
                <FormField>
                  <Label>Select Tenant List</Label>
                  <Select
                    value={localField.options?.tenantListId || ''}
                    onChange={(e) => handleUpdate({
                      options: {
                        ...localField.options,
                        tenantListId: e.target.value,
                      }
                    })}
                  >
                    <option value="">Choose a list...</option>
                    {tenantLists.map(list => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                  <HelpText>Options will be loaded from the selected tenant list</HelpText>
                </FormField>
              )}

              {localField.options?.source === 'entity' && (
                <>
                  <FormField>
                    <Label>Entity Type</Label>
                    <Select
                      value={localField.options?.entityType || ''}
                      onChange={(e) => handleUpdate({
                        options: {
                          ...localField.options,
                          entityType: e.target.value,
                        }
                      })}
                    >
                      <option value="">Select entity...</option>
                      <option value="supplier">Suppliers</option>
                      <option value="customer">Customers</option>
                      <option value="product">Products</option>
                      <option value="warehouse">Warehouses</option>
                    </Select>
                  </FormField>
                  <FormField>
                    <Label>Display Field</Label>
                    <Input
                      type="text"
                      value={localField.options?.entityField || ''}
                      onChange={(e) => handleUpdate({
                        options: {
                          ...localField.options,
                          entityField: e.target.value,
                        }
                      })}
                      placeholder="e.g., name"
                    />
                    <HelpText>Which field to show in the dropdown (e.g., "name")</HelpText>
                  </FormField>
                </>
              )}
            </SectionContent>
          </Section>
        )}

        {/* Conditional Visibility */}
        <Section>
          <SectionHeader onClick={() => toggleSection('visibility')}>
            <SectionTitle>
              Conditional Visibility
            </SectionTitle>
            {collapsedSections.has('visibility') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('visibility')}>
            <FormField>
              <ToggleButton
                $active={localField.visibility?.mode === 'conditional'}
                onClick={() => handleUpdate({
                  visibility: {
                    mode: localField.visibility?.mode === 'conditional' ? 'always' : 'conditional',
                    conditions: localField.visibility?.conditions || [],
                    logic: localField.visibility?.logic || 'and',
                  }
                })}
              >
                {localField.visibility?.mode === 'conditional' ? <Eye size={16} /> : <EyeOff size={16} />}
                {localField.visibility?.mode === 'conditional' ? 'Show conditionally' : 'Always visible'}
              </ToggleButton>
              <HelpText>
                {localField.visibility?.mode === 'conditional'
                  ? 'This field will only be visible when conditions are met'
                  : 'This field is always visible in the form'}
              </HelpText>
            </FormField>

            {localField.visibility?.mode === 'conditional' && (
              <FormField>
                <ConditionBuilder
                  conditions={localField.visibility?.conditions || []}
                  logic={localField.visibility?.logic || 'and'}
                  onChange={(conditions, logic) => handleUpdate({
                    visibility: {
                      mode: 'conditional',
                      conditions,
                      logic,
                    }
                  })}
                  availableFields={availableFields}
                />
              </FormField>
            )}
          </SectionContent>
        </Section>
      </PanelContent>

      <PanelFooter>
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton onClick={handleSave}>
          Save Field
        </PrimaryButton>
      </PanelFooter>
    </Container>
  );
};

export default FormFieldConfigPanel;
