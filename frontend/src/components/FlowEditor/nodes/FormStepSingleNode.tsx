/**
 * Form Step Single Node Component (formerly Form Step Node)
 * 
 * Container for multiple form fields in a multi-step form.
 * Displays field summary and validation status.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 * Renamed: 2026-02-14 - Phase 2: FormStep → FormStepSingle
 */
import React from 'react';
import styled from 'styled-components';
import type { Node, NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces (Updated for Phase 5)
// ============================================================================

export type FormFieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'file';

export interface ValidationRule {
  id: string;
  type: string;
  value?: any;
  errorMessage?: string;
}

export interface ConditionRule {
  id: string;
  field: string;
  operator: string;
  value?: any;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: any;
  helpText?: string;
  validationRules: ValidationRule[];
  visibility?: {
    mode: 'always' | 'conditional';
    conditions?: ConditionRule[];
    logic?: 'and' | 'or';
  };
  options?: {
    source: 'manual' | 'tenant-list' | 'entity';
    manualOptions?: string[];
    tenantListId?: string;
    entityType?: string;
    entityField?: string;
  };
  dependencies?: Array<{
    field: string;
    action: 'enable' | 'disable' | 'show' | 'hide';
    condition: ConditionRule;
  }>;
}

export interface FieldMapping {
  id: string;
  formFieldId: string;
  entityField: string;
  transformation: {
    type: 'direct' | 'lookup' | 'format' | 'calculated';
    format?: string;
    formula?: string;
    lookupEntity?: string;
  };
  autoPopulate?: {
    sourceStep: string;
    sourceField: string;
    mode: 'copy' | 'lookup';
  };
}

export interface FormStepNodeData extends BaseNodeData {
  stepTitle?: string;
  stepDescription?: string;
  fields?: FormField[];
  visibility?: {
    mode: 'always' | 'conditional';
    conditions?: ConditionRule[];
    logic?: 'and' | 'or';
  };
  navigation?: {
    allowBack: boolean;
    allowSkip: boolean;
    autoAdvance: boolean;
    backLabel?: string;
    nextLabel?: string;
    skipLabel?: string;
  };
  validation?: {
    mode: 'all' | 'minimum';
    minimumRequired?: number;
    customMessage?: string;
  };
  fieldMappings?: FieldMapping[];
  targetEntity?: string;
  validationRules?: Record<string, any>; // Legacy - kept for backward compatibility
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
  color: rgb(var(--color-error));
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
// Field Type Icons (Updated for Phase 5)
// ============================================================================

const FIELD_TYPE_ICONS: Record<FormFieldType, string> = {
  text: '📝',
  number: '🔢',
  email: '📧',
  select: '📋',
  textarea: '📄',
  checkbox: '☑️',
  radio: '🔘',
  date: '📅',
  file: '📎',
  phone: '📱',
  url: '🔗',
  datetime: '🕐',
  'multi-select': '✅',
};

// ============================================================================
// Component
// ============================================================================

export const FormStepSingleNode = React.memo<NodeProps<Node<FormStepNodeData>>>((props) => {
  const { data, selected, id } = props;
  const nodeTypeDef = getNodeTypeDefinition('formStepSingle');
  
  // Safety check: provide fallback if nodeType is undefined
  // Note: This fallback matches the registry definition (Form (Legacy))
  const nodeType = nodeTypeDef || {
    id: 'formStepSingle',
    name: 'Form (Legacy)',  // Phase E Fix: Updated from 'Form Step Single'
    category: 'form' as const,
    color: 'rgb(var(--color-primary))',  // Match registry color
    icon: '📋',  // Match registry icon
    description: 'Collect information from a user via a form step',
    maxInputs: 1,
    maxOutputs: 1,
  };
  
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
});

export default FormStepSingleNode;
