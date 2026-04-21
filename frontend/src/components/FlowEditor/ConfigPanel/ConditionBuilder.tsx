/**
 * Condition Builder Component
 * 
 * Reusable component for building conditional logic rules.
 * Used for conditional visibility, step transitions, and field dependencies.
 * 
 * Features:
 * - Multiple condition operators (equals, contains, greater than, etc.)
 * - AND/OR logic between multiple conditions
 * - Field reference with auto-complete
 * - Value input with type awareness
 * - Visual condition preview
 * 
 * Created: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterOrEqual'
  | 'lessOrEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty';

export type ConditionLogic = 'and' | 'or';

import {
  Select,
  Input,
  EmptyState,
  HelpText,
} from './shared/StyledComponents';

export interface ConditionRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface ConditionGroup {
  logic: ConditionLogic;
  conditions: ConditionRule[];
}

export interface ConditionBuilderProps {
  conditions: ConditionRule[];
  logic?: ConditionLogic;
  onChange: (conditions: ConditionRule[], logic: ConditionLogic) => void;
  availableFields?: Array<{ key: string; label: string; type: string }>;
  fieldPrefix?: string; // e.g., "step1." for referencing fields from other steps
}

// ============================================================================
// Operator Definitions
// ============================================================================

const OPERATOR_DEFINITIONS: Record<ConditionOperator, {
  label: string;
  symbol: string;
  description: string;
  requiresValue: boolean;
  applicableTypes?: string[];
}> = {
  equals: {
    label: 'Equals',
    symbol: '=',
    description: 'Field value equals the specified value',
    requiresValue: true,
  },
  notEquals: {
    label: 'Not Equals',
    symbol: '≠',
    description: 'Field value does not equal the specified value',
    requiresValue: true,
  },
  greaterThan: {
    label: 'Greater Than',
    symbol: '>',
    description: 'Field value is greater than the specified value',
    requiresValue: true,
    applicableTypes: ['number', 'date'],
  },
  lessThan: {
    label: 'Less Than',
    symbol: '<',
    description: 'Field value is less than the specified value',
    requiresValue: true,
    applicableTypes: ['number', 'date'],
  },
  greaterOrEqual: {
    label: 'Greater or Equal',
    symbol: '≥',
    description: 'Field value is greater than or equal to the specified value',
    requiresValue: true,
    applicableTypes: ['number', 'date'],
  },
  lessOrEqual: {
    label: 'Less or Equal',
    symbol: '≤',
    description: 'Field value is less than or equal to the specified value',
    requiresValue: true,
    applicableTypes: ['number', 'date'],
  },
  contains: {
    label: 'Contains',
    symbol: '⊃',
    description: 'Field value contains the specified text',
    requiresValue: true,
    applicableTypes: ['text', 'textarea', 'email', 'url'],
  },
  notContains: {
    label: 'Does Not Contain',
    symbol: '⊅',
    description: 'Field value does not contain the specified text',
    requiresValue: true,
    applicableTypes: ['text', 'textarea', 'email', 'url'],
  },
  startsWith: {
    label: 'Starts With',
    symbol: '^',
    description: 'Field value starts with the specified text',
    requiresValue: true,
    applicableTypes: ['text', 'textarea', 'email', 'url'],
  },
  endsWith: {
    label: 'Ends With',
    symbol: '$',
    description: 'Field value ends with the specified text',
    requiresValue: true,
    applicableTypes: ['text', 'textarea', 'email', 'url'],
  },
  isEmpty: {
    label: 'Is Empty',
    symbol: '∅',
    description: 'Field has no value',
    requiresValue: false,
  },
  isNotEmpty: {
    label: 'Is Not Empty',
    symbol: '∃',
    description: 'Field has a value',
    requiresValue: false,
  },
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LogicSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
`;

const LogicLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
`;

const LogicToggle = styled.div`
  display: inline-flex;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgb(var(--color-border));
`;

const LogicButton = styled.button<{ $active: boolean }>`
  padding: 6px 16px;
  border: none;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-background))'};
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-primary))'};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.1)'};
  }
  
  &:not(:last-child) {
    border-right: 1px solid rgb(var(--color-border));
  }
`;

const ConditionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ConditionItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  position: relative;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.05);
  }
`;

const ConditionRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
`;

const FieldGroup = styled.div`
  flex: 1;
  min-width: 0;
`;

const ConditionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
`;



const ValueInput = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const DeleteButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  flex-shrink: 0;
  
  &:hover {
    background: rgba(var(--color-error), 0.1);
    color: rgb(var(--color-error));
  }
`;

const ConditionPreview = styled.div`
  padding: 10px 12px;
  background: rgba(var(--color-primary), 0.05);
  border-left: 3px solid rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: monospace;
  color: rgb(var(--color-text-secondary));
  word-break: break-word;
`;

const LogicDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
`;

const LogicLine = styled.div`
  flex: 1;
  height: 1px;
  background: rgb(var(--color-border));
`;

const LogicBadge = styled.div<{ $logic: ConditionLogic }>`
  padding: 4px 12px;
  background: ${props => props.$logic === 'and' ? 'rgba(var(--color-info), 0.1)' : 'rgba(var(--color-warning), 0.1)'};
  color: ${props => props.$logic === 'and' ? 'rgb(var(--color-info))' : 'rgb(var(--color-warning))'};
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 2px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
`;





// ============================================================================
// Component
// ============================================================================

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  conditions,
  logic = 'and',
  onChange,
  availableFields = [],
  fieldPrefix = '',
}) => {
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);

  const handleLogicChange = (newLogic: ConditionLogic) => {
    onChange(conditions, newLogic);
  };

  const handleAddCondition = () => {
    const newCondition: ConditionRule = {
      id: `condition-${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
    };
    onChange([...conditions, newCondition], logic);
    setEditingConditionId(newCondition.id);
  };

  const handleUpdateCondition = (conditionId: string, updates: Partial<ConditionRule>) => {
    onChange(
      conditions.map(c => c.id === conditionId ? { ...c, ...updates } : c),
      logic
    );
  };

  const handleDeleteCondition = (conditionId: string) => {
    onChange(conditions.filter(c => c.id !== conditionId), logic);
  };

  const getFieldType = (fieldKey: string): string => {
    const field = availableFields.find(f => f.key === fieldKey);
    return field?.type || 'text';
  };

  const getApplicableOperators = (fieldKey: string): ConditionOperator[] => {
    const fieldType = getFieldType(fieldKey);
    return Object.entries(OPERATOR_DEFINITIONS)
      .filter(([_, def]) => !def.applicableTypes || def.applicableTypes.includes(fieldType))
      .map(([operator]) => operator as ConditionOperator);
  };

  const formatConditionPreview = (condition: ConditionRule): string => {
    if (!condition.field || !condition.operator) return 'Incomplete condition';
    
    const field = availableFields.find(f => f.key === condition.field);
    const fieldLabel = field?.label || condition.field;
    const operator = OPERATOR_DEFINITIONS[condition.operator];
    
    if (!operator.requiresValue) {
      return `${fieldLabel} ${operator.label}`;
    }
    
    return `${fieldLabel} ${operator.symbol} "${condition.value || ''}"`;
  };

  return (
    <Container>
      {conditions.length > 1 && (
        <LogicSelector>
          <LogicLabel>Match:</LogicLabel>
          <LogicToggle>
            <LogicButton
              $active={logic === 'and'}
              onClick={() => handleLogicChange('and')}
            >
              ALL (AND)
            </LogicButton>
            <LogicButton
              $active={logic === 'or'}
              onClick={() => handleLogicChange('or')}
            >
              ANY (OR)
            </LogicButton>
          </LogicToggle>
          <HelpText>
            {logic === 'and' 
              ? 'All conditions must be true' 
              : 'At least one condition must be true'}
          </HelpText>
        </LogicSelector>
      )}

      {conditions.length === 0 ? (
        <EmptyState>
          No conditions defined.<br />
          Click "Add Condition" to create your first rule.
        </EmptyState>
      ) : (
        <ConditionList>
          {conditions.map((condition, index) => {
            const operatorDef = OPERATOR_DEFINITIONS[condition.operator];
            const applicableOperators = condition.field 
              ? getApplicableOperators(condition.field)
              : Object.keys(OPERATOR_DEFINITIONS) as ConditionOperator[];

            return (
              <React.Fragment key={condition.id}>
                {index > 0 && (
                  <LogicDivider>
                    <LogicLine />
                    <LogicBadge $logic={logic}>{logic.toUpperCase()}</LogicBadge>
                    <LogicLine />
                  </LogicDivider>
                )}
                
                <ConditionItem>
                  <ConditionRow>
                    <FieldGroup>
                      <ConditionLabel>Field</ConditionLabel>
                      <Select
                        value={condition.field}
                        onChange={(e) => handleUpdateCondition(condition.id, { 
                          field: e.target.value,
                          operator: 'equals', // Reset operator when field changes
                          value: '',
                        })}
                      >
                        <option value="">Select a field...</option>
                        {availableFields.map(field => (
                          <option key={field.key} value={field.key}>
                            {fieldPrefix}{field.label}
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>

                    <FieldGroup>
                      <ConditionLabel>Operator</ConditionLabel>
                      <Select
                        value={condition.operator}
                        onChange={(e) => handleUpdateCondition(condition.id, { 
                          operator: e.target.value as ConditionOperator 
                        })}
                        disabled={!condition.field}
                      >
                        {applicableOperators.map(operator => {
                          const def = OPERATOR_DEFINITIONS[operator];
                          return (
                            <option key={operator} value={operator}>
                              {def.symbol} {def.label}
                            </option>
                          );
                        })}
                      </Select>
                    </FieldGroup>

                    {operatorDef?.requiresValue && (
                      <FieldGroup>
                        <ConditionLabel>Value</ConditionLabel>
                        <ValueInput
                          type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                          value={condition.value || ''}
                          onChange={(e) => handleUpdateCondition(condition.id, { 
                            value: e.target.value 
                          })}
                          placeholder="Enter value..."
                        />
                      </FieldGroup>
                    )}

                    <DeleteButton
                      onClick={() => handleDeleteCondition(condition.id)}
                      title="Delete condition"
                    >
                      <Trash2 size={16} />
                    </DeleteButton>
                  </ConditionRow>

                  {condition.field && (
                    <ConditionPreview>
                      {formatConditionPreview(condition)}
                    </ConditionPreview>
                  )}
                </ConditionItem>
              </React.Fragment>
            );
          })}
        </ConditionList>
      )}

      <AddButton onClick={handleAddCondition}>
        <Plus size={16} />
        Add Condition
      </AddButton>
    </Container>
  );
};

export default ConditionBuilder;
