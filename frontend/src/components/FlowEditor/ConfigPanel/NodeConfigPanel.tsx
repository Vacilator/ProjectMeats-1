/**
 * Node Configuration Panel
 * 
 * Slide-in panel from right for configuring selected nodes.
 * Industry-inspired by: HubSpot Workflows, Make, n8n, Salesforce Flow
 * 
 * Features:
 * - Tabbed interface (Config, Data Mapping, Advanced, Test)
 * - Live validation with inline errors
 * - Field search for complex nodes
 * - Help tooltips with examples
 * - Test runner for individual nodes
 * 
 * Created: 2026-02-04 - Phase 2.2 Configuration Panels
 * Updated: 2026-02-05 - Task 1.5 Integrated FieldMappingPanel
 * Updated: 2026-02-05 - Task 2.1 Cascading Trigger Configuration
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/utils/uiDialogs';
import * as Sentry from '@sentry/react';
import { X, HelpCircle, Play, Save, AlertCircle, Plus, Trash2, Edit2, Check, GripVertical, Download } from 'lucide-react';
import { Node, Edge } from '@xyflow/react';
import { FieldMappingPanel, FieldMapping } from './FieldMappingPanel';
import { FormProcessConfigPanel } from './FormProcessConfigPanel';
import EntityFieldPicker, { type SelectedField } from './EntityFieldPicker';
import { listTenantForms, getFormFields } from '../../../services/workformsApi';
import { COMMON_ENTITY_TYPES } from '../../../services/schemaService';
import {
  Panel as BasePanel,
  PanelHeader,
  PanelTitle,
  PanelContent,
  PanelFooter,
  CloseButton,
  FormField,
  Label,
  RequiredIndicator,
  Input,
  TextArea,
  Select,
  HelpText,
  EmptyState,
  EmptyIcon,
  EmptyText,
  PrimaryButton,
  SecondaryButton,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface NodeConfigPanelProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
  onTest?: (nodeId: string) => void;
}

type ConfigTab = 'config' | 'mapping' | 'advanced' | 'test';

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: string[];
}

interface ConditionRule {
  id: string;
  field: string;
  operator: string;
  value: any;
}

// ============================================================================
// Styled Components
// ============================================================================

const PanelOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(var(--color-overlay), 0.3);
  z-index: 1000;
  display: ${props => props.$isOpen ? 'block' : 'none'};
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;





const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`;

const NodeIcon = styled.span`
  font-size: 24px;
  line-height: 1;
`;

const HeaderInfo = styled.div`
  flex: 1;
  min-width: 0;
`;


const NodeType = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;



const TabBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 0 24px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  
  &:hover {
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;



const FormSection = styled.div`
  margin-bottom: 32px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;







const HelpIcon = styled(HelpCircle)`
  color: rgb(var(--color-text-tertiary));
  cursor: help;
  
  &:hover {
    color: rgb(var(--color-text-secondary));
  }
`;

const SlidingPanel = styled(BasePanel)<{ $isOpen: boolean }>`
  transform: translateX(${props => props.$isOpen ? '0' : '100%'});
  opacity: ${props => props.$isOpen ? 1 : 0};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
`;













const ValidationMessage = styled.div<{ $severity: 'error' | 'warning' }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  line-height: 1.5;
  background: ${props => props.$severity === 'error' 
    ? 'rgba(var(--color-error), 0.1)' 
    : 'rgba(var(--color-warning), 0.1)'};
  color: ${props => props.$severity === 'error' 
    ? 'rgb(var(--color-error))' 
    : 'rgb(var(--color-warning))'};
`;



const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        border: none;
        
        &:hover {
          opacity: 0.9;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;
    } else if (props.$variant === 'secondary') {
      return `
        background: rgb(var(--color-surface));
        color: rgb(var(--color-text-primary));
        border: 1px solid rgb(var(--color-border));
        
        &:hover {
          background: rgb(var(--color-border));
        }
      `;
    } else {
      return `
        background: none;
        color: rgb(var(--color-text-secondary));
        border: none;
        
        &:hover {
          color: rgb(var(--color-text-primary));
          background: rgba(var(--color-border), 0.5);
        }
      `;
    }
  }}
`;







const FieldItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  margin-bottom: 8px;
`;

const FieldItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const FieldItemLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
`;

const FieldItemMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
  
  &:hover.delete {
    background: rgb(var(--color-error));
    color: white;
  }
`;

const EditableFieldItem = styled.div<{ $isEditing: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: ${props => props.$isEditing ? 'rgb(var(--color-surface))' : 'rgb(var(--color-background))'};
  border: 1px solid ${props => props.$isEditing ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: all 0.2s ease;
`;

const FieldItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DragHandle = styled.div`
  color: rgb(var(--color-text-tertiary));
  cursor: grab;
  display: flex;
  align-items: center;
  
  &:active {
    cursor: grabbing;
  }
`;

const InlineInput = styled.input`
  flex: 1;
  padding: 6px 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const InlineSelect = styled.select`
  padding: 6px 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

const InlineCheckbox = styled.input`
  width: 14px;
  height: 14px;
  cursor: pointer;
`;

const InlineLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
`;

const FieldEditRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 120px 80px;
  gap: 8px;
  align-items: center;
`;

const FieldTemplate = styled.button`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-background));
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-surface));
  }
`;

const TemplatesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
`;

// ============================================================================
// Component
// ============================================================================

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  nodes,
  edges,
  onClose,
  onUpdate,
  onTest,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('config');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  // Cascading configuration state (Task 2.1)
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [availableFormFields, setAvailableFormFields] = useState<any[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const isOpen = node !== null;

  // Update form data when node changes
  useEffect(() => {
    if (node) {
      setFormData(node.data || {});
      setValidationErrors([]);
      setHasUnsavedChanges(false);
      setActiveTab('config');
    }
  }, [node?.id]); // Only reset when node ID changes
  
  const isFormProcessTrigger = formData.triggerType === 'formSubmitted';

  // Fetch available forms when trigger type is form-related (Task 2.1)
  useEffect(() => {
    const triggerType = formData.triggerType;
    if (
      triggerType === 'form' ||
      triggerType === 'formSubmitted' ||
      triggerType === 'recordCreated' ||
      triggerType === 'recordUpdated'
    ) {
      setLoadingForms(true);

      listTenantForms()
        .then((forms) => {
          const list = Array.isArray(forms) ? forms : [];

          // For Form Submitted triggers, we want *saved FormProcess nodes*, which are multi-entity forms
          // persisted from FormProcess containers.
          const filtered = isFormProcessTrigger
            ? list.filter((f: any) => Boolean(f?.is_multi_entity) || Number(f?.entity_count ?? 0) > 1)
            : list;

          // Sort newest first for quicker selection.
          filtered.sort((a: any, b: any) => {
            const aT = new Date(a?.created_at || 0).getTime();
            const bT = new Date(b?.created_at || 0).getTime();
            return bT - aT;
          });

          setAvailableForms(filtered);
        })
        .catch((error) => {
          console.error('Failed to fetch forms:', error);
          toast.error('Failed to load forms. Please refresh and try again.', {
            duration: 4000,
            icon: '⚠️',
          });
          Sentry.captureException(error, {
            extra: { context: 'NodeConfigPanel.fetchForms', triggerType: formData.triggerType },
          });
          setAvailableForms([]);
        })
        .finally(() => {
          setLoadingForms(false);
        });
    } else {
      setAvailableForms([]);
      setAvailableFormFields([]);
    }
  }, [formData.triggerType, isFormProcessTrigger]);
  
  // Fetch form fields when a form is selected (Task 2.1)
  useEffect(() => {
    const formId = formData.selectedFormId || formData.formId;
    if (formId) {
      setLoadingFields(true);
      // Use the proper API method to get fields
      getFormFields(formId)
        .then(fields => {
          setAvailableFormFields(fields);
        })
        .catch(error => {
          console.error('Failed to fetch form fields:', error);
          toast.error('Failed to load form fields. Please try selecting the form again.', {
            duration: 4000,
            icon: '⚠️',
          });
          Sentry.captureException(error, {
            extra: { context: 'NodeConfigPanel.fetchFormFields', formId },
          });
          setAvailableFormFields([]);
        })
        .finally(() => {
          setLoadingFields(false);
        });
    } else {
      setAvailableFormFields([]);
    }
  }, [formData.selectedFormId, formData.formId]);

  // ============================================================================
  // Validation Logic
  // ============================================================================

  const validate = (data: Record<string, any>): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Basic validation
    if (!data.label || data.label.trim() === '') {
      errors.push({
        field: 'label',
        message: 'Node label is required',
        severity: 'error',
      });
    }
    
    // Node-specific validation
    if (node?.type === 'formStep') {
      if (!data.fields || data.fields.length === 0) {
        errors.push({
          field: 'fields',
          message: 'At least one field is recommended',
          severity: 'warning',
        });
      }
    }
    
    if (node?.type === 'action') {
      if (!data.actionType) {
        errors.push({
          field: 'actionType',
          message: 'Action type is required',
          severity: 'error',
        });
      }
    }
    
    return errors;
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleFieldChange = (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    setHasUnsavedChanges(true);
    
    // Live validation
    const errors = validate(newData);
    setValidationErrors(errors);
  };

  const handleSave = () => {
    if (node && validationErrors.filter(e => e.severity === 'error').length === 0) {
      onUpdate(node.id, formData);
      setHasUnsavedChanges(false);
    }
  };

  const handleTest = () => {
    if (node && onTest) {
      onTest(node.id);
    }
  };

  const handleAddField = () => {
    const fields = formData.fields || [];
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: `Field ${fields.length + 1}`,
      type: 'text',
      required: false,
      placeholder: '',
    };
    handleFieldChange('fields', [...fields, newField]);
  };

  const handleRemoveField = (fieldId: string) => {
    const fields = formData.fields || [];
    handleFieldChange('fields', fields.filter((f: FormField) => f.id !== fieldId));
  };

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    const fields = formData.fields || [];
    handleFieldChange(
      'fields',
      fields.map((f: FormField) => (f.id === fieldId ? { ...f, ...updates } : f))
    );
  };

  const handleAddRule = () => {
    const rules = formData.rules || [];
    const newRule: ConditionRule = {
      id: `rule_${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
    };
    handleFieldChange('rules', [...rules, newRule]);
  };

  const handleRemoveRule = (ruleId: string) => {
    const rules = formData.rules || [];
    handleFieldChange('rules', rules.filter((r: ConditionRule) => r.id !== ruleId));
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<ConditionRule>) => {
    const rules = formData.rules || [];
    handleFieldChange(
      'rules',
      rules.map((r: ConditionRule) => (r.id === ruleId ? { ...r, ...updates } : r))
    );
  };

  const handleClose = () => {
    void (async () => {
      if (hasUnsavedChanges) {
        const confirmed = await confirmDialog({
          title: 'Discard changes?',
          content: 'You have unsaved changes. Close anyway?',
          okText: 'Discard',
          cancelText: 'Keep editing',
          danger: true,
        });
        if (confirmed) {
          setHasUnsavedChanges(false);
          onClose();
        }
      } else {
        onClose();
      }
    })();
  };

  // ============================================================================
  // Field Templates
  // ============================================================================
  
  const fieldTemplates = [
    { label: 'Email Address', type: 'email', required: true, placeholder: 'user@example.com' },
    { label: 'Phone Number', type: 'tel', required: false, placeholder: '(XXX)XXX-XXXX' },
    { label: 'Full Name', type: 'text', required: true, placeholder: 'John Doe' },
    { label: 'Company Name', type: 'text', required: false, placeholder: 'Acme Corp' },
    { label: 'Address', type: 'text', required: false, placeholder: '123 Main St' },
    { label: 'Date of Birth', type: 'date', required: false, placeholder: '' },
    { label: 'Comments', type: 'textarea', required: false, placeholder: 'Enter your comments...' },
    { label: 'Agree to Terms', type: 'checkbox', required: true, placeholder: '' },
  ];
  
  const addFieldFromTemplate = (template: typeof fieldTemplates[0]) => {
    const fields = formData.fields || [];
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: template.label,
      type: template.type,
      required: template.required,
      placeholder: template.placeholder,
    };
    handleFieldChange('fields', [...fields, newField]);
  };

  // ============================================================================
  // Render Tab Content
  // ============================================================================

  const renderTabContent = () => {
    if (!node) return null;

    switch (activeTab) {
      case 'config':
        return renderConfigTab();
      case 'mapping':
        return renderMappingTab();
      case 'advanced':
        return renderAdvancedTab();
      case 'test':
        return renderTestTab();
      default:
        return null;
    }
  };

  const renderConfigTab = () => {
    if (!node) return null;

    return (
      <>
        <FormSection>
          <SectionTitle>Basic Settings</SectionTitle>
          
          <FormField>
            <Label>
              Node Label <RequiredIndicator>*</RequiredIndicator>
              <span title="Display name for this node">
                <HelpIcon size={14} />
              </span>
            </Label>
            <Input
              value={formData.label || ''}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              placeholder="e.g., Customer Information Form"
              $hasError={validationErrors.some(e => e.field === 'label' && e.severity === 'error')}
            />
            {validationErrors.filter(e => e.field === 'label').map((error, i) => (
              <ValidationMessage key={i} $severity={error.severity}>
                <AlertCircle size={14} />
                <span>{error.message}</span>
              </ValidationMessage>
            ))}
            <HelpText>
              This name appears on the node in the canvas
            </HelpText>
          </FormField>

          <FormField>
            <Label>
              Description
            </Label>
            <TextArea
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Add a description for this node..."
            />
            <HelpText>
              Optional description for documentation purposes
            </HelpText>
          </FormField>
        </FormSection>

        {node.type === 'formStep' && renderFormStepConfig()}
        {node.type === 'action' && renderActionConfig()}
        {node.type === 'condition' && renderConditionConfig()}
        {node.type === 'trigger' && renderTriggerConfig()}
        {node.type === 'waitState' && renderWaitStateConfig()}
        {node.type === 'document' && renderDocumentConfig()}
        {node.type === 'utility' && renderUtilityConfig()}
        {node.type === 'terminal' && renderTerminalConfig()}
      </>
    );
  };

  const renderFormStepConfig = () => {
    const fields = (formData.fields || []) as FormField[];
    
    // Safe entity type access with fallback
    const entityType = formData.entityType || '';
    const entityTypeDisplay = entityType.replace('_', ' ');
    
    return (
      <>
        <FormSection>
          <SectionTitle>Entity Configuration</SectionTitle>

          <FormField>
            <Label>
              Entity + Fields
              <span title="Select entity and choose fields (mirrors Django Admin builder)">
                <HelpIcon size={14} />
              </span>
            </Label>

            <EntityFieldPicker
              selectedFields={((fields as any[]) || []).map((f: any, idx: number) => ({
                ...f,
                fieldId: f.fieldId || f.name || f.id || `${idx}`
              })) as SelectedField[]}
              onFieldsChange={(newFields: SelectedField[]) => {
                handleFieldChange('fields', newFields);
                handleFieldChange('selectedFields', newFields.map(f => f.name));
              }}
              initialEntityType={(() => {
                if (!entityType) return '';
                if (String(entityType).includes('.')) return entityType;
                const match = COMMON_ENTITY_TYPES.find(e => e.model === entityType || e.id.endsWith(`.${entityType}`));
                return match?.id || entityType;
              })()}
              onEntityTypeChange={(newEntityType) => handleFieldChange('entityType', newEntityType)}
              multiSelectMode
            />

            <HelpText>
              Selecting an entity loads its schema via BusinessApi (system entity introspection) and lets you pick fields.
            </HelpText>
          </FormField>
        </FormSection>

        <FormSection>
          <SectionTitle>Form Fields</SectionTitle>
          
          <FormField>
            <Label as="label">
              <Checkbox
                type="checkbox"
                checked={formData.allowBack || false}
                onChange={(e) => handleFieldChange('allowBack', e.target.checked)}
              />
              Allow "Back" button
            </Label>
          </FormField>

          <FormField>
            <Label as="label">
              <Checkbox
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => handleFieldChange('required', e.target.checked)}
              />
              All fields required
            </Label>
          </FormField>
          
          {/* Field Templates */}
        {showTemplates && (
          <FormField>
            <Label>Quick Add from Templates</Label>
            <TemplatesGrid>
              {fieldTemplates.map((template, index) => (
                <FieldTemplate
                  key={index}
                  onClick={() => {
                    addFieldFromTemplate(template);
                    setShowTemplates(false);
                  }}
                >
                  {template.label}
                </FieldTemplate>
              ))}
            </TemplatesGrid>
          </FormField>
        )}
        
        {/* Field list with inline editing */}
        {fields.length > 0 && (
          <FormField>
            <Label>Fields ({fields.length})</Label>
            {fields.map((field, index) => {
              const isEditing = editingFieldId === field.id;
              
              return (
                <EditableFieldItem key={field.id} $isEditing={isEditing}>
                  {isEditing ? (
                    <>
                      <FieldEditRow>
                        <InlineInput
                          type="text"
                          value={field.label}
                          onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                          placeholder="Field label"
                          autoFocus
                        />
                        <InlineSelect
                          value={field.type}
                          onChange={(e) => handleUpdateField(field.id, { type: e.target.value })}
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="tel">Phone</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="textarea">Text Area</option>
                          <option value="select">Dropdown</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="radio">Radio</option>
                        </InlineSelect>
                        <InlineLabel>
                          <InlineCheckbox
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                          />
                          Required
                        </InlineLabel>
                      </FieldEditRow>
                      <InlineInput
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) => handleUpdateField(field.id, { placeholder: e.target.value })}
                        placeholder="Placeholder text (optional)"
                      />
                      {(field.type === 'select' || field.type === 'radio') && (
                        <div style={{ marginTop: '8px' }}>
                          <InlineLabel>Options (comma-separated)</InlineLabel>
                          <InlineInput
                            type="text"
                            value={(field as any).options?.join(', ') || ''}
                            onChange={(e) => handleUpdateField(field.id, { 
                              options: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) 
                            })}
                            placeholder="e.g., Option 1, Option 2, Option 3"
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <IconButton
                          onClick={() => setEditingFieldId(null)}
                          title="Done editing"
                        >
                          <Check size={14} />
                        </IconButton>
                      </div>
                    </>
                  ) : (
                    <FieldItemHeader>
                      <DragHandle>
                        <GripVertical size={16} />
                      </DragHandle>
                      <FieldItemContent>
                        <FieldItemLabel>{field.label}</FieldItemLabel>
                        <FieldItemMeta>
                          {field.type} {field.required && '• Required'}
                          {field.placeholder && ` • "${field.placeholder}"`}
                        </FieldItemMeta>
                      </FieldItemContent>
                      <IconButton
                        onClick={() => setEditingFieldId(field.id)}
                        title="Edit field"
                      >
                        <Edit2 size={14} />
                      </IconButton>
                      <IconButton
                        className="delete"
                        onClick={() => handleRemoveField(field.id)}
                        title="Remove field"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </FieldItemHeader>
                  )}
                </EditableFieldItem>
              );
            })}
          </FormField>
        )}
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button $variant="secondary" onClick={handleAddField} style={{ flex: 1 }}>
            <Plus size={16} />
            Add Field
          </Button>
          <Button 
            $variant="ghost" 
            onClick={() => setShowTemplates(!showTemplates)}
            title="Choose from templates"
          >
            {showTemplates ? 'Hide Templates' : 'Templates'}
          </Button>
        </div>
        </FormSection>
      </>
    );
  };

  const renderActionConfig = () => {
    return (
      <FormSection>
        <SectionTitle>Action Configuration</SectionTitle>
        
        <FormField>
          <Label>
            Action Type <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Select
            value={formData.actionType || ''}
            onChange={(e) => handleFieldChange('actionType', e.target.value)}
            $hasError={validationErrors.some(e => e.field === 'actionType' && e.severity === 'error')}
          >
            <option value="">Select action type...</option>
            <option value="email">Send Email</option>
            <option value="notify">Send Notification</option>
            <option value="createRecord">Create Record</option>
            <option value="updateRecord">Update Record</option>
            <option value="deleteRecord">Delete Record</option>
            <option value="http">HTTP Request</option>
            <option value="script">Run Script</option>
          </Select>
        </FormField>
      </FormSection>
    );
  };

  const renderConditionConfig = () => {
    const rules = (formData.rules || []) as ConditionRule[];
    
    return (
      <FormSection>
        <SectionTitle>Condition Rules</SectionTitle>
        
        <FormField>
          <Label>
            Logical Operator
          </Label>
          <Select
            value={formData.logicalOperator || 'AND'}
            onChange={(e) => handleFieldChange('logicalOperator', e.target.value)}
          >
            <option value="AND">All conditions must match (AND)</option>
            <option value="OR">Any condition matches (OR)</option>
          </Select>
        </FormField>
        
        {/* Rule list with inline editing */}
        {rules.length > 0 && (
          <FormField>
            <Label>Rules ({rules.length})</Label>
            {rules.map((rule) => {
              const isEditing = editingRuleId === rule.id;
              
              return (
                <EditableFieldItem key={rule.id} $isEditing={isEditing}>
                  {isEditing ? (
                    <>
                      <InlineInput
                        type="text"
                        value={rule.field}
                        onChange={(e) => handleUpdateRule(rule.id, { field: e.target.value })}
                        placeholder="Field name (e.g., status, total, email)"
                        autoFocus
                      />
                      <FieldEditRow>
                        <InlineSelect
                          value={rule.operator}
                          onChange={(e) => handleUpdateRule(rule.id, { operator: e.target.value })}
                        >
                          <option value="equals">Equals</option>
                          <option value="notEquals">Not Equals</option>
                          <option value="contains">Contains</option>
                          <option value="notContains">Does Not Contain</option>
                          <option value="greaterThan">Greater Than</option>
                          <option value="lessThan">Less Than</option>
                          <option value="isEmpty">Is Empty</option>
                          <option value="isNotEmpty">Is Not Empty</option>
                        </InlineSelect>
                        <InlineInput
                          type="text"
                          value={rule.value}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          placeholder="Value"
                          disabled={rule.operator === 'isEmpty' || rule.operator === 'isNotEmpty'}
                        />
                      </FieldEditRow>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <IconButton
                          onClick={() => setEditingRuleId(null)}
                          title="Done editing"
                        >
                          <Check size={14} />
                        </IconButton>
                      </div>
                    </>
                  ) : (
                    <FieldItemHeader>
                      <DragHandle>
                        <GripVertical size={16} />
                      </DragHandle>
                      <FieldItemContent>
                        <FieldItemLabel>
                          {rule.field || 'Untitled Rule'}
                        </FieldItemLabel>
                        <FieldItemMeta>
                          {rule.operator} {rule.value && `"${rule.value}"`}
                        </FieldItemMeta>
                      </FieldItemContent>
                      <IconButton
                        onClick={() => setEditingRuleId(rule.id)}
                        title="Edit rule"
                      >
                        <Edit2 size={14} />
                      </IconButton>
                      <IconButton
                        className="delete"
                        onClick={() => handleRemoveRule(rule.id)}
                        title="Remove rule"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </FieldItemHeader>
                  )}
                </EditableFieldItem>
              );
            })}
          </FormField>
        )}
        
        <Button $variant="secondary" onClick={handleAddRule}>
          <Plus size={16} />
          Add Rule
        </Button>
      </FormSection>
    );
  };

  const renderTriggerConfig = () => {
    return (
      <FormSection>
        <SectionTitle>Trigger Configuration</SectionTitle>
        
        <FormField>
          <Label>
            Trigger Type <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Select
            value={formData.triggerType || 'manual'}
            onChange={(e) => handleFieldChange('triggerType', e.target.value)}
          >
            <option value="manual">Manual / On-Demand</option>
            <option value="schedule">Scheduled (Cron)</option>
            <option value="webhook">Webhook / API</option>
            <option value="event">System Event</option>
            <option value="recordCreated">Record Created</option>
            <option value="recordUpdated">Record Updated</option>
            <option value="formSubmitted">Form Submitted</option>
          </Select>
          <HelpText>
            How this workflow should be triggered
          </HelpText>
        </FormField>

        {formData.triggerType === 'schedule' && (
          <FormField>
            <Label>Cron Expression</Label>
            <Input
              value={formData.cronExpression || ''}
              onChange={(e) => handleFieldChange('cronExpression', e.target.value)}
              placeholder="0 9 * * * (every day at 9 AM)"
            />
            <HelpText>
              Enter a valid cron expression for scheduling
            </HelpText>
          </FormField>
        )}

        {formData.triggerType === 'webhook' && (
          <FormField>
            <Label>Webhook Path</Label>
            <Input
              value={formData.webhookPath || ''}
              onChange={(e) => handleFieldChange('webhookPath', e.target.value)}
              placeholder="/api/webhooks/custom-flow"
            />
            <HelpText>
              Custom URL path for this webhook
            </HelpText>
          </FormField>
        )}
        
        {/* Cascading Form Selection (Task 2.1) */}
        {(formData.triggerType === 'formSubmitted' || formData.triggerType === 'recordCreated' || formData.triggerType === 'recordUpdated') && (
          <>
            <FormField>
              <Label>
                {formData.triggerType === 'formSubmitted' ? 'Select Form Process' : 'Select Form'}{' '}
                <RequiredIndicator>*</RequiredIndicator>
              </Label>
              <Select
                value={formData.selectedFormId || formData.formId || ''}
                onChange={(e) => {
                  handleFieldChange('selectedFormId', e.target.value);
                  handleFieldChange('formId', e.target.value);
                }}
                disabled={loadingForms}
              >
                <option value="">
                  {loadingForms
                    ? 'Loading form processes...'
                    : formData.triggerType === 'formSubmitted'
                      ? 'Select a form process'
                      : 'Select a form'}
                </option>
                {availableForms.map((form: any) => {
                  const title =
                    form?.title ||
                    form?.display_name ||
                    form?.displayName ||
                    form?.name ||
                    `Form ${form?.id}`;

                  const createdLabel = form?.created_at
                    ? new Date(form.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })
                    : null;

                  return (
                    <option key={form.id} value={form.id}>
                      {createdLabel ? `${title} — ${createdLabel}` : title}
                    </option>
                  );
                })}
              </Select>
              <HelpText>
                {formData.triggerType === 'formSubmitted'
                  ? 'Choose which saved FormProcess submission should trigger this workflow'
                  : 'Choose which form submission will trigger this workflow'}
              </HelpText>
            </FormField>
            
            {/* Field Selection (appears after form is selected) */}
            {(formData.selectedFormId || formData.formId) && (
              <FormField>
                <Label>
                  Trigger Field (Optional)
                </Label>
                <Select
                  value={formData.triggerFieldId || ''}
                  onChange={(e) => handleFieldChange('triggerFieldId', e.target.value)}
                  disabled={loadingFields || availableFormFields.length === 0}
                >
                  <option value="">
                    {loadingFields ? 'Loading fields...' : availableFormFields.length === 0 ? 'No fields available' : 'Any field (trigger on any submission)'}
                  </option>
                  {availableFormFields.map((field: any) => (
                    <option key={field.id} value={field.id}>
                      {field.label} ({field.type})
                      {field.required && ' *'}
                    </option>
                  ))}
                </Select>
                <HelpText>
                  Optionally trigger only when a specific field is filled. Leave empty to trigger on any form submission.
                </HelpText>
              </FormField>
            )}
          </>
        )}
      </FormSection>
    );
  };

  const renderWaitStateConfig = () => {
    return (
      <FormSection>
        <SectionTitle>Wait Configuration</SectionTitle>
        
        <FormField>
          <Label>
            Wait Type <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Select
            value={formData.waitType || 'duration'}
            onChange={(e) => handleFieldChange('waitType', e.target.value)}
          >
            <option value="duration">Duration (Time Period)</option>
            <option value="until">Until (Specific Date/Time)</option>
            <option value="event">Until Event Occurs</option>
          </Select>
        </FormField>

        {formData.waitType === 'duration' && (
          <>
            <FormField>
              <Label>Duration Value</Label>
              <Input
                type="number"
                value={formData.durationValue || ''}
                onChange={(e) => handleFieldChange('durationValue', e.target.value)}
                placeholder="5"
              />
            </FormField>
            <FormField>
              <Label>Duration Unit</Label>
              <Select
                value={formData.durationUnit || 'minutes'}
                onChange={(e) => handleFieldChange('durationUnit', e.target.value)}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </Select>
            </FormField>
          </>
        )}

        {formData.waitType === 'until' && (
          <FormField>
            <Label>Date/Time</Label>
            <Input
              type="datetime-local"
              value={formData.waitUntil || ''}
              onChange={(e) => handleFieldChange('waitUntil', e.target.value)}
            />
          </FormField>
        )}
      </FormSection>
    );
  };

  const renderDocumentConfig = () => {
    return (
      <FormSection>
        <SectionTitle>Document Configuration</SectionTitle>
        
        <FormField>
          <Label>
            Document Type <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Select
            value={formData.documentType || ''}
            onChange={(e) => handleFieldChange('documentType', e.target.value)}
          >
            <option value="">Select document type...</option>
            <option value="pdf">PDF Document</option>
            <option value="excel">Excel Spreadsheet</option>
            <option value="word">Word Document</option>
            <option value="csv">CSV File</option>
          </Select>
        </FormField>

        <FormField>
          <Label>Template</Label>
          <Input
            value={formData.templatePath || ''}
            onChange={(e) => handleFieldChange('templatePath', e.target.value)}
            placeholder="/templates/invoice.pdf"
          />
          <HelpText>
            Path to the document template
          </HelpText>
        </FormField>
      </FormSection>
    );
  };

  const renderUtilityConfig = () => {
    return (
      <FormSection>
        <SectionTitle>Utility Configuration</SectionTitle>
        
        <FormField>
          <Label>
            Utility Type <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Select
            value={formData.utilityType || ''}
            onChange={(e) => handleFieldChange('utilityType', e.target.value)}
          >
            <option value="">Select utility...</option>
            <option value="variable">Set Variable</option>
            <option value="calculate">Calculate</option>
            <option value="transform">Transform Data</option>
            <option value="split">Split Flow</option>
            <option value="merge">Merge Flows</option>
          </Select>
        </FormField>

        <FormField>
          <Label>Expression</Label>
          <TextArea
            value={formData.expression || ''}
            onChange={(e) => handleFieldChange('expression', e.target.value)}
            placeholder="result = input1 + input2"
          />
          <HelpText>
            JavaScript expression or operation
          </HelpText>
        </FormField>
      </FormSection>
    );
  };

  const renderTerminalConfig = () => {
    return (
      <FormSection>
        <SectionTitle>Termination Configuration</SectionTitle>
        
        <FormField>
          <Label>
            End Type <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Select
            value={formData.endType || 'success'}
            onChange={(e) => handleFieldChange('endType', e.target.value)}
          >
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </FormField>

        <FormField>
          <Label>Message</Label>
          <Input
            value={formData.endMessage || ''}
            onChange={(e) => handleFieldChange('endMessage', e.target.value)}
            placeholder="Workflow completed successfully"
          />
          <HelpText>
            Optional message to display when this endpoint is reached
          </HelpText>
        </FormField>
      </FormSection>
    );
  };

  const renderMappingTab = () => {
    if (!node) return null;

    // Get field mappings from node data
    const mappings: FieldMapping[] = formData.fieldMappings || [];
    
    // Get available form fields from current node
    const formFields = (formData.fields || []).map((field: any) => ({
      id: field.id,
      label: field.label,
      type: field.type,
    }));
    
    // Determine target entity from node data or default to 'supplier'
    const targetEntity = formData.targetEntity || 'supplier';
    
    // Handle mapping changes
    const handleMappingsChange = (updatedMappings: FieldMapping[]) => {
      handleFieldChange('fieldMappings', updatedMappings);
    };
    
    // If no form fields, show message
    if (formFields.length === 0) {
      return (
        <FormSection>
          <SectionTitle>Field Mappings</SectionTitle>
          <EmptyState>
            <EmptyIcon>📋</EmptyIcon>
            <EmptyText>Add form fields first to enable data mapping</EmptyText>
            <HelpText>
              Field mappings allow you to connect form data to database entities (Suppliers, Customers, Products, etc.)
            </HelpText>
          </EmptyState>
        </FormSection>
      );
    }

    return (
      <FormSection style={{ padding: 0, border: 'none' }}>
        <FieldMappingPanel
          mappings={mappings}
          formFields={formFields}
          targetEntity={targetEntity}
          onChange={handleMappingsChange}
          availableSteps={[]}
        />
      </FormSection>
    );
  };
  const renderAdvancedTab = () => {
    return (
      <FormSection>
        <SectionTitle>Advanced Settings</SectionTitle>
        
        <FormField>
          <Label>
            Max Inputs
          </Label>
          <Input
            type="number"
            min="0"
            value={formData.maxInputs || 1}
            onChange={(e) => handleFieldChange('maxInputs', parseInt(e.target.value) || 1)}
          />
          <HelpText>
            Maximum number of incoming connections (0 = unlimited)
          </HelpText>
        </FormField>

        <FormField>
          <Label>
            Max Outputs
          </Label>
          <Input
            type="number"
            min="0"
            value={formData.maxOutputs || 1}
            onChange={(e) => handleFieldChange('maxOutputs', parseInt(e.target.value) || 1)}
          />
          <HelpText>
            Maximum number of outgoing connections (0 = unlimited)
          </HelpText>
        </FormField>

        <FormField>
          <Label as="label">
            <Checkbox
              type="checkbox"
              checked={formData.disabled || false}
              onChange={(e) => handleFieldChange('disabled', e.target.checked)}
            />
            Disable this node
          </Label>
        </FormField>
      </FormSection>
    );
  };

  const renderTestTab = () => {
    return (
      <EmptyState>
        <EmptyIcon>🧪</EmptyIcon>
        <EmptyText>
          Test runner coming soon
          <br />
          Execute this node with sample data
        </EmptyText>
        <Button $variant="primary" onClick={handleTest} style={{ marginTop: '20px' }}>
          <Play size={14} />
          Run Test
        </Button>
      </EmptyState>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (!node) return null;

  return (
    <>
      <PanelOverlay $isOpen={isOpen} onClick={handleClose} />
      <SlidingPanel $isOpen={isOpen}>
        <PanelHeader>
          <HeaderLeft>
            <NodeIcon>⚙️</NodeIcon>
            <HeaderInfo>
              <PanelTitle>{formData.label || 'Untitled Node'}</PanelTitle>
              <NodeType>{node.type}</NodeType>
            </HeaderInfo>
          </HeaderLeft>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </PanelHeader>

        <TabBar>
          <Tab $active={activeTab === 'config'} onClick={() => setActiveTab('config')}>
            Config
          </Tab>
          <Tab $active={activeTab === 'mapping'} onClick={() => setActiveTab('mapping')}>
            Data Mapping
          </Tab>
          <Tab $active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')}>
            Advanced
          </Tab>
          <Tab $active={activeTab === 'test'} onClick={() => setActiveTab('test')}>
            Test
          </Tab>
        </TabBar>

        <PanelContent>
          {renderTabContent()}
        </PanelContent>

        <PanelFooter>
          <Button $variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            $variant="primary" 
            onClick={handleSave}
            disabled={validationErrors.some(e => e.severity === 'error')}
          >
            <Save size={14} />
            Save Changes
            {hasUnsavedChanges && ' *'}
          </Button>
        </PanelFooter>
      </SlidingPanel>
    </>
  );
};

export default NodeConfigPanel;
