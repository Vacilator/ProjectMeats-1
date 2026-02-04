/**
 * Form Step Node Component
 * 
 * Container for multiple form fields in a multi-step form.
 * Displays field summary and validation status.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */
import React from 'react';
import styled from 'styled-components';
import { NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'date' | 'file';
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormStepNodeData extends BaseNodeData {
  stepTitle?: string;
  fields?: FormField[];
  validationRules?: Record<string, any>;
}

// ============================================================================
// Styled Components
// ============================================================================

const FieldList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
`;

const FieldItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  font-size: 11px;
`;

const FieldIcon = styled.span`
  font-size: 14px;
`;

const FieldLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(var(--color-text-primary));
`;

const RequiredBadge = styled.span`
  color: rgb(239, 68, 68);
  font-weight: 700;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 12px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
  font-style: italic;
`;

const FieldCount = styled.div`
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  font-weight: 600;
`;

// ============================================================================
// Field Type Icons
// ============================================================================

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: '📝',
  number: '🔢',
  email: '📧',
  select: '📋',
  textarea: '📄',
  checkbox: '☑️',
  radio: '🔘',
  date: '📅',
  file: '📎',
};

// ============================================================================
// Component
// ============================================================================

export const FormStepNode: React.FC<NodeProps<FormStepNodeData>> = (props) => {
  const { data, selected, id } = props;
  const nodeType = getNodeTypeDefinition('formStep')!;
  
  const { stepTitle, fields = [] } = data;
  const fieldCount = fields.length;
  const requiredCount = fields.filter(f => f.required).length;

  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeType={nodeType}
    >
      <div>
        {stepTitle && (
          <div style={{ 
            fontWeight: 600, 
            marginBottom: 8,
            color: 'rgb(var(--color-text-primary))',
          }}>
            {stepTitle}
          </div>
        )}
        
        {fields.length === 0 ? (
          <EmptyState>
            Click to add fields
          </EmptyState>
        ) : (
          <>
            <FieldList>
              {fields.slice(0, 3).map(field => (
                <FieldItem key={field.id}>
                  <FieldIcon>
                    {FIELD_TYPE_ICONS[field.type] || '📝'}
                  </FieldIcon>
                  <FieldLabel>{field.label}</FieldLabel>
                  {field.required && <RequiredBadge>*</RequiredBadge>}
                </FieldItem>
              ))}
            </FieldList>
            
            {fields.length > 3 && (
              <FieldCount>
                +{fields.length - 3} more field{fields.length - 3 > 1 ? 's' : ''}
              </FieldCount>
            )}
            
            <FieldCount>
              {fieldCount} field{fieldCount !== 1 ? 's' : ''}
              {requiredCount > 0 && ` • ${requiredCount} required`}
            </FieldCount>
          </>
        )}
      </div>
    </BaseNode>
  );
};

export default FormStepNode;
