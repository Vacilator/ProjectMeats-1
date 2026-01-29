/**
 * FormSubmissionModal - Clean rebuild based on FormPreview
 * 
 * A simple, functional form viewer that matches the Django admin preview modal
 * styling while being fully functional for form submission.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FormSubmission,
  formSubmissionService,
  entityOptionsService,
} from '../../services/quickActionsService';
import { notify } from '../../utils/notify';
import { Icon } from '../ui';

// ============================================================================
// Types
// ============================================================================

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
  min?: number;
  max?: number;
  rows?: number;
}

// ============================================================================
// Component
// ============================================================================

const FormSubmissionModal: React.FC<FormSubmissionModalProps> = ({
  submission: initialSubmission,
  isOpen,
  onClose,
  onSubmissionUpdate,
}) => {
  // Core state
  const [submission, setSubmission] = useState<FormSubmission>(initialSubmission);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Entity options cache for lookups
  const [entityOptions, setEntityOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  // Debug: Log every render
  console.log('[FormSubmissionModal] Render - isOpen:', isOpen, 'submissionId:', submission?.id);

  // Debug logging for form_snapshot
  useEffect(() => {
    console.log('[FormSubmissionModal] Submission received:', submission?.id);
    console.log('[FormSubmissionModal] Form snapshot:', submission?.form_snapshot);
    console.log('[FormSubmissionModal] Form name:', submission?.form_name);
    console.log('[FormSubmissionModal] Steps count:', submission?.form_snapshot?.steps?.length);
    if (submission?.form_snapshot && (!submission.form_snapshot.steps || submission.form_snapshot.steps.length === 0)) {
      console.warn('[FormSubmissionModal] Form has no steps configured');
      setLoadError('This form has no steps configured. Please contact your administrator.');
    } else {
      setLoadError(null);
    }
  }, [submission]);

  // Parse steps from form snapshot
  const steps: StepData[] = useMemo(() => {
    const snapshot = submission.form_snapshot;
    if (!snapshot?.steps) return [];
    
    return snapshot.steps
      .sort((a: any, b: any) => a.order - b.order)
      .map((step: any) => ({
        id: step.id,
        name: step.name,
        order: step.order,
        entity_type: step.entity_type,
        fields: (step.fields || []).map((f: any) => ({
          key: f.key,
          label: f.label || f.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          type: f.type || 'text',
          required: f.required || false,
          placeholder: f.placeholder,
          help_text: f.help_text,
          options: f.options,
          related_entity_type: f.related_entity_type,
          min: f.min,
          max: f.max,
          rows: f.rows,
        })),
      }));
  }, [submission.form_snapshot]);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const hasPrevStep = currentStepIndex > 0;
  const hasNextStep = currentStepIndex < steps.length - 1;

  // Initialize form data from submission
  useEffect(() => {
    if (submission.data) {
      const initialData: Record<string, Record<string, any>> = {};
      steps.forEach(step => {
        initialData[step.id] = submission.data?.[step.id] || {};
      });
      setFormData(initialData);
    }
  }, [submission.data, steps]);

  // Load entity options for lookup fields
  useEffect(() => {
    const loadOptions = async () => {
      const entityTypes = new Set<string>();
      steps.forEach(step => {
        step.fields.forEach(field => {
          if (field.related_entity_type) {
            entityTypes.add(field.related_entity_type);
          }
        });
      });

      for (const entityType of entityTypes) {
        if (!entityOptions[entityType]) {
          try {
            const response = await entityOptionsService.getOptions(entityType);
            setEntityOptions(prev => ({
              ...prev,
              [entityType]: response.options || [],
            }));
          } catch (err) {
            console.error(`Failed to load options for ${entityType}:`, err);
          }
        }
      }
    };
    
    if (steps.length > 0) {
      loadOptions();
    }
  }, [steps, entityOptions]);

  // Handle field value change
  const handleChange = useCallback((stepId: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [key]: value,
      },
    }));
  }, []);

  // Handle field blur - auto-save
  const handleBlur = useCallback(async (stepId: string, key: string) => {
    const value = formData[stepId]?.[key];
    if (value === undefined) return;

    setSavingField(`${stepId}.${key}`);
    try {
      await formSubmissionService.autoSave(submission.id, stepId, key, value);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setSavingField(null);
    }
  }, [formData, submission.id]);

  // Navigate to step
  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  }, [steps.length]);

  // Submit form
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await formSubmissionService.submit(submission.id);
      const updatedSubmission = {
        ...submission,
        status: 'completed' as const,
        completed_at: result.completed_at,
      };
      setSubmission(updatedSubmission);
      onSubmissionUpdate?.(updatedSubmission);
      notify.success('Form submitted successfully!');
      setTimeout(onClose, 1000);
    } catch (err: any) {
      console.error('Submit failed:', err);
      if (err.response?.data?.incomplete_steps) {
        const confirmForce = window.confirm('Some steps are incomplete. Submit anyway?');
        if (confirmForce) {
          await formSubmissionService.submit(submission.id, true);
          notify.success('Form submitted successfully!');
          onClose();
        }
      } else {
        notify.handleApiError(err, 'Failed to submit form');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [submission, onSubmissionUpdate, onClose]);

  // Render a single field
  const renderField = (field: FieldData, stepId: string) => {
    const value = formData[stepId]?.[field.key];
    const isSaving = savingField === `${stepId}.${field.key}`;
    
    // Get options for select/lookup fields
    let options: { value: string; label: string }[] = [];
    if (field.related_entity_type && entityOptions[field.related_entity_type]) {
      options = entityOptions[field.related_entity_type];
    } else if (field.options) {
      if (typeof field.options[0] === 'string') {
        options = (field.options as string[]).map(opt => ({ value: opt, label: opt }));
      } else {
        options = field.options as { value: string; label: string }[];
      }
    }

    const baseInputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.type === 'phone' ? 'tel' : field.type}
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            required={field.required}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseInputClass}
          />
        );

      case 'number':
      case 'decimal':
      case 'currency':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            required={field.required}
            min={field.min}
            max={field.max}
            step={field.type === 'currency' ? '0.01' : field.type === 'decimal' ? '0.01' : '1'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseInputClass}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            required={field.required}
            className={baseInputClass}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            required={field.required}
            className={baseInputClass}
          />
        );

      case 'select':
      case 'lookup':
        return (
          <select
            value={value || ''}
            onChange={(e) => {
              handleChange(stepId, field.key, e.target.value);
              handleBlur(stepId, field.key);
            }}
            required={field.required}
            className={baseInputClass}
          >
            <option value="">-- Select {field.label} --</option>
            {options.map((opt, idx) => (
              <option key={idx} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            required={field.required}
            rows={field.rows || 4}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseInputClass + " resize-y"}
          />
        );

      case 'checkbox':
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => {
                handleChange(stepId, field.key, e.target.checked);
                handleBlur(stepId, field.key);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">{field.label}</span>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center">
                <input
                  type="radio"
                  name={`${stepId}_${field.key}`}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => {
                    handleChange(stepId, field.key, e.target.value);
                    handleBlur(stepId, field.key);
                  }}
                  required={field.required}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">{opt.label}</label>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            onBlur={() => handleBlur(stepId, field.key)}
            required={field.required}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseInputClass}
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 1100 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="text-2xl flex items-center justify-center">
              <Icon name={submission.form_icon || 'clipboard-list'} size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{submission.form_name}</h2>
              {submission.form_description && (
                <p className="text-sm text-gray-500 mt-0.5">{submission.form_description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator (if multiple steps) */}
        {steps.length > 1 && (
          <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/25 text-white font-bold border-2 border-white/50">
              {currentStepIndex + 1}
            </div>
            <span className="text-lg font-semibold text-white">
              {currentStep?.name || `Step ${currentStepIndex + 1}`}
            </span>
          </div>
        )}

        {/* Step Navigation Pills */}
        {steps.length > 1 && (
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
            <div className="flex justify-center gap-2 flex-wrap">
              {steps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;
                
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(idx)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : isCompleted 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
                      }
                    `}
                  >
                    <span className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${isActive 
                        ? 'bg-white/30 text-white' 
                        : isCompleted 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }
                    `}>
                      {isCompleted ? '✓' : idx + 1}
                    </span>
                    <span className="hidden sm:inline">{step.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {/* Navigation Arrows */}
          {hasPrevStep && (
            <button
              type="button"
              onClick={() => goToStep(currentStepIndex - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-bold z-10 transition-all hover:scale-110"
              title="Previous Step"
            >
              ←
            </button>
          )}
          {hasNextStep && (
            <button
              type="button"
              onClick={() => goToStep(currentStepIndex + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-bold z-10 transition-all hover:scale-110"
              title="Next Step"
            >
              →
            </button>
          )}

          {currentStep ? (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
              {currentStep.fields.map((field) => (
                <div key={field.key}>
                  {field.type !== 'checkbox' && field.type !== 'boolean' && (
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(field, currentStep.id)}
                  {field.help_text && (
                    <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
                  )}
                </div>
              ))}

              {/* Submit button only on last step */}
              {isLastStep && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        ✓ Submit Form
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {loadError ? 'Configuration Error' : 'No steps configured'}
              </h3>
              <p className="text-gray-500">
                {loadError || 'This form has no steps to display. Please configure steps in the admin panel.'}
              </p>
              {loadError && (
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                💾 Saved at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {savingField && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <span className="animate-spin">⏳</span> Saving...
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Step Counter */}
            {steps.length > 1 && (
              <span className="text-sm text-gray-500 px-3 py-1 bg-gray-200 rounded-full">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            )}
            
            {/* Navigation Buttons */}
            {hasPrevStep && (
              <button
                type="button"
                onClick={() => goToStep(currentStepIndex - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ← Previous
              </button>
            )}
            
            {hasNextStep ? (
              <button
                type="button"
                onClick={() => goToStep(currentStepIndex + 1)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSubmissionModal;
