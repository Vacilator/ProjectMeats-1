/**
 * FormSubmissionModal - Enhanced Form with Auto-Save
 * 
 * Features:
 * - Two-column layout for smaller fields
 * - Intelligent field sizing based on type
 * - Real-time auto-save with visual feedback
 * - Save & Exit capability
 * - Conditional rules evaluation
 * - Smart validation
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FormSubmission,
  formSubmissionService,
  entityOptionsService,
} from '../../services/quickActionsService';
import { notify } from '../../utils/notify';
import { Icon } from '../ui';

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
  width?: 'full' | 'half' | 'third';
}

interface RuleData {
  id: string;
  conditions: { field: string; operator: string; value: any }[];
  condition_logic: 'and' | 'or';
  actions: { action: string; params: any }[];
  is_active: boolean;
}

// Determine field width based on type
const getFieldWidth = (field: FieldData): 'full' | 'half' | 'third' => {
  if (field.width) return field.width;
  
  switch (field.type) {
    case 'textarea':
    case 'json':
    case 'multiselect':
      return 'full';
    case 'checkbox':
    case 'boolean':
    case 'date':
    case 'time':
    case 'number':
    case 'decimal':
    case 'currency':
      return 'half';
    case 'email':
    case 'phone':
    case 'url':
      return 'half';
    case 'select':
    case 'lookup':
      return field.options && (field.options as any[]).length > 10 ? 'full' : 'half';
    default:
      // Text fields - check max_length
      if (field.max_length && field.max_length <= 50) return 'half';
      if (field.max_length && field.max_length <= 100) return 'half';
      return 'full';
  }
};

// Auto-save status type
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  
  // Refs for debouncing
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
          label: f.label || f.custom_label || f.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          type: f.type || 'text',
          required: f.required || f.is_required || false,
          placeholder: f.placeholder,
          help_text: f.help_text || f.custom_help_text,
          options: f.options || f.choices,
          related_entity_type: f.related_entity_type,
          max_length: f.max_length,
          min: f.min,
          max: f.max,
          step: f.step,
          rows: f.rows,
          choices: f.choices,
          validation_rules: f.validation_rules,
          width: f.width,
        })),
      }));
  }, [submission?.form_snapshot]);

  // Parse rules
  const rules: RuleData[] = useMemo(() => {
    if (!submission?.form_snapshot?.rules) return [];
    return submission.form_snapshot.rules.filter((r: any) => r.is_active !== false);
  }, [submission?.form_snapshot]);

  const currentStep = steps[currentStepIndex];

  // Initialize form data from submission
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
    if (conditions.length === 0) return false;
    
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

  // Auto-save field value
  const autoSaveField = useCallback(async (stepId: string, fieldKey: string, value: any) => {
    const saveKey = `${stepId}-${fieldKey}`;
    
    // Clear any pending save for this field
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    setSaveStatus(prev => ({ ...prev, [saveKey]: 'saving' }));
    
    try {
      await formSubmissionService.autoSave(submission.id, stepId, fieldKey, value);
      setSaveStatus(prev => ({ ...prev, [saveKey]: 'saved' }));
      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      
      // Clear saved status after 2 seconds
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

  // Handle field change with debounced auto-save
  const handleChange = useCallback((stepId: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: { ...(prev[stepId] || {}), [key]: value },
    }));
    
    hasUnsavedChanges.current = true;
    
    // Clear any existing timeout
    const saveKey = `${stepId}-${key}`;
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    // Debounce auto-save (500ms)
    saveTimeoutRef.current[saveKey] = setTimeout(() => {
      autoSaveField(stepId, key, value);
    }, 500);
  }, [autoSaveField]);

  // Save immediately (on blur)
  const handleBlur = useCallback((stepId: string, key: string) => {
    const saveKey = `${stepId}-${key}`;
    if (saveTimeoutRef.current[saveKey]) {
      clearTimeout(saveTimeoutRef.current[saveKey]);
    }
    
    const value = formData[stepId]?.[key];
    if (hasUnsavedChanges.current) {
      autoSaveField(stepId, key, value);
    }
  }, [formData, autoSaveField]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges.current) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [onClose]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    // Save any pending changes
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
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const errors: Record<string, string> = {};
    currentStep?.fields.forEach(field => {
      if (field.required && !hiddenFields.has(field.key)) {
        const value = formData[currentStep.id]?.[field.key];
        if (!value && value !== 0 && value !== false) {
          errors[field.key] = `${field.label} is required`;
        }
      }
    });
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      notify.error('Please fill in all required fields');
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

  // Get options for a field
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

  // Render a single field
  const renderField = (field: FieldData, stepId: string) => {
    if (hiddenFields.has(field.key)) return null;
    
    const value = formData[stepId]?.[field.key] ?? '';
    const saveKey = `${stepId}-${field.key}`;
    const status = saveStatus[saveKey] || 'idle';
    const error = fieldErrors[field.key];
    const opts = getFieldOptions(field);
    
    // Base input styles
    const inputBase = `
      w-full px-3 py-2.5 
      border rounded-lg
      transition-all duration-200
      focus:ring-2 focus:ring-blue-500 focus:border-blue-500
      ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'}
    `;
    
    const renderInput = () => {
      switch (field.type) {
        case 'select':
        case 'lookup':
        case 'dropdown':
          return (
            <select 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              className={inputBase}
              style={{ minHeight: '42px' }}
            >
              <option value="">— Select {field.label} —</option>
              {opts.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
            </select>
          );
          
        case 'multiselect':
          return (
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
              {opts.length === 0 ? (
                <span className="text-gray-400 text-sm">No options available</span>
              ) : opts.map((o, i) => (
                <label key={i} className="flex items-center gap-2 py-1.5 hover:bg-gray-50 px-2 rounded cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={Array.isArray(value) && value.includes(o.value)}
                    onChange={e => {
                      const current = Array.isArray(value) ? value : [];
                      const newValue = e.target.checked 
                        ? [...current, o.value]
                        : current.filter(v => v !== o.value);
                      handleChange(stepId, field.key, newValue);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </div>
          );
          
        case 'textarea':
          return (
            <textarea 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              rows={field.rows || 4}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              className={inputBase}
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
          );
          
        case 'checkbox':
        case 'boolean':
          return (
            <label className="flex items-center gap-3 cursor-pointer py-2">
              <input 
                type="checkbox" 
                checked={!!value} 
                onChange={e => {
                  handleChange(stepId, field.key, e.target.checked);
                  // Immediate save for checkboxes
                  autoSaveField(stepId, field.key, e.target.checked);
                }}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">{field.label}</span>
            </label>
          );
          
        case 'date':
          return (
            <input 
              type="date" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'datetime':
          return (
            <input 
              type="datetime-local" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'time':
          return (
            <input 
              type="time" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'number':
        case 'integer':
          return (
            <input 
              type="number" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              step="1"
              min={field.min}
              max={field.max}
              placeholder={field.placeholder || '0'}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'decimal':
        case 'float':
          return (
            <input 
              type="number" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              step={field.step || '0.01'}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder || '0.00'}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'currency':
          return (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input 
                type="number" 
                value={value} 
                onChange={e => handleChange(stepId, field.key, e.target.value)}
                onBlur={() => handleBlur(stepId, field.key)}
                required={field.required}
                step="0.01"
                min="0"
                placeholder="0.00"
                className={`${inputBase} pl-7`}
                style={{ minHeight: '42px' }}
              />
            </div>
          );
          
        case 'email':
          return (
            <input 
              type="email" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              placeholder={field.placeholder || 'email@example.com'}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'phone':
          return (
            <input 
              type="tel" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              placeholder={field.placeholder || '(555) 123-4567'}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        case 'url':
          return (
            <input 
              type="url" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              placeholder={field.placeholder || 'https://'}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
          
        default: // text
          return (
            <input 
              type="text" 
              value={value} 
              onChange={e => handleChange(stepId, field.key, e.target.value)}
              onBlur={() => handleBlur(stepId, field.key)}
              required={field.required}
              maxLength={field.max_length}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              className={inputBase}
              style={{ minHeight: '42px' }}
            />
          );
      }
    };

    return renderInput();
  };

  // Render save status indicator
  const renderSaveIndicator = (stepId: string, fieldKey: string) => {
    const saveKey = `${stepId}-${fieldKey}`;
    const status = saveStatus[saveKey];
    
    if (!status || status === 'idle') return null;
    
    return (
      <span className={`text-xs ml-2 ${
        status === 'saving' ? 'text-blue-500' :
        status === 'saved' ? 'text-green-500' :
        'text-red-500'
      }`}>
        {status === 'saving' && '⏳ Saving...'}
        {status === 'saved' && '✓ Saved'}
        {status === 'error' && '⚠ Error'}
      </span>
    );
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid #e5e7eb', 
          backgroundColor: '#f9fafb', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              backgroundColor: '#dbeafe', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Icon name={submission?.form_icon || 'clipboard-list'} size={22} style={{ color: '#2563eb' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {submission?.form_name || 'Form'}
              </h2>
              {lastSaved && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Last saved: {lastSaved.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={handleClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer', 
              color: '#9ca3af',
              padding: '4px',
              lineHeight: 1,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        {steps.length > 1 && (
          <div style={{ 
            padding: '12px 24px', 
            backgroundColor: '#2563eb', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px' 
          }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(255,255,255,0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700,
              fontSize: '14px'
            }}>
              {currentStepIndex + 1}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>{currentStep?.name || `Step ${currentStepIndex + 1}`}</span>
            <span style={{ fontSize: '13px', opacity: 0.8 }}>of {steps.length}</span>
          </div>
        )}

        {/* Step pills */}
        {steps.length > 1 && (
          <div style={{ 
            padding: '10px 24px', 
            backgroundColor: '#f3f4f6', 
            borderBottom: '1px solid #e5e7eb', 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '6px', 
            justifyContent: 'center' 
          }}>
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: idx === currentStepIndex ? 'none' : '1px solid #d1d5db',
                  backgroundColor: idx === currentStepIndex ? '#2563eb' : idx < currentStepIndex ? '#dcfce7' : 'white',
                  color: idx === currentStepIndex ? 'white' : idx < currentStepIndex ? '#166534' : '#4b5563',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                {idx < currentStepIndex ? '✓ ' : `${idx + 1}. `}{step.name}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {steps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151' }}>No steps configured</h3>
              <p style={{ color: '#6b7280' }}>Please configure form steps in the admin panel.</p>
            </div>
          ) : currentStep ? (
            <form onSubmit={handleSubmit}>
              {/* Two-column grid for fields */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '16px 20px',
                maxWidth: '100%',
              }}>
                {currentStep.fields
                  .filter(field => !hiddenFields.has(field.key))
                  .map(field => {
                    const width = getFieldWidth(field);
                    const isCheckbox = field.type === 'checkbox' || field.type === 'boolean';
                    
                    return (
                      <div 
                        key={field.key} 
                        style={{ 
                          gridColumn: width === 'full' ? '1 / -1' : 'span 1',
                        }}
                      >
                        {!isCheckbox && (
                          <label style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            marginBottom: '6px', 
                            fontSize: '14px', 
                            fontWeight: 500, 
                            color: '#374151' 
                          }}>
                            {field.label}
                            {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                            {renderSaveIndicator(currentStep.id, field.key)}
                          </label>
                        )}
                        {renderField(field, currentStep.id)}
                        {fieldErrors[field.key] && (
                          <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
                            {fieldErrors[field.key]}
                          </p>
                        )}
                        {field.help_text && !fieldErrors[field.key] && (
                          <p style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                            {field.help_text}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Submit button on last step */}
              {currentStepIndex === steps.length - 1 && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: isSubmitting ? '#9ca3af' : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    marginTop: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {isSubmitting ? (
                    <>⏳ Submitting...</>
                  ) : (
                    <>✓ Submit Form</>
                  )}
                </button>
              )}
            </form>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '12px 24px', 
          borderTop: '1px solid #e5e7eb', 
          backgroundColor: '#f9fafb', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              fontSize: '13px', 
              color: '#6b7280', 
              backgroundColor: '#e5e7eb', 
              padding: '4px 12px', 
              borderRadius: '999px' 
            }}>
              Step {currentStepIndex + 1} of {steps.length || 1}
            </span>
            {lastSaved && (
              <span style={{ fontSize: '12px', color: '#16a34a' }}>
                ✓ Auto-saved
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleSaveAndExit}
              style={{ 
                padding: '8px 16px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px', 
                backgroundColor: 'white', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
              }}
            >
              💾 Save & Exit
            </button>
            {currentStepIndex > 0 && (
              <button 
                onClick={() => setCurrentStepIndex(i => i - 1)} 
                style={{ 
                  padding: '8px 16px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px', 
                  backgroundColor: 'white', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                ← Previous
              </button>
            )}
            {currentStepIndex < steps.length - 1 && (
              <button 
                onClick={() => setCurrentStepIndex(i => i + 1)} 
                style={{ 
                  padding: '8px 16px', 
                  border: 'none', 
                  borderRadius: '6px', 
                  backgroundColor: '#2563eb', 
                  color: 'white', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 600 }}>
              Save your progress?
            </h3>
            <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '14px' }}>
              You have unsaved changes. Would you like to save before exiting?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowExitConfirm(false); onClose(); }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Discard
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); handleSaveAndExit(); }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FormSubmissionModal;
