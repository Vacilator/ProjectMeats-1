/**
 * DynamicFormEngine Component
 * 
 * Renders forms dynamically from JSON schema definitions.
 * Supports 12 field types with validation and data piping.
 * 
 * Wave 4 - Task 4.12: Integrated with ConfigResolver for dynamic settings.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import styled from 'styled-components';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { resolveConfig } from '../../services/configService';
import { getChoicesForField, isStaticChoiceField } from '../../services/choicesService';

// Field definition types
interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'email' | 'phone' | 'url' | 'textarea' | 'checkbox' | 'radio' | 'file' | 'datetime';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help_text?: string;
}

interface SchemaDefinition {
  step_index: number;
  name: string;
  description?: string;
  fields: FieldDefinition[];
}

interface DynamicFormEngineProps {
  schema: SchemaDefinition;
  initialValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;

  /** Prefer showing these keys first, and collapse the rest behind an expand toggle. */
  keyFieldKeys?: string[];

  /** Controlled show-all-fields state (used when a parent needs to expand multiple sections). */
  showAllFields?: boolean;
  onShowAllFieldsChange?: (next: boolean) => void;

  /** When false, hides the expand/collapse toggle UI (still respects showAllFields). */
  showAllFieldsToggle?: boolean;

  /** Override submit button label (e.g. "Create" vs "Save"). */
  submitLabel?: string;
}

const FormContainer = styled.form`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
`;

const FormHeader = styled.div`
  margin-bottom: 2rem;
`;

const FormTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const FormDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const FieldGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label<{ required?: boolean }>`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
  
  ${props => props.required && `
    &::after {
      content: ' *';
      color: rgb(var(--color-danger));
    }
  `}
`;

const Input = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: rgb(var(--color-text-primary));
  background-color: rgb(var(--color-surface));
  border: 1px solid ${props => props.hasError ? 'rgb(var(--color-danger))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &:disabled {
    background-color: rgb(var(--color-input-readonly));
    cursor: not-allowed;
    opacity: 0.6;
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const TextArea = styled.textarea<{ hasError?: boolean }>`
  width: 100%;
  min-height: 100px;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: rgb(var(--color-text-primary));
  background-color: rgb(var(--color-surface));
  border: 1px solid ${props => props.hasError ? 'rgb(var(--color-danger))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
`;

const HelpText = styled.span`
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const ErrorText = styled.span`
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgb(var(--color-danger));
`;

const FormActions = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgb(var(--color-border));
`;

// Build Zod schema dynamically from field definitions
const buildValidationSchema = (fields: FieldDefinition[]) => {
  const schemaShape: Record<string, any> = {};

  fields.forEach((field) => {
    let fieldSchema: any;

    switch (field.type) {
      case 'email':
        fieldSchema = z.string().email('Invalid email address');
        break;
      case 'url':
        fieldSchema = z.string().url('Invalid URL');
        break;
      case 'number':
        fieldSchema = z.coerce.number();
        break;
      case 'checkbox':
        fieldSchema = z.boolean();
        break;
      default:
        fieldSchema = z.string();
    }

    if (!field.required) {
      fieldSchema = fieldSchema.optional().or(z.literal(''));
    }

    schemaShape[field.key] = fieldSchema;
  });

  return z.object(schemaShape);
};

export const DynamicFormEngine: React.FC<DynamicFormEngineProps> = ({
  schema,
  initialValues = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  keyFieldKeys,
  showAllFields,
  onShowAllFieldsChange,
  showAllFieldsToggle = true,
  submitLabel,
}) => {
  const validationSchema = buildValidationSchema(schema.fields);

  const [internalShowAllFields, setInternalShowAllFields] = useState(false);
  const effectiveShowAllFields = showAllFields ?? internalShowAllFields;
  const setEffectiveShowAllFields = onShowAllFieldsChange ?? setInternalShowAllFields;
  
  // Form-level config from ConfigResolver (Wave 4 - Task 4.12)
  const [formConfig, setFormConfig] = useState({
    showRequiredIndicator: true,
    showHelpText: true,
    validateOnChange: false,
    submitButtonText: 'Submit',
  });
  
  // Dynamic choice options from config system
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  // Load form-level configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [showRequired, showHelp, validateChange, submitText] = await Promise.all([
          resolveConfig<boolean>('forms.show_required_indicator', true),
          resolveConfig<boolean>('forms.show_help_text', true),
          resolveConfig<boolean>('forms.validate_on_change', false),
          resolveConfig<string>('forms.submit_button_text', 'Submit'),
        ]);
        
        setFormConfig({
          showRequiredIndicator: showRequired.value,
          showHelpText: showHelp.value,
          validateOnChange: validateChange.value,
          submitButtonText: submitText.value,
        });
      } catch (error) {
        console.debug('Using default form config');
      }
    };
    
    loadConfig();
  }, []);
  
  // Load dynamic options for select fields
  useEffect(() => {
    const loadOptions = async () => {
      const selectFields = schema.fields.filter(f => f.type === 'select' && !f.options?.length);
      
      for (const field of selectFields) {
        // Try to load from config system
        if (isStaticChoiceField(field.key)) {
          const choices = await getChoicesForField(field.key);
          if (choices) {
            setDynamicOptions(prev => ({ ...prev, [field.key]: choices }));
          }
        }
      }
    };
    
    loadOptions();
  }, [schema.fields]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues: initialValues,
    mode: formConfig.validateOnChange ? 'onChange' : 'onSubmit',
  });
  
  const keySet = useMemo(() => {
    const keys = (keyFieldKeys || []).map((k) => String(k).toLowerCase());
    return new Set(keys);
  }, [keyFieldKeys]);

  const hasKeySplit = Boolean(keyFieldKeys && keyFieldKeys.length);

  const keyFields = useMemo(() => {
    if (!hasKeySplit) return schema.fields;
    return schema.fields.filter((f) => keySet.has(String(f.key).toLowerCase()));
  }, [hasKeySplit, keySet, schema.fields]);

  const otherFields = useMemo(() => {
    if (!hasKeySplit) return [] as FieldDefinition[];
    return schema.fields.filter((f) => !keySet.has(String(f.key).toLowerCase()));
  }, [hasKeySplit, keySet, schema.fields]);

  // Get options for a select field (static or dynamic)
  const getFieldOptions = (field: FieldDefinition): { value: string; label: string }[] => {
    // Use provided options first
    if (field.options?.length) {
      return field.options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
    }
    // Fall back to dynamically loaded options
    return dynamicOptions[field.key] || [];
  };

  const renderField = (field: FieldDefinition) => {
    const error = errors[field.key];
    const hasError = !!error;
    // Use config for required indicator (Wave 4 - Task 4.12)
    const showRequired = formConfig.showRequiredIndicator && field.required;

    switch (field.type) {
      case 'textarea':
        return (
          <FieldGroup key={field.key}>
            <Label htmlFor={field.key} required={showRequired}>
              {field.label}
            </Label>
            <TextArea
              id={field.key}
              {...register(field.key)}
              placeholder={field.placeholder}
              hasError={hasError}
              disabled={isSubmitting}
            />
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
            {error && <ErrorText>{error.message as string}</ErrorText>}
          </FieldGroup>
        );

      case 'select':
        return (
          <FieldGroup key={field.key}>
            <Label htmlFor={field.key} required={showRequired}>
              {field.label}
            </Label>
            <Controller
              name={field.key}
              control={control}
              render={({ field: controllerField }) => (
                <Select
                  id={field.key}
                  value={controllerField.value || ''}
                  onChange={controllerField.onChange}
                  options={getFieldOptions(field)}
                  placeholder={field.placeholder || 'Select an option'}
                  error={error?.message as string}
                  disabled={isSubmitting}
                />
              )}
            />
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
          </FieldGroup>
        );

      case 'checkbox':
        return (
          <FieldGroup key={field.key}>
            <CheckboxLabel>
              <input
                type="checkbox"
                id={field.key}
                {...register(field.key)}
                disabled={isSubmitting}
              />
              {field.label}
            </CheckboxLabel>
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
            {error && <ErrorText>{error.message as string}</ErrorText>}
          </FieldGroup>
        );

      case 'radio':
        return (
          <FieldGroup key={field.key}>
            <Label required={showRequired}>{field.label}</Label>
            <RadioGroup>
              {getFieldOptions(field).map((option) => (
                <RadioLabel key={option.value}>
                  <input
                    type="radio"
                    value={option.value}
                    {...register(field.key)}
                    disabled={isSubmitting}
                  />
                  {option.label}
                </RadioLabel>
              ))}
            </RadioGroup>
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
            {error && <ErrorText>{error.message as string}</ErrorText>}
          </FieldGroup>
        );

      default:
        // text, number, date, email, phone, url, file, datetime
        return (
          <FieldGroup key={field.key}>
            <Label htmlFor={field.key} required={showRequired}>
              {field.label}
            </Label>
            <Input
              type={field.type === 'datetime' ? 'datetime-local' : field.type}
              id={field.key}
              {...register(field.key)}
              placeholder={field.placeholder}
              hasError={hasError}
              disabled={isSubmitting}
            />
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
            {error && <ErrorText>{error.message as string}</ErrorText>}
          </FieldGroup>
        );
    }
  };

  const resolvedSubmitLabel =
    (typeof submitLabel === 'string' && submitLabel.trim()) ||
    (typeof formConfig.submitButtonText === 'string' && formConfig.submitButtonText.trim()) ||
    'Save';

  const onInvalid = (errs: Record<string, any>) => {
    if (!hasKeySplit) return;
    const errorKeys = Object.keys(errs || {});
    const hasHiddenError = errorKeys.some((k) => !keySet.has(String(k).toLowerCase()));
    if (hasHiddenError) {
      setEffectiveShowAllFields(true);
    }
  };

  return (
    <FormContainer onSubmit={handleSubmit(onSubmit, onInvalid)}>
      <FormHeader>
        <FormTitle>{schema.name}</FormTitle>
        {schema.description && <FormDescription>{schema.description}</FormDescription>}
      </FormHeader>

      {(hasKeySplit ? keyFields : schema.fields).map((field) => renderField(field))}

      {hasKeySplit && otherFields.length > 0 && showAllFieldsToggle && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEffectiveShowAllFields(!effectiveShowAllFields)}
            disabled={isSubmitting}
          >
            {effectiveShowAllFields ? 'Hide remaining fields' : 'Show all fields'}
          </Button>
        </div>
      )}

      {hasKeySplit && otherFields.length > 0 && (
        <div style={{ display: effectiveShowAllFields ? 'block' : 'none' }}>
          {otherFields.map((field) => renderField(field))}
        </div>
      )}

      <FormActions>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : resolvedSubmitLabel}
        </Button>
      </FormActions>
    </FormContainer>
  );
};

export default DynamicFormEngine;
