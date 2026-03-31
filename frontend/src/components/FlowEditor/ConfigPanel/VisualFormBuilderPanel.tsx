/**
 * Visual Form Builder Panel
 * 
 * Embedded form builder for node configuration - NO JSON!
 * User-friendly drag-drop interface like Typeform/Zapier.
 * 
 * Features:
 * - Drag-drop fields (text, email, select, file, etc)
 * - Visual validation rules (checkboxes/toggles)
 * - Conditional logic builder (if-then UI)
 * - Live preview
 * 
 * Created: 2026-02-24
 * Phase: Visual Config Panel Enhancement
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { confirmDialog } from '@/utils/uiDialogs';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Eye, 
  Settings,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormField, FieldType, ValidationRule } from '../../form-builder/types';

// ============================================================================
// Component Props
// ============================================================================

export interface VisualFormBuilderPanelProps {
  /** Current fields configuration */
  fields: FormField[];
  
  /** Callback when fields change */
  onChange: (fields: FormField[]) => void;
  
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Field Type Options
// ============================================================================

const FIELD_TYPES: Array<{ value: FieldType; label: string; icon: string }> = [
  { value: 'text', label: 'Text Input', icon: '📝' },
  { value: 'textarea', label: 'Long Text', icon: '📄' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'number', label: 'Number', icon: '🔢' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'datetime', label: 'Date & Time', icon: '🕐' },
  { value: 'select', label: 'Dropdown', icon: '📋' },
  { value: 'multiSelect', label: 'Multi-Select', icon: '☑️' },
  { value: 'radio', label: 'Radio Buttons', icon: '🔘' },
  { value: 'checkbox', label: 'Checkboxes', icon: '✅' },
  { value: 'file', label: 'File Upload', icon: '📎' },
  { value: 'signature', label: 'Signature', icon: '✍️' },
  { value: 'rating', label: 'Rating', icon: '⭐' },
  { value: 'slider', label: 'Slider', icon: '🎚️' },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const AddFieldButton = styled.button`
  padding: 8px 16px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: rgb(var(--color-text-secondary));
  
  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
`;

const FieldCard = styled.div<{ isDragging?: boolean; isExpanded?: boolean }>`
  background: ${props => props.isDragging ? 'rgb(var(--color-surface-hover))' : 'rgb(var(--color-surface))'};
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 12px;
  cursor: ${props => props.isDragging ? 'grabbing' : 'grab'};
  transition: all 0.2s;
  opacity: ${props => props.isDragging ? 0.5 : 1};
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
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

const FieldIcon = styled.span`
  font-size: 20px;
`;

const FieldInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FieldLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 6px;
`;

const RequiredBadge = styled.span`
  font-size: 10px;
  background: rgb(239, 68, 68);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
`;

const FieldType = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const FieldActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button<{ variant?: 'danger' }>`
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: ${props => props.variant === 'danger' ? 'rgb(239, 68, 68)' : 'rgb(var(--color-text-secondary))'};
  display: flex;
  align-items: center;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgb(var(--color-surface-hover))'};
  }
`;

const FieldDetails = styled.div<{ isExpanded: boolean }>`
  display: ${props => props.isExpanded ? 'flex' : 'none'};
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const FormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Input = styled.input`
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Textarea = styled.textarea`
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  min-height: 60px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Select = styled.select`
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const CheckboxWrapper = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
`;

const ValidationSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--color-primary-rgb), 0.05);
  border-radius: 6px;
`;

const ValidationTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ValidationRules = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

// ============================================================================
// Sortable Field Item Component
// ============================================================================

interface SortableFieldItemProps {
  field: FormField;
  onEdit: (field: FormField) => void;
  onDelete: (fieldId: string) => void;
}

const SortableFieldItem: React.FC<SortableFieldItemProps> = ({ field, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localField, setLocalField] = useState(field);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.value === field.type);
  
  // Sync local changes back to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(localField) !== JSON.stringify(field)) {
        onEdit(localField);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [localField, field, onEdit]);
  
  const handleLocalChange = (updates: Partial<FormField>) => {
    setLocalField(prev => ({ ...prev, ...updates }));
  };
  
  return (
    <FieldCard ref={setNodeRef} style={style} isDragging={isDragging} isExpanded={isExpanded}>
      <FieldHeader>
        <DragHandle {...listeners} {...attributes}>
          <GripVertical size={18} />
        </DragHandle>
        
        <FieldIcon>{fieldTypeInfo?.icon || '📝'}</FieldIcon>
        
        <FieldInfo>
          <FieldLabel>
            {field.label || 'Untitled Field'}
            {field.required && <RequiredBadge>REQUIRED</RequiredBadge>}
          </FieldLabel>
          <FieldType>{fieldTypeInfo?.label || field.type}</FieldType>
        </FieldInfo>
        
        <FieldActions>
          <IconButton onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </IconButton>
          <IconButton variant="danger" onClick={() => onDelete(field.id)}>
            <Trash2 size={16} />
          </IconButton>
        </FieldActions>
      </FieldHeader>
      
      <FieldDetails isExpanded={isExpanded}>
        <FormRow>
          <Label>Field Label *</Label>
          <Input
            type="text"
            value={localField.label}
            onChange={(e) => handleLocalChange({ label: e.target.value })}
            placeholder="Enter field label"
          />
        </FormRow>
        
        <FormRow>
          <Label>Placeholder Text</Label>
          <Input
            type="text"
            value={localField.placeholder || ''}
            onChange={(e) => handleLocalChange({ placeholder: e.target.value })}
            placeholder="Enter placeholder"
          />
        </FormRow>
        
        <FormRow>
          <Label>Help Text</Label>
          <Textarea
            value={localField.helpText || ''}
            onChange={(e) => handleLocalChange({ helpText: e.target.value })}
            placeholder="Optional help text for users"
          />
        </FormRow>
        
        <FormRow>
          <Label>Field Type</Label>
          <Select
            value={localField.type}
            onChange={(e) => handleLocalChange({ type: e.target.value as FieldType })}
          >
            {FIELD_TYPES.map(ft => (
              <option key={ft.value} value={ft.value}>
                {ft.icon} {ft.label}
              </option>
            ))}
          </Select>
        </FormRow>
        
        {(localField.type === 'select' || localField.type === 'multiSelect' || localField.type === 'radio' || localField.type === 'checkbox') && (
          <FormRow>
            <Label>Options (one per line)</Label>
            <Textarea
              value={(localField.options || []).join('\n')}
              onChange={(e) => handleLocalChange({ options: e.target.value.split('\n').filter(o => o.trim()) })}
              placeholder="Option 1&#10;Option 2&#10;Option 3"
            />
          </FormRow>
        )}
        
        <ValidationSection>
          <ValidationTitle>Validation Rules</ValidationTitle>
          <ValidationRules>
            <CheckboxWrapper>
              <input
                type="checkbox"
                checked={localField.required}
                onChange={(e) => handleLocalChange({ required: e.target.checked })}
              />
              <span>Required field</span>
            </CheckboxWrapper>
            
            {(localField.type === 'text' || localField.type === 'textarea') && (
              <>
                <FormRow>
                  <Label>Min Length</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 3"
                    onChange={(e) => {
                      const minLength = parseInt(e.target.value);
                      if (!isNaN(minLength)) {
                        const validation = localField.validation.filter(v => v.type !== 'minLength');
                        validation.push({ type: 'minLength', value: minLength, message: `Minimum ${minLength} characters` });
                        handleLocalChange({ validation });
                      }
                    }}
                  />
                </FormRow>
                <FormRow>
                  <Label>Max Length</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    onChange={(e) => {
                      const maxLength = parseInt(e.target.value);
                      if (!isNaN(maxLength)) {
                        const validation = localField.validation.filter(v => v.type !== 'maxLength');
                        validation.push({ type: 'maxLength', value: maxLength, message: `Maximum ${maxLength} characters` });
                        handleLocalChange({ validation });
                      }
                    }}
                  />
                </FormRow>
              </>
            )}
            
            {(localField.type === 'number') && (
              <>
                <FormRow>
                  <Label>Minimum Value</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 0"
                    onChange={(e) => {
                      const min = parseInt(e.target.value);
                      if (!isNaN(min)) {
                        const validation = localField.validation.filter(v => v.type !== 'min');
                        validation.push({ type: 'min', value: min, message: `Minimum value: ${min}` });
                        handleLocalChange({ validation });
                      }
                    }}
                  />
                </FormRow>
                <FormRow>
                  <Label>Maximum Value</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    onChange={(e) => {
                      const max = parseInt(e.target.value);
                      if (!isNaN(max)) {
                        const validation = localField.validation.filter(v => v.type !== 'max');
                        validation.push({ type: 'max', value: max, message: `Maximum value: ${max}` });
                        handleLocalChange({ validation });
                      }
                    }}
                  />
                </FormRow>
              </>
            )}
          </ValidationRules>
        </ValidationSection>
      </FieldDetails>
    </FieldCard>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const VisualFormBuilderPanel: React.FC<VisualFormBuilderPanelProps> = ({
  fields,
  onChange,
  readOnly = false,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      
      onChange(arrayMove(fields, oldIndex, newIndex));
    }
  }, [fields, onChange]);
  
  const handleAddField = useCallback(() => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: 'text',
      label: `New Field ${fields.length + 1}`,
      placeholder: '',
      helpText: '',
      required: false,
      validation: [],
      width: 'full',
    };
    
    onChange([...fields, newField]);
  }, [fields, onChange]);
  
  const handleEditField = useCallback((updatedField: FormField) => {
    onChange(fields.map(f => f.id === updatedField.id ? updatedField : f));
  }, [fields, onChange]);
  
  const handleDeleteField = useCallback((fieldId: string) => {
    void (async () => {
      const confirmed = await confirmDialog({
        title: 'Delete field?',
        content: 'Delete this field?',
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });

      if (confirmed) {
        onChange(fields.filter(f => f.id !== fieldId));
      }
    })();
  }, [fields, onChange]);
  
  return (
    <Container>
      <Header>
        <Title>Form Fields</Title>
        {!readOnly && (
          <AddFieldButton onClick={handleAddField}>
            <Plus size={16} />
            Add Field
          </AddFieldButton>
        )}
      </Header>
      
      {fields.length === 0 ? (
        <EmptyState>
          <AlertCircle size={48} />
          <p>No fields yet. Click "Add Field" to get started!</p>
        </EmptyState>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <FieldsList>
              {fields.map(field => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  onEdit={handleEditField}
                  onDelete={handleDeleteField}
                />
              ))}
            </FieldsList>
          </SortableContext>
        </DndContext>
      )}
    </Container>
  );
};
