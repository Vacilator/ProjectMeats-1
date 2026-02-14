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
 * - New field types: rating, slider, signature, richtext
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { css } from 'styled-components';
import { 
  FormSubmission,
  formSubmissionService,
  entityOptionsService,
} from '../../services/quickActionsService';
import { isStaticChoiceField, getChoicesForField } from '../../services/choicesService';
import { getEffectiveChoices } from '../../services/optionListsService';
import { resolveConfig } from '../../services/configService';
import { notify } from '../../utils/notify';
import { validateField, mergeValidationRules, ValidationRule } from '../../utils/formValidation';
import { Icon } from '../ui';
import QuickCreateModal from './QuickCreateModal';
import FileUploadField from './FileUploadField';
import SearchableSelect from './SearchableSelect';
import RatingField from './RatingField';
import SliderField from './SliderField';
import SignatureField from './SignatureField';
import RichTextField from './RichTextField';
// Phase 1: TaskRenderer Integration
import { TaskRenderer } from './TaskRenderer';
import { useWorkflowContext } from './hooks/useWorkflowContext';
import { createLinearGraph, getNodeByStepId } from './utils/legacyShim';

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
    unit?: string;  // For slider fields (e.g., '%', 'lbs', '$')
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

// Visually hidden but accessible to screen readers
const ScreenReaderAnnouncement = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
    case 'rating':
    case 'stars': return '⭐';
    case 'slider':
    case 'range': return '🎚️';
    case 'signature': return '✍️';
    case 'richtext':
    case 'html':
    case 'wysiwyg': return '📰';
    default: return '📝';
  }
};

const isFullWidthField = (field: FieldData): boolean => {
  if (field.type === 'textarea' || field.type === 'json') return true;
  if (field.type === 'multiselect') return true;
  if (field.type === 'file' || field.type === 'image') return true;
  if (field.type === 'richtext' || field.type === 'html' || field.type === 'wysiwyg') return true;
  if (field.type === 'signature') return true;
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
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());  // Track touched fields
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [multiSelectSearch, setMultiSelectSearch] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState<string>('');
  const [quickCreateField, setQuickCreateField] = useState<{
    stepId: string;
    fieldKey: string;
    entityType: string;
  } | null>(null);
  
  // Form-level config settings from ConfigResolver (Wave 4 - Task 4.11)
  const [formConfig, setFormConfig] = useState<{
    autoSaveEnabled: boolean;
    autoSaveDelay: number;
    showProgressBar: boolean;
    allowStepNavigation: boolean;
    validateOnBlur: boolean;
  }>({
    autoSaveEnabled: true,
    autoSaveDelay: 500,
    showProgressBar: true,
    allowStepNavigation: true,
    validateOnBlur: true,
  });
  
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const hasUnsavedChanges = useRef(false);
  const stepContentRef = useRef<HTMLDivElement>(null);
  
  // Phase 1: Feature flag for TaskRenderer (set to false to maintain backward compatibility)
  const [useTaskRenderer] = useState(false);

  // Load form-level configuration from ConfigResolver (Wave 4 - Task 4.11)
  useEffect(() => {
    const loadFormConfig = async () => {
      try {
        // Resolve form configuration with cascading defaults
        const [autoSave, autoSaveDelay, showProgress, allowNav, validateBlur] = await Promise.all([
          resolveConfig<boolean>('forms.auto_save_enabled', true),
          resolveConfig<number>('forms.auto_save_delay_ms', 500),
          resolveConfig<boolean>('forms.show_progress_bar', true),
          resolveConfig<boolean>('forms.allow_step_navigation', true),
          resolveConfig<boolean>('forms.validate_on_blur', true),
        ]);
        
        setFormConfig({
          autoSaveEnabled: autoSave.value,
          autoSaveDelay: autoSaveDelay.value,
          showProgressBar: showProgress.value,
          allowStepNavigation: allowNav.value,
          validateOnBlur: validateBlur.value,
        });
      } catch (error) {
        // Keep defaults if config resolution fails
        console.debug('Using default form config, resolution failed:', error);
      }
    };
    
    loadFormConfig();
  }, []);

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
        fields: (step.fields || [])
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))  // Sort fields by order
          .map((f: any) => ({
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
            order: f.order ?? 0,  // Preserve order for debugging
          })),
      }));
  }, [submission?.form_snapshot]);

  // Parse rules
  const rules: RuleData[] = useMemo(() => {
    if (!submission?.form_snapshot?.rules) return [];
    return submission.form_snapshot.rules.filter((r: any) => r.is_active !== false);
  }, [submission?.form_snapshot]);

  const currentStep = steps[currentStepIndex];

  // Phase 1: Initialize workflow context from legacy steps (AFTER steps are defined)
  const { nodes: workflowNodes } = useMemo(() => {
    return createLinearGraph(steps);
  }, [steps]);

  const currentNode = useMemo(() => {
    return getNodeByStepId(workflowNodes, currentStep?.id || '');
  }, [workflowNodes, currentStep?.id]);

  const workflowContext = useWorkflowContext(workflowNodes, currentNode?.id || null);

  // Sync formData with workflow context on step change
  useEffect(() => {
    if (currentStep && formData[currentStep.id]) {
      workflowContext.setNodeData(currentStep.id, formData[currentStep.id]);
    }
  }, [currentStep?.id, formData, workflowContext]);

  // Phase 1: Initialize workflow context from legacy steps (AFTER steps are defined)

  // Initialize form data with proper structure for all steps
  useEffect(() => {
    // Always initialize formData structure for all steps
    const initialData: Record<string, Record<string, any>> = {};
    
    // Ensure all steps have entries in formData
    steps.forEach(step => {
      initialData[step.id] = {
        ...(submission?.data?.[step.id] || {}),
      };
    });
    
    if (Object.keys(initialData).length > 0) {
      setFormData(initialData);
      console.log('[FormSubmission] Initialized formData:', { 
        stepIds: steps.map(s => s.id),
        submissionDataKeys: Object.keys(submission?.data || {}),
        initialDataKeys: Object.keys(initialData)
      });
    }
  }, [submission?.data, steps]);

  // Load entity options AND static choices
  useEffect(() => {
    const loadOptions = async () => {
      // 1. Load related entity options (ForeignKey fields)
      const entityTypes = new Set<string>();
      steps.forEach(s => s.fields.forEach(f => {
        if (f.related_entity_type) entityTypes.add(f.related_entity_type);
      }));
      
      for (const type of entityTypes) {
        if (!entityOptions[type]) {
          try {
            const res = await entityOptionsService.getOptions(type);
            setEntityOptions(prev => ({ ...prev, [type]: res.options || [] }));
          } catch (e) { 
            console.error('Failed to load options for', type, e); 
          }
        }
      }
      
      // 2. Load choices for select fields (effective choices with tenant overrides)
      for (const step of steps) {
        for (const field of step.fields) {
          // Check if this field needs choices (not already having options)
          if ((field.type === 'select' || field.type === 'multiselect') && 
              !field.options?.length && !field.choices?.length && !field.related_entity_type) {
            
            // Try to get effective choices (includes tenant overrides)
            try {
              const effectiveResult = await getEffectiveChoices(step.entity_type, field.key);
              if (effectiveResult.choices && effectiveResult.choices.length > 0) {
                const choiceKey = `__choices__${field.key}`;
                setEntityOptions(prev => ({ ...prev, [choiceKey]: effectiveResult.choices }));
                continue; // Successfully loaded effective choices
              }
            } catch (e) {
              // Effective choices endpoint might not exist for this field, fall back to static
              console.debug(`No effective choices override for ${step.entity_type}.${field.key}, trying static choices`);
            }
            
            // Fall back to static choices if no override exists
            if (isStaticChoiceField(field.key)) {
              try {
                const choices = await getChoicesForField(field.key);
                if (choices && choices.length > 0) {
                  const choiceKey = `__choices__${field.key}`;
                  setEntityOptions(prev => ({ ...prev, [choiceKey]: choices }));
                }
              } catch (e) {
                console.error(`Failed to load static choices for field ${field.key}:`, e);
              }
            }
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

  // Announce step changes to screen readers
  useEffect(() => {
    if (currentStep) {
      setAnnouncement(`Step ${currentStepIndex + 1} of ${steps.length}: ${currentStep.name}`);
    }
  }, [currentStepIndex, currentStep, steps.length]);

  // Focus first input when step changes
  useEffect(() => {
    if (stepContentRef.current && currentStep) {
      setTimeout(() => {
        const firstInput = stepContentRef.current?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea, select, button[role="combobox"]'
        );
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
  }, [currentStepIndex, currentStep]);

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
      const result = await formSubmissionService.autoSave(submission.id, stepId, fieldKey, value);
      console.log('[AutoSave] Success:', { stepId, fieldKey, result });
      setSaveStatus(prev => ({ ...prev, [saveKey]: 'saved' }));
      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [saveKey]: 'idle' }));
      }, 2000);
    } catch (err: any) {
      // Check if this is an axios cancel
      const isCanceled = err?.message?.includes('cancelled') || err?.message?.includes('canceled') || err?.__CANCEL__;
      
      if (!isCanceled) {
        console.error('[AutoSave] Failed:', { stepId, fieldKey, error: err?.response?.data || err?.message || err });
        setSaveStatus(prev => ({ ...prev, [saveKey]: 'error' }));
        
        // Show user-friendly error for non-network issues
        if (err?.response?.status === 403) {
          notify.error('Access denied - please refresh and try again');
        } else if (err?.response?.status === 400) {
          notify.error(`Save failed: ${err?.response?.data?.error || 'Invalid data'}`);
        } else if (err?.response?.status >= 500) {
          notify.error('Server error - please try again later');
        }
        // For network errors, don't spam notifications - just mark as error status
      }
    }
  }, [submission.id]);

  // Handle field change - with real-time validation for touched fields
  const handleChange = useCallback((stepId: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: { ...(prev[stepId] || {}), [key]: value },
    }));
    
    hasUnsavedChanges.current = true;

    // Phase 1: Sync with workflow context
    workflowContext.setNodeData(stepId, { [key]: value });
    
    // Real-time validation for fields that have been touched (blurred before)
    const fieldKey = `${stepId}.${key}`;
    if (touchedFields.has(fieldKey)) {
      const step = steps.find(s => s.id === stepId);
      const field = step?.fields.find(f => f.key === key);
      
      if (field) {
        const rules = mergeValidationRules(field.type, field.validation_rules as ValidationRule);
        if (field.required) {
          rules.required = true;
        }
        
        const result = validateField(value, rules, field.label);
        
        if (!result.isValid && result.error) {
          setFieldErrors(prev => ({ ...prev, [key]: result.error! }));
        } else {
          setFieldErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[key];
            return newErrors;
          });
        }
      }
    }
    
    // Use configurable auto-save delay (Wave 4 - Task 4.11)
    if (formConfig.autoSaveEnabled) {
      const saveKey = `${stepId}-${key}`;
      if (saveTimeoutRef.current[saveKey]) {
        clearTimeout(saveTimeoutRef.current[saveKey]);
      }
      
      saveTimeoutRef.current[saveKey] = setTimeout(() => {
        autoSaveField(stepId, key, value);
      }, formConfig.autoSaveDelay);
    }
  }, [autoSaveField, touchedFields, steps, formConfig.autoSaveEnabled, formConfig.autoSaveDelay, workflowContext]);

  // Save on blur with validation - mark field as touched
  const handleBlur = useCallback((stepId: string, key: string) => {
    const saveKey = `${stepId}-${key}`;
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    // Mark field as touched
    const fieldKey = `${stepId}.${key}`;
    setTouchedFields(prev => {
      const newTouched = new Set(prev);
      newTouched.add(fieldKey);
      return newTouched;
    });
    
    // Get value directly from formData state
    const value = formData[stepId]?.[key];
    console.log('[handleBlur]', { stepId, key, value, hasUnsavedChanges: hasUnsavedChanges.current });
    
    // Find the field to get validation rules
    const step = steps.find(s => s.id === stepId);
    const field = step?.fields.find(f => f.key === key);
    
    // Validate on blur if enabled via config (Wave 4 - Task 4.11)
    if (field && formConfig.validateOnBlur) {
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
    
    if (hasUnsavedChanges.current && formConfig.autoSaveEnabled) {
      autoSaveField(stepId, key, value);
    }
  }, [formData, autoSaveField, steps, formConfig.validateOnBlur, formConfig.autoSaveEnabled]);

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
    // Collect all field values to save
    const savePromises: Promise<any>[] = [];
    const fieldsToSave: Array<{stepId: string; fieldKey: string; value: any}> = [];
    
    Object.entries(formData).forEach(([stepId, fields]) => {
      Object.entries(fields).forEach(([fieldKey, value]) => {
        if (fieldKey !== '_meta') {
          fieldsToSave.push({ stepId, fieldKey, value });
        }
      });
    });
    
    if (fieldsToSave.length === 0) {
      // Nothing to save
      notify.info('No changes to save');
      onClose();
      return;
    }
    
    console.log('[SaveAndExit] Saving', fieldsToSave.length, 'fields');
    
    // Create promises for each field
    fieldsToSave.forEach(({ stepId, fieldKey, value }) => {
      savePromises.push(
        formSubmissionService.autoSave(submission.id, stepId, fieldKey, value)
          .then(() => ({ success: true, stepId, fieldKey }))
          .catch(err => ({ success: false, stepId, fieldKey, error: err }))
      );
    });
    
    try {
      const results = await Promise.all(savePromises);
      const failures = results.filter((r: any) => !r.success);
      
      if (failures.length === 0) {
        notify.success('Progress saved successfully');
        onClose();
      } else if (failures.length < results.length) {
        // Partial success
        const successCount = results.length - failures.length;
        notify.warning(`Saved ${successCount} of ${results.length} fields. Some fields failed to save.`);
        console.error('[SaveAndExit] Partial failure:', failures);
        onClose();
      } else {
        // All failed
        notify.error('Failed to save progress. Please try again.');
        console.error('[SaveAndExit] All saves failed:', failures);
      }
    } catch (err: any) {
      console.error('[SaveAndExit] Unexpected error:', err);
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

  // Check if current step is valid (for enabling/disabling Next button)
  // This doesn't show errors - just checks if required fields are filled
  const isCurrentStepValid = useMemo((): boolean => {
    if (!currentStep) return true;
    
    for (const field of currentStep.fields) {
      // Skip hidden fields
      if (hiddenFields.has(field.key)) continue;
      
      // Check required fields
      if (field.required) {
        const value = formData[currentStep.id]?.[field.key];
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          return false;
        }
      }
    }
    
    // Also check if there are any validation errors currently showing
    return Object.keys(fieldErrors).length === 0;
  }, [currentStep, formData, hiddenFields, fieldErrors]);

  // Count of missing required fields (for tooltip)
  const missingRequiredCount = useMemo((): number => {
    if (!currentStep) return 0;
    
    let count = 0;
    for (const field of currentStep.fields) {
      if (hiddenFields.has(field.key)) continue;
      
      if (field.required) {
        const value = formData[currentStep.id]?.[field.key];
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          count++;
        }
      }
    }
    return count;
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
        // Note: 'lookup' mode for fetching related entity data via API is planned for Wave 4 (Admin Studio)
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
    // 1. Check for related entity options (ForeignKey)
    if (field.related_entity_type && entityOptions[field.related_entity_type]) {
      return entityOptions[field.related_entity_type];
    }
    
    // 2. Check for static choices loaded from backend
    const choiceKey = `__choices__${field.key}`;
    if (entityOptions[choiceKey]) {
      return entityOptions[choiceKey];
    }
    
    // 3. Check for choices defined in field config
    if (field.choices) {
      return field.choices;
    }
    
    // 4. Check for options array
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
    
    // Accessibility helpers
    const fieldId = `field-${stepId}-${field.key}`;
    const errorId = `${fieldId}-error`;
    const helpId = `${fieldId}-help`;
    const ariaProps = {
      id: fieldId,
      'aria-required': field.required || undefined,
      'aria-invalid': hasError || undefined,
      'aria-describedby': [
        hasError ? errorId : null,
        field.help_text ? helpId : null,
      ].filter(Boolean).join(' ') || undefined,
    };
    
    switch (field.type) {
      case 'checkbox':
      case 'boolean':
        return (
          <CheckboxWrapper>
            <input
              {...ariaProps}
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
            {...ariaProps}
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
        // Use SearchableSelect for fields with related_entity_type (API-backed)
        if (field.related_entity_type) {
          return (
            <SelectWithAddContainer>
              <SelectWrapper>
                <SearchableSelect
                  entityType={field.related_entity_type}
                  value={value}
                  onChange={(newValue) => handleChange(stepId, field.key, newValue)}
                  onBlur={() => handleBlur(stepId, field.key)}
                  placeholder={`Select ${field.label}...`}
                  hasError={hasError}
                  initialOptions={opts}
                  threshold={50}
                />
              </SelectWrapper>
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
        
        // Standard select for static options
        return (
          <SelectInput
            {...ariaProps}
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
      }
        
      case 'multiselect': {
        const searchKey = `${stepId}-${field.key}`;
        const searchTerm = multiSelectSearch[searchKey] || '';
        const filteredOpts = opts.filter(o => 
          o.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const selectedValues = Array.isArray(value) ? value : [];
        
        return (
          <MultiSelectContainer 
            role="group" 
            aria-labelledby={`${fieldId}-label`}
            {...ariaProps}
          >
            <MultiSelectSearch
              type="text"
              placeholder={`🔍 Search ${field.label.toLowerCase()}...`}
              value={searchTerm}
              onChange={e => setMultiSelectSearch(prev => ({ ...prev, [searchKey]: e.target.value }))}
              aria-label={`Search ${field.label}`}
            />
            <MultiSelectOptions role="listbox" aria-multiselectable="true">
              {filteredOpts.length === 0 ? (
                <div style={{ padding: '12px', color: '#9ca3af', textAlign: 'center', fontSize: '14px' }}>
                  No options found
                </div>
              ) : filteredOpts.map((opt, i) => (
                <MultiSelectOption key={i} $selected={selectedValues.includes(opt.value)} role="option" aria-selected={selectedValues.includes(opt.value)}>
                  <input
                    type="checkbox"
                    id={`${fieldId}-opt-${i}`}
                    checked={selectedValues.includes(opt.value)}
                    onChange={e => {
                      const newValue = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter(v => v !== opt.value);
                      handleChange(stepId, field.key, newValue);
                    }}
                    aria-label={opt.label}
                  />
                  <span>{opt.label}</span>
                </MultiSelectOption>
              ))}
            </MultiSelectOptions>
            <SelectedCount aria-live="polite">
              {selectedValues.length} selected
            </SelectedCount>
          </MultiSelectContainer>
        );
      }
        
      case 'date':
        return (
          <TextInput
            {...ariaProps}
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
            {...ariaProps}
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
            {...ariaProps}
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
            {...ariaProps}
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
            {...ariaProps}
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
            <span aria-hidden="true">$</span>
            <TextInput
              {...ariaProps}
              $hasError={hasError}
              type="number"
              value={value}
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              placeholder="0.00"
              step="0.01"
              min="0"
              style={{ paddingLeft: '30px' }}
              aria-label={`${field.label} in dollars`}
            />
          </CurrencyInputWrapper>
        );
        
      case 'email':
        return (
          <TextInput
            {...ariaProps}
            $hasError={hasError}
            type="email"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || 'email@example.com'}
            autoComplete="email"
          />
        );
        
      case 'phone':
        return (
          <TextInput
            {...ariaProps}
            $hasError={hasError}
            type="tel"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || '(555) 123-4567'}
            autoComplete="tel"
          />
        );
        
      case 'url':
        return (
          <TextInput
            {...ariaProps}
            $hasError={hasError}
            type="url"
            value={value}
            onChange={e => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            placeholder={field.placeholder || 'https://'}
            autoComplete="url"
          />
        );
        
      case 'file':
      case 'image':
        return (
          <FileUploadField
            submissionId={submission.id}
            fieldKey={field.key}
            label={field.label}
            value={value}
            onChange={(newValue) => handleChange(stepId, field.key, newValue)}
            isImage={field.type === 'image'}
            hasError={hasError}
            maxSizeMB={10}
          />
        );
        
      case 'rating':
      case 'stars':
        return (
          <RatingField
            value={Number(value) || 0}
            onChange={(newValue) => {
              handleChange(stepId, field.key, newValue);
              autoSaveField(stepId, field.key, newValue);
            }}
            maxRating={field.max || 5}
            hasError={hasError}
            ariaProps={ariaProps}
          />
        );
        
      case 'slider':
      case 'range':
        return (
          <SliderField
            value={Number(value) || field.min || 0}
            onChange={(newValue) => {
              handleChange(stepId, field.key, newValue);
              autoSaveField(stepId, field.key, newValue);
            }}
            min={field.min || 0}
            max={field.max || 100}
            step={field.step || 1}
            unit={field.config?.unit || ''}
            hasError={hasError}
            ariaProps={ariaProps}
          />
        );
        
      case 'signature':
        return (
          <SignatureField
            value={value || ''}
            onChange={(newValue) => {
              handleChange(stepId, field.key, newValue);
              autoSaveField(stepId, field.key, newValue);
            }}
            hasError={hasError}
            ariaProps={ariaProps}
          />
        );
        
      case 'richtext':
      case 'html':
      case 'wysiwyg':
        return (
          <RichTextField
            value={value || ''}
            onChange={(newValue) => handleChange(stepId, field.key, newValue)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            maxLength={field.max_length}
            hasError={hasError}
            ariaProps={ariaProps}
          />
        );
        
      default: // text
        return (
          <TextInput
            {...ariaProps}
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
          <CloseButton onClick={handleClose} aria-label="Close form">✕</CloseButton>
        </ModalHeader>

        {/* Screen reader announcements */}
        <ScreenReaderAnnouncement aria-live="polite" aria-atomic="true">
          {announcement}
        </ScreenReaderAnnouncement>

        {/* Step Progress */}
        {steps.length > 1 && (
          <ProgressContainer role="navigation" aria-label="Form steps">
            {steps.map((step, idx) => (
              <ProgressStep
                key={step.id}
                $active={idx === currentStepIndex}
                $completed={idx < currentStepIndex}
                role="button"
                tabIndex={0}
                aria-label={`Step ${idx + 1}: ${step.name}${idx < currentStepIndex ? ' (completed)' : idx === currentStepIndex ? ' (current)' : ''}`}
                aria-current={idx === currentStepIndex ? 'step' : undefined}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (idx > currentStepIndex && !validateCurrentStep()) {
                      return;
                    }
                    setCurrentStepIndex(idx);
                    if (idx !== currentStepIndex) {
                      setTimeout(() => autoPopulateFields(idx), 100);
                    }
                  }
                }}
              >
                <ProgressNumber
                  $active={idx === currentStepIndex}
                  $completed={idx < currentStepIndex}
                  aria-hidden="true"
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
        <StepContent ref={stepContentRef} role="region" aria-label={currentStep?.name || 'Form step'}>
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
              
              {/* Phase 1: Conditional rendering - TaskRenderer or Legacy FieldsGrid */}
              {useTaskRenderer && currentNode ? (
                <TaskRenderer
                  node={currentNode}
                  context={workflowContext}
                  onComplete={(data) => {
                    // Handle step completion
                    console.log('[TaskRenderer] Step completed with data:', data);
                    if (currentStepIndex < steps.length - 1) {
                      goToNextStep();
                    }
                  }}
                  readOnly={false}
                />
              ) : (
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
                            <FieldIcon aria-hidden="true">{getFieldTypeIcon(field.type)}</FieldIcon>
                            <FieldLabel 
                              as="label" 
                              htmlFor={`field-${currentStep.id}-${field.key}`}
                              id={`field-${currentStep.id}-${field.key}-label`}
                            >
                              {!isCheckbox && field.label}
                              {field.required && !isCheckbox && <RequiredStar aria-hidden="true">*</RequiredStar>}
                            </FieldLabel>
                            <FieldTypeBadge aria-hidden="true">{field.type}</FieldTypeBadge>
                            <SaveIndicator $status={status} aria-live="polite" aria-label={
                              status === 'saving' ? 'Saving...' :
                              status === 'saved' ? 'Saved' :
                              status === 'error' ? 'Save failed' : ''
                            }>
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
                            <FieldError 
                              id={`field-${currentStep.id}-${field.key}-error`}
                              role="alert"
                              aria-live="assertive"
                            >
                              ⚠ {fieldErrors[field.key]}
                            </FieldError>
                          )}
                          
                          {field.help_text && !fieldErrors[field.key] && (
                            <HelpText id={`field-${currentStep.id}-${field.key}-help`}>
                              {field.help_text}
                            </HelpText>
                          )}
                        </FieldCard>
                      </FieldWrapper>
                    );
                  })}
              </FieldsGrid>
              )}
              {/* End Phase 1 conditional rendering */}
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
              <Button 
                onClick={() => setCurrentStepIndex(i => i - 1)}
                aria-label={`Go to previous step: ${steps[currentStepIndex - 1]?.name || 'Previous'}`}
              >
                ← Previous
              </Button>
            )}
            
            {currentStepIndex < steps.length - 1 ? (
              <Button 
                $variant="primary" 
                onClick={goToNextStep}
                disabled={!isCurrentStepValid}
                aria-label={`Go to next step: ${steps[currentStepIndex + 1]?.name || 'Next'}`}
                title={!isCurrentStepValid ? `Please fill in ${missingRequiredCount} required field${missingRequiredCount !== 1 ? 's' : ''}` : undefined}
              >
                Next {!isCurrentStepValid && missingRequiredCount > 0 && `(${missingRequiredCount} required)`} →
              </Button>
            ) : (
              <Button 
                $variant="success" 
                onClick={handleSubmit} 
                disabled={isSubmitting || !isCurrentStepValid}
                aria-busy={isSubmitting}
                title={!isCurrentStepValid ? `Please fill in ${missingRequiredCount} required field${missingRequiredCount !== 1 ? 's' : ''}` : undefined}
              >
                {isSubmitting ? '⏳ Submitting...' : '✓ Submit Form'}
              </Button>
            )}
          </NavRight>
        </NavigationContainer>

        {/* Exit Confirmation */}
        {showExitConfirm && (
          <ConfirmOverlay>
            <ConfirmDialog role="alertdialog" aria-labelledby="exit-confirm-title" aria-describedby="exit-confirm-desc">
              <h3 id="exit-confirm-title">💾 Save your progress?</h3>
              <p id="exit-confirm-desc">You have unsaved changes. Would you like to save before exiting?</p>
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
