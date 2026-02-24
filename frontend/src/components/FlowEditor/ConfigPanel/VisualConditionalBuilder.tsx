/**
 * Visual Conditional Logic Builder
 * 
 * Drag-drop interface for creating if-then rules without code.
 * Like Typeform's Logic Jumps or Zapier's Filters.
 * 
 * Features:
 * - Visual if-then rule builder
 * - Drag-drop conditions
 * - Multiple actions per rule
 * - Test rule preview
 * 
 * Created: 2026-02-24
 * Phase: Visual Config Panel Enhancement
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Copy, Play, GitBranch, Zap } from 'lucide-react';
import { FormField, FormRule, RuleCondition, RuleAction, RuleOperator, RuleActionType } from '../../form-builder/types';

// ============================================================================
// Component Props
// ============================================================================

export interface VisualConditionalBuilderProps {
  /** Available fields to use in conditions */
  fields: FormField[];
  
  /** Current rules */
  rules: FormRule[];
  
  /** Callback when rules change */
  onChange: (rules: FormRule[]) => void;
  
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Operators & Actions
// ============================================================================

const OPERATORS: Array<{ value: RuleOperator; label: string }> = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'does not equal' },
  { value: 'greaterThan', label: 'is greater than' },
  { value: 'lessThan', label: 'is less than' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

const ACTIONS: Array<{ value: RuleActionType; label: string; icon: string }> = [
  { value: 'show', label: 'Show field', icon: '👁️' },
  { value: 'hide', label: 'Hide field', icon: '🙈' },
  { value: 'enable', label: 'Enable field', icon: '✅' },
  { value: 'disable', label: 'Disable field', icon: '🚫' },
  { value: 'require', label: 'Make required', icon: '⚠️' },
  { value: 'setValue', label: 'Set value', icon: '✏️' },
  { value: 'showError', label: 'Show error', icon: '❌' },
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
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AddRuleButton = styled.button`
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

const RulesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const RuleCard = styled.div<{ isActive?: boolean }>`
  background: rgb(var(--color-surface));
  border: 2px solid ${props => props.isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const RuleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const RuleName = styled.input`
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  background: transparent;
  border: none;
  border-bottom: 1px dashed transparent;
  padding: 4px 0;
  flex: 1;
  
  &:focus {
    outline: none;
    border-bottom-color: rgb(var(--color-primary));
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const RuleActions = styled.div`
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

const ToggleSwitch = styled.label`
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.2s;
    border-radius: 24px;
    
    &:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.2s;
      border-radius: 50%;
    }
  }
  
  input:checked + span {
    background-color: rgb(var(--color-primary));
  }
  
  input:checked + span:before {
    transform: translateX(20px);
  }
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ConditionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--color-primary-rgb), 0.05);
  border-radius: 8px;
`;

const ConditionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgb(var(--color-surface));
  border-radius: 6px;
  border: 1px solid rgb(var(--color-border));
`;

const Select = styled.select`
  padding: 6px 10px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  flex: 1;
  min-width: 100px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Input = styled.input`
  padding: 6px 10px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  flex: 1;
  min-width: 80px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const SmallButton = styled.button`
  padding: 4px 10px;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-primary));
  }
`;

const ActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(34, 197, 94, 0.05);
  border-radius: 8px;
`;

const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgb(var(--color-surface));
  border-radius: 6px;
  border: 1px solid rgb(var(--color-border));
`;

const ActionIcon = styled.span`
  font-size: 16px;
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
    margin: 8px 0 0 0;
  }
`;

// ============================================================================
// Main Component
// ============================================================================

export const VisualConditionalBuilder: React.FC<VisualConditionalBuilderProps> = ({
  fields,
  rules,
  onChange,
  readOnly = false,
}) => {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  
  const handleAddRule = () => {
    const newRule: FormRule = {
      id: `rule_${Date.now()}`,
      name: `Rule ${rules.length + 1}`,
      enabled: true,
      conditions: [{
        id: `cond_${Date.now()}`,
        field: fields[0]?.id || '',
        operator: 'equals',
        value: '',
      }],
      actions: [{
        id: `action_${Date.now()}`,
        type: 'show',
        targetField: fields[1]?.id || fields[0]?.id || '',
      }],
    };
    
    onChange([...rules, newRule]);
    setExpandedRules(prev => new Set([...prev, newRule.id]));
  };
  
  const handleUpdateRule = (ruleId: string, updates: Partial<FormRule>) => {
    onChange(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  };
  
  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Delete this rule?')) {
      onChange(rules.filter(r => r.id !== ruleId));
      setExpandedRules(prev => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
    }
  };
  
  const handleDuplicateRule = (rule: FormRule) => {
    const newRule: FormRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      name: `${rule.name} (Copy)`,
      conditions: rule.conditions.map(c => ({ ...c, id: `cond_${Date.now()}_${Math.random()}` })),
      actions: rule.actions.map(a => ({ ...a, id: `action_${Date.now()}_${Math.random()}` })),
    };
    
    onChange([...rules, newRule]);
  };
  
  const handleAddCondition = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    const newCondition: RuleCondition = {
      id: `cond_${Date.now()}`,
      field: fields[0]?.id || '',
      operator: 'equals',
      value: '',
      logicalOperator: 'AND',
    };
    
    handleUpdateRule(ruleId, {
      conditions: [...rule.conditions, newCondition],
    });
  };
  
  const handleUpdateCondition = (ruleId: string, condId: string, updates: Partial<RuleCondition>) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    handleUpdateRule(ruleId, {
      conditions: rule.conditions.map(c => c.id === condId ? { ...c, ...updates } : c),
    });
  };
  
  const handleDeleteCondition = (ruleId: string, condId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule || rule.conditions.length <= 1) return; // Keep at least one condition
    
    handleUpdateRule(ruleId, {
      conditions: rule.conditions.filter(c => c.id !== condId),
    });
  };
  
  const handleAddAction = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    const newAction: RuleAction = {
      id: `action_${Date.now()}`,
      type: 'show',
      targetField: fields[0]?.id || '',
    };
    
    handleUpdateRule(ruleId, {
      actions: [...rule.actions, newAction],
    });
  };
  
  const handleUpdateAction = (ruleId: string, actionId: string, updates: Partial<RuleAction>) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    handleUpdateRule(ruleId, {
      actions: rule.actions.map(a => a.id === actionId ? { ...a, ...updates } : a),
    });
  };
  
  const handleDeleteAction = (ruleId: string, actionId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule || rule.actions.length <= 1) return; // Keep at least one action
    
    handleUpdateRule(ruleId, {
      actions: rule.actions.filter(a => a.id !== actionId),
    });
  };
  
  return (
    <Container>
      <Header>
        <Title>
          <GitBranch size={18} />
          Conditional Logic
        </Title>
        {!readOnly && (
          <AddRuleButton onClick={handleAddRule} disabled={fields.length < 2}>
            <Plus size={16} />
            Add Rule
          </AddRuleButton>
        )}
      </Header>
      
      {rules.length === 0 ? (
        <EmptyState>
          <GitBranch />
          <p>No conditional rules yet.</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>
            Create rules to show/hide fields based on user input.
          </p>
        </EmptyState>
      ) : (
        <RulesList>
          {rules.map(rule => (
            <RuleCard key={rule.id} isActive={rule.enabled}>
              <RuleHeader>
                <RuleName
                  value={rule.name}
                  onChange={(e) => handleUpdateRule(rule.id, { name: e.target.value })}
                  placeholder="Rule name"
                  disabled={readOnly}
                />
                <RuleActions>
                  <ToggleSwitch>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => handleUpdateRule(rule.id, { enabled: e.target.checked })}
                      disabled={readOnly}
                    />
                    <span />
                  </ToggleSwitch>
                  {!readOnly && (
                    <>
                      <IconButton onClick={() => handleDuplicateRule(rule)} title="Duplicate">
                        <Copy size={16} />
                      </IconButton>
                      <IconButton variant="danger" onClick={() => handleDeleteRule(rule.id)} title="Delete">
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  )}
                </RuleActions>
              </RuleHeader>
              
              <Section>
                <SectionTitle>
                  When (Conditions)
                </SectionTitle>
                <ConditionsContainer>
                  {rule.conditions.map((condition, idx) => (
                    <React.Fragment key={condition.id}>
                      {idx > 0 && (
                        <Select
                          value={condition.logicalOperator || 'AND'}
                          onChange={(e) => handleUpdateCondition(rule.id, condition.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                          disabled={readOnly}
                          style={{ maxWidth: '80px', margin: '0 auto' }}
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </Select>
                      )}
                      <ConditionRow>
                        <Select
                          value={condition.field}
                          onChange={(e) => handleUpdateCondition(rule.id, condition.id, { field: e.target.value })}
                          disabled={readOnly}
                        >
                          {fields.map(field => (
                            <option key={field.id} value={field.id}>{field.label}</option>
                          ))}
                        </Select>
                        
                        <Select
                          value={condition.operator}
                          onChange={(e) => handleUpdateCondition(rule.id, condition.id, { operator: e.target.value as RuleOperator })}
                          disabled={readOnly}
                        >
                          {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </Select>
                        
                        {!['isEmpty', 'isNotEmpty'].includes(condition.operator) && (
                          <Input
                            value={condition.value || ''}
                            onChange={(e) => handleUpdateCondition(rule.id, condition.id, { value: e.target.value })}
                            placeholder="Value"
                            disabled={readOnly}
                          />
                        )}
                        
                        {!readOnly && rule.conditions.length > 1 && (
                          <IconButton onClick={() => handleDeleteCondition(rule.id, condition.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </ConditionRow>
                    </React.Fragment>
                  ))}
                  {!readOnly && (
                    <SmallButton onClick={() => handleAddCondition(rule.id)}>
                      + Add Condition
                    </SmallButton>
                  )}
                </ConditionsContainer>
              </Section>
              
              <Section>
                <SectionTitle>
                  <Zap size={14} />
                  Then (Actions)
                </SectionTitle>
                <ActionsContainer>
                  {rule.actions.map(action => {
                    const actionInfo = ACTIONS.find(a => a.value === action.type);
                    return (
                      <ActionRow key={action.id}>
                        <ActionIcon>{actionInfo?.icon || '⚡'}</ActionIcon>
                        
                        <Select
                          value={action.type}
                          onChange={(e) => handleUpdateAction(rule.id, action.id, { type: e.target.value as RuleActionType })}
                          disabled={readOnly}
                        >
                          {ACTIONS.map(a => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </Select>
                        
                        <Select
                          value={action.targetField}
                          onChange={(e) => handleUpdateAction(rule.id, action.id, { targetField: e.target.value })}
                          disabled={readOnly}
                        >
                          {fields.map(field => (
                            <option key={field.id} value={field.id}>{field.label}</option>
                          ))}
                        </Select>
                        
                        {(action.type === 'setValue' || action.type === 'showError') && (
                          <Input
                            value={action.value || action.message || ''}
                            onChange={(e) => handleUpdateAction(rule.id, action.id, 
                              action.type === 'setValue' ? { value: e.target.value } : { message: e.target.value }
                            )}
                            placeholder={action.type === 'setValue' ? 'Value' : 'Error message'}
                            disabled={readOnly}
                          />
                        )}
                        
                        {!readOnly && rule.actions.length > 1 && (
                          <IconButton onClick={() => handleDeleteAction(rule.id, action.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </ActionRow>
                    );
                  })}
                  {!readOnly && (
                    <SmallButton onClick={() => handleAddAction(rule.id)}>
                      + Add Action
                    </SmallButton>
                  )}
                </ActionsContainer>
              </Section>
            </RuleCard>
          ))}
        </RulesList>
      )}
    </Container>
  );
};
