/**
 * FormField Component
 *
 * Renders form fields based on field type with auto-save on blur.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { formatUsPhone } from '@/utils/phone';

export interface FieldConfig {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  autoPopulateSource?: string;
  validationRules?: Record<string, any>;
  related_entity_type?: string;  // For ForeignKey fields - used to fetch options dynamically
  related_model?: { app: string; model: string; label: string };
}

interface FormFieldProps {
  field: FieldConfig;
  value: any;
  onChange: (value: any) => void;
  onBlur: () => void;
  disabled?: boolean;
  error?: string;
  isSaving?: boolean;
  onCreateEntity?: (entityType: string) => void;  // Callback when user wants to create entity
}

const FieldContainer = styled.div`
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-color, rgb(var(--color-border)));

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const FieldIcon = styled.span`
  font-size: 1rem;
`;

const Label = styled.label<{ required?: boolean }>`
  flex: 1;
  font-weight: 500;
  color: var(--text-primary, rgb(var(--color-text-primary)));
  font-size: 0.875rem;

  ${({ required }) => required && `
    &::after {
      content: ' *';
      color: var(--color-error, rgb(var(--color-error)));
    }
  `}
`;

const FieldTypeBadge = styled.span`
  padding: 0.125rem 0.5rem;
  background: var(--bg-secondary, rgb(var(--color-surface)));
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
  text-transform: uppercase;
`;

const HelpText = styled.span`
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
  margin-top: 0.25rem;
`;

const ErrorText = styled.span`
  display: block;
  font-size: 0.75rem;
  color: var(--color-error, rgb(var(--color-error)));
  margin-top: 0.25rem;
`;

const SavingIndicator = styled.span`
  font-size: 0.75rem;
  color: var(--color-info, rgb(var(--color-info)));
  margin-left: 0.5rem;
`;

const inputStyles = `
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary, rgb(var(--color-text-primary)));
  background-color: var(--input-bg, rgb(var(--color-surface)));
  border: 1px solid var(--border-color, rgb(var(--color-border)));
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:focus {
    outline: none;
    border-color: var(--color-primary, rgb(var(--color-primary)));
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
  }

  &:disabled {
    background-color: var(--input-disabled-bg, rgb(var(--color-border)));
    cursor: not-allowed;
  }

  &.error {
    border-color: var(--color-error, rgb(var(--color-error)));
  }
`;

const Input = styled.input`${inputStyles}`;

const Select = styled.select`
  ${inputStyles}
  cursor: pointer;
`;

const Textarea = styled.textarea`
  ${inputStyles}
  resize: vertical;
  min-height: 80px;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Checkbox = styled.input`
  width: 1.125rem;
  height: 1.125rem;
  cursor: pointer;
`;

const CheckboxLabel = styled.label<{ required?: boolean }>`
  font-weight: 500;
  color: var(--text-primary, rgb(var(--color-text-primary)));
  cursor: pointer;

  ${({ required }) => required && `
    &::after {
      content: ' *';
      color: var(--color-error, rgb(var(--color-error)));
    }
  `}
`;

const MultiSelectContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--input-bg, rgb(var(--color-surface)));
  border: 1px solid var(--border-color, rgb(var(--color-border)));
  border-radius: 0.375rem;
  min-height: 2.5rem;
`;

const MultiSelectOption = styled.label<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: ${({ selected }) => selected ? 'var(--color-primary-light, rgba(var(--color-primary), 0.14))' : 'var(--bg-secondary, rgb(var(--color-surface)))'};
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.8125rem;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--color-primary-light, rgba(var(--color-primary), 0.14));
  }
`;

// Empty state container for select fields with no options
const EmptyOptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-secondary, rgb(var(--color-surface)));
  border: 1px dashed var(--border-color, rgb(var(--color-border)));
  border-radius: 0.375rem;
  text-align: center;
`;

const EmptyOptionsText = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
`;

const CreateEntityButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-surface));
  background: var(--color-primary, rgb(var(--color-primary)));
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--color-primary-hover, rgb(var(--color-primary)));
  }

  &:disabled {
    background: var(--text-secondary, rgb(var(--color-text-muted)));
    cursor: not-allowed;
  }
`;

// Helper function to get field type icons (matching admin preview)
const getFieldTypeIcon = (fieldType: string): string => {
  const icons: Record<string, string> = {
    text: '📝',
    textarea: '📄',
    number: '#️⃣',
    decimal: '🔢',
    currency: '💵',
    email: '📧',
    phone: '📞',
    url: '🔗',
    date: '📅',
    datetime: '🕐',
    time: '⏰',
    select: '📋',
    dropdown: '📋',
    multiselect: '☑️',
    checkbox: '✅',
    boolean: '✅',
    foreignkey: '🔗',
  };
  return icons[fieldType] || '📝';
};

const FormField: React.FC<FormFieldProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  isSaving = false,
  onCreateEntity,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local value with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((newValue: any) => {
    setLocalValue(newValue);

    // Debounce onChange for text inputs
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    // Clear debounce and trigger immediate save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onChange(localValue);
    onBlur();
  }, [localValue, onChange, onBlur]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    onChange(checked);
    onBlur();
  }, [onChange, onBlur]);

  const handleMultiSelectChange = useCallback((optionValue: string, checked: boolean) => {
    const currentValues = Array.isArray(localValue) ? localValue : [];
    let newValues: string[];

    if (checked) {
      newValues = [...currentValues, optionValue];
    } else {
      newValues = currentValues.filter((v: string) => v !== optionValue);
    }

    setLocalValue(newValues);
    onChange(newValues);
    onBlur();
  }, [localValue, onChange, onBlur]);

  const renderField = () => {
    const commonProps = {
      id: field.key,
      disabled,
      className: error ? 'error' : '',
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <Input
            {...commonProps}
            type={field.type}
            value={localValue || ''}
            placeholder={field.placeholder}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
          />
        );

      case 'phone':
        return (
          <Input
            {...commonProps}
            type="tel"
            inputMode="tel"
            maxLength={14}
            autoComplete="tel"
            value={String(localValue || '')}
            placeholder={field.placeholder || '(XXX) XXX-XXXX'}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={(e) => {
              const formatted = formatUsPhone(e.target.value);
              setLocalValue(formatted);

              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
              }

              onChange(formatted);
              onBlur();
            }}
          />
        );

      case 'number':
      case 'decimal':
      case 'currency':
        return (
          <Input
            {...commonProps}
            type="number"
            value={localValue ?? ''}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.type === 'decimal' || field.type === 'currency' ? '0.01' : field.step || 1}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
            onBlur={handleBlur}
          />
        );

      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
          />
        );

      case 'datetime':
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
          />
        );

      case 'time':
        return (
          <Input
            {...commonProps}
            type="time"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
          />
        );

      case 'select':
      case 'dropdown':
        // Check if options are empty and this is a related entity field
        const hasOptions = field.options && field.options.length > 0;
        const canCreate = field.related_entity_type && onCreateEntity;
        const entityLabel = field.related_model?.label || field.related_entity_type?.replace('_', ' ') || field.label;

        if (!hasOptions && canCreate) {
          return (
            <EmptyOptionsContainer>
              <EmptyOptionsText>
                No {entityLabel.toLowerCase()}s found.
              </EmptyOptionsText>
              <CreateEntityButton
                type="button"
                onClick={() => onCreateEntity(field.related_entity_type!)}
                disabled={disabled}
              >
                ➕ Create {entityLabel}
              </CreateEntityButton>
            </EmptyOptionsContainer>
          );
        }

        return (
          <Select
            {...commonProps}
            value={localValue || ''}
            onChange={(e) => {
              handleChange(e.target.value);
              onBlur();
            }}
          >
            <option value="">-- Select {field.label} --</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      case 'multiselect':
        return (
          <MultiSelectContainer>
            {field.options?.map((option) => {
              const isSelected = Array.isArray(localValue) && localValue.includes(option.value);
              return (
                <MultiSelectOption key={option.value} selected={isSelected}>
                  <Checkbox
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleMultiSelectChange(option.value, e.target.checked)}
                    disabled={disabled}
                  />
                  {option.label}
                </MultiSelectOption>
              );
            })}
          </MultiSelectContainer>
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={localValue || ''}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
          />
        );

      case 'checkbox':
      case 'boolean':
        return (
          <CheckboxContainer>
            <Checkbox
              {...commonProps}
              type="checkbox"
              checked={Boolean(localValue)}
              onChange={handleCheckboxChange}
            />
            <CheckboxLabel required={field.required} htmlFor={field.key}>
              {field.label}
            </CheckboxLabel>
          </CheckboxContainer>
        );

      default:
        return (
          <Input
            {...commonProps}
            type="text"
            value={localValue || ''}
            placeholder={field.placeholder}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
          />
        );
    }
  };

  // For checkbox/boolean, label is rendered inline
  if (field.type === 'checkbox' || field.type === 'boolean') {
    return (
      <FieldContainer>
        <FieldHeader>
          <FieldIcon>{getFieldTypeIcon(field.type)}</FieldIcon>
          <Label required={field.required} htmlFor={field.key}>
            {field.label}
            {isSaving && <SavingIndicator>Saving...</SavingIndicator>}
          </Label>
          <FieldTypeBadge>{field.type}</FieldTypeBadge>
        </FieldHeader>
        {renderField()}
        {error && <ErrorText>{error}</ErrorText>}
        {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
      </FieldContainer>
    );
  }

  return (
    <FieldContainer>
      <FieldHeader>
        <FieldIcon>{getFieldTypeIcon(field.type)}</FieldIcon>
        <Label required={field.required} htmlFor={field.key}>
          {field.label}
          {isSaving && <SavingIndicator>Saving...</SavingIndicator>}
        </Label>
        <FieldTypeBadge>{field.type}</FieldTypeBadge>
      </FieldHeader>
      {renderField()}
      {error && <ErrorText>{error}</ErrorText>}
      {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
    </FieldContainer>
  );
};

export default FormField;
