/**
 * Nested Children Renderer
 * 
 * Renders an array of child configurations within a parent node.
 * Each child is rendered using its own schema with DynamicConfigPanel.
 * 
 * Phase E.3: Schema + Config Integration + Reusability
 * 
 * Created: 2026-02-19
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, ChevronDown, ChevronRight, Trash2, GripVertical } from 'lucide-react';
import { ConfigField, NodeConfigSchema } from '../config/types';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface NestedChildrenRendererProps {
  field: ConfigField;
  value: any[];
  onChange: (newValue: any[]) => void;
  error?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ChildrenList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChildItem = styled.div<{ $expanded: boolean }>`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: rgba(var(--color-primary), 0.5);
    box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.05);
  }
`;

const ChildHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(var(--color-primary), 0.03);
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: rgba(var(--color-primary), 0.06);
  }
`;

const DragHandle = styled.div`
  color: rgb(var(--color-text-tertiary));
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
`;

const ExpandIcon = styled.div`
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
`;

const ChildTitle = styled.div`
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const ChildIndex = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(var(--color-primary), 0.15);
  color: rgb(var(--color-primary));
  font-size: 12px;
  font-weight: 600;
  margin-right: 8px;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const DeleteButton = styled(IconButton)`
  &:hover {
    background: rgba(var(--color-error), 0.1);
    color: rgb(var(--color-error));
  }
`;

const ChildContent = styled.div`
  padding: 16px;
  border-top: 1px solid rgb(var(--color-border));
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 2px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.03);
    color: rgb(var(--color-primary));
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const EmptyState = styled.div`
  padding: 32px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
  font-size: 12px;
  margin-top: 4px;
`;

// ============================================================================
// Component
// ============================================================================

/**
 * Nested Children Renderer
 * 
 * Renders an expandable/collapsible list of child configurations.
 * Each child is a mini-form using the provided childSchema.
 */
export const NestedChildrenRenderer: React.FC<NestedChildrenRendererProps> = ({
  field,
  value = [],
  onChange,
  error
}) => {
  const effectiveChildSchema: Omit<NodeConfigSchema, 'nodeType' | 'displayName'> | undefined =
    field.childSchema ??
    ((field as any).itemSchema && Array.isArray((field as any).itemSchema.fields)
      ? {
          sections: [
            {
              id: 'item',
              title: 'Item',
              fields: (field as any).itemSchema.fields,
            },
          ],
        }
      : undefined);

  const [expandedChildren, setExpandedChildren] = useState<Set<number>>(
    new Set(value.length === 1 ? [0] : []) // Auto-expand if only one child
  );
  
  // Toggle child expansion
  const toggleExpanded = useCallback((index: number) => {
    setExpandedChildren(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);
  
  // Add new child
  const handleAddChild = useCallback(() => {
    const newChild = effectiveChildSchema?.sections?.reduce((acc, section) => {
      section.fields.forEach(f => {
        if (f.defaultValue !== undefined) {
          acc[f.id] = f.defaultValue;
        }
      });
      return acc;
    }, {} as any) || {};
    
    const newValue = [...value, newChild];
    onChange(newValue);
    
    // Auto-expand new child
    setExpandedChildren(prev => new Set([...prev, newValue.length - 1]));
  }, [effectiveChildSchema, value, onChange]);
  
  // Remove child
  const handleRemoveChild = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
    
    // Update expanded indices
    setExpandedChildren(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < index) next.add(i);
        if (i > index) next.add(i - 1);
      });
      return next;
    });
  }, [value, onChange]);
  
  // Update child data
  const handleUpdateChild = useCallback((index: number, childData: any) => {
    const newValue = value.map((child, i) => i === index ? childData : child);
    onChange(newValue);
  }, [value, onChange]);
  
  // Get child title (from first text field or index)
  const getChildTitle = (child: any, index: number): string => {
    // Try to find a title/name/label field
    const titleField = effectiveChildSchema?.sections?.flatMap(s => s.fields)
      .find(f => ['title', 'name', 'label', 'stepTitle'].includes(f.id));
    
    if (titleField && child[titleField.id]) {
      return child[titleField.id];
    }
    
    return `Item ${index + 1}`;
  };
  
  return (
    <Container>
      {value.length === 0 ? (
        <EmptyState>
          {field.helpText || 'No items yet. Click "Add" to create your first item.'}
        </EmptyState>
      ) : (
        <ChildrenList>
          {value.map((child, index) => {
            const isExpanded = expandedChildren.has(index);
            
            return (
              <ChildItem key={index} $expanded={isExpanded}>
                <ChildHeader onClick={() => toggleExpanded(index)}>
                  <DragHandle onClick={(e) => e.stopPropagation()}>
                    <GripVertical size={16} />
                  </DragHandle>
                  
                  <ExpandIcon>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </ExpandIcon>
                  
                  <ChildTitle>
                    <ChildIndex>{index + 1}</ChildIndex>
                    {getChildTitle(child, index)}
                  </ChildTitle>
                  
                  <Actions>
                    <DeleteButton onClick={(e) => handleRemoveChild(index, e)}>
                      <Trash2 size={16} />
                    </DeleteButton>
                  </Actions>
                </ChildHeader>
                
                {isExpanded && (
                  <ChildContent>
                    {/* Render child fields inline without full DynamicConfigPanel */}
                    {effectiveChildSchema?.sections?.map(section => (
                      <div key={section.id}>
                        {section.fields.map(childField => (
                          <div key={childField.id} style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                              {childField.label}
                              {childField.required && <span style={{ color: 'rgb(var(--color-error))' }}> *</span>}
                            </label>
                            {/* Simple inline renderer for now */}
                            {childField.type === 'text' && (
                              <input
                                type="text"
                                value={child[childField.id] || ''}
                                onChange={(e) => handleUpdateChild(index, { ...child, [childField.id]: e.target.value })}
                                placeholder={
                                  typeof childField.placeholder === 'string'
                                    ? childField.placeholder
                                    : childField.placeholder?.value
                                }
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  border: '1px solid rgb(var(--color-border))',
                                  borderRadius: '6px'
                                }}
                              />
                            )}
                            {childField.type === 'textarea' && (
                              <textarea
                                value={child[childField.id] || ''}
                                onChange={(e) => handleUpdateChild(index, { ...child, [childField.id]: e.target.value })}
                                placeholder={
                                  typeof childField.placeholder === 'string'
                                    ? childField.placeholder
                                    : childField.placeholder?.value
                                }
                                rows={3}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  border: '1px solid rgb(var(--color-border))',
                                  borderRadius: '6px',
                                  resize: 'vertical'
                                }}
                              />
                            )}
                            {childField.helpText && (
                              <div style={{ fontSize: '12px', color: 'rgb(var(--color-text-tertiary))', marginTop: '4px' }}>
                                {childField.helpText}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </ChildContent>
                )}
              </ChildItem>
            );
          })}
        </ChildrenList>
      )}
      
      <AddButton onClick={handleAddChild}>
        <Plus size={16} />
        Add {field.label?.replace(/^Child\s+/i, '') || 'Item'}
      </AddButton>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Container>
  );
};
