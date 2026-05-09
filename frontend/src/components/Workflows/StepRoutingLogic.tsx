/**
 * StepRoutingLogic Component
 *
 * UI for configuring step-to-step routing logic in workflows.
 * Allows defining conditions that determine which step comes next.
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
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_list';

export type LogicalOperator = 'AND' | 'OR';

export interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  type: 'form' | 'approval' | 'notification' | 'automated' | 'conditional';
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  stepId: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
}

export interface RoutingCondition {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

export interface RoutingRule {
  id: string;
  name: string;
  sourceStepId: string;
  targetStepId: string;
  conditions: RoutingCondition[];
  logicalOperator: LogicalOperator;
  priority: number;
  isDefault: boolean;
}

export interface StepRoutingLogicProps {
  rules: RoutingRule[];
  steps: WorkflowStep[];
  fields: FormField[];
  currentStepId: string;
  onChange: (rules: RoutingRule[]) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'Equals',
  not_equals: 'Does not equal',
  contains: 'Contains',
  greater_than: 'Greater than',
  less_than: 'Less than',
  is_empty: 'Is empty',
  is_not_empty: 'Is not empty',
  in_list: 'Is one of',
};

const NO_VALUE_OPERATORS: ConditionOperator[] = ['is_empty', 'is_not_empty'];

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 17 24 39));
`;

const Description = styled.p`
  margin: 0 0 16px 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 107 114 128));
`;

const RulesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RuleCard = styled.div<{ $isDefault?: boolean; $priority: number }>`
  padding: 16px;
  background: ${props => props.$isDefault
    ? 'rgb(var(--color-success-bg, 240 253 244))'
    : 'rgb(var(--color-surface-alt, 249 250 251))'};
  border-radius: 8px;
  border: 1px solid ${props => props.$isDefault
    ? 'rgb(var(--color-success-border, 187 247 208))'
    : 'rgb(var(--color-border, 229 231 235))'};
  animation: ${fadeIn} 0.2s ease-out;
  position: relative;

  ${props => props.$isDefault && css`
    &::before {
      content: 'Default';
      position: absolute;
      top: -8px;
      right: 16px;
      padding: 2px 8px;
      background: rgb(var(--color-success, 34 197 94));
      color: rgb(var(--color-text-inverse));
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      text-transform: uppercase;
    }
  `}
`;

const RuleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const RuleNameInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 17 24 39));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary, 102 126 234), 0.1);
  }
`;

const RuleActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const IconButton = styled.button<{ $variant?: 'danger' | 'default' }>`
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: ${props => props.$variant === 'danger'
    ? 'rgb(var(--color-error, 239 68 68))'
    : 'rgb(var(--color-text-secondary, 107 114 128))'};
  transition: all 0.15s ease;

  &:hover {
    background: ${props => props.$variant === 'danger'
      ? 'rgb(var(--color-error-bg, 254 242 242))'
      : 'rgb(var(--color-surface-hover, 243 244 246))'};
  }
`;

const RoutingSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 6px;
  margin-bottom: 12px;
`;

const StepBadge = styled.div<{ $type: WorkflowStep['type'] }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;

  ${props => {
    switch (props.$type) {
      case 'form':
        return css`
          background: rgb(var(--color-info-bg, 239 246 255));
          color: rgb(var(--color-info, 59 130 246));
        `;
      case 'approval':
        return css`
          background: rgb(var(--color-warning-bg, 254 252 232));
          color: rgb(var(--color-warning, 234 179 8));
        `;
      case 'notification':
        return css`
          background: rgb(var(--color-success-bg, 240 253 244));
          color: rgb(var(--color-success, 34 197 94));
        `;
      case 'automated':
        return css`
          background: rgb(var(--color-purple-bg, 245 243 255));
          color: rgb(var(--color-purple, 139 92 246));
        `;
      case 'conditional':
        return css`
          background: rgb(var(--color-orange-bg, 255 247 237));
          color: rgb(var(--color-orange, 249 115 22));
        `;
      default:
        return css`
          background: rgb(var(--color-surface-alt, 249 250 251));
          color: rgb(var(--color-text-primary, 17 24 39));
        `;
    }
  }}
`;

const Arrow = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-text-secondary, 107 114 128));
  font-size: 18px;
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  font-size: 13px;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 17 24 39));
  cursor: pointer;
  min-width: 150px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary, 102 126 234), 0.1);
  }
`;

const ConditionsSection = styled.div`
  border-top: 1px solid rgb(var(--color-border, 229 231 235));
  padding-top: 12px;
`;

const ConditionsLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary, 107 114 128));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const ConditionRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  font-size: 13px;
  background: rgb(var(--color-surface, 255 255 255));
  color: rgb(var(--color-text-primary, 17 24 39));
  min-width: 120px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary, 102 126 234), 0.1);
  }
`;

const RemoveButton = styled.button`
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-tertiary, 156 163 175));
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;

  &:hover {
    background: rgb(var(--color-error-bg, 254 242 242));
    color: rgb(var(--color-error, 239 68 68));
  }
`;

const AddButton = styled.button`
  padding: 8px 16px;
  background: rgb(var(--color-surface, 255 255 255));
  border: 1px dashed rgb(var(--color-border, 229 231 235));
  border-radius: 6px;
  color: rgb(var(--color-text-secondary, 107 114 128));
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary, 102 126 234));
    color: rgb(var(--color-primary, 102 126 234));
    background: rgb(var(--color-primary-bg, 238 242 255));
  }
`;

const LogicalToggle = styled.button<{ $isAnd: boolean }>`
  padding: 4px 12px;
  background: ${props => props.$isAnd
    ? 'rgb(var(--color-info-bg, 239 246 255))'
    : 'rgb(var(--color-warning-bg, 254 252 232))'};
  color: ${props => props.$isAnd
    ? 'rgb(var(--color-info, 59 130 246))'
    : 'rgb(var(--color-warning, 234 179 8))'};
  border: none;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.15s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const PriorityBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgb(var(--color-surface-alt, 249 250 251));
  border-radius: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary, 107 114 128));
`;

const PriorityInput = styled.input`
  width: 40px;
  padding: 2px 4px;
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 4px;
  font-size: 12px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }
`;

const DefaultToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 107 114 128));
  cursor: pointer;

  input {
    cursor: pointer;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px;
  color: rgb(var(--color-text-secondary, 107 114 128));

  p {
    margin: 8px 0 0 0;
    font-size: 13px;
  }
`;

const FlowDiagram = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px;
  background: rgb(var(--color-surface-alt, 249 250 251));
  border-radius: 8px;
  margin-bottom: 16px;
`;

const StepChip = styled.button<{ $active: boolean }>`
  padding: 6px 12px;
  background: ${props => props.$active
    ? 'rgb(var(--color-primary, 102 126 234))'
    : 'rgb(var(--color-surface, 255 255 255))'};
  color: ${props => props.$active
    ? 'white'
    : 'rgb(var(--color-text-primary, 17 24 39))'};
  border: 1px solid ${props => props.$active
    ? 'rgb(var(--color-primary, 102 126 234))'
    : 'rgb(var(--color-border, 229 231 235))'};
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    ${props => !props.$active && css`
      border-color: rgb(var(--color-primary, 102 126 234));
      background: rgb(var(--color-primary-bg, 238 242 255));
    `}
  }
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = (): string => `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const generateConditionId = (): string => `cond-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getStepIcon = (type: WorkflowStep['type']): string => {
  switch (type) {
    case 'form': return '📝';
    case 'approval': return '✅';
    case 'notification': return '🔔';
    case 'automated': return '⚡';
    case 'conditional': return '🔀';
    default: return '📋';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const StepRoutingLogic: React.FC<StepRoutingLogicProps> = ({
  rules,
  steps,
  fields,
  currentStepId,
  onChange,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string>(currentStepId);

  const currentStep = steps.find(s => s.id === selectedStepId);
  const availableTargetSteps = steps.filter(s => s.id !== selectedStepId);
  const availableFields = fields.filter(f => {
    // Include fields from current step and all previous steps
    const currentOrder = currentStep?.order ?? 0;
    const fieldStep = steps.find(s => s.id === f.stepId);
    return fieldStep && fieldStep.order <= currentOrder;
  });

  const stepRules = rules
    .filter(r => r.sourceStepId === selectedStepId)
    .sort((a, b) => a.priority - b.priority);

  const addRule = useCallback(() => {
    const defaultTarget = availableTargetSteps[0];
    if (!defaultTarget) return;

    const newRule: RoutingRule = {
      id: generateId(),
      name: `Route to ${defaultTarget.name}`,
      sourceStepId: selectedStepId,
      targetStepId: defaultTarget.id,
      conditions: [],
      logicalOperator: 'AND',
      priority: stepRules.length + 1,
      isDefault: stepRules.length === 0,
    };

    onChange([...rules, newRule]);
  }, [rules, selectedStepId, availableTargetSteps, stepRules.length, onChange]);

  const updateRule = useCallback((ruleId: string, updates: Partial<RoutingRule>) => {
    onChange(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }, [rules, onChange]);

  const removeRule = useCallback((ruleId: string) => {
    const updatedRules = rules.filter(r => r.id !== ruleId);
    // If we removed the default rule, make the first one default
    if (updatedRules.length > 0 && !updatedRules.some(r => r.isDefault && r.sourceStepId === selectedStepId)) {
      const firstStepRule = updatedRules.find(r => r.sourceStepId === selectedStepId);
      if (firstStepRule) {
        firstStepRule.isDefault = true;
      }
    }
    onChange(updatedRules);
  }, [rules, selectedStepId, onChange]);

  const setDefaultRule = useCallback((ruleId: string) => {
    onChange(rules.map(r => ({
      ...r,
      isDefault: r.sourceStepId === selectedStepId ? r.id === ruleId : r.isDefault,
    })));
  }, [rules, selectedStepId, onChange]);

  const addCondition = useCallback((ruleId: string) => {
    const field = availableFields[0];
    if (!field) return;

    const newCondition: RoutingCondition = {
      id: generateConditionId(),
      fieldId: field.id,
      operator: 'equals',
      value: '',
    };

    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, { conditions: [...rule.conditions, newCondition] });
    }
  }, [rules, availableFields, updateRule]);

  const updateCondition = useCallback((
    ruleId: string,
    conditionId: string,
    updates: Partial<RoutingCondition>
  ) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, {
        conditions: rule.conditions.map(c =>
          c.id === conditionId ? { ...c, ...updates } : c
        ),
      });
    }
  }, [rules, updateRule]);

  const removeCondition = useCallback((ruleId: string, conditionId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, {
        conditions: rule.conditions.filter(c => c.id !== conditionId),
      });
    }
  }, [rules, updateRule]);

  const toggleLogicalOperator = useCallback((ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, {
        logicalOperator: rule.logicalOperator === 'AND' ? 'OR' : 'AND',
      });
    }
  }, [rules, updateRule]);

  return (
    <Container>
      <Header>
        <div>
          <Title>Step Routing Logic</Title>
          <Description>
            Define conditions that determine which step comes next after the selected step.
          </Description>
        </div>
      </Header>

      <FlowDiagram>
        {steps.map(step => (
          <StepChip
            key={step.id}
            $active={step.id === selectedStepId}
            onClick={() => setSelectedStepId(step.id)}
          >
            {getStepIcon(step.type)} {step.name}
          </StepChip>
        ))}
      </FlowDiagram>

      {currentStep && (
        <>
          <Description>
            Configure routing rules for <strong>{currentStep.name}</strong>.
            Rules are evaluated in priority order; the first matching rule determines the next step.
          </Description>

          <RulesContainer>
            {stepRules.length === 0 ? (
              <EmptyState>
                <span style={{ fontSize: 32 }}>🔀</span>
                <p>No routing rules configured for this step.</p>
                <p>Add a rule to define conditional step transitions.</p>
              </EmptyState>
            ) : (
              stepRules.map(rule => {
                const targetStep = steps.find(s => s.id === rule.targetStepId);

                return (
                  <RuleCard key={rule.id} $isDefault={rule.isDefault} $priority={rule.priority}>
                    <RuleHeader>
                      <RuleNameInput
                        value={rule.name}
                        onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                        placeholder="Rule name..."
                      />
                      <RuleActions>
                        <PriorityBadge>
                          Priority:
                          <PriorityInput
                            type="number"
                            min={1}
                            value={rule.priority}
                            onChange={(e) => updateRule(rule.id, { priority: parseInt(e.target.value) || 1 })}
                          />
                        </PriorityBadge>
                        <DefaultToggle>
                          <input
                            type="checkbox"
                            checked={rule.isDefault}
                            onChange={() => setDefaultRule(rule.id)}
                          />
                          Default
                        </DefaultToggle>
                        <IconButton
                          $variant="danger"
                          onClick={() => removeRule(rule.id)}
                          aria-label="Delete rule"
                          title="Delete rule"
                        >
                          🗑️
                        </IconButton>
                      </RuleActions>
                    </RuleHeader>

                    <RoutingSection>
                      <StepBadge $type={currentStep.type}>
                        {getStepIcon(currentStep.type)} {currentStep.name}
                      </StepBadge>
                      <Arrow>→</Arrow>
                      <Select
                        value={rule.targetStepId}
                        onChange={(e) => updateRule(rule.id, { targetStepId: e.target.value })}
                      >
                        {availableTargetSteps.map(step => (
                          <option key={step.id} value={step.id}>
                            {getStepIcon(step.type)} {step.name}
                          </option>
                        ))}
                      </Select>
                      {targetStep && (
                        <StepBadge $type={targetStep.type}>
                          {getStepIcon(targetStep.type)} {targetStep.name}
                        </StepBadge>
                      )}
                    </RoutingSection>

                    <ConditionsSection>
                      <ConditionsLabel>
                        When{' '}
                        {rule.conditions.length > 1 && (
                          <LogicalToggle
                            $isAnd={rule.logicalOperator === 'AND'}
                            onClick={() => toggleLogicalOperator(rule.id)}
                          >
                            {rule.logicalOperator}
                          </LogicalToggle>
                        )}
                        {rule.conditions.length === 0 && '(always)'}
                      </ConditionsLabel>

                      {rule.conditions.map(condition => {
                        const field = availableFields.find(f => f.id === condition.fieldId);

                        return (
                          <ConditionRow key={condition.id}>
                            <Select
                              value={condition.fieldId}
                              onChange={(e) => updateCondition(rule.id, condition.id, {
                                fieldId: e.target.value
                              })}
                            >
                              {availableFields.map(f => (
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
                              {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                                <option key={op} value={op}>{label}</option>
                              ))}
                            </Select>

                            {!NO_VALUE_OPERATORS.includes(condition.operator) && (
                              <Input
                                type={field?.type === 'number' ? 'number' : 'text'}
                                value={String(condition.value)}
                                onChange={(e) => updateCondition(rule.id, condition.id, {
                                  value: field?.type === 'number'
                                    ? parseFloat(e.target.value) || 0
                                    : e.target.value,
                                })}
                                placeholder="Value..."
                              />
                            )}

                            <RemoveButton
                              onClick={() => removeCondition(rule.id, condition.id)}
                              aria-label="Remove condition"
                            >
                              ✕
                            </RemoveButton>
                          </ConditionRow>
                        );
                      })}

                      {availableFields.length > 0 && (
                        <AddButton onClick={() => addCondition(rule.id)}>
                          + Add condition
                        </AddButton>
                      )}
                    </ConditionsSection>
                  </RuleCard>
                );
              })
            )}
          </RulesContainer>

          {availableTargetSteps.length > 0 && (
            <AddButton onClick={addRule}>
              + Add routing rule
            </AddButton>
          )}

          {availableTargetSteps.length === 0 && stepRules.length === 0 && (
            <EmptyState>
              <span style={{ fontSize: 32 }}>⚠️</span>
              <p>This is the last step in the workflow.</p>
              <p>No routing rules can be configured.</p>
            </EmptyState>
          )}
        </>
      )}
    </Container>
  );
};

export default StepRoutingLogic;
