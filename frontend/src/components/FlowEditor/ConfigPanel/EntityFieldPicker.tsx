/**
 * EntityFieldPicker Component
 * 
 * Allows users to select fields from an entity schema and add them to a form.
 * Features:
 * - Entity selection dropdown
 * - Available fields list (from entity schema)
 * - Selected fields list (drag-and-drop ordering)
 * - Search/filter fields
 * - Field metadata display (type, required, etc.)
 * 
 * Phase 2.3 of WF-ENH-2026-Q1
 * Created: 2026-02-06
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useEntityList, useEntityFields, EntityType, EntityField } from '../../../services/schemaService';
import workformsApi from '../../../services/workformsApi';
import {
  Section,
  SectionTitle,
  Label,
  Select,
  Input,
  EmptyState,
} from './shared/StyledComponents';
import { 
  FieldListSkeleton, 
  EntitySelectorSkeleton,
  RetryButton,
  ErrorStateContainer,
  ErrorIcon,
  ErrorTitle,
  ErrorMessage,
  TimeoutContainer,
  TimeoutMessage
} from './SkeletonLoaders';
import { useTimeout } from '../hooks/useTimeout';

// ============================================================================
// Types
// ============================================================================

export interface SelectedField extends EntityField {
  /** Unique ID for drag-and-drop tracking */
  fieldId: string;
  /** Custom label override (optional) */
  customLabel?: string;
  /** Whether field is checked in multi-select mode */
  checked?: boolean;
}

interface EntityFieldPickerProps {
  /** Currently selected fields */
  selectedFields: SelectedField[];

  /** Callback when fields change */
  onFieldsChange: (fields: SelectedField[]) => void;

  /** Initial entity type (optional, uncontrolled mode) */
  initialEntityType?: string;

  /** Controlled entity type (preferred when embedded in a larger config panel) */
  entityType?: string;

  /** When true, the entity selector UI is hidden and entityType must be provided */
  hideEntitySelector?: boolean;

  /** Callback when entity type changes (uncontrolled mode only) */
  onEntityTypeChange?: (entityType: string) => void;

  /** Enable multi-select mode with checkboxes (default: false) */
  multiSelectMode?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
`;





const EntitySelector = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;







const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgb(var(--color-surface));
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--color-text-tertiary));
  }
`;

const FieldItem = styled.div<{ selected?: boolean; dragging?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: ${props => props.selected ? 'rgba(var(--color-primary), 0.1)' : 'rgb(var(--color-surface))'};
  border: 1px solid ${props => props.selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 6px;
  cursor: ${props => props.dragging ? 'grabbing' : 'pointer'};
  transition: all 0.2s ease;
  opacity: ${props => props.dragging ? 0.5 : 1};

  &:hover {
    border-color: rgb(var(--color-primary));
    background: ${props => props.selected ? 'rgba(var(--color-primary), 0.15)' : 'rgba(var(--color-primary), 0.05)'};
  }
`;

const FieldInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const FieldName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const FieldMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  gap: 8px;
  align-items: center;
`;

const FieldBadge = styled.span<{ variant?: 'required' | 'type' }>`
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 3px;
  background: ${props => {
    if (props.variant === 'required') return 'rgba(239, 68, 68, 0.1)';
    return 'rgba(var(--color-primary), 0.1)';
  }};
  color: ${props => {
    if (props.variant === 'required') return 'rgb(239, 68, 68)';
    return 'rgb(var(--color-primary))';
  }};
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgb(var(--color-primary));
  color: white;

  &:hover {
    background: rgba(var(--color-primary), 0.9);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RemoveButton = styled.button`
  padding: 4px 8px;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  transition: all 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  }
`;

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  padding: 4px;
  cursor: grab;
  color: rgb(var(--color-text-tertiary));

  &:active {
    cursor: grabbing;
  }
`;

const LoadingText = styled.div`
  padding: 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const ErrorText = styled.div`
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: rgb(239, 68, 68);
  font-size: 14px;
`;

// New: Field type filter UI
const FilterRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
`;

const FilterButton = styled.button<{ $active?: boolean }>`
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
    color: rgb(var(--color-primary));
  }
`;

const BulkActions = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
`;

// ============================================================================
// Component
// ============================================================================

export const EntityFieldPicker: React.FC<EntityFieldPickerProps> = ({
  selectedFields,
  onFieldsChange,
  initialEntityType,
  entityType,
  hideEntitySelector = false,
  onEntityTypeChange,
  multiSelectMode = false,
}) => {
  const [selectedEntityType, setSelectedEntityType] = useState<string>(entityType || initialEntityType || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [fieldTypeFilter, setFieldTypeFilter] = useState<string>('all');
  const [checkedFields, setCheckedFields] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);

  // Use React Query hooks from schemaService
  const { data: entities = [], isLoading: entitiesLoading, error: entitiesError, refetch: refetchEntities } = useEntityList();

  const effectiveEntityType = entityType || selectedEntityType;

  const { data: fieldsData, isLoading: fieldsLoading, error: fieldsError, refetch: refetchFields } = useEntityFields(
    effectiveEntityType,
    { enabled: !!effectiveEntityType }
  );
  
  // Timeout detection for fields loading
  const { isTimedOut: fieldsTimedOut, resetTimeout: resetFieldsTimeout } = useTimeout({
    isLoading: fieldsLoading,
    timeout: 5000,
    onTimeout: () => {
      console.warn('[EntityFieldPicker] Field loading timed out after 5s');
    }
  });
  
  // Timeout detection for entities loading
  const { isTimedOut: entitiesTimedOut, resetTimeout: resetEntitiesTimeout } = useTimeout({
    isLoading: entitiesLoading,
    timeout: 5000,
    onTimeout: () => {
      console.warn('[EntityFieldPicker] Entity loading timed out after 5s');
    }
  });
  
  const availableFields = fieldsData?.fields || [];
  const loading = entitiesLoading || fieldsLoading;
  const error = entitiesError || fieldsError;

  // Field type categorization
  const fieldTypeCategories = {
    text: ['text', 'email', 'url', 'char', 'string'],
    number: ['number', 'integer', 'decimal', 'float', 'positive_integer'],
    date: ['date', 'datetime', 'time'],
    boolean: ['boolean', 'checkbox'],
    relation: ['foreign_key', 'many_to_many', 'one_to_one'],
  };

  // Get unique field types from available fields
  const availableFieldTypes = Array.from(
    new Set(availableFields.map(f => f.type.toLowerCase()))
  ).sort();

  // Keep internal state in sync when used as a controlled component
  useEffect(() => {
    if (entityType) {
      setSelectedEntityType(entityType);
    }
  }, [entityType]);

  // Auto-select first entity in uncontrolled mode
  useEffect(() => {
    if (hideEntitySelector || entityType) return;
    if (!initialEntityType && entities.length > 0 && !selectedEntityType) {
      setSelectedEntityType(entities[0].id);
    }
  }, [entities, entityType, hideEntitySelector, initialEntityType, selectedEntityType]);

  const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const entityType = e.target.value;
    console.log('[EntityFieldPicker] Entity selected:', entityType);
    setSelectedEntityType(entityType);
    setSearchTerm('');
    setFieldTypeFilter('all');
    setCheckedFields(new Set());
    resetFieldsTimeout(); // Reset timeout when changing entity
    // Clear selected fields when changing entity type
    onFieldsChange([]);
    
    if (onEntityTypeChange) {
      console.log('[EntityFieldPicker] Notifying parent of entity change');
      onEntityTypeChange(entityType);
    }
  };
  
  // Retry handlers
  const handleRetryEntities = () => {
    console.log('[EntityFieldPicker] Retrying entity list fetch');
    setRetryCount(prev => prev + 1);
    resetEntitiesTimeout();
    refetchEntities();
  };
  
  const handleRetryFields = () => {
    console.log('[EntityFieldPicker] Retrying fields fetch');
    setRetryCount(prev => prev + 1);
    resetFieldsTimeout();
    refetchFields();
  };

  const handleAddField = (field: EntityField) => {
    // Check if field already added
    const exists = selectedFields.some(f => f.name === field.name);
    if (exists) return;

    const newField: SelectedField = {
      ...field,
      fieldId: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    onFieldsChange([...selectedFields, newField]);
  };

  const handleAddSelected = () => {
    const fieldsToAdd = availableFields
      .filter(f => checkedFields.has(f.name))
      .filter(f => !selectedFields.some(sf => sf.name === f.name))
      .map(f => ({
        ...f,
        fieldId: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

    if (fieldsToAdd.length > 0) {
      onFieldsChange([...selectedFields, ...fieldsToAdd]);
      setCheckedFields(new Set());
    }
  };

  const handleSelectAll = () => {
    const allFieldNames = filteredAvailableFields.map(f => f.name);
    setCheckedFields(new Set(allFieldNames));
  };

  const handleClearAll = () => {
    setCheckedFields(new Set());
  };

  const handleFieldCheckToggle = (fieldName: string) => {
    const newChecked = new Set(checkedFields);
    if (newChecked.has(fieldName)) {
      newChecked.delete(fieldName);
    } else {
      newChecked.add(fieldName);
    }
    setCheckedFields(newChecked);
  };

  const handleRemoveField = (fieldId: string) => {
    onFieldsChange(selectedFields.filter(f => f.fieldId !== fieldId));
  };

  const handleDragStart = (fieldId: string) => {
    setDraggedFieldId(fieldId);
  };

  const handleDragOver = (e: React.DragEvent, targetFieldId: string) => {
    e.preventDefault();
    
    if (!draggedFieldId || draggedFieldId === targetFieldId) return;

    const draggedIndex = selectedFields.findIndex(f => f.fieldId === draggedFieldId);
    const targetIndex = selectedFields.findIndex(f => f.fieldId === targetFieldId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newFields = [...selectedFields];
    const [draggedField] = newFields.splice(draggedIndex, 1);
    newFields.splice(targetIndex, 0, draggedField);

    onFieldsChange(newFields);
  };

  const handleDragEnd = () => {
    setDraggedFieldId(null);
  };

  const filteredAvailableFields = availableFields.filter(field => {
    // Search term filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        field.name.toLowerCase().includes(search) ||
        field.label.toLowerCase().includes(search) ||
        field.type.toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Field type filter
    if (fieldTypeFilter !== 'all') {
      const fieldTypeLower = field.type.toLowerCase();
      
      // Check if filter is a category (text, number, date, etc.)
      if (fieldTypeFilter in fieldTypeCategories) {
        const category = fieldTypeFilter as keyof typeof fieldTypeCategories;
        if (!fieldTypeCategories[category].some(t => fieldTypeLower.includes(t))) {
          return false;
        }
      } else {
        // Direct type match
        if (!fieldTypeLower.includes(fieldTypeFilter.toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  });

  const isFieldSelected = (fieldName: string) => {
    return selectedFields.some(f => f.name === fieldName);
  };

  return (
    <Container>
      {/* Entity Selection */}
      {!hideEntitySelector && !entityType && (
        <Section>
          <SectionTitle>Select Entity</SectionTitle>
          <EntitySelector>
            <Label htmlFor="entity-select">Entity Type *</Label>
            <Select
              id="entity-select"
              value={selectedEntityType}
              onChange={handleEntityChange}
            >
              <option value="">-- Select entity --</option>
              {entities.map(entity => (
                <option key={entity.id} value={entity.id}>
                  {entity.label_plural} {selectedEntityType === entity.id && availableFields.length > 0 ? `(${availableFields.length} fields)` : ''}
                </option>
              ))}
            </Select>
            {selectedEntityType && fieldsLoading && (
              <LoadingText style={{ padding: '8px 0', textAlign: 'left', fontSize: '12px' }}>
                Loading fields for {entities.find(e => e.id === selectedEntityType)?.label_plural}...
              </LoadingText>
            )}
            {selectedEntityType && !fieldsLoading && availableFields.length === 0 && !fieldsError && (
              <ErrorText style={{ marginTop: '8px', fontSize: '12px' }}>
                No fields found for this entity. This may indicate a backend configuration issue.
              </ErrorText>
            )}
          </EntitySelector>
        </Section>
      )}

      {hideEntitySelector && !effectiveEntityType && (
        <Section>
          <SectionTitle>Entity</SectionTitle>
          <EmptyState>
            ℹ️ Select an entity type first to see available fields
          </EmptyState>
        </Section>
      )}

      {/* Available Fields */}
      {effectiveEntityType && (
        <Section>
          <SectionTitle>Available Fields</SectionTitle>
          <Input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Field Type Filter */}
          <FilterRow>
            <FilterButton 
              $active={fieldTypeFilter === 'all'}
              onClick={() => setFieldTypeFilter('all')}
            >
              All Types
            </FilterButton>
            <FilterButton 
              $active={fieldTypeFilter === 'text'}
              onClick={() => setFieldTypeFilter('text')}
            >
              Text
            </FilterButton>
            <FilterButton 
              $active={fieldTypeFilter === 'number'}
              onClick={() => setFieldTypeFilter('number')}
            >
              Number
            </FilterButton>
            <FilterButton 
              $active={fieldTypeFilter === 'date'}
              onClick={() => setFieldTypeFilter('date')}
            >
              Date
            </FilterButton>
            <FilterButton 
              $active={fieldTypeFilter === 'boolean'}
              onClick={() => setFieldTypeFilter('boolean')}
            >
              Boolean
            </FilterButton>
            <FilterButton 
              $active={fieldTypeFilter === 'relation'}
              onClick={() => setFieldTypeFilter('relation')}
            >
              Relations
            </FilterButton>
          </FilterRow>

          {/* Bulk Actions (multi-select mode only) */}
          {multiSelectMode && (
            <BulkActions>
              <ActionButton onClick={handleSelectAll} disabled={filteredAvailableFields.length === 0}>
                Select All ({filteredAvailableFields.length})
              </ActionButton>
              <ActionButton onClick={handleClearAll} disabled={checkedFields.size === 0}>
                Clear All
              </ActionButton>
              <ActionButton 
                onClick={handleAddSelected} 
                disabled={checkedFields.size === 0}
                style={{ marginLeft: 'auto' }}
              >
                Add Selected ({checkedFields.size})
              </ActionButton>
            </BulkActions>
          )}
          
          {/* Entity loading skeleton */}
          {entitiesLoading && (
            <EntitySelectorSkeleton />
          )}
          
          {/* Entity loading error with retry */}
          {entitiesError && (
            <ErrorStateContainer>
              <ErrorIcon>
                <AlertCircle size={32} />
              </ErrorIcon>
              <ErrorTitle>Failed to Load Entities</ErrorTitle>
              <ErrorMessage>
                {entitiesError instanceof Error ? entitiesError.message : 'Could not fetch entity list'}
              </ErrorMessage>
              <RetryButton onClick={handleRetryEntities}>
                <RefreshCw size={16} />
                Retry
              </RetryButton>
            </ErrorStateContainer>
          )}
          
          {/* Entity loading timeout */}
          {entitiesTimedOut && !entitiesError && (
            <TimeoutContainer>
              <TimeoutMessage>
                Loading is taking longer than expected...
              </TimeoutMessage>
              <RetryButton onClick={handleRetryEntities}>
                <RefreshCw size={16} />
                Retry
              </RetryButton>
            </TimeoutContainer>
          )}
          
          {/* Fields loading skeleton */}
          {fieldsLoading && !fieldsTimedOut ? (
            <FieldListSkeleton count={5} />
          ) : /* Fields timeout */
          fieldsTimedOut && !fieldsError ? (
            <TimeoutContainer>
              <TimeoutMessage>
                Loading fields is taking longer than expected (&gt;5s)...
              </TimeoutMessage>
              <RetryButton onClick={handleRetryFields}>
                <RefreshCw size={16} />
                Retry
              </RetryButton>
            </TimeoutContainer>
          ) : /* Fields error */
          fieldsError ? (
            <ErrorStateContainer>
              <ErrorIcon>
                <AlertCircle size={32} />
              </ErrorIcon>
              <ErrorTitle>Failed to Load Fields</ErrorTitle>
              <ErrorMessage>
                {fieldsError instanceof Error ? fieldsError.message : 'Could not fetch fields for this entity'}
              </ErrorMessage>
              <RetryButton onClick={handleRetryFields}>
                <RefreshCw size={16} />
                Retry (Attempt {retryCount + 1})
              </RetryButton>
            </ErrorStateContainer>
          ) : (
            <FieldsList>
              {filteredAvailableFields.length === 0 ? (
                <EmptyState>
                  {availableFields.length === 0 
                    ? 'No fields found' 
                    : 'No fields match your filters'}
                </EmptyState>
              ) : (
                filteredAvailableFields.map(field => (
                  <FieldItem
                    key={field.name}
                    selected={isFieldSelected(field.name)}
                    onClick={() => {
                      if (multiSelectMode) {
                        handleFieldCheckToggle(field.name);
                      } else if (!isFieldSelected(field.name)) {
                        handleAddField(field);
                      }
                    }}
                  >
                    {multiSelectMode && (
                      <Checkbox
                        checked={checkedFields.has(field.name)}
                        onChange={() => handleFieldCheckToggle(field.name)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <FieldInfo>
                      <FieldName>{field.label}</FieldName>
                      <FieldMeta>
                        <FieldBadge variant="type">{field.type}</FieldBadge>
                        {field.required && <FieldBadge variant="required">required</FieldBadge>}
                        {field.help_text && <span>• {field.help_text}</span>}
                      </FieldMeta>
                    </FieldInfo>
                    {!multiSelectMode && !isFieldSelected(field.name) && (
                      <ActionButton onClick={() => handleAddField(field)}>
                        Add
                      </ActionButton>
                    )}
                    {!multiSelectMode && isFieldSelected(field.name) && (
                      <FieldBadge>Added</FieldBadge>
                    )}
                  </FieldItem>
                ))
              )}
            </FieldsList>
          )}
        </Section>
      )}

      {/* Selected Fields */}
      <Section>
        <SectionTitle>Selected Fields ({selectedFields.length})</SectionTitle>
        <FieldsList>
          {selectedFields.length === 0 ? (
            <EmptyState>No fields selected. Add fields from above.</EmptyState>
          ) : (
            selectedFields.map(field => (
              <FieldItem
                key={field.fieldId}
                dragging={draggedFieldId === field.fieldId}
                draggable
                onDragStart={() => handleDragStart(field.fieldId)}
                onDragOver={(e) => handleDragOver(e, field.fieldId)}
                onDragEnd={handleDragEnd}
              >
                <DragHandle>⋮⋮</DragHandle>
                <FieldInfo>
                  <FieldName>{field.label}</FieldName>
                  <FieldMeta>
                    <FieldBadge variant="type">{field.type}</FieldBadge>
                    {field.required && <FieldBadge variant="required">required</FieldBadge>}
                  </FieldMeta>
                </FieldInfo>
                <RemoveButton onClick={() => handleRemoveField(field.fieldId)}>
                  Remove
                </RemoveButton>
              </FieldItem>
            ))
          )}
        </FieldsList>
      </Section>
    </Container>
  );
};

export default EntityFieldPicker;
