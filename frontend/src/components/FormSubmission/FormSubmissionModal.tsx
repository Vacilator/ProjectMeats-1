/**
 * FormSubmissionModal - Premium Form UX
 * 
 * Mirrors the admin backend Form Preview Modal with:
 * - Clickable step progress indicator
 * - Entity type badges
 * - Field type icons and badges
 * - Proper field rendering by type (checkbox, textarea, select, multiselect)
 * - Auto-populate and conditional indicators
 * - Professional styling with proper input elements
 * - Auto-save with visual feedback
 * - Searchable multi-select
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { css } from 'styled-components';
import { 
  FormSubmission,
  formSubmissionService,
  entityOptionsService,
} from '../../services/quickActionsService';
import { notify } from '../../utils/notify';
import { validateField, mergeValidationRules, ValidationRule } from '../../utils/formValidation';
import { Icon } from '../ui';
import QuickCreateModal from './QuickCreateModal';

// ============== Types ==============
interface FormSubmissionModalProps {
  submission: FormSubmission;
  isOpen: boolean;
  onClose: () => void;
  onSubmissionUpdate?: (submission: FormSubmission) => void;
}

interface StepData {
  id: string;
  name: string;
  order: number;
  entity_type: string;
  fields: FieldData[];
}

interface FieldData {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help_text?: string;
  options?: string[] | { value: string; label: string }[];
  related_entity_type?: string;
  max_length?: number;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  choices?: { value: string; label: string }[];
  validation_rules?: Record<string, any>;
  auto_populate?: {
    source_step_id?: string;
    source_field?: string;
    mode?: 'copy' | 'lookup';
  };
  config?: {
    custom_label?: string;
    custom_help_text?: string;
    is_required?: boolean;
    auto_populate?: { source_step?: string };  // Deprecated - use top-level auto_populate
  };
}

interface RuleData {
  id: string;
  step_id?: string;
  conditions: { field: string; operator: string; value: any }[];
  condition_logic: 'and' | 'or';
  actions: { action: string; params: any }[];
  is_active: boolean;
  affected_fields?: string[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ============== Styled Components ==============
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
  backdrop-filter: blur(2px);
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalSlideIn 0.2s ease-out;
  
  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const ModalHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const FormIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
`;

const HeaderTitle = styled.div`
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #111827;
  }
  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #6b7280;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  font-size: 20px;
  transition: all 0.15s;
  
  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
`;

// Step Progress Indicator
const ProgressContainer = styled.div`
  padding: 16px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ProgressStep = styled.div<{ $active: boolean; $completed: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.$active ? '#3b82f6' : p.$completed ? '#dcfce7' : 'white'};
  border: 2px solid ${p => p.$active ? '#3b82f6' : p.$completed ? '#22c55e' : '#e5e7eb'};
  
  &:hover {
    border-color: ${p => p.$active ? '#3b82f6' : '#3b82f6'};
    transform: translateY(-1px);
  }
`;

const ProgressNumber = styled.span<{ $active: boolean; $completed: boolean }>`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  background: ${p => p.$active ? 'rgba(255,255,255,0.2)' : p.$completed ? '#22c55e' : '#f3f4f6'};
  color: ${p => p.$active ? 'white' : p.$completed ? 'white' : '#6b7280'};
`;

const ProgressLabel = styled.span<{ $active: boolean; $completed: boolean }>`
  font-size: 14px;
  font-weight: 500;
  color: ${p => p.$active ? 'white' : p.$completed ? '#166534' : '#374151'};
`;

// Step Content Area
const StepContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f3f4f6;
  
  h4 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 10px;
  }
`;

const EntityBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4338ca;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  text-transform: capitalize;
`;

// Field Container
const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FieldWrapper = styled.div<{ $fullWidth?: boolean }>`
  grid-column: ${p => p.$fullWidth ? '1 / -1' : 'span 1'};
`;

const FieldCard = styled.div`
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  
  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  
  &:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`;

const FieldIcon = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #e0e7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`;

const FieldLabel = styled.label`
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const RequiredStar = styled.span`
  color: #ef4444;
  font-weight: 700;
`;

const FieldTypeBadge = styled.span`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 3px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
`;

const SaveIndicator = styled.span<{ $status: SaveStatus }>`
  font-size: 11px;
  font-weight: 500;
  color: ${p => p.$status === 'saving' ? '#3b82f6' : p.$status === 'saved' ? '#22c55e' : p.$status === 'error' ? '#ef4444' : 'transparent'};
  display: flex;
  align-items: center;
  gap: 4px;
`;

// Field Inputs
const inputStyles = css<{ $hasError?: boolean }>`
  width: 100%;
  padding: 10px 14px;
  border: 1px solid ${p => p.$hasError ? '#ef4444' : '#d1d5db'};
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  background: ${p => p.$hasError ? '#fef2f2' : 'white'};
  transition: all 0.15s;
  
  &:hover {
    border-color: ${p => p.$hasError ? '#dc2626' : '#9ca3af'};
  }
  
  &:focus {
    outline: none;
    border-color: ${p => p.$hasError ? '#dc2626' : '#3b82f6'};
    box-shadow: 0 0 0 3px ${p => p.$hasError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
  }
  
  &::placeholder {
    color: #9ca3af;
  }
  
  &:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }
`;

const TextInput = styled.input<{ $hasError?: boolean }>`
  ${inputStyles}
  min-height: 44px;
`;

const TextArea = styled.textarea<{ $hasError?: boolean }>`
  ${inputStyles}
  min-height: 100px;
  resize: vertical;
`;

const SelectInput = styled.select<{ $hasError?: boolean }>`
  ${inputStyles}
  min-height: 44px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
`;

// Container for select + "Add new" button
const SelectWithAddContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
`;

const SelectWrapper = styled.div`
  flex: 1;
  min-width: 0;
`;

const QuickAddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  min-width: 44px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  
  &:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 500px) {
    padding: 0 8px;
    font-size: 0;
    
    &::before {
      content: '+';
      font-size: 18px;
    }
  }
`;

const CheckboxWrapper = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    border-color: #3b82f6;
    background: #f8fafc;
  }
  
  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    accent-color: #3b82f6;
  }
  
  span {
    font-size: 14px;
    color: #374151;
  }
`;

// Multi-select with search
const MultiSelectContainer = styled.div`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  overflow: hidden;
`;

const MultiSelectSearch = styled.input`
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
  
  &:focus {
    outline: none;
    background: #f8fafc;
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const MultiSelectOptions = styled.div`
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
`;

const MultiSelectOption = styled.label<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$selected ? '#eff6ff' : 'transparent'};
  
  &:hover {
    background: ${p => p.$selected ? '#dbeafe' : '#f3f4f6'};
  }
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    accent-color: #3b82f6;
  }
  
  span {
    font-size: 14px;
    color: #374151;
  }
`;

const SelectedCount = styled.div`
  padding: 8px 14px;
  background: #f3f4f6;
  font-size: 12px;
  color: #6b7280;
  border-top: 1px solid #e5e7eb;
`;

// Field Indicators
const FieldIndicators = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
`;

const Indicator = styled.span<{ $type: 'auto' | 'conditional' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 12px;
  background: ${p => p.$type === 'auto' ? '#fef3c7' : '#f3e8ff'};
  color: ${p => p.$type === 'auto' ? '#92400e' : '#7c3aed'};
`;

// Error display
const FieldError = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const HelpText = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b7280;
`;

// Currency Input
const CurrencyInputWrapper = styled.div`
  position: relative;
  
  span {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    font-weight: 500;
  }
  
  input {
    padding-left: 30px;
  }
`;

// Navigation
const NavigationContainer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StepIndicator = styled.span`
  font-size: 13px;
  color: #6b7280;
  padding: 6px 14px;
  background: #e5e7eb;
  border-radius: 20px;
`;

const AutoSaveStatus = styled.span`
  font-size: 12px;
  color: #22c55e;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const NavRight = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'success' }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
  
  ${p => p.$variant === 'primary' && `
    background: #3b82f6;
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background: #2563eb;
    }
  `}
  
  ${p => p.$variant === 'success' && `
    background: #22c55e;
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background: #16a34a;
    }
  `}
  
  ${p => (!p.$variant || p.$variant === 'secondary') && `
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    
    &:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #9ca3af;
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Empty State
const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  
  .icon {
    font-size: 64px;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 8px;
  }
  
  p {
    color: #6b7280;
    font-size: 14px;
  }
`;

// Exit Confirmation Modal
const ConfirmOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
`;

const ConfirmDialog = styled.div`
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  
  h3 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
  }
  
  p {
    margin: 0 0 24px;
    color: #6b7280;
    font-size: 14px;
    line-height: 1.5;
  }
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

// ============== Helper Functions ==============

const getFieldTypeIcon = (type: string): string => {
  switch (type) {
    case 'text':
    case 'string': return '📝';
    case 'textarea': return '📄';
    case 'email': return '📧';
    case 'phone': return '📞';
    case 'url': return '🔗';
    case 'number':
    case 'integer':
    case 'decimal':
    case 'float': return '🔢';
    case 'currency': return '💰';
    case 'date': return '📅';
    case 'datetime': return '⏰';
    case 'time': return '🕐';
    case 'checkbox':
    case 'boolean': return '☑️';
    case 'select':
    case 'lookup':
    case 'foreignkey':
    case 'dropdown': return '📋';
    case 'multiselect': return '📑';
    case 'file':
    case 'image': return '📎';
    case 'json': return '{ }';
    default: return '📝';
  }
};

const isFullWidthField = (field: FieldData): boolean => {
  if (field.type === 'textarea' || field.type === 'json') return true;
  if (field.type === 'multiselect') return true;
  if (field.max_length && field.max_length > 100) return true;
  return false;
};

// ============== Main Component ==============

const FormSubmissionModal: React.FC<FormSubmissionModalProps> = ({
  submission,
  isOpen,
  onClose,
  onSubmissionUpdate,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entityOptions, setEntityOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [multiSelectSearch, setMultiSelectSearch] = useState<Record<string, string>>({});
  const [quickCreateField, setQuickCreateField] = useState<{
    stepId: string;
    fieldKey: string;
    entityType: string;
  } | null>(null);
  
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const hasUnsavedChanges = useRef(false);

  // Parse steps from submission
  const steps: StepData[] = useMemo(() => {
    if (!submission?.form_snapshot?.steps) return [];
    return submission.form_snapshot.steps
      .sort((a: any, b: any) => a.order - b.order)
      .map((step: any) => ({
        id: step.id,
        name: step.name,
        order: step.order,
        entity_type: step.entity_type,
        fields: (step.fields || []).map((f: any) => ({
          key: f.key,
          label: f.config?.custom_label || f.label || f.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          type: f.type || 'text',
          required: f.required || f.config?.is_required || false,
          placeholder: f.placeholder || f.config?.custom_help_text,
          help_text: f.help_text || f.config?.custom_help_text,
          options: f.options || f.choices,
          related_entity_type: f.related_entity_type,
          max_length: f.max_length,
          min: f.min,
          max: f.max,
          step: f.step,
          rows: f.rows,
          choices: f.choices,
          validation_rules: f.validation_rules,
          config: f.config,
        })),
      }));
  }, [submission?.form_snapshot]);

  // Parse rules
  const rules: RuleData[] = useMemo(() => {
    if (!submission?.form_snapshot?.rules) return [];
    return submission.form_snapshot.rules.filter((r: any) => r.is_active !== false);
  }, [submission?.form_snapshot]);

  const currentStep = steps[currentStepIndex];

  // Initialize form data
  useEffect(() => {
    if (submission?.data) {
      setFormData(submission.data);
    }
  }, [submission?.data]);

  // Load entity options
  useEffect(() => {
    const loadOptions = async () => {
      const types = new Set<string>();
      steps.forEach(s => s.fields.forEach(f => {
        if (f.related_entity_type) types.add(f.related_entity_type);
      }));
      for (const type of types) {
        if (!entityOptions[type]) {
          try {
            const res = await entityOptionsService.getOptions(type);
            setEntityOptions(prev => ({ ...prev, [type]: res.options || [] }));
          } catch (e) { 
            console.error('Failed to load options for', type, e); 
          }
        }
      }
    };
    if (steps.length > 0) loadOptions();
  }, [steps]);

  // Evaluate conditional rules
  useEffect(() => {
    if (rules.length === 0) return;
    
    const newHiddenFields = new Set<string>();
    
    for (const rule of rules) {
      const conditionsMet = evaluateConditions(rule.conditions, rule.condition_logic, formData);
      
      if (conditionsMet) {
        for (const action of rule.actions) {
          if (action.action === 'hide_fields' && action.params?.fields) {
            action.params.fields.forEach((f: string) => newHiddenFields.add(f));
          }
        }
      }
    }
    
    setHiddenFields(newHiddenFields);
  }, [rules, formData]);

  // Evaluate conditions
  const evaluateConditions = (
    conditions: { field: string; operator: string; value: any }[],
    logic: 'and' | 'or',
    data: Record<string, Record<string, any>>
  ): boolean => {
    if (!conditions || conditions.length === 0) return false;
    
    const results = conditions.map(cond => {
      const [stepKey, fieldKey] = cond.field.includes('.') 
        ? cond.field.split('.') 
        : [Object.keys(data)[0] || '', cond.field];
      const fieldValue = data[stepKey]?.[fieldKey];
      
      switch (cond.operator) {
        case 'eq': return fieldValue === cond.value;
        case 'neq': return fieldValue !== cond.value;
        case 'gt': return Number(fieldValue) > Number(cond.value);
        case 'lt': return Number(fieldValue) < Number(cond.value);
        case 'gte': return Number(fieldValue) >= Number(cond.value);
        case 'lte': return Number(fieldValue) <= Number(cond.value);
        case 'contains': return String(fieldValue || '').includes(String(cond.value));
        case 'not_contains': return !String(fieldValue || '').includes(String(cond.value));
        case 'is_empty': return !fieldValue || fieldValue === '';
        case 'is_not_empty': return !!fieldValue && fieldValue !== '';
        default: return false;
      }
    });
    
    return logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  };

  // Check if field has rules affecting it
  const getFieldHasRules = (stepId: string, fieldKey: string): boolean => {
    return rules.some(rule => 
      rule.step_id === stepId || 
      rule.affected_fields?.includes(fieldKey) ||
      rule.actions.some(a => a.params?.fields?.includes(fieldKey))
    );
  };

  // Auto-save field value
  const autoSaveField = useCallback(async (stepId: string, fieldKey: string, value: any) => {
    const saveKey = `${stepId}-${fieldKey}`;
    
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    setSaveStatus(prev => ({ ...prev, [saveKey]: 'saving' }));
    
    try {
      await formSubmissionService.autoSave(submission.id, stepId, fieldKey, value);
      setSaveStatus(prev => ({ ...prev, [saveKey]: 'saved' }));
      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [saveKey]: 'idle' }));
      }, 2000);
    } catch (err: any) {
      if (err?.message !== 'canceled') {
        setSaveStatus(prev => ({ ...prev, [saveKey]: 'error' }));
        console.error('Auto-save failed:', err);
      }
    }
  }, [submission.id]);

  // Handle field change
  const handleChange = useCallback((stepId: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: { ...(prev[stepId] || {}), [key]: value },
    }));
    
    hasUnsavedChanges.current = true;
    
    const saveKey = `${stepId}-${key}`;
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    saveTimeoutRef.current[saveKey] = setTimeout(() => {
      autoSaveField(stepId, key, value);
    }, 500);
  }, [autoSaveField]);

  // Save on blur with validation
  const handleBlur = useCallback((stepId: string, key: string) => {
    const saveKey = `${stepId}-${key}`;
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    const value = formData[stepId]?.[key];
    
    // Find the field to get validation rules
    const step = steps.find(s => s.id === stepId);
    const field = step?.fields.find(f => f.key === key);
    
    if (field) {
      // Merge field type defaults with custom validation rules
      const rules = mergeValidationRules(field.type, field.validation_rules as ValidationRule);
      if (field.required) {
        rules.required = true;
      }
      
      // Validate the field
      const result = validateField(value, rules, field.label);
      
      if (!result.isValid && result.error) {
        // Set error for this field
        setFieldErrors(prev => ({ ...prev, [key]: result.error! }));
      } else {
        // Clear error for this field
        setFieldErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[key];
          return newErrors;
        });
      }
    }
    
    if (hasUnsavedChanges.current) {
      autoSaveField(stepId, key, value);
    }
  }, [formData, autoSaveField, steps]);

  // Handle close
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges.current) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [onClose]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    const savePromises: Promise<any>[] = [];
    Object.entries(formData).forEach(([stepId, fields]) => {
      Object.entries(fields).forEach(([fieldKey, value]) => {
        if (fieldKey !== '_meta') {
          savePromises.push(formSubmissionService.autoSave(submission.id, stepId, fieldKey, value));
        }
      });
    });
    
    try {
      await Promise.all(savePromises);
      notify.success('Progress saved');
      onClose();
    } catch (err) {
      notify.error('Failed to save progress');
    }
  }, [formData, submission.id, onClose]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    // Validate all visible fields in current step with full validation rules
    const errors: Record<string, string> = {};
    currentStep?.fields.forEach(field => {
      // Skip hidden fields
      if (hiddenFields.has(field.key)) return;
      
      const value = formData[currentStep.id]?.[field.key];
      
      // Merge field type defaults with custom validation rules
      const rules = mergeValidationRules(field.type, field.validation_rules as ValidationRule);
      if (field.required) {
        rules.required = true;
      }
      
      // Validate the field
      const result = validateField(value, rules, field.label);
      
      if (!result.isValid && result.error) {
        errors[field.key] = result.error;
      }
    });
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      notify.error('Please fix the validation errors before submitting');
      return;
    }
    
    setFieldErrors({});
    setIsSubmitting(true);
    
    try {
      await formSubmissionService.submit(submission.id);
      notify.success('Form submitted successfully!');
      setTimeout(onClose, 500);
    } catch (err: any) {
      notify.handleApiError(err, 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  }, [submission.id, onClose, currentStep, formData, hiddenFields]);

  // Validate current step before navigation
  const validateCurrentStep = useCallback((): boolean => {
    if (!currentStep) return true;
    
    const errors: Record<string, string> = {};
    currentStep.fields.forEach(field => {
      // Skip hidden fields
      if (hiddenFields.has(field.key)) return;
      
      const value = formData[currentStep.id]?.[field.key];
      
      // Merge field type defaults with custom validation rules
      const rules = mergeValidationRules(field.type, field.validation_rules as ValidationRule);
      if (field.required) {
        rules.required = true;
      }
      
      // Validate the field
      const result = validateField(value, rules, field.label);
      
      if (!result.isValid && result.error) {
        errors[field.key] = result.error;
      }
    });
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      notify.error('Please fix the validation errors before continuing');
      return false;
    }
    
    setFieldErrors({});
    return true;
  }, [currentStep, formData, hiddenFields]);

  // Auto-populate fields when entering a new step
  const autoPopulateFields = useCallback((targetStepIndex: number) => {
    const targetStep = steps[targetStepIndex];
    if (!targetStep) return;
    
    const updates: Record<string, any> = {};
    let hasUpdates = false;
    
    targetStep.fields.forEach(field => {
      // Check for auto_populate configuration
      const autoPopConfig = field.auto_populate;
      if (!autoPopConfig?.source_step_id || !autoPopConfig?.source_field) return;
      
      // Find the source step
      const sourceStep = steps.find(s => s.id === autoPopConfig.source_step_id);
      if (!sourceStep) return;
      
      // Get value from source step
      const sourceValue = formData[sourceStep.id]?.[autoPopConfig.source_field];
      
      // Only auto-populate if:
      // 1. There's a source value
      // 2. The target field is empty (don't overwrite user input)
      const currentValue = formData[targetStep.id]?.[field.key];
      if (sourceValue !== undefined && sourceValue !== '' && 
          (currentValue === undefined || currentValue === '')) {
        
        if (autoPopConfig.mode === 'copy' || !autoPopConfig.mode) {
          // Direct copy
          updates[field.key] = sourceValue;
          hasUpdates = true;
        }
        // TODO: 'lookup' mode would fetch related entity data via API
      }
    });
    
    // Apply updates if any
    if (hasUpdates) {
      setFormData(prev => ({
        ...prev,
        [targetStep.id]: {
          ...prev[targetStep.id],
          ...updates,
        },
      }));
      
      // Show notification about auto-filled fields
      const fieldCount = Object.keys(updates).length;
      notify.info(`${fieldCount} field${fieldCount > 1 ? 's' : ''} auto-filled from previous step`);
    }
  }, [steps, formData]);

  // Go to next step with validation and auto-populate
  const goToNextStep = useCallback(() => {
    if (validateCurrentStep()) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      // Auto-populate after a short delay to ensure state is updated
      setTimeout(() => autoPopulateFields(nextIndex), 100);
    }
  }, [validateCurrentStep, currentStepIndex, autoPopulateFields]);

  // Get field options
  const getFieldOptions = (field: FieldData): { value: string; label: string }[] => {
    if (field.related_entity_type && entityOptions[field.related_entity_type]) {
      return entityOptions[field.related_entity_type];
    }
    if (field.choices) {
      return field.choices;
    }
    if (field.options) {
      return Array.isArray(field.options) 
        ? (typeof field.options[0] === 'string' 
            ? (field.options as string[]).map(o => ({ value: o, label: o }))
            : field.options as { value: string; label: string }[])
        : [];
    }
    return [];
  };

  // Render field input based on type
  const renderFieldInput = (field: FieldData, stepId: string) => {
    const value = formData[stepId]?.[field.key] ?? '';
    const opts = getFieldOptions(field);
    const hasError = !!fieldErrors[field.key];
    
    switch (field.type) {
      case 'checkbox':
      case 'boolean':
        return (
          <CheckboxWrapper>
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => {
                handleChange(stepId, field.key, e.target.checked);
                autoSaveField(stepId, field.key, e.target.checked);
              }}
            />
            <span>{field.label}</span>
          </CheckboxWrapper>
        );
        
      case 'textarea':
        return (
          <TextArea
            $hasError={hasError}
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            rows={field.rows || 4}
          />
        );
        
      case 'select':
      case 'lookup':
      case 'dropdown':
      case 'foreignkey': {
        const selectElement = (
          <SelectInput
            $hasError={hasError}
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
          >
            <option value="">Select {field.label}...</option>
            {opts.map((opt, i) => (
              <option key={i} value={opt.value}>{opt.label}</option>
            ))}
          </SelectInput>
        );
        
        // Show quick add button for fields with related entity type
        if (field.related_entity_type) {
          return (
            <SelectWithAddContainer>
              <SelectWrapper>{selectElement}</SelectWrapper>
              <QuickAddButton
                type="button"
                onClick={() => setQuickCreateField({
                  stepId,
                  fieldKey: field.key,
                  entityType: field.related_entity_type!,
                })}
                title={`Create new ${field.label}`}
              >
                + New
              </QuickAddButton>
            </SelectWithAddContainer>
          );
        }
        
        return selectElement;
      }
        
      case 'multiselect': {
        const searchKey = `${stepId}-${field.key}`;
        const searchTerm = multiSelectSearch[searchKey] || '';
        const filteredOpts = opts.filter(o => 
          o.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const selectedValues = Array.isArray(value) ? value : [];
        
        return (
          <MultiSelectContainer>
            <MultiSelectSearch
              type="text"
              placeholder={`🔍 Search ${field.label.toLowerCase()}...`}
              value={searchTerm}
              onChange={e => setMultiSelectSearch(prev => ({ ...prev, [searchKey]: e.target.value }))}
            />
            <MultiSelectOptions>
              {filteredOpts.length === 0 ? (
                <div style={{ padding: '12px', color: '#9ca3af', textAlign: 'center', fontSize: '14px' }}>
                  No options found
                </div>
              ) : filteredOpts.map((opt, i) => (
                <MultiSelectOption key={i} $selected={selectedValues.includes(opt.value)}>
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={e => {
                      const newValue = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter(v => v !== opt.value);
                      handleChange(stepId, field.key, newValue);
                    }}
                  />
                  <span>{opt.label}</span>
                </MultiSelectOption>
              ))}
            </MultiSelectOptions>
            <SelectedCount>
              {selectedValues.length} selected
            </SelectedCount>
          </MultiSelectContainer>
        );
      }
        
      case 'date':
        return (
          <TextInput
            $hasError={hasError}
            type="date"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
          />
        );
        
      case 'datetime':
        return (
          <TextInput
            $hasError={hasError}
            type="datetime-local"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
          />
        );
        
      case 'time':
        return (
          <TextInput
            $hasError={hasError}
            type="time"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
          />
        );
        
      case 'number':
      case 'integer':
        return (
          <TextInput
            $hasError={hasError}
            type="number"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || '0'}
            min={field.min}
            max={field.max}
            step="1"
          />
        );
        
      case 'decimal':
      case 'float':
        return (
          <TextInput
            $hasError={hasError}
            type="number"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || '0.00'}
            step={field.step || '0.01'}
            min={field.min}
            max={field.max}
          />
        );
        
      case 'currency':
        return (
          <CurrencyInputWrapper>
            <span>$</span>
            <TextInput
              $hasError={hasError}
              type="number"
              value={value}
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              placeholder="0.00"
              step="0.01"
              min="0"
              style={{ paddingLeft: '30px' }}
            />
          </CurrencyInputWrapper>
        );
        
      case 'email':
        return (
          <TextInput
            $hasError={hasError}
            type="email"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || 'email@example.com'}
          />
        );
        
      case 'phone':
        return (
          <TextInput
            $hasError={hasError}
            type="tel"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || '(555) 123-4567'}
          />
        );
        
      case 'url':
        return (
          <TextInput
            $hasError={hasError}
            type="url"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || 'https://'}
          />
        );
        
      default: // text
        return (
          <TextInput
            $hasError={hasError}
            type="text"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            maxLength={field.max_length}
          />
        );
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <ModalOverlay onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <ModalContent onClick={e => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader>
          <HeaderLeft>
            <FormIcon>
              <Icon name={submission?.form_icon || 'clipboard-list'} size={24} />
            </FormIcon>
            <HeaderTitle>
              <h2>👁️ {submission?.form_name || 'Form'}</h2>
              {lastSaved && (
                <p>Last saved: {lastSaved.toLocaleTimeString()}</p>
              )}
            </HeaderTitle>
          </HeaderLeft>
          <CloseButton onClick={handleClose}>✕</CloseButton>
        </ModalHeader>

        {/* Step Progress */}
        {steps.length > 1 && (
          <ProgressContainer>
            {steps.map((step, idx) => (
              <ProgressStep
                key={step.id}
                $active={idx === currentStepIndex}
                $completed={idx < currentStepIndex}
                onClick={() => {
                  // Validate before moving forward, but allow going back
                  if (idx > currentStepIndex && !validateCurrentStep()) {
                    return;
                  }
                  setCurrentStepIndex(idx);
                  // Trigger auto-populate for the new step
                  if (idx !== currentStepIndex) {
                    setTimeout(() => autoPopulateFields(idx), 100);
                  }
                }}
              >
                <ProgressNumber
                  $active={idx === currentStepIndex}
                  $completed={idx < currentStepIndex}
                >
                  {idx < currentStepIndex ? '✓' : idx + 1}
                </ProgressNumber>
                <ProgressLabel
                  $active={idx === currentStepIndex}
                  $completed={idx < currentStepIndex}
                >
                  {step.name}
                </ProgressLabel>
              </ProgressStep>
            ))}
          </ProgressContainer>
        )}

        {/* Content */}
        <StepContent>
          {steps.length === 0 ? (
            <EmptyState>
              <div className="icon">📋</div>
              <h3>No steps configured</h3>
              <p>Add steps and fields in the form builder to see a preview.</p>
            </EmptyState>
          ) : currentStep ? (
            <>
              <StepHeader>
                <h4>
                  {currentStep.name}
                </h4>
                <EntityBadge>
                  🏷️ {currentStep.entity_type?.replace('_', ' ') || 'Entity'}
                </EntityBadge>
              </StepHeader>
              
              <FieldsGrid>
                {currentStep.fields
                  .filter(field => !hiddenFields.has(field.key))
                  .map(field => {
                    const isCheckbox = field.type === 'checkbox' || field.type === 'boolean';
                    const fullWidth = isFullWidthField(field);
                    const saveKey = `${currentStep.id}-${field.key}`;
                    const status = saveStatus[saveKey] || 'idle';
                    // Check both new and legacy auto_populate config
                    const hasAutoPopulate = !!(field.auto_populate?.source_step_id || field.config?.auto_populate?.source_step);
                    const hasRules = getFieldHasRules(currentStep.id, field.key);
                    
                    // Get source step name for auto-populate indicator
                    const sourceStepName = (() => {
                      if (field.auto_populate?.source_step_id) {
                        const sourceStep = steps.find(s => s.id === field.auto_populate?.source_step_id);
                        return sourceStep?.name || 'previous step';
                      }
                      return 'previous step';
                    })();
                    
                    return (
                      <FieldWrapper key={field.key} $fullWidth={fullWidth}>
                        <FieldCard>
                          <FieldHeader>
                            <FieldIcon>{getFieldTypeIcon(field.type)}</FieldIcon>
                            <FieldLabel>
                              {!isCheckbox && field.label}
                              {field.required && !isCheckbox && <RequiredStar>*</RequiredStar>}
                            </FieldLabel>
                            <FieldTypeBadge>{field.type}</FieldTypeBadge>
                            <SaveIndicator $status={status}>
                              {status === 'saving' && '⏳'}
                              {status === 'saved' && '✓'}
                              {status === 'error' && '⚠'}
                            </SaveIndicator>
                          </FieldHeader>
                          
                          {renderFieldInput(field, currentStep.id)}
                          
                          {(hasAutoPopulate || hasRules) && (
                            <FieldIndicators>
                              {hasAutoPopulate && (
                                <Indicator $type="auto" title={`Auto-populated from ${sourceStepName}`}>
                                  🔗 From {sourceStepName}
                                </Indicator>
                              )}
                              {hasRules && (
                                <Indicator $type="conditional" title="Has conditional visibility rule">
                                  👁️ Conditional
                                </Indicator>
                              )}
                            </FieldIndicators>
                          )}
                          
                          {fieldErrors[field.key] && (
                            <FieldError>⚠ {fieldErrors[field.key]}</FieldError>
                          )}
                          
                          {field.help_text && !fieldErrors[field.key] && (
                            <HelpText>{field.help_text}</HelpText>
                          )}
                        </FieldCard>
                      </FieldWrapper>
                    );
                  })}
              </FieldsGrid>
            </>
          ) : null}
        </StepContent>

        {/* Navigation */}
        <NavigationContainer>
          <NavLeft>
            <StepIndicator>
              Step {currentStepIndex + 1} of {steps.length || 1}
            </StepIndicator>
            {lastSaved && (
              <AutoSaveStatus>
                ✓ Auto-saved
              </AutoSaveStatus>
            )}
          </NavLeft>
          
          <NavRight>
            <Button onClick={handleSaveAndExit}>
              💾 Save & Exit
            </Button>
            
            {currentStepIndex > 0 && (
              <Button onClick={() => setCurrentStepIndex(i => i - 1)}>
                ← Previous
              </Button>
            )}
            
            {currentStepIndex < steps.length - 1 ? (
              <Button $variant="primary" onClick={goToNextStep}>
                Next →
              </Button>
            ) : (
              <Button $variant="success" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? '⏳ Submitting...' : '✓ Submit Form'}
              </Button>
            )}
          </NavRight>
        </NavigationContainer>

        {/* Exit Confirmation */}
        {showExitConfirm && (
          <ConfirmOverlay>
            <ConfirmDialog>
              <h3>💾 Save your progress?</h3>
              <p>You have unsaved changes. Would you like to save before exiting?</p>
              <ConfirmActions>
                <Button onClick={() => { setShowExitConfirm(false); onClose(); }}>
                  Discard
                </Button>
                <Button $variant="primary" onClick={() => { setShowExitConfirm(false); handleSaveAndExit(); }}>
                  Save & Exit
                </Button>
              </ConfirmActions>
            </ConfirmDialog>
          </ConfirmOverlay>
        )}

        {/* Quick Create Modal */}
        {quickCreateField && (
          <QuickCreateModal
            entityType={quickCreateField.entityType}
            isOpen={true}
            onClose={() => setQuickCreateField(null)}
            onCreated={async (entity) => {
              // Set the newly created entity as the field value
              handleChange(quickCreateField.stepId, quickCreateField.fieldKey, entity.value);
              
              // Refresh options for this entity type
              try {
                const res = await entityOptionsService.getOptions(quickCreateField.entityType);
                setEntityOptions(prev => ({ ...prev, [quickCreateField.entityType]: res.options || [] }));
              } catch (e) {
                console.error('Failed to refresh options:', e);
              }
              
              setQuickCreateField(null);
              notify.success(`Created new ${entity.label}`);
            }}
          />
        )}
      </ModalContent>
    </ModalOverlay>
  );

  return createPortal(modalContent, document.body);
};

export default FormSubmissionModal;
