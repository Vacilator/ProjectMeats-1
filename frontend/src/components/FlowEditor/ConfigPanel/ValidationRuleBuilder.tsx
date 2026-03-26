/**
 * Validation Rule Builder Component
 * 
 * Reusable component for building field validation rules.
 * Used by FormFieldConfigPanel and other configuration panels.
 * 
 * Features:
 * - Multiple validation rule types (required, length, pattern, etc.)
 * - Custom error messages
 * - Add/edit/delete rules
 * - Real-time validation preview
 * 
 * Created: 2026-02-04 - Phase 5 Field/Step/Mapping Enhancements
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import {
  FormField,
  Label,
  Select,
  HelpText,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type ValidationRuleType = 
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'url'
  | 'phone'
  | 'custom';

export interface ValidationRule {
  id: string;
  type: ValidationRuleType;
  value?: any;
  errorMessage?: string;
}

interface ValidationRuleBuilderProps {
  rules: ValidationRule[];
  onChange: (rules: ValidationRule[]) => void;
  fieldType?: string;
}

// ============================================================================
// Validation Rule Definitions
// ============================================================================

const RULE_DEFINITIONS: Record<ValidationRuleType, {
  label: string;
  description: string;
  requiresValue: boolean;
  valueType?: 'number' | 'text';
  defaultValue?: any;
  placeholder?: string;
  applicableFieldTypes?: string[];
}> = {
  required: {
    label: 'Required',
    description: 'Field must have a value',
    requiresValue: false,
  },
  minLength: {
    label: 'Minimum Length',
    description: 'Minimum number of characters',
    requiresValue: true,
    valueType: 'number',
    defaultValue: 1,
    placeholder: 'e.g., 5',
    applicableFieldTypes: ['text', 'textarea', 'email', 'url', 'phone'],
  },
  maxLength: {
    label: 'Maximum Length',
    description: 'Maximum number of characters',
    requiresValue: true,
    valueType: 'number',
    defaultValue: 100,
    placeholder: 'e.g., 100',
    applicableFieldTypes: ['text', 'textarea', 'email', 'url', 'phone'],
  },
  min: {
    label: 'Minimum Value',
    description: 'Minimum numeric value',
    requiresValue: true,
    valueType: 'number',
    defaultValue: 0,
    placeholder: 'e.g., 0',
    applicableFieldTypes: ['number'],
  },
  max: {
    label: 'Maximum Value',
    description: 'Maximum numeric value',
    requiresValue: true,
    valueType: 'number',
    defaultValue: 100,
    placeholder: 'e.g., 100',
    applicableFieldTypes: ['number'],
  },
  pattern: {
    label: 'Pattern (Regex)',
    description: 'Custom regular expression pattern',
    requiresValue: true,
    valueType: 'text',
    placeholder: 'e.g., ^[A-Z]{2}\\d{4}$',
    applicableFieldTypes: ['text', 'email', 'url', 'phone'],
  },
  email: {
    label: 'Email Format',
    description: 'Must be a valid email address',
    requiresValue: false,
    applicableFieldTypes: ['text', 'email'],
  },
  url: {
    label: 'URL Format',
    description: 'Must be a valid URL',
    requiresValue: false,
    applicableFieldTypes: ['text', 'url'],
  },
  phone: {
    label: 'Phone Format',
    description: 'Must be a valid phone number',
    requiresValue: false,
    applicableFieldTypes: ['text', 'phone'],
  },
  custom: {
    label: 'Custom Validation',
    description: 'Custom validation function',
    requiresValue: true,
    valueType: 'text',
    placeholder: 'JavaScript expression',
  },
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RuleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RuleItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const RuleIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 14px;
  flex-shrink: 0;
`;

const RuleContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const RuleLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const RuleDetails = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RuleValue = styled.span`
  font-family: monospace;
  background: rgba(var(--color-primary), 0.1);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
`;

const RuleActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const IconButton = styled.button`
  padding: 6px;
  background: none;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
  
  &:hover svg {
    stroke-width: 2.5;
  }
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





const Modal = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const ModalFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;















const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  font-family: inherit;
  resize: vertical;
  transition: all 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;



const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${props => props.$variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;
    
    &:hover {
      opacity: 0.9;
    }
  ` : `
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover {
      background: rgb(var(--color-border));
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const ValidationRuleBuilder: React.FC<ValidationRuleBuilderProps> = ({
  rules,
  onChange,
  fieldType = 'text',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [formData, setFormData] = useState<Partial<ValidationRule>>({});

  // Get applicable rule types for current field type
  const applicableRuleTypes = Object.entries(RULE_DEFINITIONS).filter(([type, def]) => {
    if (!def.applicableFieldTypes) return true;
    return def.applicableFieldTypes.includes(fieldType);
  });

  const handleAddRule = () => {
    setEditingRule(null);
    setFormData({ type: 'required' as ValidationRuleType });
    setIsModalOpen(true);
  };

  const handleEditRule = (rule: ValidationRule) => {
    setEditingRule(rule);
    setFormData({ ...rule });
    setIsModalOpen(true);
  };

  const handleDeleteRule = (ruleId: string) => {
    onChange(rules.filter(r => r.id !== ruleId));
  };

  const handleSaveRule = () => {
    if (!formData.type) return;

    const ruleDefinition = RULE_DEFINITIONS[formData.type];
    
    // Validate required value
    if (ruleDefinition.requiresValue && !formData.value) {
      alert('Please provide a value for this rule');
      return;
    }

    const newRule: ValidationRule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      type: formData.type,
      value: formData.value,
      errorMessage: formData.errorMessage,
    };

    if (editingRule) {
      // Update existing rule
      onChange(rules.map(r => r.id === editingRule.id ? newRule : r));
    } else {
      // Add new rule
      onChange([...rules, newRule]);
    }

    setIsModalOpen(false);
    setFormData({});
  };

  const handleRuleTypeChange = (type: ValidationRuleType) => {
    const definition = RULE_DEFINITIONS[type];
    setFormData({
      ...formData,
      type,
      value: definition.requiresValue ? (definition.defaultValue || '') : undefined,
    });
  };

  const getRuleIcon = (type: ValidationRuleType) => {
    const icons: Record<ValidationRuleType, string> = {
      required: '✓',
      minLength: '📏',
      maxLength: '📐',
      min: '⬇️',
      max: '⬆️',
      pattern: '🔍',
      email: '📧',
      url: '🔗',
      phone: '📱',
      custom: '⚙️',
    };
    return icons[type] || '•';
  };

  const currentRuleDefinition = formData.type ? RULE_DEFINITIONS[formData.type] : null;

  return (
    <Container>
      {rules.length === 0 ? (
        <EmptyState>
          No validation rules. Click "Add Rule" to create one.
        </EmptyState>
      ) : (
        <RuleList>
          {rules.map(rule => {
            const definition = RULE_DEFINITIONS[rule.type];
            return (
              <RuleItem key={rule.id}>
                <RuleIcon>{getRuleIcon(rule.type)}</RuleIcon>
                <RuleContent>
                  <RuleLabel>{definition.label}</RuleLabel>
                  <RuleDetails>
                    {definition.requiresValue && rule.value !== undefined && (
                      <RuleValue>{rule.value}</RuleValue>
                    )}
                    {rule.errorMessage && (
                      <span>→ "{rule.errorMessage}"</span>
                    )}
                  </RuleDetails>
                </RuleContent>
                <RuleActions>
                  <IconButton onClick={() => handleEditRule(rule)} title="Edit rule">
                    <Edit2 size={16} />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteRule(rule.id)} title="Delete rule">
                    <Trash2 size={16} />
                  </IconButton>
                </RuleActions>
              </RuleItem>
            );
          })}
        </RuleList>
      )}

      <AddButton onClick={handleAddRule}>
        <Plus size={16} />
        Add Validation Rule
      </AddButton>

      <Modal $isOpen={isModalOpen} onClick={() => setIsModalOpen(false)}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              {editingRule ? 'Edit Validation Rule' : 'Add Validation Rule'}
            </ModalTitle>
          </ModalHeader>

          <ModalBody>
            <FormField>
              <Label>Rule Type</Label>
              <Select
                value={formData.type || ''}
                onChange={(e) => handleRuleTypeChange(e.target.value as ValidationRuleType)}
              >
                <option value="">Select a rule type...</option>
                {applicableRuleTypes.map(([type, def]) => (
                  <option key={type} value={type}>
                    {def.label}
                  </option>
                ))}
              </Select>
              {currentRuleDefinition && (
                <HelpText>{currentRuleDefinition.description}</HelpText>
              )}
            </FormField>

            {currentRuleDefinition?.requiresValue && (
              <FormField>
                <Label>Value</Label>
                <Input
                  type={currentRuleDefinition.valueType || 'text'}
                  value={formData.value || ''}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={currentRuleDefinition.placeholder}
                />
              </FormField>
            )}

            <FormField>
              <Label>Custom Error Message (Optional)</Label>
              <TextArea
                value={formData.errorMessage || ''}
                onChange={(e) => setFormData({ ...formData, errorMessage: e.target.value })}
                placeholder="e.g., Please enter at least 5 characters"
              />
              <HelpText>
                Leave blank to use the default error message
              </HelpText>
            </FormField>
          </ModalBody>

          <ModalFooter>
            <SecondaryButton onClick={() => setIsModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleSaveRule} disabled={!formData.type}>
              {editingRule ? 'Update Rule' : 'Add Rule'}
            </PrimaryButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default ValidationRuleBuilder;
