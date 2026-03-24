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
import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Modal } from 'antd';
import { useReactFlow } from '@xyflow/react';
import ReactSelect from 'react-select';
import { Eye, EyeOff, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { ValidationRuleBuilder, ValidationRule } from './ValidationRuleBuilder';
import { ConditionBuilder, ConditionRule, ConditionLogic } from './ConditionBuilder';
import { useFlowEditor } from '../context';
import { getUpstreamOutputs, formatInheritanceSyntax, isInheritanceSyntax } from '../../../utils/flowUtils';
import {
  PanelHeader,
  PanelTitle,
  PanelContent,
  PanelFooter,
  Section,
  SectionHeader,
  SectionTitle,
  FormField,
  Label,
  Input,
  TextArea,
  Select,
  HelpText,
  RequiredIndicator,
  PrimaryButton,
  SecondaryButton,
} from './shared/StyledComponents';

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
    source: 'manual' | 'system-choice-list' | 'tenant-list' | 'entity';
    manualOptions?: string[];
    systemChoiceListSlug?: string;
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
// Styled Components (Custom - Panel-specific)
// ============================================================================

// Layout containers
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Subtitle = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

// SectionContent for collapsible sections (shared Section doesn't support $collapsed)
const SectionContent = styled.div<{ $collapsed?: boolean }>`
  display: ${props => props.$collapsed ? 'none' : 'block'};
`;

// CheckboxLabel (not in shared library)
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

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  margin-right: 8px;
  accent-color: rgb(var(--color-primary));
`;

const UpstreamBadge = styled.span`
  margin-left: 8px;
  font-size: 11px;
  color: rgb(var(--color-primary));
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

// Field type selector components (specific to FormFieldConfigPanel)
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


// ============================================================================
// Component
// ============================================================================

export const FormFieldConfigPanel: React.FC<FormFieldConfigPanelProps> = ({
  field,
  onChange,
  onClose,
}) => {
  const { tenantLists, systemChoiceLists, availableFields, currentNodeId } = useFlowEditor();
  // Ensure required arrays are always initialized
  const [localField, setLocalField] = useState<FormField>({
    ...field,
    validationRules: field.validationRules || [],
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [inheritanceMode, setInheritanceMode] = useState<'manual' | 'inherit'>('manual');

  // React Flow integration for upstream data inheritance
  const { getNodes, getEdges } = useReactFlow();
  
  // Get upstream outputs for inheritance
  const upstreamOutputs = useMemo(() => {
    if (!currentNodeId) return [];
    return getUpstreamOutputs(getNodes(), getEdges(), currentNodeId);
  }, [currentNodeId, getNodes, getEdges]);

  // Convert upstream outputs to react-select options
  const inheritanceOptions = useMemo(() => {
    return upstreamOutputs.map((output) => ({
      value: formatInheritanceSyntax(output.nodeId, output.fieldName),
      label: `${output.nodeLabel} → ${output.fieldLabel}`,
      nodeLabel: output.nodeLabel,
      fieldLabel: output.fieldLabel,
      type: output.fieldType,
      sample: output.sampleValue,
    }));
  }, [upstreamOutputs]);

  useEffect(() => {
    setLocalField({
      ...field,
      validationRules: field.validationRules || [],
    });
    
    // Detect if current default value is inheritance syntax
    if (field.defaultValue && isInheritanceSyntax(field.defaultValue)) {
      setInheritanceMode('inherit');
    }
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

  const openCreateCustomTenantList = () => {
    Modal.info({
      title: 'Create Custom Tenant List (Coming Soon)',
      content: (
        <div>
          <p>
            Custom Tenant Lists will support workflow-specific dropdown fields (tenant-owned choice lists).
          </p>
          <p>For now, this is a placeholder. If/when a TenantListModal exists, we can wire it here.</p>
        </div>
      ),
    });
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
                Field Type <RequiredIndicator>*</RequiredIndicator>
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
                Field Label <RequiredIndicator>*</RequiredIndicator>
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

            {/* Smart Data Inheritance - Default Value */}
            {!['checkbox', 'file'].includes(localField.type) && (
              <FormField>
                <Label>
                  Default Value
                  {upstreamOutputs.length > 0 && (
                    <UpstreamBadge>
                      <Zap size={12} />
                      {upstreamOutputs.length} upstream field(s)
                    </UpstreamBadge>
                  )}
                </Label>
                
                {/* Mode Toggle */}
                {upstreamOutputs.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <ToggleButton
                      type="button"
                      $active={inheritanceMode === 'manual'}
                      onClick={() => setInheritanceMode('manual')}
                    >
                      Manual Value
                    </ToggleButton>
                    <ToggleButton
                      type="button"
                      $active={inheritanceMode === 'inherit'}
                      onClick={() => setInheritanceMode('inherit')}
                    >
                      <Zap size={12} />
                      Inherit from Upstream
                    </ToggleButton>
                  </div>
                )}

                {/* Manual Input Mode */}
                {(inheritanceMode === 'manual' || upstreamOutputs.length === 0) && (
                  <Input
                    type={localField.type === 'number' ? 'number' : 'text'}
                    value={localField.defaultValue || ''}
                    onChange={(e) => handleUpdate({ defaultValue: e.target.value })}
                    placeholder="Optional default value..."
                  />
                )}

                {/* Inheritance Mode - Dropdown Selector */}
                {inheritanceMode === 'inherit' && upstreamOutputs.length > 0 && (
                  <ReactSelect
                    value={inheritanceOptions.find((opt) => opt.value === localField.defaultValue)}
                    onChange={(selected) => {
                      if (selected) {
                        handleUpdate({ defaultValue: selected.value });
                      }
                    }}
                    options={inheritanceOptions}
                    isClearable
                    placeholder="Select upstream field to inherit..."
                    formatOptionLabel={(option: any) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgb(var(--color-text-primary))' }}>
                          {option.nodeLabel} → {option.fieldLabel}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgb(var(--color-text-secondary))' }}>
                          Type: {option.type} | Sample: {option.sample || 'N/A'}
                        </div>
                      </div>
                    )}
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '42px',
                        border: '1px solid rgb(var(--color-border))',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'none',
                        '&:hover': {
                          border: '1px solid rgb(var(--color-primary))',
                        },
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused
                          ? 'rgba(var(--color-primary), 0.1)'
                          : 'transparent',
                        color: 'rgb(var(--color-text-primary))',
                        cursor: 'pointer',
                        padding: '12px',
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        zIndex: 9999,
                      }),
                    }}
                  />
                )}

                <HelpText>
                  {inheritanceMode === 'inherit' 
                    ? 'Value automatically pulled from an upstream node\'s output'
                    : 'Value pre-filled when the form loads'}
                </HelpText>
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
                  onChange={(e) =>
                    handleUpdate({
                      options: {
                        ...(localField.options ?? { source: 'manual' }),
                        source: e.target.value as 'manual' | 'tenant-list' | 'entity',
                      },
                    })
                  }
                >
                  <option value="manual">Manual Entry</option>
                  <option value="system-choice-list">System Choice List</option>
                  <option value="tenant-list">Tenant List</option>
                  <option value="entity">Entity (Database)</option>
                </Select>
              </FormField>

              {localField.options?.source === 'manual' && (
                <FormField>
                  <Label>Options (one per line)</Label>
                  <TextArea
                    value={localField.options?.manualOptions?.join('\n') || ''}
                    onChange={(e) =>
                      handleUpdate({
                        options: {
                          ...(localField.options ?? { source: 'manual' }),
                          manualOptions: e.target.value.split('\n').filter((o) => o.trim()),
                        },
                      })
                    }
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                  <HelpText>Enter each option on a new line</HelpText>
                </FormField>
              )}

              {localField.options?.source === 'system-choice-list' && (
                <FormField>
                  <Label>Select System Choice List</Label>
                  <Select
                    value={localField.options?.systemChoiceListSlug || ''}
                    onChange={(e) =>
                      handleUpdate({
                        options: {
                          ...(localField.options ?? { source: 'system-choice-list' }),
                          systemChoiceListSlug: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Choose a list...</option>
                    {systemChoiceLists.map((list) => (
                      <option key={list.id} value={list.slug}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                  <HelpText>Options will be loaded from the selected system choice list.</HelpText>
                </FormField>
              )}

              {localField.options?.source === 'tenant-list' && (
                <FormField>
                  <Label>Select Tenant List</Label>
                  <Select
                    value={localField.options?.tenantListId || ''}
                    onChange={(e) =>
                      handleUpdate({
                        options: {
                          ...(localField.options ?? { source: 'tenant-list' }),
                          tenantListId: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Choose a list...</option>
                    {tenantLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                  <HelpText>Options will be loaded from the selected tenant list.</HelpText>
                  <SecondaryButton type="button" onClick={openCreateCustomTenantList}>
                    Create Custom Tenant List (Coming Soon)
                  </SecondaryButton>
                </FormField>
              )}

              {localField.options?.source === 'entity' && (
                <>
                  <FormField>
                    <Label>Entity Type</Label>
                    <Select
                      value={localField.options?.entityType || ''}
                      onChange={(e) =>
                        handleUpdate({
                          options: {
                            ...(localField.options ?? { source: 'entity' }),
                            entityType: e.target.value,
                          },
                        })
                      }
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
                      onChange={(e) =>
                        handleUpdate({
                          options: {
                            ...(localField.options ?? { source: 'entity' }),
                            entityField: e.target.value,
                          },
                        })
                      }
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
