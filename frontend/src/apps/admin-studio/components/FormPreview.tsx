/**
 * FormPreview Component
 * 
 * Shows a live preview of what the form will look like based on schema_config.
 * Helps users visualize their field configurations before saving.
 */
import React, { useState } from 'react';
import { message } from 'antd';
import { formatUsPhone } from '@/utils/phone';

interface Field {
  id: string;
  label: string;
  key: string;
  type: string;
  required: boolean;
  options?: string;
}

interface FormPreviewProps {
  fields: Field[];
  onClose: () => void;
}

const FormPreview: React.FC<FormPreviewProps> = ({ fields, onClose }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleChange = (key: string, value: any) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    message.info('Preview mode — form not submitted');
  };

  const renderField = (field: Field) => {
    const optionsArray = field.options
      ? field.options.split(',').map(opt => opt.trim()).filter(Boolean)
      : [];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <input
            type={field.type}
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'phone':
        return (
          <input
            type="tel"
            value={String(formData[field.key] || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onBlur={(e) => handleChange(field.key, formatUsPhone(e.target.value))}
            required={field.required}
            maxLength={14}
            inputMode="tel"
            autoComplete="tel"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
            placeholder={field.label ? `(XXX) XXX-XXXX` : '(XXX) XXX-XXXX'}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
          />
        );

      case 'select':
        return (
          <select
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
          >
            <option value="">-- Select {field.label} --</option>
            {optionsArray.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            rows={4}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData[field.key] || false}
              onChange={(e) => handleChange(field.key, e.target.checked)}
              className="w-4 h-4 rounded focus:ring-blue-500" style={{ color: 'rgb(var(--color-primary))', borderColor: 'rgb(var(--color-border-secondary))' }}
            />
            <label className="ml-2 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {field.label}
            </label>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {optionsArray.map((option, idx) => (
              <div key={idx} className="flex items-center">
                <input
                  type="radio"
                  name={field.key}
                  value={option}
                  checked={formData[field.key] === option}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required={field.required}
                  className="w-4 h-4 focus:ring-blue-500" style={{ color: 'rgb(var(--color-primary))', borderColor: 'rgb(var(--color-border-secondary))' }}
                />
                <label className="ml-2 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {option}
                </label>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style={{ borderColor: 'rgb(var(--color-border-secondary))' }}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-[rgba(var(--color-overlay),0.5)] flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--color-border-primary))', background: 'rgb(var(--color-bg-secondary))' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Form Preview</h2>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
              This is how users will see the form
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:text-[rgb(var(--color-text-secondary))] p-2" style={{ color: 'rgb(var(--color-text-quaternary))' }}
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {fields.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4" style={{ color: 'rgb(var(--color-text-quaternary))' }}>📋</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                No fields to preview
              </h3>
              <p style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                Add some fields in the Schema Editor to see the preview
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    {field.label}
                    {field.required && (
                      <span className="ml-1" style={{ color: 'rgb(var(--color-error))' }}>*</span>
                    )}
                  </label>
                  {renderField(field)}
                  {field.type === 'select' && field.options && (
                    <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                      Options: {field.options}
                    </p>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t" style={{ borderColor: 'rgb(var(--color-border-primary))' }}>
                <button
                  type="submit"
                  className="w-full px-4 py-3 text-[rgb(var(--color-text-inverse))] font-medium rounded-md hover:bg-[rgb(var(--color-primary-hover))] transition-colors" style={{ background: 'rgb(var(--color-primary))' }}
                >
                  Submit (Preview Only)
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'rgb(var(--color-border-primary))', background: 'rgb(var(--color-bg-secondary))' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-[rgb(var(--color-bg-secondary))]" style={{ color: 'rgb(var(--color-text-secondary))', background: 'rgb(var(--color-bg-primary))', borderColor: 'rgb(var(--color-border-secondary))' }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormPreview;
