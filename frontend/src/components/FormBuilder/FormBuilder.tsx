/**
 * FormBuilder Component
 * 
 * Standalone form builder for creating and editing reusable forms.
 * Features drag-and-drop field builder, section organization, and form templates.
 * 
 * Created: 2026-02-05 - Phase 3 Task 3.1
 * Part of: WORKFORMS_NAVIGATION_FIX_PLAN Phase 3
 */
import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Plus, Save, X, Eye, Settings, Copy, Trash2, 
  GripVertical, ChevronDown, ChevronUp, Layout 
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FieldConfigPanel from './FieldConfigPanel';
import ConditionalVisibilityRules from './ConditionalVisibilityRules';
import type { FieldConfig, FieldType } from './FieldConfigPanel';
import type { VisibilityRule } from './ConditionalVisibilityRules';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FieldConfig[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  icon?: string;
}

export interface FormDefinition {
  id?: string;
  name: string;
  description?: string;
  sections: FormSection[];
  settings: {
    multiPage?: boolean;
    showProgress?: boolean;
    allowSave?: boolean;
    submitButtonText?: string;
    theme?: 'light' | 'dark' | 'auto';
  };
  visibilityRules?: VisibilityRule[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FormBuilderProps {
  initialForm?: FormDefinition;
  onSave: (form: FormDefinition) => Promise<void>;
  onCancel?: () => void;
  onPreview?: (form: FormDefinition) => void;
  readOnly?: boolean;
}

// ============================================================================
// Field Type Palette
// ============================================================================

const FIELD_TYPE_PALETTE: { type: FieldType; label: string; icon: string; category: string }[] = [
  // Text Inputs
  { type: 'text', label: 'Text', icon: '📝', category: 'Text' },
  { type: 'textarea', label: 'Long Text', icon: '📄', category: 'Text' },
  { type: 'email', label: 'Email', icon: '📧', category: 'Text' },
  { type: 'phone', label: 'Phone', icon: '📞', category: 'Text' },
  // Numbers & Dates
  { type: 'number', label: 'Number', icon: '🔢', category: 'Numbers' },
  { type: 'currency', label: 'Currency', icon: '💰', category: 'Numbers' },
  { type: 'date', label: 'Date', icon: '📅', category: 'Date/Time' },
  { type: 'datetime', label: 'Date & Time', icon: '🕐', category: 'Date/Time' },
  { type: 'time', label: 'Time', icon: '⏰', category: 'Date/Time' },
  // Choices
  { type: 'select', label: 'Dropdown', icon: '📋', category: 'Choices' },
  { type: 'multiselect', label: 'Multi-Select', icon: '☑️', category: 'Choices' },
  { type: 'radio', label: 'Radio Buttons', icon: '🔘', category: 'Choices' },
  { type: 'checkbox', label: 'Checkbox', icon: '✅', category: 'Choices' },
  // Special
  { type: 'file', label: 'File Upload', icon: '📁', category: 'Special' },
  { type: 'signature', label: 'Signature', icon: '✍️', category: 'Special' },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: rgb(var(--color-background));
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const FormNameInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  min-width: 300px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        &:hover { opacity: 0.9; }
      `;
    } else if (props.$variant === 'danger') {
      return `
        background: rgb(var(--color-error));
        color: white;
        &:hover { opacity: 0.9; }
      `;
    } else {
      return `
        background: rgb(var(--color-surface));
        color: rgb(var(--color-text-primary));
        border: 1px solid rgb(var(--color-border));
        &:hover { background: rgb(var(--color-background)); }
      `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Sidebar = styled.div<{ $collapsed?: boolean }>`
  width: ${props => props.$collapsed ? '60px' : '280px'};
  background: rgb(var(--color-surface));
  border-right: 1px solid rgb(var(--color-border));
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
`;

const SidebarHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PaletteCategory = styled.div`
  border-bottom: 1px solid rgb(var(--color-border));
`;

const CategoryHeader = styled.div<{ $collapsed?: boolean }>`
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:hover {
    background: rgb(var(--color-surface));
  }
`;

const CategoryTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const PaletteItems = styled.div`
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PaletteItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: grab;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
  
  &:active {
    cursor: grabbing;
  }
`;

const FieldIcon = styled.span`
  font-size: 18px;
  flex-shrink: 0;
`;

const FieldLabel = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const Canvas = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: rgb(var(--color-background));
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  border: 2px dashed rgb(var(--color-border));
  border-radius: 12px;
  background: rgba(var(--color-primary), 0.02);
  color: rgb(var(--color-text-secondary));
  gap: 16px;
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  opacity: 0.5;
`;

const EmptyStateText = styled.p`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`;

const SectionContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  margin-bottom: 24px;
  overflow: hidden;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(var(--color-primary), 0.03);
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SectionInfo = styled.div`
  flex: 1;
`;

const SectionTitle = styled.h3`
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const SectionDescription = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const SectionActions = styled.div`
  display: flex;
  gap: 8px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }
`;

const FieldList = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100px;
`;

const FieldItem = styled.div<{ $isDragging?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: ${props => props.$isDragging ? 0.5 : 1};
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.03);
  }
`;

const DragHandle = styled.div`
  color: rgb(var(--color-text-tertiary));
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
`;

const FieldInfo = styled.div`
  flex: 1;
`;

const FieldName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
`;

const FieldType = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const FieldActions = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  
  ${FieldItem}:hover & {
    opacity: 1;
  }
`;

// ============================================================================
// Sortable Field Component
// ============================================================================

interface SortableFieldProps {
  field: FieldConfig;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const SortableField: React.FC<SortableFieldProps> = ({ field, onEdit, onDuplicate, onDelete }) => {
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
  
  return (
    <FieldItem ref={setNodeRef} style={style} $isDragging={isDragging} onClick={onEdit}>
      <DragHandle {...attributes} {...listeners}>
        <GripVertical size={16} />
      </DragHandle>
      <FieldIcon>
        {FIELD_TYPE_PALETTE.find(f => f.type === field.type)?.icon || '📝'}
      </FieldIcon>
      <FieldInfo>
        <FieldName>{field.label}</FieldName>
        <FieldType>{field.type}</FieldType>
      </FieldInfo>
      <FieldActions onClick={(e) => e.stopPropagation()}>
        <IconButton onClick={onDuplicate} title="Duplicate field">
          <Copy size={14} />
        </IconButton>
        <IconButton onClick={onDelete} title="Delete field">
          <Trash2 size={14} />
        </IconButton>
      </FieldActions>
    </FieldItem>
  );
};

// ============================================================================
// Main FormBuilder Component
// ============================================================================

export const FormBuilder: React.FC<FormBuilderProps> = ({
  initialForm,
  onSave,
  onCancel,
  onPreview,
  readOnly = false,
}) => {
  // State
  const [form, setForm] = useState<FormDefinition>(
    initialForm || {
      name: 'Untitled Form',
      description: '',
      sections: [],
      settings: {
        submitButtonText: 'Submit',
        theme: 'light',
      },
    }
  );
  
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<{ sectionId: string; field: FieldConfig } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handlers
  const handleFormNameChange = (name: string) => {
    setForm(prev => ({ ...prev, name }));
    setHasUnsavedChanges(true);
  };
  
  const handleAddSection = () => {
    const newSection: FormSection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      description: '',
      fields: [],
    };
    setForm(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setHasUnsavedChanges(true);
  };
  
  const handleAddField = (sectionId: string, fieldType: FieldType) => {
    const newField: FieldConfig = {
      id: `field-${Date.now()}`,
      name: `field_${Date.now()}`,
      label: `New ${fieldType} Field`,
      type: fieldType,
      validation: [],
      width: 'full',
    };
    
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? { ...section, fields: [...section.fields, newField] }
          : section
      ),
    }));
    setHasUnsavedChanges(true);
    setEditingField({ sectionId, field: newField });
  };
  
  const handleFieldUpdate = (sectionId: string, updatedField: FieldConfig) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map(f =>
                f.id === updatedField.id ? updatedField : f
              ),
            }
          : section
      ),
    }));
    setHasUnsavedChanges(true);
  };
  
  const handleDuplicateField = (sectionId: string, field: FieldConfig) => {
    const duplicatedField: FieldConfig = {
      ...field,
      id: `field-${Date.now()}`,
      name: `${field.name}_copy`,
      label: `${field.label} (Copy)`,
    };
    
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? { ...section, fields: [...section.fields, duplicatedField] }
          : section
      ),
    }));
    setHasUnsavedChanges(true);
  };
  
  const handleDeleteField = (sectionId: string, fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? { ...section, fields: section.fields.filter(f => f.id !== fieldId) }
          : section
      ),
    }));
    setHasUnsavedChanges(true);
  };
  
  const handleDeleteSection = (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section and all its fields?')) return;
    
    setForm(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
    }));
    setHasUnsavedChanges(true);
  };
  
  const handleDragEnd = (event: any, sectionId: string) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setForm(prev => ({
        ...prev,
        sections: prev.sections.map(section => {
          if (section.id !== sectionId) return section;
          
          const oldIndex = section.fields.findIndex(f => f.id === active.id);
          const newIndex = section.fields.findIndex(f => f.id === over.id);
          
          return {
            ...section,
            fields: arrayMove(section.fields, oldIndex, newIndex),
          };
        }),
      }));
      setHasUnsavedChanges(true);
    }
  };
  
  const handleSave = async () => {
    try {
      await onSave(form);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save form:', error);
    }
  };
  
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  // Group fields by category
  const groupedFields = FIELD_TYPE_PALETTE.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof FIELD_TYPE_PALETTE>);
  
  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>Form Builder</Title>
          <FormNameInput
            value={form.name}
            onChange={(e) => handleFormNameChange(e.target.value)}
            placeholder="Form name..."
            disabled={readOnly}
          />
        </HeaderLeft>
        <HeaderActions>
          {onPreview && (
            <Button onClick={() => onPreview(form)}>
              <Eye size={16} />
              Preview
            </Button>
          )}
          <Button onClick={handleSave} $variant="primary" disabled={!hasUnsavedChanges || readOnly}>
            <Save size={16} />
            Save
          </Button>
          {onCancel && (
            <Button onClick={onCancel}>
              <X size={16} />
              Cancel
            </Button>
          )}
        </HeaderActions>
      </Header>
      
      <MainContent>
        <Sidebar>
          <SidebarHeader>
            <SidebarTitle>Field Types</SidebarTitle>
          </SidebarHeader>
          {Object.entries(groupedFields).map(([category, fields]) => (
            <PaletteCategory key={category}>
              <CategoryHeader onClick={() => toggleCategory(category)}>
                <CategoryTitle>{category}</CategoryTitle>
                {collapsedCategories.has(category) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </CategoryHeader>
              {!collapsedCategories.has(category) && (
                <PaletteItems>
                  {fields.map(field => (
                    <PaletteItem
                      key={field.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('fieldType', field.type);
                      }}
                    >
                      <FieldIcon>{field.icon}</FieldIcon>
                      <FieldLabel>{field.label}</FieldLabel>
                    </PaletteItem>
                  ))}
                </PaletteItems>
              )}
            </PaletteCategory>
          ))}
        </Sidebar>
        
        <Canvas>
          {form.sections.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon>📋</EmptyStateIcon>
              <EmptyStateText>No sections yet. Add a section to start building your form.</EmptyStateText>
              <Button onClick={handleAddSection}>
                <Plus size={16} />
                Add Section
              </Button>
            </EmptyState>
          ) : (
            <>
              {form.sections.map((section) => (
                <SectionContainer
                  key={section.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'rgb(var(--color-primary))';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgb(var(--color-border))';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'rgb(var(--color-border))';
                    const fieldType = e.dataTransfer.getData('fieldType') as FieldType;
                    if (fieldType) {
                      handleAddField(section.id, fieldType);
                    }
                  }}
                >
                  <SectionHeader>
                    <SectionInfo>
                      <SectionTitle>{section.title}</SectionTitle>
                      {section.description && (
                        <SectionDescription>{section.description}</SectionDescription>
                      )}
                    </SectionInfo>
                    <SectionActions>
                      <IconButton onClick={() => handleDeleteSection(section.id)} title="Delete section">
                        <Trash2 size={16} />
                      </IconButton>
                    </SectionActions>
                  </SectionHeader>
                  
                  <FieldList>
                    {section.fields.length === 0 ? (
                      <EmptyState style={{ height: '120px', margin: 0 }}>
                        <EmptyStateText style={{ fontSize: '14px' }}>
                          Drag fields here or click to add
                        </EmptyStateText>
                      </EmptyState>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, section.id)}
                      >
                        <SortableContext items={section.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                          {section.fields.map((field) => (
                            <SortableField
                              key={field.id}
                              field={field}
                              onEdit={() => setEditingField({ sectionId: section.id, field })}
                              onDuplicate={() => handleDuplicateField(section.id, field)}
                              onDelete={() => handleDeleteField(section.id, field.id)}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </FieldList>
                </SectionContainer>
              ))}
              
              <Button onClick={handleAddSection} style={{ marginTop: '16px' }}>
                <Plus size={16} />
                Add Section
              </Button>
            </>
          )}
        </Canvas>
      </MainContent>
      
      {/* Field Config Panel */}
      {editingField && (
        <FieldConfigPanel
          field={editingField.field}
          onChange={(updatedField) => {
            handleFieldUpdate(editingField.sectionId, updatedField);
            setEditingField({ ...editingField, field: updatedField });
          }}
          onClose={() => setEditingField(null)}
        />
      )}
    </Container>
  );
};

export default FormBuilder;
