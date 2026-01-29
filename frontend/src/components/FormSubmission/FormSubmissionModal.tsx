/**
 * FormSubmissionModal - Simplified Version
 * 
 * A clean, functional form modal that displays form steps and fields
 * similar to the admin FormPreview but with actual submission capability.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  // State
  const [submission] = useState<FormSubmission>(initialSubmission);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entityOptions, setEntityOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  // Parse steps from form snapshot
  const steps: StepData[] = useMemo(() => {
    const snapshot = submission?.form_snapshot;
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
  }, [submission?.form_snapshot]);

  const currentStep = steps[currentStepIndex];

  // Initialize form data
  useEffect(() => {
    if (submission?.data) {
      const initialData: Record<string, Record<string, any>> = {};
      steps.forEach(step => {
        initialData[step.id] = submission.data?.[step.id] || {};
      });
      setFormData(initialData);
    }
  }, [submission?.data, steps]);

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

  // Handle field change
  const handleChange = useCallback((stepId: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [key]: value,
      },
    }));
  }, []);

  // Navigate steps
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
      onSubmissionUpdate?.({
        ...submission,
        status: 'completed' as const,
        completed_at: result.completed_at,
      });
      notify.success('Form submitted successfully!');
      setTimeout(onClose, 1000);
    } catch (err: any) {
      console.error('Submit failed:', err);
      notify.handleApiError(err, 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  }, [submission, onSubmissionUpdate, onClose]);

  // Render field based on type
  const renderField = (field: FieldData, stepId: string) => {
    const value = formData[stepId]?.[field.key];
    
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

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

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
            required={field.required}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputClass}
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
            required={field.required}
            min={field.min}
            max={field.max}
            step={field.type === 'currency' || field.type === 'decimal' ? '0.01' : '1'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputClass}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            required={field.required}
            className={inputClass}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            required={field.required}
            className={inputClass}
          />
        );

      case 'select':
      case 'lookup':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            required={field.required}
            className={inputClass}
          >
            <option value="">-- Select {field.label} --</option>
            {options.map((opt, idx) => (
              <option key={idx} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleChange(stepId, field.key, e.target.value)}
            required={field.required}
            rows={field.rows || 4}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputClass + " resize-y"}
          />
        );

      case 'checkbox':
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleChange(stepId, field.key, e.target.checked)}
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
                  onChange={(e) => handleChange(stepId, field.key, e.target.value)}
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
            required={field.required}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputClass}
          />
        );
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const isLastStep = currentStepIndex === steps.length - 1;
  const hasPrevStep = currentStepIndex > 0;
  const hasNextStep = currentStepIndex < steps.length - 1;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <Icon name={submission?.form_icon || 'clipboard-list'} size={28} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {submission?.form_name || 'Form'}
              </h2>
              {submission?.form_description && (
                <p className="text-sm text-gray-500">{submission.form_description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        {steps.length > 1 && (
          <div className="px-6 py-3 bg-blue-600 flex items-center justify-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/25 text-white font-bold">
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
              {steps.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`
                    px-4 py-2 rounded-md text-sm font-medium transition-all
                    ${idx === currentStepIndex 
                      ? 'bg-blue-600 text-white' 
                      : idx < currentStepIndex
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
                    }
                  `}
                >
                  <span className="mr-2">
                    {idx < currentStepIndex ? '✓' : idx + 1}
                  </span>
                  {step.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {steps.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No steps configured
              </h3>
              <p className="text-gray-500">
                This form has no steps to display. Please configure steps in the admin panel.
              </p>
            </div>
          ) : currentStep ? (
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
                    className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? '⏳ Submitting...' : '✓ Submit Form'}
                  </button>
                </div>
              )}
            </form>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            {steps.length > 1 && (
              <span className="text-sm text-gray-500 px-3 py-1 bg-gray-200 rounded-full">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
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
