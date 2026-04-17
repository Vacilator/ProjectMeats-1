/**
 * DynamicFormEngine Component
 * 
 * Renders forms dynamically from JSON schema definitions.
 * Supports 12 field types with validation and data piping.
 * 
 * Wave 4 - Task 4.12: Integrated with ConfigResolver for dynamic settings.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Select as AntSelect } from 'antd';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import styled from 'styled-components';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import StateSelect from '../../components/ui/StateSelect';
import { CountrySelect } from '../../components/ui';
import { DEFAULT_COUNTRY } from '../../utils/constants/countries';
import { resolveConfig } from '../../services/configService';
import { getChoicesForField, isStaticChoiceField } from '../../services/choicesService';
import { formatUsPhone } from '../../utils/phone';
import { getAntdPopupContainer } from '../../utils/antdPopupContainer';

// Field definition types
type SelectOption = string | { value: string; label: string };

type FieldUi = {
  widget?: string;
};

interface FieldDefinition {
  key: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'date'
    | 'select'
    | 'email'
    | 'phone'
    | 'url'
    | 'textarea'
    | 'checkbox'
    | 'radio'
    | 'file'
    | 'datetime'
    | 'inline_form_array';
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  help_text?: string;
  ui?: FieldUi;

  // For inline arrays
  item_fields?: FieldDefinition[];
  add_button_label?: string;
  item_label?: string;
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

  const buildScalar = (field: FieldDefinition) => {
    switch (field.type) {
      case 'email':
        return z.string().email('Invalid email address');
      case 'url':
        return z.string().url('Invalid URL');
      case 'number':
        return z.coerce.number();
      case 'checkbox':
        return z.boolean();
      default:
        return z.string();
    }
  };

  const buildItemFieldSchema = (field: FieldDefinition) => {
    if (field.ui?.widget === 'tags') {
      return field.required ? z.array(z.string()) : z.array(z.string()).optional();
    }

    let s: any = buildScalar(field);

    // Inline arrays are primarily for nested child entities (e.g. contacts). For required string fields,
    // enforce a non-empty value client-side so we don't create blank child rows.
    const isStringField =
      field.type === 'text' ||
      field.type === 'phone' ||
      field.type === 'select' ||
      field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'textarea';
    if (field.required && isStringField) {
      s = s.min(1, 'Required');
    }

    if (!field.required) {
      s = s.optional().or(z.literal(''));
    }
    return s;
  };

  fields.forEach((field) => {
    let fieldSchema: any;

    if (field.type === 'inline_form_array') {
      const itemFields = field.item_fields || [];
      const itemShape: Record<string, any> = {};
      itemFields.forEach((f) => {
        itemShape[f.key] = buildItemFieldSchema(f);
      });

      fieldSchema = z.array(z.object(itemShape));
      if (!field.required) {
        fieldSchema = fieldSchema.optional();
      } else {
        fieldSchema = fieldSchema.min(1, 'Please add at least one item');
      }

      schemaShape[field.key] = fieldSchema;
      return;
    }

    fieldSchema = buildScalar(field);
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

  const defaultValues = useMemo(() => {
    const next: Record<string, any> = { ...(initialValues || {}) };
    for (const f of schema.fields) {
      if (String(f.key).toLowerCase() === 'country' && !next[f.key]) {
        next[f.key] = DEFAULT_COUNTRY;
      }
      if (f.type === 'inline_form_array' && !Array.isArray(next[f.key])) {
        next[f.key] = [];
      }
    }
    return next;
  }, [initialValues, schema.fields]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
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

  const isStateLikeKey = (normalizedKey: string): boolean => {
    if (!normalizedKey) return false;
    if (normalizedKey === 'state') return true;
    if (normalizedKey.endsWith('_state')) return true;
    if (normalizedKey === 'province') return true;
    if (normalizedKey.endsWith('_province')) return true;
    if (normalizedKey.includes('province')) return true;
    if (normalizedKey.includes('state')) return true;
    return false;
  };

  const InlineFormArrayField: React.FC<{ field: FieldDefinition; showRequired: boolean }> = ({
    field,
    showRequired,
  }) => {
    const itemFields = field.item_fields || [];
    const { fields: items, append, remove } = useFieldArray({
      control,
      name: field.key as never,
    });

    const arrayError = errors[field.key] as unknown;

    const renderItemField = (itemField: FieldDefinition, namePath: string, idx: number) => {
      const itemErr = (errors as any)?.[field.key]?.[idx]?.[itemField.key];
      const hasItemError = Boolean(itemErr);

      const itemNormalizedKey = String(itemField.key).toLowerCase();
      if (isStateLikeKey(itemNormalizedKey) || itemField.ui?.widget === 'state_select') {
        return (
          <FieldGroup key={namePath} style={{ marginBottom: 12 }}>
            <Label required={formConfig.showRequiredIndicator && itemField.required}>{itemField.label}</Label>
            <Controller
              name={namePath as never}
              control={control}
              render={({ field: controllerField }) => (
                <StateSelect
                  value={String(controllerField.value || '')}
                  onChange={controllerField.onChange}
                  placeholder={itemField.placeholder || 'Search state'}
                  disabled={isSubmitting}
                  aria-label={itemField.label}
                />
              )}
            />
            {hasItemError && <ErrorText>{String(itemErr?.message || 'Invalid value')}</ErrorText>}
          </FieldGroup>
        );
      }

      if (itemField.ui?.widget === 'tags') {
        return (
          <FieldGroup key={namePath} style={{ marginBottom: 12 }}>
            <Label required={formConfig.showRequiredIndicator && itemField.required}>{itemField.label}</Label>
            <Controller
              name={namePath as never}
              control={control}
              render={({ field: controllerField }) => (
                <AntSelect
                  mode="tags"
                  value={Array.isArray(controllerField.value) ? controllerField.value : []}
                  onChange={controllerField.onChange}
                  placeholder={itemField.placeholder || 'Add values'}
                  disabled={isSubmitting}
                  getPopupContainer={getAntdPopupContainer}
                  style={{ width: '100%' }}
                />
              )}
            />
            {hasItemError && <ErrorText>{String(itemErr?.message || 'Invalid value')}</ErrorText>}
          </FieldGroup>
        );
      }

      if (itemField.type === 'select') {
        return (
          <FieldGroup key={namePath} style={{ marginBottom: 12 }}>
            <Label required={formConfig.showRequiredIndicator && itemField.required}>{itemField.label}</Label>
            <Controller
              name={namePath as never}
              control={control}
              render={({ field: controllerField }) => (
                <Select
                  value={controllerField.value || ''}
                  onChange={controllerField.onChange}
                  options={getFieldOptions(itemField)}
                  placeholder={itemField.placeholder || 'Select an option'}
                  disabled={isSubmitting}
                />
              )}
            />
            {hasItemError && <ErrorText>{String(itemErr?.message || 'Invalid value')}</ErrorText>}
          </FieldGroup>
        );
      }

      const inputType =
        itemField.type === 'datetime'
          ? 'datetime-local'
          : itemField.type === 'phone'
            ? 'text'
            : itemField.type;

      return (
        <FieldGroup key={namePath} style={{ marginBottom: 12 }}>
          <Label htmlFor={namePath} required={formConfig.showRequiredIndicator && itemField.required}>
            {itemField.label}
          </Label>
          <Input
            type={inputType}
            id={namePath}
            {...register(namePath as never, {
              onBlur: (e) => {
                if (itemField.type !== 'phone') return;
                const raw = (e?.target as HTMLInputElement | null)?.value ?? '';
                const formatted = formatUsPhone(String(raw));
                setValue(namePath as any, formatted as any, { shouldDirty: true, shouldValidate: true });
              },
            })}
            placeholder={itemField.placeholder}
            hasError={hasItemError}
            disabled={isSubmitting}
          />
          {hasItemError && <ErrorText>{String(itemErr?.message || 'Invalid value')}</ErrorText>}
        </FieldGroup>
      );
    };

    return (
      <FieldGroup key={field.key}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Label required={showRequired}>{field.label}</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({} as any)}
            disabled={isSubmitting}
          >
            + {field.add_button_label || 'Add'}
          </Button>
        </div>

        {items.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
            No entries added yet.
          </div>
        ) : (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid rgb(var(--color-border))',
                  borderRadius: 10,
                  padding: 12,
                  background: 'rgb(var(--color-surface))',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(var(--color-text-primary))' }}>
                    {field.item_label || 'Item'} #{idx + 1}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => remove(idx)}
                    disabled={isSubmitting}
                  >
                    Remove
                  </Button>
                </div>

                <div style={{ marginTop: 12 }}>
                  {itemFields.map((itemField) =>
                    renderItemField(itemField, `${field.key}.${idx}.${itemField.key}`, idx)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
        {Boolean(arrayError) && typeof (arrayError as any)?.message === 'string' && (
          <ErrorText>{String((arrayError as any).message)}</ErrorText>
        )}
      </FieldGroup>
    );
  };

  const renderField = (field: FieldDefinition) => {
    const error = errors[field.key];
    const hasError = !!error;
    // Use config for required indicator (Wave 4 - Task 4.12)
    const showRequired = formConfig.showRequiredIndicator && Boolean(field.required);

    if (field.type === 'inline_form_array') {
      return <InlineFormArrayField field={field} showRequired={showRequired} />;
    }

    if (String(field.key).toLowerCase() === 'country') {
      return (
        <FieldGroup key={field.key}>
          <Label htmlFor={field.key} required={showRequired}>
            {field.label}
          </Label>
          <Controller
            name={field.key}
            control={control}
            render={({ field: controllerField }) => (
              <CountrySelect
                value={String(controllerField.value || DEFAULT_COUNTRY)}
                onChange={controllerField.onChange}
                placeholder={field.placeholder || 'Search country'}
                disabled={isSubmitting}
                aria-label={field.label}
              />
            )}
          />
          {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
          {error && <ErrorText>{error.message as string}</ErrorText>}
        </FieldGroup>
      );
    }

    const normalizedKey = String(field.key).toLowerCase();

    const isStateLikeField = isStateLikeKey(normalizedKey) || field.ui?.widget === 'state_select';
    if (isStateLikeField) {
      return (
        <FieldGroup key={field.key}>
          <Label htmlFor={field.key} required={showRequired}>
            {field.label}
          </Label>
          <Controller
            name={field.key}
            control={control}
            render={({ field: controllerField }) => (
              <StateSelect
                value={String(controllerField.value || '')}
                onChange={controllerField.onChange}
                placeholder={field.placeholder || 'Search state'}
                disabled={isSubmitting}
                aria-label={field.label}
              />
            )}
          />
          {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
          {error && <ErrorText>{error.message as string}</ErrorText>}
        </FieldGroup>
      );
    }

    const isIndustryField = normalizedKey === 'industry' || normalizedKey === 'industry_array';

    if (isIndustryField && field.type === 'select') {
      const options = getFieldOptions(field);
      return (
        <FieldGroup key={field.key}>
          <Label htmlFor={field.key} required={showRequired}>
            {field.label}
          </Label>
          <Controller
            name={field.key}
            control={control}
            render={({ field: controllerField }) => (
              <AntSelect
                value={controllerField.value || undefined}
                onChange={controllerField.onChange}
                options={options}
                placeholder={field.placeholder || 'Search industry'}
                disabled={isSubmitting}
                showSearch
                allowClear
                optionFilterProp="label"
                getPopupContainer={getAntdPopupContainer}
                style={{ width: '100%' }}
                filterOption={(input, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(String(input || '').toLowerCase())
                }
              />
            )}
          />
          {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
          {error && <ErrorText>{error.message as string}</ErrorText>}
        </FieldGroup>
      );
    }

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

      case 'phone':
        return (
          <FieldGroup key={field.key}>
            <Label htmlFor={field.key} required={showRequired}>
              {field.label}
            </Label>
            <Controller
              name={field.key}
              control={control}
              render={({ field: controllerField }) => (
                <Input
                  type="tel"
                  inputMode="tel"
                  id={field.key}
                  value={String(controllerField.value || '')}
                  onChange={(e) => controllerField.onChange(e.target.value)}
                  onBlur={(e) => controllerField.onChange(formatUsPhone(e.target.value))}
                  placeholder={field.placeholder || '(555) 123-4567'}
                  hasError={hasError}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
              )}
            />
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
            {error && <ErrorText>{error.message as string}</ErrorText>}
          </FieldGroup>
        );

      default:
        // text, number, date, email, url, file, datetime
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
