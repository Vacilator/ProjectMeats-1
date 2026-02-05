/**
 * Create Record Action Configuration Panel
 * 
 * Specialized panel for configuring "Create Record" actions.
 * Allows selecting target entity and mapping form fields to entity fields.
 * 
 * Features:
 * - Entity type selector (Supplier, Customer, Product, etc.)
 * - Integration with FieldMappingPanel for field mapping
 * - Required field indicators
 * - Validation for entity selection
 * 
 * Created: 2026-02-05 - Phase 2 Task 2.2 Action Type-Specific Configs
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Save, X, AlertCircle } from 'lucide-react';
import { Node } from '@xyflow/react';
import { FieldMappingPanel, FieldMapping } from './FieldMappingPanel';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface CreateRecordConfigPanelProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
}

interface CreateRecordData {
  label: string;
  entity: string;
  fieldMappings: FieldMapping[];
  description?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const PanelOverlay = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Panel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 600px;
  background: rgb(var(--color-surface));
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

const PanelHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const PanelTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const PanelFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-shrink: 0;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  border: none;
  
  ${props => props.$variant === 'primary' && `
    background: rgb(var(--color-primary));
    color: white;
    
    &:hover {
      background: rgb(var(--color-primary-hover, var(--color-primary)));
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
    }
  `}
  
  ${props => props.$variant === 'secondary' && `
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover {
      background: rgb(var(--color-surface));
    }
  `}
  
  ${props => props.$variant === 'ghost' && `
    background: transparent;
    color: rgb(var(--color-text-secondary));
    
    &:hover {
      background: rgb(var(--color-background));
      color: rgb(var(--color-text-primary));
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
`;

const FormSection = styled.div`
  margin-bottom: 24px;
  
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
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const RequiredIndicator = styled.span`
  color: rgb(var(--color-error));
  margin-left: 4px;
`;

const Select = styled.select<{ $hasError?: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  
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

const TextInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  resize: vertical;
  min-height: 80px;
  transition: all 0.2s;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const FieldHelp = styled.p`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin: 6px 0 0 0;
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--color-error), 0.1);
  border: 1px solid rgba(var(--color-error), 0.3);
  border-radius: var(--radius-md);
  color: rgb(var(--color-error));
  font-size: 13px;
  margin-bottom: 16px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-weight: 500;
  margin-bottom: 8px;
`;

// ============================================================================
// Component
// ============================================================================

export const CreateRecordConfigPanel: React.FC<CreateRecordConfigPanelProps> = ({
  node,
  onClose,
  onUpdate,
}) => {
  const [formData, setFormData] = useState<CreateRecordData>({
    label: node.data.label || 'Create Record',
    entity: node.data.entity || '',
    fieldMappings: node.data.fieldMappings || [],
    description: node.data.description || '',
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get available form fields from previous nodes (simplified - in production would traverse graph)
  const formFields = [
    // This would be populated from previous form step nodes
    // For now, returning empty array - will be populated when integrated with flow
  ];

  const handleFieldChange = (field: keyof CreateRecordData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    setValidationError(null);
  };

  const handleMappingsChange = (mappings: FieldMapping[]) => {
    handleFieldChange('fieldMappings', mappings);
  };

  const handleSave = () => {
    // Validation
    if (!formData.entity) {
      setValidationError('Please select an entity type');
      return;
    }
    
    if (formData.fieldMappings.length === 0) {
      setValidationError('Please configure at least one field mapping');
      return;
    }
    
    // Save changes
    onUpdate(node.id, formData);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <>
      <PanelOverlay onClick={handleClose} />
      <Panel>
        <PanelHeader>
          <PanelTitle>Create Record Configuration</PanelTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </PanelHeader>

        <PanelContent>
          {validationError && (
            <ErrorMessage>
              <AlertCircle size={16} />
              {validationError}
            </ErrorMessage>
          )}

          <FormSection>
            <SectionTitle>Basic Information</SectionTitle>
            
            <FormField>
              <FieldLabel>
                Action Label <RequiredIndicator>*</RequiredIndicator>
              </FieldLabel>
              <TextInput
                value={formData.label}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                placeholder="e.g., Create New Supplier"
              />
              <FieldHelp>
                A descriptive name for this action
              </FieldHelp>
            </FormField>

            <FormField>
              <FieldLabel>Description</FieldLabel>
              <TextArea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Optional description..."
              />
            </FormField>
          </FormSection>

          <FormSection>
            <SectionTitle>Target Entity</SectionTitle>
            
            <FormField>
              <FieldLabel>
                Entity Type <RequiredIndicator>*</RequiredIndicator>
              </FieldLabel>
              <Select
                value={formData.entity}
                onChange={(e) => handleFieldChange('entity', e.target.value)}
                $hasError={!!validationError && !formData.entity}
              >
                <option value="">Select entity type...</option>
                <option value="supplier">Supplier</option>
                <option value="customer">Customer</option>
                <option value="product">Product</option>
                <option value="purchase_order">Purchase Order</option>
                <option value="sales_order">Sales Order</option>
                <option value="inventory_item">Inventory Item</option>
              </Select>
              <FieldHelp>
                The type of record to create
              </FieldHelp>
            </FormField>
          </FormSection>

          {formData.entity ? (
            <FormSection>
              <SectionTitle>Field Mapping</SectionTitle>
              <FieldMappingPanel
                mappings={formData.fieldMappings}
                formFields={formFields}
                targetEntity={formData.entity}
                onChange={handleMappingsChange}
                availableSteps={[]}
              />
            </FormSection>
          ) : (
            <EmptyState>
              <EmptyIcon>📋</EmptyIcon>
              <EmptyText>Select an entity type first</EmptyText>
              <FieldHelp>
                Choose which type of record to create, then configure field mappings
              </FieldHelp>
            </EmptyState>
          )}
        </PanelContent>

        <PanelFooter>
          <Button $variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            $variant="primary" 
            onClick={handleSave}
            disabled={!formData.entity}
          >
            <Save size={14} />
            Save Configuration
            {hasUnsavedChanges && ' *'}
          </Button>
        </PanelFooter>
      </Panel>
    </>
  );
};

export default CreateRecordConfigPanel;
