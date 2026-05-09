/**
 * Rule Builder Modal
 *
 * Modal for creating conditional rules with when/then logic.
 * Supports multiple conditions (AND/OR) and actions.
 *
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { showAlert } from '@/utils/uiDialogs';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { FormRule, RuleCondition, RuleAction, RuleOperator, RuleActionType } from './types';
import { useFormBuilderStore } from './store';

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 90vw;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const ConditionRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1.5fr 2fr auto;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const IconButton = styled.button`
  padding: 8px;
  background: transparent;
  border: none;
  color: rgb(var(--color-error));
  cursor: pointer;
  border-radius: 6px;
  display: flex;

  &:hover {
    background: rgba(var(--color-error), 0.1);
  }
`;

const AddButton = styled.button`
  padding: 8px 12px;
  background: transparent;
  border: 1px dashed rgb(var(--color-border));
  color: rgb(var(--color-primary));
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
  }
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' }>`
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;

  ${props => props.variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: rgb(var(--color-text-inverse));
  ` : `
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  `}
`;

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'isEmpty', label: 'Is Empty' }
];

const ACTION_TYPES: { value: RuleActionType; label: string }[] = [
  { value: 'show', label: 'Show Field' },
  { value: 'hide', label: 'Hide Field' },
  { value: 'require', label: 'Make Required' },
  { value: 'setValue', label: 'Set Value' }
];

const generateId = () => `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const RuleBuilderModal: React.FC = () => {
  const { isRuleModalOpen, activeStepId, editingRule, closeRuleModal, saveRule } = useFormBuilderStore();

  const [ruleData, setRuleData] = useState<FormRule>({
    id: generateId(),
    name: '',
    enabled: true,
    conditions: [],
    actions: []
  });

  useEffect(() => {
    if (editingRule) {
      setRuleData(editingRule);
    } else {
      setRuleData({
        id: generateId(),
        name: '',
        enabled: true,
        conditions: [],
        actions: []
      });
    }
  }, [editingRule, isRuleModalOpen]);

  const addCondition = () => {
    setRuleData(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        id: generateId(),
        field: '',
        operator: 'equals',
        value: ''
      }]
    }));
  };

  const removeCondition = (id: string) => {
    setRuleData(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id)
    }));
  };

  const addAction = () => {
    setRuleData(prev => ({
      ...prev,
      actions: [...prev.actions, {
        id: generateId(),
        type: 'show',
        targetField: ''
      }]
    }));
  };

  const removeAction = (id: string) => {
    setRuleData(prev => ({
      ...prev,
      actions: prev.actions.filter(a => a.id !== id)
    }));
  };

  const handleSave = () => {
    if (!activeStepId || !ruleData.name.trim()) {
      showAlert({ type: 'warning', title: 'Validation', content: 'Rule name is required' });
      return;
    }
    saveRule(activeStepId, ruleData);
  };

  return (
    <Overlay isOpen={isRuleModalOpen} onClick={closeRuleModal}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{editingRule ? 'Edit Rule' : 'Add Rule'}</Title>
          <IconButton onClick={closeRuleModal}>
            <X size={20} />
          </IconButton>
        </Header>

        <Content>
          <Section>
            <Input
              type="text"
              placeholder="Rule name..."
              value={ruleData.name}
              onChange={(e) => setRuleData(prev => ({ ...prev, name: e.target.value }))}
            />
          </Section>

          <Section>
            <SectionTitle>When (Conditions)</SectionTitle>
            {ruleData.conditions.map(condition => (
              <ConditionRow key={condition.id}>
                <Input placeholder="Field name" value={condition.field} onChange={(e) => {
                  setRuleData(prev => ({
                    ...prev,
                    conditions: prev.conditions.map(c =>
                      c.id === condition.id ? { ...c, field: e.target.value } : c
                    )
                  }));
                }} />
                <Select value={condition.operator} onChange={(e) => {
                  setRuleData(prev => ({
                    ...prev,
                    conditions: prev.conditions.map(c =>
                      c.id === condition.id ? { ...c, operator: e.target.value as RuleOperator } : c
                    )
                  }));
                }}>
                  {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </Select>
                <Input placeholder="Value" value={condition.value || ''} onChange={(e) => {
                  setRuleData(prev => ({
                    ...prev,
                    conditions: prev.conditions.map(c =>
                      c.id === condition.id ? { ...c, value: e.target.value } : c
                    )
                  }));
                }} />
                <IconButton onClick={() => removeCondition(condition.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </ConditionRow>
            ))}
            <AddButton onClick={addCondition}>
              <Plus size={14} />
              Add Condition
            </AddButton>
          </Section>

          <Section>
            <SectionTitle>Then (Actions)</SectionTitle>
            {ruleData.actions.map(action => (
              <ConditionRow key={action.id}>
                <Select value={action.type} onChange={(e) => {
                  setRuleData(prev => ({
                    ...prev,
                    actions: prev.actions.map(a =>
                      a.id === action.id ? { ...a, type: e.target.value as RuleActionType } : a
                    )
                  }));
                }}>
                  {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
                <Input placeholder="Target field" value={action.targetField} onChange={(e) => {
                  setRuleData(prev => ({
                    ...prev,
                    actions: prev.actions.map(a =>
                      a.id === action.id ? { ...a, targetField: e.target.value } : a
                    )
                  }));
                }} />
                <div />
                <IconButton onClick={() => removeAction(action.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </ConditionRow>
            ))}
            <AddButton onClick={addAction}>
              <Plus size={14} />
              Add Action
            </AddButton>
          </Section>
        </Content>

        <Footer>
          <Button onClick={closeRuleModal}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            <Save size={16} />
            Save Rule
          </Button>
        </Footer>
      </Modal>
    </Overlay>
  );
};
