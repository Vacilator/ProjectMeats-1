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
import { X, HelpCircle, Play, Save, AlertCircle } from 'lucide-react';
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
    return (
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
        
        {/* Field builder will be added in next batch */}
        <Button $variant="secondary">
          + Add Field
        </Button>
      </FormSection>
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
        
        {/* Rule builder will be added in next batch */}
        <Button $variant="secondary">
          + Add Rule
        </Button>
      </FormSection>
    );
  };

  const renderMappingTab = () => {
    return (
      <EmptyState>
        <EmptyIcon>🔗</EmptyIcon>
        <EmptyText>
          Data mapping interface coming soon
          <br />
          Connect fields from previous nodes
        </EmptyText>
      </EmptyState>
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
