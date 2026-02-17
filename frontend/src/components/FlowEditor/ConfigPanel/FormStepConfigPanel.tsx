/**
 * Form Step Configuration Panel
 * 
 * Configuration panel for form steps (multi-step form containers).
 * Manages step-level settings including visibility, navigation, and validation.
 * 
 * Features:
 * - Step title and description editing
 * - Conditional visibility for entire step
 * - Navigation controls (back/skip/auto-advance)
 * - Step-level validation rules
 * - Field list management (add/edit/delete/reorder)
 * 
 * Created: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  ChevronDown, ChevronUp, GripVertical, Plus, Edit2, Trash2, 
  Eye, EyeOff, CheckCircle, Database
} from 'lucide-react';
import { ConditionBuilder, ConditionRule, ConditionLogic } from './ConditionBuilder';
import { FormField, FormFieldType } from './FormFieldConfigPanel';
import { useEntityList, useEntityFields } from '../../../services/schemaService';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FormStepData {
  stepTitle: string;
  stepDescription?: string;
  entityType?: string;  // Phase 3: Entity selection
  fields: FormField[];
  
  // Visibility configuration
  visibility?: {
    mode: 'always' | 'conditional';
    conditions?: ConditionRule[];
    logic?: ConditionLogic;
  };
  
  // Navigation configuration
  navigation?: {
    allowBack: boolean;
    allowSkip: boolean;
    autoAdvance: boolean;
    backLabel?: string;
    nextLabel?: string;
    skipLabel?: string;
  };
  
  // Validation configuration
  validation?: {
    mode: 'all' | 'minimum';
    minimumRequired?: number;
    customMessage?: string;
  };
}

export interface FormStepConfigPanelProps {
  step: FormStepData;
  onChange: (step: FormStepData) => void;
  onClose: () => void;
  onEditField?: (field: FormField) => void;
  onAddField?: () => void;
  availableFields?: Array<{ key: string; label: string; type: string }>;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
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

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
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
  
  &:hover h4 {
    color: rgb(var(--color-primary));
  }
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.15s ease;
`;

const SectionContent = styled.div<{ $collapsed?: boolean }>`
  display: ${props => props.$collapsed ? 'none' : 'block'};
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
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

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  margin-right: 8px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  margin-bottom: 12px;
  
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

const FieldList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const DragHandle = styled.div`
  color: rgb(var(--color-text-tertiary));
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
`;

const FieldIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 16px;
  flex-shrink: 0;
`;

const FieldContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const FieldLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FieldMeta = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FieldBadge = styled.span<{ $type?: 'required' | 'optional' }>`
  padding: 2px 6px;
  background: ${props => props.$type === 'required' 
    ? 'rgba(239, 68, 68, 0.1)' 
    : 'rgba(var(--color-border), 0.5)'};
  color: ${props => props.$type === 'required' 
    ? 'rgb(239, 68, 68)' 
    : 'rgb(var(--color-text-tertiary))'};
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
`;

const FieldActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const IconButton = styled.button`
  padding: 6px;
  background: none;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
`;

const AddFieldButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 2px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: rgb(var(--color-text-tertiary));
  font-size: 13px;
  line-height: 1.6;
`;

const ValidationModeSelector = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

const ValidationModeButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 12px;
  background: ${props => props.$active 
    ? 'rgba(var(--color-primary), 0.1)' 
    : 'rgb(var(--color-background))'};
  border: 1px solid ${props => props.$active 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  color: ${props => props.$active 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-text-primary))'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  
  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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
// Helper Functions
// ============================================================================

const FIELD_TYPE_ICONS: Record<FormFieldType, string> = {
  text: '📝',
  textarea: '📄',
  number: '🔢',
  email: '📧',
  phone: '📱',
  url: '🔗',
  date: '📅',
  datetime: '🕐',
  select: '📋',
  'multi-select': '☑️',
  checkbox: '✅',
  radio: '🔘',
  file: '📎',
};

/**
 * Map Django field types to form field types
 * Phase 3: Intelligent Schema Bridge
 */
const mapEntityFieldTypeToFormFieldType = (djangoType: string): FormFieldType => {
  const mapping: Record<string, FormFieldType> = {
    'CharField': 'text',
    'TextField': 'textarea',
    'IntegerField': 'number',
    'DecimalField': 'number',
    'FloatField': 'number',
    'EmailField': 'email',
    'URLField': 'url',
    'DateField': 'date',
    'DateTimeField': 'datetime',
    'BooleanField': 'checkbox',
    'FileField': 'file',
    'ImageField': 'file',
    'ForeignKey': 'select',
    'ManyToManyField': 'multi-select',
  };
  
  return mapping[djangoType] || 'text';
};

// ============================================================================
// Component
// ============================================================================

export const FormStepConfigPanel: React.FC<FormStepConfigPanelProps> = ({
  step,
  onChange,
  onClose,
  onEditField,
  onAddField,
  availableFields = [],
}) => {
  // Ensure fields array is always initialized
  const [localStep, setLocalStep] = useState<FormStepData>({
    ...step,
    fields: step.fields || [],
    entityType: step.entityType || '',
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Phase A.3: Field search and filter
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>('');
  const [fieldTypeFilter, setFieldTypeFilter] = useState<string>('all');

  // Phase A: Enhanced entity and field loading with error handling
  const { 
    data: entities = [], 
    isLoading: entitiesLoading,
    isError: entitiesError,
    error: entitiesErrorMessage 
  } = useEntityList();
  
  const { 
    data: fieldsData, 
    isLoading: fieldsLoading,
    isError: fieldsError,
    error: fieldsErrorMessage 
  } = useEntityFields(
    localStep.entityType,
    { enabled: !!localStep.entityType }
  );
  const availableEntityFields = fieldsData?.fields || [];
  
  // Phase A.3: Filter available fields by search term and type
  const filteredEntityFields = availableEntityFields
    .filter(field => {
      // Filter out already added fields
      if (localStep.fields.some(f => f.label === field.label)) {
        return false;
      }
      
      // Filter by search term (label or name)
      if (fieldSearchTerm && 
          !field.label.toLowerCase().includes(fieldSearchTerm.toLowerCase()) &&
          !field.name.toLowerCase().includes(fieldSearchTerm.toLowerCase())) {
        return false;
      }
      
      // Filter by field type
      if (fieldTypeFilter !== 'all') {
        const formFieldType = mapEntityFieldTypeToFormFieldType(field.field_type);
        if (formFieldType !== fieldTypeFilter) {
          return false;
        }
      }
      
      return true;
    });

  useEffect(() => {
    setLocalStep({
      ...step,
      fields: step.fields || [],
      entityType: step.entityType || '',
    });
  }, [step]);

  const handleUpdate = (updates: Partial<FormStepData>) => {
    const updated = { ...localStep, ...updates };
    setLocalStep(updated);
  };

  const handleSave = () => {
    onChange(localStep);
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

  const handleDeleteField = (fieldId: string) => {
    handleUpdate({
      fields: localStep.fields.filter(f => f.id !== fieldId)
    });
  };

  const handleMoveField = (fieldId: string, direction: 'up' | 'down') => {
    const index = localStep.fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localStep.fields.length) return;
    
    const newFields = [...localStep.fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    handleUpdate({ fields: newFields });
  };

  return (
    <Container>
      <Header>
        <Title>Configure Form Step</Title>
        <Subtitle>{(localStep.fields || []).length} field{(localStep.fields || []).length !== 1 ? 's' : ''}</Subtitle>
      </Header>

      <Content>
        {/* Basic Configuration */}
        <Section>
          <SectionHeader onClick={() => toggleSection('basic')}>
            <SectionTitle>
              Step Information
            </SectionTitle>
            {collapsedSections.has('basic') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('basic')}>
            <FormGroup>
              <Label>
                Step Title <Required>*</Required>
              </Label>
              <Input
                type="text"
                value={localStep.stepTitle}
                onChange={(e) => handleUpdate({ stepTitle: e.target.value })}
                placeholder="e.g., Customer Information"
              />
              <HelpText>The title shown at the top of this step</HelpText>
            </FormGroup>

            <FormGroup>
              <Label>Step Description</Label>
              <TextArea
                value={localStep.stepDescription || ''}
                onChange={(e) => handleUpdate({ stepDescription: e.target.value })}
                placeholder="Optional description or instructions for this step..."
              />
              <HelpText>Additional context or instructions for users</HelpText>
            </FormGroup>

            <FormGroup>
              <Label>
                <Database size={14} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />
                Entity Type <Required>*</Required>
              </Label>
              <select
                value={localStep.entityType || ''}
                onChange={(e) => {
                  handleUpdate({ entityType: e.target.value, fields: [] }); // Clear fields when entity changes
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: entitiesError ? '1px solid rgb(239, 68, 68)' : '1px solid rgb(var(--color-border))',
                  borderRadius: '6px',
                  background: 'rgb(var(--color-background))',
                  color: 'rgb(var(--color-text-primary))',
                  cursor: entitiesLoading ? 'wait' : 'pointer',
                }}
                disabled={entitiesLoading}
              >
                <option value="">
                  {entitiesLoading ? 'Loading entities...' : '-- Select entity type --'}
                </option>
                {entities.length > 0 ? (
                  entities.map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.label_plural} ({entity.field_count} fields)
                    </option>
                  ))
                ) : !entitiesLoading && (
                  <option disabled>No entities available</option>
                )}
              </select>
              <HelpText style={{ color: entitiesError ? 'rgb(239, 68, 68)' : undefined }}>
                {entitiesLoading ? (
                  '⏳ Loading entities...'
                ) : entitiesError ? (
                  '⚠️ Failed to load entities. Using fallback list. Check your connection and try again.'
                ) : localStep.entityType ? (
                  fieldsLoading ? (
                    `⏳ Loading fields for ${entities.find(e => e.id === localStep.entityType)?.label_plural || 'selected entity'}...`
                  ) : fieldsError ? (
                    `⚠️ Failed to load fields. Please try selecting the entity again.`
                  ) : (
                    `✓ ${availableEntityFields.length} fields available from ${entities.find(e => e.id === localStep.entityType)?.label_plural || 'selected entity'}`
                  )
                ) : (
                  'Select the business entity this form step will create or update'
                )}
              </HelpText>
            </FormGroup>
          </SectionContent>
        </Section>

        {/* Fields Management */}
        <Section>
          <SectionHeader onClick={() => toggleSection('fields')}>
            <SectionTitle>
              Fields ({localStep.fields.length})
              {fieldsLoading && ' - Loading...'}
            </SectionTitle>
            {collapsedSections.has('fields') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('fields')}>
            {localStep.fields.length === 0 ? (
              <EmptyState>
                No fields added yet.<br />
                Click "Add Field" to create your first field.
              </EmptyState>
            ) : (
              <FieldList>
                {localStep.fields.map((field, index) => (
                  <FieldItem key={field.id}>
                    <DragHandle>
                      <GripVertical size={16} />
                    </DragHandle>
                    <FieldIcon>{FIELD_TYPE_ICONS[field.type]}</FieldIcon>
                    <FieldContent>
                      <FieldLabel>{field.label}</FieldLabel>
                      <FieldMeta>
                        <span>{field.type}</span>
                        <FieldBadge $type={field.required ? 'required' : 'optional'}>
                          {field.required ? 'Required' : 'Optional'}
                        </FieldBadge>
                        {field.validationRules.length > 0 && (
                          <span>• {field.validationRules.length} rule{field.validationRules.length !== 1 ? 's' : ''}</span>
                        )}
                      </FieldMeta>
                    </FieldContent>
                    <FieldActions>
                      {onEditField && (
                        <IconButton onClick={() => onEditField(field)} title="Edit field">
                          <Edit2 size={16} />
                        </IconButton>
                      )}
                      <IconButton onClick={() => handleDeleteField(field.id)} title="Delete field">
                        <Trash2 size={16} />
                      </IconButton>
                    </FieldActions>
                  </FieldItem>
                ))}
              </FieldList>
            )}

            {/* Add Field from Entity */}
            {localStep.entityType && availableEntityFields.length > 0 && (
              <FormGroup>
                <Label>
                  Add Fields from {entities.find(e => e.id === localStep.entityType)?.label_plural}
                </Label>
                
                {/* Phase A.3: Field Search */}
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search fields..."
                    value={fieldSearchTerm}
                    onChange={(e) => setFieldSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: '6px',
                      background: 'rgb(var(--color-background))',
                      color: 'rgb(var(--color-text-primary))',
                    }}
                  />
                </div>
                
                {/* Phase A.3: Field Type Filter */}
                <div style={{ marginBottom: '12px' }}>
                  <select
                    value={fieldTypeFilter}
                    onChange={(e) => setFieldTypeFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: '6px',
                      background: 'rgb(var(--color-background))',
                      color: 'rgb(var(--color-text-primary))',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Field Types</option>
                    <option value="text">📝 Text</option>
                    <option value="textarea">📄 Long Text</option>
                    <option value="number">🔢 Number</option>
                    <option value="email">📧 Email</option>
                    <option value="phone">📱 Phone</option>
                    <option value="date">📅 Date</option>
                    <option value="select">📋 Dropdown</option>
                    <option value="checkbox">✅ Checkbox</option>
                  </select>
                </div>
                
                <select
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const selectedField = availableEntityFields.find(f => f.name === e.target.value);
                    if (!selectedField) return;

                    // Convert entity field to form field
                    const newField: FormField = {
                      id: `field-${Date.now()}`,
                      type: mapEntityFieldTypeToFormFieldType(selectedField.field_type),
                      label: selectedField.label,
                      required: selectedField.is_required,
                      placeholder: '',
                      helpText: selectedField.help_text,
                      validationRules: [],
                    };

                    handleUpdate({ fields: [...localStep.fields, newField] });
                    e.target.value = ''; // Reset dropdown
                    setFieldSearchTerm(''); // Reset search
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid rgb(var(--color-border))',
                    borderRadius: '6px',
                    background: 'rgb(var(--color-background))',
                    color: 'rgb(var(--color-text-primary))',
                    cursor: 'pointer',
                  }}
                  disabled={fieldsLoading}
                >
                  <option value="">
                    {filteredEntityFields.length === 0 
                      ? '-- No matching fields --' 
                      : '-- Select field to add --'}
                  </option>
                  {filteredEntityFields.map(field => {
                    const formFieldType = mapEntityFieldTypeToFormFieldType(field.field_type);
                    const icon = FIELD_TYPE_ICONS[formFieldType] || '📋';
                    return (
                      <option key={field.name} value={field.name}>
                        {icon} {field.label} ({field.field_type}) {field.is_required ? '- Required' : ''}
                      </option>
                    );
                  })}
                </select>
                <HelpText>
                  {fieldsLoading ? (
                    '⏳ Loading fields...'
                  ) : fieldSearchTerm || fieldTypeFilter !== 'all' ? (
                    `Showing ${filteredEntityFields.length} of ${availableEntityFields.length - localStep.fields.length} available fields`
                  ) : (
                    `${availableEntityFields.length - localStep.fields.length} fields available to add`
                  )}
                </HelpText>
              </FormGroup>
            )}

            {onAddField && !localStep.entityType && (
              <AddFieldButton onClick={onAddField}>
                <Plus size={16} />
                Add Custom Field
              </AddFieldButton>
            )}
          </SectionContent>
        </Section>

        {/* Conditional Visibility */}
        <Section>
          <SectionHeader onClick={() => toggleSection('visibility')}>
            <SectionTitle>
              Step Visibility
            </SectionTitle>
            {collapsedSections.has('visibility') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('visibility')}>
            <FormGroup>
              <ToggleButton
                $active={localStep.visibility?.mode === 'conditional'}
                onClick={() => handleUpdate({
                  visibility: {
                    mode: localStep.visibility?.mode === 'conditional' ? 'always' : 'conditional',
                    conditions: localStep.visibility?.conditions || [],
                    logic: localStep.visibility?.logic || 'and',
                  }
                })}
              >
                {localStep.visibility?.mode === 'conditional' ? <Eye size={16} /> : <EyeOff size={16} />}
                {localStep.visibility?.mode === 'conditional' ? 'Show conditionally' : 'Always visible'}
              </ToggleButton>
              <HelpText>
                {localStep.visibility?.mode === 'conditional'
                  ? 'This step will only be shown when conditions are met'
                  : 'This step is always shown in the form'}
              </HelpText>
            </FormGroup>

            {localStep.visibility?.mode === 'conditional' && (
              <FormGroup>
                <ConditionBuilder
                  conditions={localStep.visibility?.conditions || []}
                  logic={localStep.visibility?.logic || 'and'}
                  onChange={(conditions, logic) => handleUpdate({
                    visibility: {
                      mode: 'conditional',
                      conditions,
                      logic,
                    }
                  })}
                  availableFields={availableFields}
                  fieldPrefix="Previous steps: "
                />
              </FormGroup>
            )}
          </SectionContent>
        </Section>

        {/* Navigation Options */}
        <Section>
          <SectionHeader onClick={() => toggleSection('navigation')}>
            <SectionTitle>
              Navigation Options
            </SectionTitle>
            {collapsedSections.has('navigation') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('navigation')}>
            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={localStep.navigation?.allowBack !== false}
                  onChange={(e) => handleUpdate({
                    navigation: {
                      ...localStep.navigation,
                      allowBack: e.target.checked,
                    }
                  })}
                />
                Allow Back Button
              </CheckboxLabel>
              <HelpText>Users can navigate to the previous step</HelpText>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={localStep.navigation?.allowSkip === true}
                  onChange={(e) => handleUpdate({
                    navigation: {
                      ...localStep.navigation,
                      allowSkip: e.target.checked,
                    }
                  })}
                />
                Allow Skip Button
              </CheckboxLabel>
              <HelpText>Users can skip this step without filling it out</HelpText>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={localStep.navigation?.autoAdvance === true}
                  onChange={(e) => handleUpdate({
                    navigation: {
                      ...localStep.navigation,
                      autoAdvance: e.target.checked,
                    }
                  })}
                />
                Auto-advance on Completion
              </CheckboxLabel>
              <HelpText>Automatically move to next step when all required fields are filled</HelpText>
            </FormGroup>

            <FormGroup>
              <Label>Custom Button Labels (Optional)</Label>
              <Input
                type="text"
                value={localStep.navigation?.backLabel || ''}
                onChange={(e) => handleUpdate({
                  navigation: {
                    ...localStep.navigation,
                    backLabel: e.target.value,
                  }
                })}
                placeholder="Back (default)"
              />
              <Input
                type="text"
                value={localStep.navigation?.nextLabel || ''}
                onChange={(e) => handleUpdate({
                  navigation: {
                    ...localStep.navigation,
                    nextLabel: e.target.value,
                  }
                })}
                placeholder="Next (default)"
                style={{ marginTop: '8px' }}
              />
              {localStep.navigation?.allowSkip && (
                <Input
                  type="text"
                  value={localStep.navigation?.skipLabel || ''}
                  onChange={(e) => handleUpdate({
                    navigation: {
                      ...localStep.navigation,
                      skipLabel: e.target.value,
                    }
                  })}
                  placeholder="Skip (default)"
                  style={{ marginTop: '8px' }}
                />
              )}
            </FormGroup>
          </SectionContent>
        </Section>

        {/* Validation Rules */}
        <Section>
          <SectionHeader onClick={() => toggleSection('validation')}>
            <SectionTitle>
              Step Validation
            </SectionTitle>
            {collapsedSections.has('validation') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('validation')}>
            <ValidationModeSelector>
              <ValidationModeButton
                $active={localStep.validation?.mode !== 'minimum'}
                onClick={() => handleUpdate({
                  validation: {
                    ...localStep.validation,
                    mode: 'all',
                  }
                })}
              >
                <div style={{ marginBottom: '4px', fontWeight: 700 }}>All Fields</div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>All required fields must be valid</div>
              </ValidationModeButton>
              <ValidationModeButton
                $active={localStep.validation?.mode === 'minimum'}
                onClick={() => handleUpdate({
                  validation: {
                    ...localStep.validation,
                    mode: 'minimum',
                    minimumRequired: localStep.validation?.minimumRequired || 1,
                  }
                })}
              >
                <div style={{ marginBottom: '4px', fontWeight: 700 }}>Minimum Required</div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>At least N fields must be filled</div>
              </ValidationModeButton>
            </ValidationModeSelector>

            {localStep.validation?.mode === 'minimum' && (
              <FormGroup>
                <Label>Minimum Required Fields</Label>
                <Input
                  type="number"
                  min="1"
                  max={localStep.fields.length}
                  value={localStep.validation?.minimumRequired || 1}
                  onChange={(e) => handleUpdate({
                    validation: {
                      ...localStep.validation,
                      mode: 'minimum',
                      minimumRequired: parseInt(e.target.value, 10),
                    }
                  })}
                />
                <HelpText>
                  At least this many fields must be filled out to proceed
                </HelpText>
              </FormGroup>
            )}

            <FormGroup>
              <Label>Custom Validation Message (Optional)</Label>
              <TextArea
                value={localStep.validation?.customMessage || ''}
                onChange={(e) => handleUpdate({
                  validation: {
                    ...localStep.validation,
                    customMessage: e.target.value,
                  }
                })}
                placeholder="e.g., Please complete all required fields before continuing."
              />
              <HelpText>
                Shown when validation fails (leave blank for default message)
              </HelpText>
            </FormGroup>
          </SectionContent>
        </Section>
      </Content>

      <Footer>
        <Button onClick={onClose}>Cancel</Button>
        <Button $variant="primary" onClick={handleSave}>
          Save Step
        </Button>
      </Footer>
    </Container>
  );
};

export default FormStepConfigPanel;
