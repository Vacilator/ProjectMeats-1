/**
 * FormPreview Component
 * 
 * Shows a live preview of what the form will look like based on schema_config.
 * Helps users visualize their field configurations before saving.
 */
import React, { useState } from 'react';
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
    alert('Preview mode - form not submitted\n\nData:\n' + JSON.stringify(formData, null, 2));
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'phone':
        return (
          <input
            type="tel"
            value={formatUsPhone(String(formData[field.key] || ''))}
            onChange={(e) => handleChange(field.key, formatUsPhone(e.target.value))}
            required={field.required}
            maxLength={13}
            inputMode="numeric"
            autoComplete="tel"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={field.label ? `(XXX)XXX-XXXX` : '(XXX)XXX-XXXX'}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );

      case 'select':
        return (
          <select
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700">
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
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Form Preview</h2>
            <p className="text-sm text-gray-500 mt-1">
              This is how users will see the form
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {fields.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No fields to preview
              </h3>
              <p className="text-gray-500">
                Add some fields in the Schema Editor to see the preview
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {renderField(field)}
                  {field.type === 'select' && field.options && (
                    <p className="text-xs text-gray-500 mt-1">
                      Options: {field.options}
                    </p>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Submit (Preview Only)
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormPreview;
