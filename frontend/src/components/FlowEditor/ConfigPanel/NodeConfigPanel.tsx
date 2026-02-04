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
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, HelpCircle, Play, Save, AlertCircle, Plus, Trash2, Edit2, Check, GripVertical } from 'lucide-react';
import { Node } from '@xyflow/react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface NodeConfigPanelProps {
  node: Node | null;
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
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: ${props => props.$isOpen ? 'block' : 'none'};
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Panel = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  background: rgb(var(--color-surface));
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  transform: ${props => props.$isOpen ? 'translateX(0)' : 'translateX(100%)'};
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
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

const NodeTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NodeType = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CloseButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
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

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
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

const FormField = styled.div`
  margin-bottom: 20px;
`;

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const RequiredIndicator = styled.span`
  color: rgb(239, 68, 68);
`;

const HelpIcon = styled(HelpCircle)`
  color: rgb(var(--color-text-tertiary));
  cursor: help;
  
  &:hover {
    color: rgb(var(--color-text-secondary));
  }
`;

const TextInput = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(239, 68, 68)' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? 'rgb(239, 68, 68)' : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px ${props => props.$hasError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--color-primary), 0.1)'};
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const TextArea = styled.textarea<{ $hasError?: boolean }>`
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(239, 68, 68)' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  font-family: inherit;
  resize: vertical;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? 'rgb(239, 68, 68)' : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px ${props => props.$hasError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--color-primary), 0.1)'};
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const Select = styled.select<{ $hasError?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(239, 68, 68)' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? 'rgb(239, 68, 68)' : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px ${props => props.$hasError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--color-primary), 0.1)'};
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
  
  &:hover {
    color: rgb(var(--color-primary));
  }
`;

const FieldHelp = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 6px;
  line-height: 1.5;
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
    ? 'rgba(239, 68, 68, 0.1)' 
    : 'rgba(234, 179, 8, 0.1)'};
  color: ${props => props.$severity === 'error' 
    ? 'rgb(239, 68, 68)' 
    : 'rgb(234, 179, 8)'};
`;

const PanelFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 14px;
  line-height: 1.6;
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
    background: rgb(239, 68, 68);
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
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Close anyway?')) {
        setHasUnsavedChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  // ============================================================================
  // Field Templates
  // ============================================================================
  
  const fieldTemplates = [
    { label: 'Email Address', type: 'email', required: true, placeholder: 'user@example.com' },
    { label: 'Phone Number', type: 'tel', required: false, placeholder: '(555) 123-4567' },
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
            <FieldLabel>
              Node Label <RequiredIndicator>*</RequiredIndicator>
              <HelpIcon size={14} title="Display name for this node" />
            </FieldLabel>
            <TextInput
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
            <FieldHelp>
              This name appears on the node in the canvas
            </FieldHelp>
          </FormField>

          <FormField>
            <FieldLabel>
              Description
            </FieldLabel>
            <TextArea
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Add a description for this node..."
            />
            <FieldHelp>
              Optional description for documentation purposes
            </FieldHelp>
          </FormField>
        </FormSection>

        {node.type === 'formStep' && renderFormStepConfig()}
        {node.type === 'action' && renderActionConfig()}
        {node.type === 'condition' && renderConditionConfig()}
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
            <FieldLabel>
              Entity Type
              <HelpIcon size={14} title="Select which business object this form creates or updates" />
            </FieldLabel>
            <Select
              value={entityType}
              onChange={(e) => {
                try {
                  handleFieldChange('entityType', e.target.value);
                } catch (error) {
                  console.error('[NodeConfigPanel] Error changing entity type:', error);
                }
              }}
            >
              <option value="">Select entity type...</option>
              <option value="supplier">Supplier</option>
              <option value="customer">Customer</option>
              <option value="contact">Contact</option>
              <option value="carrier">Carrier</option>
              <option value="product">Product</option>
              <option value="purchase_order">Purchase Order</option>
              <option value="sales_order">Sales Order</option>
              <option value="invoice">Invoice</option>
              <option value="inquiry">Inquiry</option>
              <option value="fulfillment">Fulfillment</option>
            </Select>
            <FieldHelp>
              Choose the type of record this form will create or modify
            </FieldHelp>
          </FormField>

          {entityType && (
            <FormField>
              <FieldLabel>
                Load Entity Fields
                <HelpIcon size={14} title="Automatically add fields based on the selected entity schema" />
              </FieldLabel>
              <Button 
                $variant="secondary" 
                onClick={() => {
                  // Placeholder: In production, fetch from API
                  alert(`Would fetch fields for entity type: ${entityTypeDisplay}\n\nAPI endpoint: /api/admin/entities/${entityType}/fields/`);
                }}
              >
                <Download size={16} />
                Load Schema Fields
              </Button>
              <FieldHelp>
                Import standard fields from the {entityTypeDisplay} entity
              </FieldHelp>
            </FormField>
          )}
        </FormSection>

        <FormSection>
          <SectionTitle>Form Fields</SectionTitle>
          
          <FormField>
            <CheckboxLabel>
              <Checkbox
                type="checkbox"
                checked={formData.allowBack || false}
                onChange={(e) => handleFieldChange('allowBack', e.target.checked)}
              />
              Allow "Back" button
            </CheckboxLabel>
          </FormField>

          <FormField>
            <CheckboxLabel>
              <Checkbox
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => handleFieldChange('required', e.target.checked)}
              />
              All fields required
            </CheckboxLabel>
          </FormField>
          
          {/* Field Templates */}
        {showTemplates && (
          <FormField>
            <FieldLabel>Quick Add from Templates</FieldLabel>
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
            <FieldLabel>Fields ({fields.length})</FieldLabel>
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
          <FieldLabel>
            Action Type <RequiredIndicator>*</RequiredIndicator>
          </FieldLabel>
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
          <FieldLabel>
            Logical Operator
          </FieldLabel>
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
            <FieldLabel>Rules ({rules.length})</FieldLabel>
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

  const renderMappingTab = () => {
    if (!node) return null;

    // Get field mappings from node data
    const mappings = formData.fieldMappings || [];

    const handleAddMapping = () => {
      const newMapping = {
        id: `mapping_${Date.now()}`,
        sourceNodeId: '',
        sourceField: '',
        targetField: '',
        mode: 'copy' as 'copy' | 'lookup',
      };
      handleFieldChange('fieldMappings', [...mappings, newMapping]);
    };

    const handleUpdateMapping = (mappingId: string, updates: any) => {
      const updatedMappings = mappings.map((m: any) =>
        m.id === mappingId ? { ...m, ...updates } : m
      );
      handleFieldChange('fieldMappings', updatedMappings);
    };

    const handleRemoveMapping = (mappingId: string) => {
      handleFieldChange('fieldMappings', mappings.filter((m: any) => m.id !== mappingId));
    };

    const handleAutoMap = () => {
      // Auto-mapping logic: match fields by name/type
      const currentFields = formData.fields || [];
      const autoMappings: any[] = [];

      currentFields.forEach((field: any) => {
        // Simple auto-match by field name (case-insensitive)
        const fieldName = field.label.toLowerCase();
        
        // Check if any previous nodes have matching fields
        // Note: In production, you'd get this from actual previous node data
        // For now, we'll create placeholder auto-mappings
        if (fieldName.includes('email') || fieldName.includes('name') || fieldName.includes('phone')) {
          autoMappings.push({
            id: `mapping_${Date.now()}_${field.id}`,
            sourceNodeId: 'previous_node', // Placeholder
            sourceField: field.label,
            targetField: field.id,
            mode: 'copy',
            isAutoMapped: true,
          });
        }
      });

      if (autoMappings.length > 0) {
        handleFieldChange('fieldMappings', [...mappings, ...autoMappings]);
        alert(`Auto-mapped ${autoMappings.length} field(s)`);
      } else {
        alert('No matching fields found for auto-mapping');
      }
    };

    return (
      <FormSection>
        <SectionTitle>
          Field Mappings
          <HelpIcon size={14} title="Map data from previous nodes to this node's fields" />
        </SectionTitle>
        
        <FormField>
          <FieldHelp>
            Connect fields from previous workflow steps to automatically populate data.
          </FieldHelp>
        </FormField>

        {mappings.length === 0 ? (
          <EmptyState>
            <EmptyIcon>🔗</EmptyIcon>
            <EmptyText>No field mappings configured yet</EmptyText>
          </EmptyState>
        ) : (
          <>
            {mappings.map((mapping: any, index: number) => (
              <Card key={mapping.id}>
                <CardContent style={{ padding: '12px' }}>
                  <FieldRow>
                    <InlineLabel style={{ flex: '0 0 auto', marginBottom: '8px', width: '100%' }}>
                      Mapping {index + 1}
                      {mapping.isAutoMapped && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          background: 'rgba(34, 197, 94, 0.1)',
                          color: 'rgb(34, 197, 94)',
                          borderRadius: '4px'
                        }}>
                          Auto
                        </span>
                      )}
                    </InlineLabel>
                  </FieldRow>
                  
                  <FieldRow style={{ marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <InlineLabel>Source Field</InlineLabel>
                      <InlineInput
                        value={mapping.sourceField || ''}
                        onChange={(e) => handleUpdateMapping(mapping.id, { sourceField: e.target.value })}
                        placeholder="Select source field"
                      />
                    </div>
                  </FieldRow>

                  <FieldRow style={{ marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <InlineLabel>Target Field</InlineLabel>
                      <InlineSelect
                        value={mapping.targetField || ''}
                        onChange={(e) => handleUpdateMapping(mapping.id, { targetField: e.target.value })}
                      >
                        <option value="">Select target field</option>
                        {(formData.fields || []).map((field: FormField) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </InlineSelect>
                    </div>
                  </FieldRow>

                  <FieldRow style={{ alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <InlineLabel>Mapping Mode</InlineLabel>
                      <InlineSelect
                        value={mapping.mode || 'copy'}
                        onChange={(e) => handleUpdateMapping(mapping.id, { mode: e.target.value })}
                      >
                        <option value="copy">Copy Value</option>
                        <option value="lookup">Lookup Reference</option>
                      </InlineSelect>
                    </div>
                    <IconButton
                      onClick={() => handleRemoveMapping(mapping.id)}
                      title="Remove mapping"
                      style={{ marginTop: '16px' }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </FieldRow>

                  {mapping.mode === 'copy' && (
                    <FieldHelp style={{ marginTop: '8px', fontSize: '11px' }}>
                      Copies the value directly from source to target
                    </FieldHelp>
                  )}
                  {mapping.mode === 'lookup' && (
                    <FieldHelp style={{ marginTop: '8px', fontSize: '11px' }}>
                      Looks up related record using the source value as key
                    </FieldHelp>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <Button $variant="secondary" onClick={handleAddMapping}>
            <Plus size={16} />
            Add Mapping
          </Button>
          <Button $variant="secondary" onClick={handleAutoMap}>
            <Sparkles size={16} />
            Auto-Map Fields
          </Button>
        </div>
      </FormSection>
    );
  };

  const renderAdvancedTab = () => {
    return (
      <FormSection>
        <SectionTitle>Advanced Settings</SectionTitle>
        
        <FormField>
          <FieldLabel>
            Max Inputs
          </FieldLabel>
          <TextInput
            type="number"
            min="0"
            value={formData.maxInputs || 1}
            onChange={(e) => handleFieldChange('maxInputs', parseInt(e.target.value) || 1)}
          />
          <FieldHelp>
            Maximum number of incoming connections (0 = unlimited)
          </FieldHelp>
        </FormField>

        <FormField>
          <FieldLabel>
            Max Outputs
          </FieldLabel>
          <TextInput
            type="number"
            min="0"
            value={formData.maxOutputs || 1}
            onChange={(e) => handleFieldChange('maxOutputs', parseInt(e.target.value) || 1)}
          />
          <FieldHelp>
            Maximum number of outgoing connections (0 = unlimited)
          </FieldHelp>
        </FormField>

        <FormField>
          <CheckboxLabel>
            <Checkbox
              type="checkbox"
              checked={formData.disabled || false}
              onChange={(e) => handleFieldChange('disabled', e.target.checked)}
            />
            Disable this node
          </CheckboxLabel>
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
      <Panel $isOpen={isOpen}>
        <PanelHeader>
          <HeaderLeft>
            <NodeIcon>⚙️</NodeIcon>
            <HeaderInfo>
              <NodeTitle>{formData.label || 'Untitled Node'}</NodeTitle>
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
      </Panel>
    </>
  );
};

export default NodeConfigPanel;
