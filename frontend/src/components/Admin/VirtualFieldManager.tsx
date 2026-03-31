/**
 * Virtual Field Definition Manager
 * 
 * UI for managing TenantFieldDefinition (custom fields without migrations).
 * Allows admins to add custom fields to entities dynamically.
 * 
 * Features:
 * - Define custom fields for any entity
 * - Field types: text, select, date, number, checkbox, etc.
 * - Validation rules (required, min/max, patterns)
 * - Preview field configuration
 * - Data stored in custom_data JSONField
 * 
 * Phase 3: Virtual Schema
 * Created: 2026-02-23
 * 
 * @module VirtualFieldManager
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  Plus, Edit2, Trash2, Save, X, Type, Calendar, Hash, CheckSquare,
  List, Link as LinkIcon, Mail, Globe
} from 'lucide-react';
import { Modal as AntModal } from 'antd';
import { apiClient } from '../../services/apiService';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface FieldDefinition {
  id?: string;
  tenant: string;
  model_name: string;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  help_text?: string;
  default_value?: any;
  validation_rules?: ValidationRules;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 
                 'select' | 'multiselect' | 'checkbox' | 'url' | 'email';

interface ValidationRules {
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  pattern?: string;
  choices?: Array<{ value: string; label: string }>;
  custom?: string;
}

interface VirtualFieldManagerProps {
  /** Current tenant ID */
  tenantId: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENTITY_MODELS = [
  { value: 'Product', label: 'Product' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'Customer', label: 'Customer' },
  { value: 'PurchaseOrder', label: 'Purchase Order' },
  { value: 'SalesOrder', label: 'Sales Order' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Contact', label: 'Contact' },
  { value: 'Carrier', label: 'Carrier' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'textarea', label: 'Long Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'datetime', label: 'Date & Time', icon: Calendar },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'multiselect', label: 'Multi-Select', icon: List },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'url', label: 'URL', icon: LinkIcon },
  { value: 'email', label: 'Email', icon: Mail },
];

// ============================================================================
// Main Component
// ============================================================================

export const VirtualFieldManager: React.FC<VirtualFieldManagerProps> = ({
  tenantId,
}) => {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('Product');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Partial<FieldDefinition> | null>(null);

  /**
   * Load field definitions
   */
  const loadFields = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/system/field-schemas/', {
        params: { model_name: selectedModel },
      });
      console.log('[VirtualFieldManager] Loaded fields:', response.data);
      setFields(response.data.results || response.data);
    } catch (error) {
      console.error('[VirtualFieldManager] Failed to load fields:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadFields();
  }, [loadFields]);

  /**
   * Create/Update field
   */
  const handleSaveField = useCallback(async () => {
    if (!editingField) return;

    try {
      const fieldData = {
        ...editingField,
        tenant: tenantId,
        model_name: selectedModel,
      };

      if (editingField.id) {
        await apiClient.patch(`/system/field-schemas/${editingField.id}/`, fieldData);
      } else {
        await apiClient.post('/system/field-schemas/', fieldData);
      }

      await loadFields();
      setIsEditModalOpen(false);
      setEditingField(null);
    } catch (error) {
      console.error('[VirtualFieldManager] Failed to save field:', error);
      showAlert({ type: 'error', title: 'Error', content: 'Failed to save field' });
    }
  }, [editingField, tenantId, selectedModel, loadFields]);

  /**
   * Delete field
   */
  const handleDeleteField = useCallback(async (fieldId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete field?',
      content: 'Are you sure you want to delete this field?',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/system/field-schemas/${fieldId}/`);
      await loadFields();
    } catch (error) {
      console.error('[VirtualFieldManager] Failed to delete field:', error);
    }
  }, [loadFields]);

  /**
   * Get field type icon
   */
  const getFieldTypeIcon = useCallback((type: FieldType) => {
    const fieldType = FIELD_TYPES.find(ft => ft.value === type);
    return fieldType ? fieldType.icon : Type;
  }, []);

  /**
   * Render field card
   */
  const renderFieldCard = useCallback((field: FieldDefinition) => {
    const Icon = getFieldTypeIcon(field.field_type);

    return (
      <FieldCard key={field.id}>
        <FieldCardHeader>
          <FieldIcon>
            <Icon size={20} />
          </FieldIcon>
          <FieldInfo>
            <FieldLabel>
              {field.field_label}
              {field.is_required && <RequiredBadge>*</RequiredBadge>}
            </FieldLabel>
            <FieldKey>{field.field_key}</FieldKey>
          </FieldInfo>
          <FieldActions>
            <IconButton
              title="Edit field"
              onClick={() => {
                setEditingField(field);
                setIsEditModalOpen(true);
              }}
            >
              <Edit2 size={16} />
            </IconButton>
            <IconButton
              title="Delete field"
              onClick={() => field.id && handleDeleteField(field.id)}
            >
              <Trash2 size={16} />
            </IconButton>
          </FieldActions>
        </FieldCardHeader>

        <FieldMeta>
          <MetaBadge>{field.field_type}</MetaBadge>
          {field.validation_rules?.choices && (
            <MetaBadge>{field.validation_rules.choices.length} choices</MetaBadge>
          )}
        </FieldMeta>

        {field.help_text && (
          <FieldHelp>{field.help_text}</FieldHelp>
        )}
      </FieldCard>
    );
  }, [getFieldTypeIcon, handleDeleteField]);

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Custom Fields</Title>
          <Subtitle>Add custom fields to entities without database changes</Subtitle>
        </HeaderLeft>
        <HeaderRight>
          <Button
            $variant="primary"
            onClick={() => {
              setEditingField({
                field_key: '',
                field_label: '',
                field_type: 'text',
                is_required: false,
                display_order: fields.length,
                is_active: true,
              });
              setIsEditModalOpen(true);
            }}
          >
            <Plus size={16} />
            Add Custom Field
          </Button>
        </HeaderRight>
      </Header>

      <Toolbar>
        <ToolbarLabel>Entity:</ToolbarLabel>
        <EntitySelector
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          {ENTITY_MODELS.map(model => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </EntitySelector>

        <ToolbarSpacer />

        <ToolbarInfo>
          {fields.length} custom field{fields.length !== 1 ? 's' : ''}
        </ToolbarInfo>
      </Toolbar>

      <Content>
        {isLoading ? (
          <LoadingState>Loading custom fields...</LoadingState>
        ) : fields.length === 0 ? (
          <EmptyState>
            <EmptyIcon><Type size={48} /></EmptyIcon>
            <EmptyTitle>No custom fields yet</EmptyTitle>
            <EmptyMessage>
              Add custom fields to extend {selectedModel} without database migrations.
              Fields are stored in the custom_data JSONField.
            </EmptyMessage>
          </EmptyState>
        ) : (
          <FieldsGrid>
            {fields.map(renderFieldCard)}
          </FieldsGrid>
        )}
      </Content>

      {/* Edit Field Modal */}
      <AntModal
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingField(null);
        }}
        title={editingField?.id ? 'Edit Custom Field' : 'New Custom Field'}
        width={600}
        footer={
          <ModalFooter>
            <Button
              $variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingField(null);
              }}
            >
              Cancel
            </Button>
            <Button $variant="primary" onClick={handleSaveField}>
              <Save size={16} />
              Save Field
            </Button>
          </ModalFooter>
        }
        destroyOnClose
      >
        {editingField && (
          <Form>
            <FormRow>
              <FormGroup>
                <Label>Field Key (internal)</Label>
                <Input
                  value={editingField.field_key || ''}
                  onChange={(e) => setEditingField({ ...editingField, field_key: e.target.value })}
                  placeholder="e.g., lot_number"
                />
                <HelpText>Lowercase, underscores only</HelpText>
              </FormGroup>

              <FormGroup>
                <Label>Field Label (display)</Label>
                <Input
                  value={editingField.field_label || ''}
                  onChange={(e) => setEditingField({ ...editingField, field_label: e.target.value })}
                  placeholder="e.g., Lot Number"
                />
              </FormGroup>
            </FormRow>

            <FormGroup>
              <Label>Field Type</Label>
              <Select
                value={editingField.field_type || 'text'}
                onChange={(e) => setEditingField({ ...editingField, field_type: e.target.value as FieldType })}
              >
                {FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </FormGroup>

            {(editingField.field_type === 'select' || editingField.field_type === 'multiselect') && (
              <FormGroup>
                <Label>Choices (one per line: value|label)</Label>
                <Textarea
                  value={editingField.validation_rules?.choices?.map(c => `${c.value}|${c.label}`).join('\n') || ''}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    const choices = lines
                      .filter(line => line.trim())
                      .map(line => {
                        const [value, label] = line.split('|');
                        return { value: value.trim(), label: (label || value).trim() };
                      });
                    setEditingField({
                      ...editingField,
                      validation_rules: { ...editingField.validation_rules, choices },
                    });
                  }}
                  placeholder="small|Small\nmedium|Medium\nlarge|Large"
                  rows={5}
                />
              </FormGroup>
            )}

            {editingField.field_type === 'text' && (
              <FormRow>
                <FormGroup>
                  <Label>Min Length</Label>
                  <Input
                    type="number"
                    value={editingField.validation_rules?.min_length || ''}
                    onChange={(e) => setEditingField({
                      ...editingField,
                      validation_rules: {
                        ...editingField.validation_rules,
                        min_length: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Max Length</Label>
                  <Input
                    type="number"
                    value={editingField.validation_rules?.max_length || ''}
                    onChange={(e) => setEditingField({
                      ...editingField,
                      validation_rules: {
                        ...editingField.validation_rules,
                        max_length: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })}
                  />
                </FormGroup>
              </FormRow>
            )}

            {editingField.field_type === 'number' && (
              <FormRow>
                <FormGroup>
                  <Label>Min Value</Label>
                  <Input
                    type="number"
                    value={editingField.validation_rules?.min_value || ''}
                    onChange={(e) => setEditingField({
                      ...editingField,
                      validation_rules: {
                        ...editingField.validation_rules,
                        min_value: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Max Value</Label>
                  <Input
                    type="number"
                    value={editingField.validation_rules?.max_value || ''}
                    onChange={(e) => setEditingField({
                      ...editingField,
                      validation_rules: {
                        ...editingField.validation_rules,
                        max_value: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })}
                  />
                </FormGroup>
              </FormRow>
            )}

            <FormGroup>
              <Label>Help Text (optional)</Label>
              <Textarea
                value={editingField.help_text || ''}
                onChange={(e) => setEditingField({ ...editingField, help_text: e.target.value })}
                placeholder="Brief description or instructions"
                rows={2}
              />
            </FormGroup>

            <FormRow>
              <FormGroup>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={editingField.display_order || 0}
                  onChange={(e) => setEditingField({ ...editingField, display_order: parseInt(e.target.value) })}
                />
              </FormGroup>

              <FormGroup>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={editingField.is_required || false}
                    onChange={(e) => setEditingField({ ...editingField, is_required: e.target.checked })}
                  />
                  Required field
                </CheckboxLabel>

                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={editingField.is_active !== false}
                    onChange={(e) => setEditingField({ ...editingField, is_active: e.target.checked })}
                  />
                  Active
                </CheckboxLabel>
              </FormGroup>
            </FormRow>
          </Form>
        )}
      </AntModal>
    </Container>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background-primary));
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HeaderRight = styled.div`
  display: flex;
  gap: 12px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background-secondary));
`;

const ToolbarLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const EntitySelector = styled.select`
  padding: 8px 12px;
  background: rgb(var(--color-background-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const ToolbarSpacer = styled.div`
  flex: 1;
`;

const ToolbarInfo = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
`;

const FieldCard = styled.div`
  padding: 16px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const FieldCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
`;

const FieldIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  border-radius: 8px;
  flex-shrink: 0;
`;

const FieldInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 4px;
`;

const RequiredBadge = styled.span`
  color: rgb(var(--color-error));
  font-weight: bold;
`;

const FieldKey = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-family: 'Courier New', monospace;
`;

const FieldActions = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  ${FieldCard}:hover & {
    opacity: 1;
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }
`;

const FieldMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
`;

const MetaBadge = styled.span`
  padding: 4px 8px;
  background: rgba(107, 114, 128, 0.1);
  color: rgb(107, 114, 128);
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  text-transform: capitalize;
`;

const FieldHelp = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 16px;
`;

const EmptyTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const EmptyMessage = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  max-width: 400px;
  line-height: 1.6;
`;

const Button = styled.button<{ $variant: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: ${props => props.$variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-background-secondary))'};
  color: ${props => props.$variant === 'primary' ? 'white' : 'rgb(var(--color-text-primary))'};
  border: 1px solid ${props => props.$variant === 'primary' ? 'transparent' : 'rgb(var(--color-border))'};
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  padding: 10px 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Select = styled.select`
  padding: 10px 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Textarea = styled.textarea`
  padding: 10px 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  resize: vertical;
  font-family: 'Courier New', monospace;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const HelpText = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
`;

export default VirtualFieldManager;
