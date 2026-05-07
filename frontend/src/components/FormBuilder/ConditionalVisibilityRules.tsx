/**
 * ConditionalVisibilityRules Component
 * 
 * UI for configuring conditional visibility rules for form fields.
 * Allows setting conditions based on other field values to show/hide fields.
 */
import React, { useState, useCallback } from 'react';
import styled, { css, keyframes } from 'styled-components';

// ============================================================================
// TYPES
// ============================================================================

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_list'
  | 'not_in_list';

export type LogicalOperator = 'AND' | 'OR';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'radio';
  options?: { value: string; label: string }[];
}

export interface VisibilityCondition {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: string | string[] | number | boolean;
}

export interface VisibilityRule {
  id: string;
  targetFieldId: string;
  conditions: VisibilityCondition[];
  logicalOperator: LogicalOperator;
  action: 'show' | 'hide';
}

export interface ConditionalVisibilityRulesProps {
  rules: VisibilityRule[];
  availableFields: FormField[];
  targetFieldId: string;
  onChange: (rules: VisibilityRule[]) => void;
  className?: string;
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const RuleCard = styled.div`
  background: rgb(var(--color-surface, 255 255 255));
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  padding: 16px;
  animation: ${slideIn} 0.2s ease;
`;

const RuleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const RuleTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionSelect = styled.select`
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 44 62 80));
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }
`;

const RuleText = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-error));
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-error), 0.1);
  }
`;

const ConditionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ConditionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  animation: ${slideIn} 0.15s ease;
`;

const LogicalOperatorBadge = styled.div<{ $operator: LogicalOperator }>`
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  
  ${props => props.$operator === 'AND' ? css`
    background: rgba(var(--color-info), 0.1);
    color: rgb(var(--color-info));
  ` : css`
    background: rgba(var(--color-warning), 0.1);
    color: rgb(180, 140, 8);
  `}
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  font-size: 14px;
  background: rgb(var(--color-surface, 255 255 255));
  min-width: 150px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  font-size: 14px;
  min-width: 120px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const RemoveConditionButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-text-secondary, 127 140 141));
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  font-size: 16px;
  
  &:hover {
    color: rgb(var(--color-error));
  }
`;

const AddConditionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px dashed rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary, 102 126 234));
    color: rgb(var(--color-primary, 102 126 234));
    background: rgba(102, 126, 234, 0.05);
  }
`;

const LogicalToggle = styled.button<{ $isAnd: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 12px;
  
  ${props => props.$isAnd ? css`
    background: rgba(var(--color-info), 0.1);
    color: rgb(var(--color-info));
    border: 1px solid rgb(var(--color-info));
  ` : css`
    background: rgba(var(--color-warning), 0.1);
    color: rgb(var(--color-warning));
    border: 1px solid rgb(var(--color-warning));
  `}
`;

const AddRuleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: 2px dashed rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary, 102 126 234));
    color: rgb(var(--color-primary, 102 126 234));
    background: rgba(102, 126, 234, 0.05);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const EmptyIcon = styled.span`
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
  font-size: 12px;
  margin-top: 4px;
  animation: ${shake} 0.3s ease;
`;

const HelpText = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin-top: 4px;
`;

// ============================================================================
// CONSTANTS
// ============================================================================

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'is greater than',
  less_than: 'is less than',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  in_list: 'is one of',
  not_in_list: 'is not one of',
};

const OPERATORS_BY_FIELD_TYPE: Record<FormField['type'], ConditionOperator[]> = {
  text: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
  select: ['equals', 'not_equals', 'in_list', 'not_in_list', 'is_empty', 'is_not_empty'],
  multiselect: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  checkbox: ['equals'],
  date: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
  radio: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
};

const NO_VALUE_OPERATORS: ConditionOperator[] = ['is_empty', 'is_not_empty'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const getAvailableOperators = (field: FormField | undefined): ConditionOperator[] => {
  if (!field) return ['equals', 'not_equals'];
  return OPERATORS_BY_FIELD_TYPE[field.type] || ['equals', 'not_equals'];
};

const needsValueInput = (operator: ConditionOperator): boolean => {
  return !NO_VALUE_OPERATORS.includes(operator);
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ConditionalVisibilityRules: React.FC<ConditionalVisibilityRulesProps> = ({
  rules,
  availableFields,
  targetFieldId,
  onChange,
  className,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter out target field from available fields for conditions
  const conditionFields = availableFields.filter(f => f.id !== targetFieldId);

  const addRule = useCallback(() => {
    const newRule: VisibilityRule = {
      id: generateId(),
      targetFieldId,
      conditions: [],
      logicalOperator: 'AND',
      action: 'show',
    };
    onChange([...rules, newRule]);
  }, [rules, targetFieldId, onChange]);

  const removeRule = useCallback((ruleId: string) => {
    onChange(rules.filter(r => r.id !== ruleId));
  }, [rules, onChange]);

  const updateRule = useCallback((ruleId: string, updates: Partial<VisibilityRule>) => {
    onChange(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }, [rules, onChange]);

  const addCondition = useCallback((ruleId: string) => {
    const newCondition: VisibilityCondition = {
      id: generateId(),
      fieldId: conditionFields[0]?.id || '',
      operator: 'equals',
      value: '',
    };
    onChange(rules.map(r => 
      r.id === ruleId 
        ? { ...r, conditions: [...r.conditions, newCondition] }
        : r
    ));
  }, [rules, conditionFields, onChange]);

  const removeCondition = useCallback((ruleId: string, conditionId: string) => {
    onChange(rules.map(r =>
      r.id === ruleId
        ? { ...r, conditions: r.conditions.filter(c => c.id !== conditionId) }
        : r
    ));
  }, [rules, onChange]);

  const updateCondition = useCallback((
    ruleId: string, 
    conditionId: string, 
    updates: Partial<VisibilityCondition>
  ) => {
    onChange(rules.map(r =>
      r.id === ruleId
        ? {
            ...r,
            conditions: r.conditions.map(c =>
              c.id === conditionId ? { ...c, ...updates } : c
            ),
          }
        : r
    ));
    // Clear errors when user makes changes
    if (errors[conditionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[conditionId];
        return next;
      });
    }
  }, [rules, errors, onChange]);

  const toggleLogicalOperator = useCallback((ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, { 
        logicalOperator: rule.logicalOperator === 'AND' ? 'OR' : 'AND' 
      });
    }
  }, [rules, updateRule]);

  const renderConditionValue = (
    condition: VisibilityCondition, 
    field: FormField | undefined,
    ruleId: string
  ) => {
    if (!needsValueInput(condition.operator)) {
      return null;
    }

    if (field?.type === 'checkbox') {
      return (
        <Select
          value={String(condition.value)}
          onChange={(e) => updateCondition(ruleId, condition.id, { 
            value: e.target.value === 'true' 
          })}
        >
          <option value="true">Checked</option>
          <option value="false">Unchecked</option>
        </Select>
      );
    }

    if (field?.type === 'select' || field?.type === 'radio') {
      return (
        <Select
          value={String(condition.value)}
          onChange={(e) => updateCondition(ruleId, condition.id, { value: e.target.value })}
        >
          <option value="">Select value...</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      );
    }

    if (field?.type === 'number') {
      return (
        <Input
          type="number"
          value={String(condition.value)}
          onChange={(e) => updateCondition(ruleId, condition.id, { 
            value: e.target.value ? Number(e.target.value) : '' 
          })}
          placeholder="Enter number..."
        />
      );
    }

    if (field?.type === 'date') {
      return (
        <Input
          type="date"
          value={String(condition.value)}
          onChange={(e) => updateCondition(ruleId, condition.id, { value: e.target.value })}
        />
      );
    }

    // Default: text input
    return (
      <Input
        type="text"
        value={String(condition.value)}
        onChange={(e) => updateCondition(ruleId, condition.id, { value: e.target.value })}
        placeholder="Enter value..."
      />
    );
  };

  if (conditionFields.length === 0) {
    return (
      <Container className={className}>
        <EmptyState>
          <EmptyIcon>⚠️</EmptyIcon>
          No other fields available to create conditions.
          <HelpText>Add more fields to your form first.</HelpText>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container className={className}>
      {rules.length === 0 ? (
        <EmptyState>
          <EmptyIcon>👁️</EmptyIcon>
          No visibility rules configured.
          <HelpText>Add a rule to control when this field is shown.</HelpText>
        </EmptyState>
      ) : (
        rules.map((rule) => (
          <RuleCard key={rule.id}>
            <RuleHeader>
              <RuleTitle>
                <ActionSelect
                  value={rule.action}
                  onChange={(e) => updateRule(rule.id, { 
                    action: e.target.value as 'show' | 'hide' 
                  })}
                >
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </ActionSelect>
                <RuleText>this field when:</RuleText>
              </RuleTitle>
              <DeleteButton 
                onClick={() => removeRule(rule.id)}
                aria-label="Delete rule"
                title="Delete rule"
              >
                🗑️
              </DeleteButton>
            </RuleHeader>

            <ConditionsContainer>
              {rule.conditions.map((condition, index) => {
                const field = conditionFields.find(f => f.id === condition.fieldId);
                const operators = getAvailableOperators(field);
                
                return (
                  <ConditionRow key={condition.id}>
                    {index > 0 && (
                      <LogicalOperatorBadge $operator={rule.logicalOperator}>
                        {rule.logicalOperator}
                      </LogicalOperatorBadge>
                    )}
                    
                    <Select
                      value={condition.fieldId}
                      onChange={(e) => {
                        const newField = conditionFields.find(f => f.id === e.target.value);
                        const newOperators = getAvailableOperators(newField);
                        updateCondition(rule.id, condition.id, { 
                          fieldId: e.target.value,
                          operator: newOperators.includes(condition.operator) 
                            ? condition.operator 
                            : newOperators[0],
                          value: '',
                        });
                      }}
                    >
                      <option value="">Select field...</option>
                      {conditionFields.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </Select>
                    
                    <Select
                      value={condition.operator}
                      onChange={(e) => updateCondition(rule.id, condition.id, { 
                        operator: e.target.value as ConditionOperator,
                        value: NO_VALUE_OPERATORS.includes(e.target.value as ConditionOperator) 
                          ? '' 
                          : condition.value,
                      })}
                    >
                      {operators.map(op => (
                        <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                      ))}
                    </Select>
                    
                    {renderConditionValue(condition, field, rule.id)}
                    
                    <RemoveConditionButton
                      onClick={() => removeCondition(rule.id, condition.id)}
                      aria-label="Remove condition"
                      title="Remove condition"
                    >
                      ✕
                    </RemoveConditionButton>
                    
                    {errors[condition.id] && (
                      <ErrorMessage>{errors[condition.id]}</ErrorMessage>
                    )}
                  </ConditionRow>
                );
              })}
              
              <AddConditionButton onClick={() => addCondition(rule.id)}>
                + Add condition
              </AddConditionButton>
              
              {rule.conditions.length > 1 && (
                <LogicalToggle 
                  $isAnd={rule.logicalOperator === 'AND'}
                  onClick={() => toggleLogicalOperator(rule.id)}
                >
                  Match {rule.logicalOperator === 'AND' ? 'ALL' : 'ANY'} conditions
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>
                    (click to toggle)
                  </span>
                </LogicalToggle>
              )}
            </ConditionsContainer>
          </RuleCard>
        ))
      )}
      
      <AddRuleButton onClick={addRule}>
        + Add visibility rule
      </AddRuleButton>
    </Container>
  );
};

export default ConditionalVisibilityRules;
