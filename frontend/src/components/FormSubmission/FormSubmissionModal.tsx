/**
 * FormSubmissionModal - Direct Portal Render
 * 
 * Uses ReactDOM.createPortal to render directly to document.body,
 * bypassing any React tree issues that could prevent display.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
}

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

  // Parse steps
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
          label: f.label || f.key.replace(/_/g, ' '),
          type: f.type || 'text',
          required: f.required || false,
          placeholder: f.placeholder,
          help_text: f.help_text,
          options: f.options,
          related_entity_type: f.related_entity_type,
        })),
      }));
  }, [submission?.form_snapshot]);

  const currentStep = steps[currentStepIndex];

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
          } catch (e) { console.error(e); }
        }
      }
    };
    if (steps.length > 0) loadOptions();
  }, [steps]);

  const handleChange = useCallback((stepId: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: { ...(prev[stepId] || {}), [key]: value },
    }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await formSubmissionService.submit(submission.id);
      notify.success('Form submitted!');
      setTimeout(onClose, 500);
    } catch (err: any) {
      notify.handleApiError(err, 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }, [submission.id, onClose]);

  const renderField = (field: FieldData, stepId: string) => {
    const value = formData[stepId]?.[field.key] ?? '';
    const cls = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
    
    let opts: { value: string; label: string }[] = [];
    if (field.related_entity_type && entityOptions[field.related_entity_type]) {
      opts = entityOptions[field.related_entity_type];
    } else if (field.options) {
      opts = Array.isArray(field.options) 
        ? (typeof field.options[0] === 'string' 
            ? (field.options as string[]).map(o => ({ value: o, label: o }))
            : field.options as { value: string; label: string }[])
        : [];
    }

    switch (field.type) {
      case 'select':
      case 'lookup':
        return (
          <select value={value} onChange={e => handleChange(stepId, field.key, e.target.value)} required={field.required} className={cls}>
            <option value="">-- Select --</option>
            {opts.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'textarea':
        return <textarea value={value} onChange={e => handleChange(stepId, field.key, e.target.value)} required={field.required} rows={4} className={cls} />;
      case 'checkbox':
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!value} onChange={e => handleChange(stepId, field.key, e.target.checked)} className="w-4 h-4" />
            <span>{field.label}</span>
          </label>
        );
      case 'date':
        return <input type="date" value={value} onChange={e => handleChange(stepId, field.key, e.target.value)} required={field.required} className={cls} />;
      case 'number':
      case 'decimal':
      case 'currency':
        return <input type="number" value={value} onChange={e => handleChange(stepId, field.key, e.target.value)} required={field.required} step={field.type === 'number' ? '1' : '0.01'} className={cls} />;
      default:
        return <input type="text" value={value} onChange={e => handleChange(stepId, field.key, e.target.value)} required={field.required} placeholder={field.placeholder} className={cls} />;
    }
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
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon name={submission?.form_icon || 'clipboard-list'} size={28} />
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{submission?.form_name || 'Form'}</h2>
              {submission?.form_description && <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>{submission.form_description}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        {/* Step indicator */}
        {steps.length > 1 && (
          <div style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {currentStepIndex + 1}
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>{currentStep?.name || `Step ${currentStepIndex + 1}`}</span>
          </div>
        )}

        {/* Step pills */}
        {steps.length > 1 && (
          <div style={{ padding: '12px 24px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: idx === currentStepIndex ? 'none' : '1px solid #d1d5db',
                  backgroundColor: idx === currentStepIndex ? '#2563eb' : idx < currentStepIndex ? '#dcfce7' : 'white',
                  color: idx === currentStepIndex ? 'white' : idx < currentStepIndex ? '#166534' : '#4b5563',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
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
            <form onSubmit={handleSubmit} style={{ maxWidth: '500px', margin: '0 auto' }}>
              {currentStep.fields.map(field => (
                <div key={field.key} style={{ marginBottom: '20px' }}>
                  {field.type !== 'checkbox' && field.type !== 'boolean' && (
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                      {field.label}{field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                    </label>
                  )}
                  {renderField(field, currentStep.id)}
                  {field.help_text && <p style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>{field.help_text}</p>}
                </div>
              ))}
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
                    marginTop: '16px',
                  }}
                >
                  {isSubmitting ? '⏳ Submitting...' : '✓ Submit Form'}
                </button>
              )}
            </form>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#6b7280', backgroundColor: '#e5e7eb', padding: '4px 12px', borderRadius: '999px' }}>
            Step {currentStepIndex + 1} of {steps.length || 1}
          </span>
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStepIndex > 0 && (
              <button onClick={() => setCurrentStepIndex(i => i - 1)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}>
                ← Previous
              </button>
            )}
            {currentStepIndex < steps.length - 1 ? (
              <button onClick={() => setCurrentStepIndex(i => i + 1)} style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer' }}>
                Next →
              </button>
            ) : (
              <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render directly to body, bypassing any React tree issues
  return createPortal(modalContent, document.body);
};

export default FormSubmissionModal;
