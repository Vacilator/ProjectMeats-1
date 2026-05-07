/**
 * DynamicFormEngine Component
 * 
 * Renders forms dynamically from JSON schema definitions.
 * Supports 12 field types with validation and data piping.
 * 
 * Wave 4 - Task 4.12: Integrated with ConfigResolver for dynamic settings.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Select as AntSelect } from 'antd';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cloneDeep, isEqual } from 'lodash';
import * as z from 'zod';
import styled from 'styled-components';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import StateSelect from '../../components/ui/StateSelect';
import { CountrySelect } from '../../components/ui';
import { DEFAULT_COUNTRY } from '../../utils/constants/countries';
import { formatUsPhone } from '../../utils/phone';
import { getAntdPopupContainer } from '../../utils/antdPopupContainer';

// Field definition types
type SelectOption = string | { value: string; label: string };
type PreloadedOption = { value: string; label: string; metadata?: Record<string, unknown> };

type FieldUi = {
  widget?: string;
  data_source?: {
    type?: 'choice_list' | 'master_products';
    list?: string;
  };
  option_groups?: Record<string, SelectOption[]>;

  /** Max length for string inputs (aligned with backend max_length). */
  max_length?: number;

  /** Optional section grouping metadata (renders a section header). */
  section?: string | { title: string; description?: string };

  /** Conditional visibility (additive; ignored if not provided). */
  visible_when?: {
    field: string;
    equals?: unknown;
    truthy?: boolean;
  };
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
  dependencies?: string[];
  related_entity?: string | null;

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
  onValuesChange?: (data: Record<string, any>) => void;
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

  /** Preloaded dropdown dictionaries keyed by field key. */
  dropdownOptions?: Record<
    string,
    Array<PreloadedOption>
  >;

  /** Preloaded form config to keep the renderer prop-driven. */
  formConfig?: Partial<DynamicFormConfig>;
}

export interface DynamicFormConfig {
  showRequiredIndicator: boolean;
  showHelpText: boolean;
  validateOnChange: boolean;
  submitButtonText: string;
}

const EMPTY_INITIAL_VALUES: Record<string, unknown> = {};
const EMPTY_OPTIONS: PreloadedOption[] = [];
const DEFAULT_FORM_CONFIG: DynamicFormConfig = {
  showRequiredIndicator: true,
  showHelpText: true,
  validateOnChange: false,
  submitButtonText: 'Submit',
};

function useDeepStableValue<T>(value: T): T {
  const ref = useRef(value);

  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

const getStableSignature = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const splitPath = (path: string): string[] =>
  String(path || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

const getValueAtPath = (obj: unknown, path: string): any => {
  const segments = splitPath(path);
  let current = obj;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const setValueAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = splitPath(path);
  if (!segments.length) return;

  let current: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = current[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
};

const collectErrorPaths = (value: unknown, currentPath = ''): string[] => {
  if (!value || typeof value !== 'object') return [];

  if ('message' in (value as Record<string, unknown>)) {
    return currentPath ? [currentPath] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    return collectErrorPaths(nested, nextPath);
  });
};

const isZodSchema = (value: unknown): value is z.ZodTypeAny =>
  Boolean(value) && typeof (value as z.ZodTypeAny).safeParse === 'function';

const assignSchemaAtPath = (
  tree: Record<string, unknown>,
  path: string,
  schema: z.ZodTypeAny
): void => {
  const segments = splitPath(path);
  if (!segments.length) return;

  let current = tree;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = current[segment];
    if (!next || typeof next !== 'object' || isZodSchema(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = schema;
};

const materializeSchemaTree = (tree: Record<string, unknown>): z.ZodObject<Record<string, z.ZodTypeAny>> => {
  const shape: Record<string, z.ZodTypeAny> = {};
  Object.entries(tree).forEach(([key, value]) => {
    shape[key] = isZodSchema(value)
      ? value
      : materializeSchemaTree(value as Record<string, unknown>);
  });
  return z.object(shape);
};

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

const Input = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: rgb(var(--color-text-primary));
  background-color: rgb(var(--color-surface));
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-danger))' : 'rgb(var(--color-border))'};
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

const TextArea = styled.textarea<{ $hasError?: boolean }>`
  width: 100%;
  min-height: 100px;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: rgb(var(--color-text-primary));
  background-color: rgb(var(--color-surface));
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-danger))' : 'rgb(var(--color-border))'};
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
  const schemaTree: Record<string, unknown> = {};

  const isArrayField = (field: FieldDefinition) =>
    field.ui?.widget === 'tags' || field.ui?.widget === 'multi_select';

  const isStringLikeField = (field: FieldDefinition) =>
    field.type === 'text' ||
    field.type === 'phone' ||
    field.type === 'select' ||
    field.type === 'date' ||
    field.type === 'datetime' ||
    field.type === 'textarea' ||
    field.type === 'email' ||
    field.type === 'url';

  const getMaxLength = (field: FieldDefinition): number | null => {
    const raw = field.ui?.max_length;
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
  };

  const buildScalar = (field: FieldDefinition) => {
    if (isArrayField(field)) {
      return z.array(z.string());
    }

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

    const maxLength = getMaxLength(field);
    if (maxLength && isStringLikeField(field) && typeof s?.max === 'function') {
      s = s.max(maxLength, `Must be ${maxLength} characters or less`);
    }

    // Inline arrays are primarily for nested child entities (e.g. contacts). For required string fields,
    // enforce a non-empty value client-side so we don't create blank child rows.
    if (field.required && isStringLikeField(field) && typeof s?.min === 'function') {
      s = s.min(1, 'Required');
    }

    if (field.required && isArrayField(field) && typeof s?.min === 'function') {
      s = s.min(1, 'Required');
    }

    if (!field.required) {
      s = isArrayField(field) ? s.optional() : s.optional().or(z.literal(''));
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

      assignSchemaAtPath(schemaTree, field.key, fieldSchema);
      return;
    }

    fieldSchema = buildItemFieldSchema(field);
    assignSchemaAtPath(schemaTree, field.key, fieldSchema);
  });

  let next = materializeSchemaTree(schemaTree);

  // US ZIP code conditional validation (when country is USA).
  const hasZip = fields.some((f) => String(f.key).toLowerCase() === 'zip_code');
  const hasCountry = fields.some((f) => String(f.key).toLowerCase() === 'country');

  if (hasZip && hasCountry) {
    next = next.superRefine((data, ctx) => {
      const country = String((data as any)?.country ?? '').trim().toUpperCase();
      const zip = String((data as any)?.zip_code ?? '').trim();

      if (!zip) return;
      const isUs = country === 'USA' || country === 'UNITED STATES' || country === 'UNITED STATES OF AMERICA';
      if (!isUs) return;

      if (!/^\d{5}(-\d{4})?$/.test(zip)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['zip_code'],
          message: 'Invalid US ZIP code',
        });
      }
    });
  }

  // Plant profile: warn/error when proteins_tested includes values not listed in proteins_offered.
  const hasProteinsOffered = fields.some((f) => String(f.key).toLowerCase() === 'proteins_offered');
  const hasProteinsTested = fields.some((f) => String(f.key).toLowerCase() === 'proteins_tested');

  if (hasProteinsOffered && hasProteinsTested) {
    next = next.superRefine((data, ctx) => {
      const offered = Array.isArray((data as any)?.proteins_offered)
        ? ((data as any).proteins_offered as unknown[]).map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      const tested = Array.isArray((data as any)?.proteins_tested)
        ? ((data as any).proteins_tested as unknown[]).map((v) => String(v || '').trim()).filter(Boolean)
        : [];

      if (offered.length === 0 || tested.length === 0) return;

      const offeredSet = new Set(offered.map((v) => v.toLowerCase()));
      const invalid = tested.filter((v) => !offeredSet.has(v.toLowerCase()));
      if (invalid.length === 0) return;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proteins_tested'],
        message: 'This protein type is not listed as offered.',
      });
    });
  }

  return next;
};

export const DynamicFormEngine: React.FC<DynamicFormEngineProps> = ({
  schema,
  initialValues = {},
  onSubmit,
  onValuesChange,
  onCancel,
  isSubmitting = false,
  keyFieldKeys,
  showAllFields,
  onShowAllFieldsChange,
  showAllFieldsToggle = true,
  submitLabel,
  dropdownOptions = {},
  formConfig: preloadedFormConfig,
}) => {
  const stableInitialValues = useDeepStableValue(initialValues || EMPTY_INITIAL_VALUES);
  // Stabilize schema.fields identity when parents rebuild arrays on each render.
  const stableFields = useMemo(() => schema.fields, [schema.fields]);

  const validationSchema = useMemo(() => buildValidationSchema(stableFields), [stableFields]);
  const resolver = useMemo(() => zodResolver(validationSchema), [validationSchema]);

  const [internalShowAllFields, setInternalShowAllFields] = useState(false);
  const effectiveShowAllFields = showAllFields ?? internalShowAllFields;
  const setEffectiveShowAllFields = onShowAllFieldsChange ?? setInternalShowAllFields;

  const formConfig = useMemo<DynamicFormConfig>(
    () => ({
      ...DEFAULT_FORM_CONFIG,
      ...(preloadedFormConfig || {}),
    }),
    [preloadedFormConfig]
  );

  const defaultValues = useMemo(() => {
    const next: Record<string, unknown> = cloneDeep(stableInitialValues || EMPTY_INITIAL_VALUES);
    for (const f of stableFields) {
      const current = getValueAtPath(next, f.key);
      if (String(f.key).toLowerCase() === 'country' && !current) {
        setValueAtPath(next, f.key, DEFAULT_COUNTRY);
      }
      if (f.type === 'inline_form_array' && !Array.isArray(current)) {
        setValueAtPath(next, f.key, []);
      }
      if ((f.ui?.widget === 'tags' || f.ui?.widget === 'multi_select') && !Array.isArray(current)) {
        setValueAtPath(next, f.key, []);
      }
    }
    return next as Record<string, any>;
  }, [stableInitialValues, stableFields]);
  const defaultValuesSignature = useMemo(() => getStableSignature(defaultValues), [defaultValues]);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver,
    defaultValues,
    mode: formConfig.validateOnChange ? 'onChange' : 'onSubmit',
  });

  const lastResetSignatureRef = useRef(defaultValuesSignature);

  useEffect(() => {
    if (lastResetSignatureRef.current === defaultValuesSignature) {
      return;
    }
    lastResetSignatureRef.current = defaultValuesSignature;
    reset(defaultValues);
  }, [defaultValues, defaultValuesSignature, reset]);

  const watchedValues = useWatch({ control });
  const lastValuesSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onValuesChange) {
      lastValuesSignatureRef.current = null;
      return;
    }

    const nextValues =
      watchedValues && typeof watchedValues === 'object' ? cloneDeep(watchedValues) : {};
    const nextSignature = getStableSignature(nextValues);

    if (lastValuesSignatureRef.current === nextSignature) {
      return;
    }

    lastValuesSignatureRef.current = nextSignature;
    onValuesChange(nextValues as Record<string, any>);
  }, [onValuesChange, watchedValues]);

  const dependencyFieldKeys = useMemo(() => {
    const keys = new Set<string>();

    stableFields.forEach((field) => {
      const visibleWhenField = field.ui?.visible_when?.field;
      if (visibleWhenField) {
        keys.add(String(visibleWhenField));
      }

      (field.dependencies || []).forEach((dependency) => {
        keys.add(String(dependency));
      });
    });

    return Array.from(keys);
  }, [stableFields]);
  const watchedDependencyValues = useWatch({
    control,
    name: dependencyFieldKeys as never[],
  });
  const dependencyValues = useMemo<Record<string, unknown>>(() => {
    const watchedArray = Array.isArray(watchedDependencyValues)
      ? watchedDependencyValues
      : dependencyFieldKeys.length === 1
        ? [watchedDependencyValues]
        : [];

    return dependencyFieldKeys.reduce<Record<string, unknown>>((acc, key, index) => {
      acc[key] = watchedArray[index];
      return acc;
    }, {});
  }, [dependencyFieldKeys, watchedDependencyValues]);
  
  const keySet = useMemo(() => {
    const keys = (keyFieldKeys || []).map((k) => String(k).toLowerCase());
    return new Set(keys);
  }, [keyFieldKeys]);

  const hasKeySplit = Boolean(keyFieldKeys && keyFieldKeys.length);

  const keyFields = useMemo(() => {
    if (!hasKeySplit) return stableFields;
    return stableFields.filter((f) => keySet.has(String(f.key).toLowerCase()));
  }, [hasKeySplit, keySet, stableFields]);

  const otherFields = useMemo(() => {
    if (!hasKeySplit) return [] as FieldDefinition[];
    return stableFields.filter((f) => !keySet.has(String(f.key).toLowerCase()));
  }, [hasKeySplit, keySet, stableFields]);

  // Get options for a select field (static or dynamic)
  const getFieldOptions = (field: FieldDefinition): PreloadedOption[] => {
    // Use provided options first
    if (field.options?.length) {
      return field.options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
    }
    return dropdownOptions[field.key] || EMPTY_OPTIONS;
  };

  const getMetadataItems = (
    option: PreloadedOption,
    keys: string[]
  ): string[] => {
    for (const key of keys) {
      const raw = option.metadata?.[key];
      if (Array.isArray(raw)) {
        return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
      }

      if (typeof raw === 'string' && raw.trim()) {
        return [raw.trim()];
      }
    }

    return [];
  };

  const filterOptionsByDependencies = (
    options: PreloadedOption[],
    dependencyItems: string[]
  ): PreloadedOption[] => {
    if (!dependencyItems.length) {
      return options;
    }

    const normalizedDependencies = dependencyItems.map((item) => item.toLowerCase());

    return options.filter((option) => {
      const allowed = getMetadataItems(option, ['protein_types', 'proteinTypes', 'dependency_values']);
      if (!allowed.length) {
        return true;
      }

      return allowed.some((item) => normalizedDependencies.includes(String(item).toLowerCase()));
    });
  };

  const isStateLikeKey = (normalizedKey: string): boolean => {
    if (!normalizedKey) return false;
    if (normalizedKey.includes('zip')) return false;
    if (normalizedKey.includes('state_zip')) return false;
    if (normalizedKey === 'state') return true;
    if (normalizedKey.endsWith('.state')) return true;
    if (normalizedKey.endsWith('_state')) return true;
    if (normalizedKey === 'province') return true;
    if (normalizedKey.endsWith('.province')) return true;
    if (normalizedKey.endsWith('_province')) return true;
    if (normalizedKey.includes('province')) return true;
    if (normalizedKey.includes('.state_')) return true;
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
    const arrayError = getValueAtPath(errors, field.key);

    const renderItemField = (itemField: FieldDefinition, namePath: string, idx: number) => {
      const itemErr = getValueAtPath(errors, namePath);
      const hasItemError = Boolean(itemErr);
      const dependencyItems = (itemField.dependencies || []).flatMap((dependencyKey) => {
        const dependencyValue = getValueAtPath(watchedValues, `${field.key}.${idx}.${dependencyKey}`);
        if (Array.isArray(dependencyValue)) {
          return dependencyValue.map((item) => String(item ?? '').trim()).filter(Boolean);
        }
        const single = String(dependencyValue ?? '').trim();
        return single ? [single] : [];
      });

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

      if (itemField.ui?.data_source?.type === 'master_products') {
        const resolvedProductOptions = filterOptionsByDependencies(
          dropdownOptions[itemField.key] || EMPTY_OPTIONS,
          dependencyItems
        );
        const disableProductSelect =
          isSubmitting || ((itemField.dependencies || []).length > 0 && dependencyItems.length === 0);

        return (
          <FieldGroup key={namePath} style={{ marginBottom: 12 }}>
            <Label required={formConfig.showRequiredIndicator && itemField.required}>{itemField.label}</Label>
            <Controller
              name={namePath as never}
              control={control}
              render={({ field: controllerField }) => (
                <AntSelect
                  showSearch
                  value={controllerField.value || undefined}
                  onChange={controllerField.onChange}
                  options={resolvedProductOptions}
                  placeholder={itemField.placeholder || 'Search products'}
                  disabled={disableProductSelect}
                  allowClear
                  optionFilterProp="label"
                  getPopupContainer={getAntdPopupContainer}
                  style={{ width: '100%' }}
                />
              )}
            />
            {hasItemError && <ErrorText>{String((itemErr as any)?.message || 'Invalid value')}</ErrorText>}
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
            $hasError={hasItemError}
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

  const MultiSelectField: React.FC<{
    field: FieldDefinition;
    showRequired: boolean;
    errorMessage?: string;
    options: PreloadedOption[];
    cascading?: boolean;
    dependencyValue?: unknown;
  }> = ({ field, showRequired, errorMessage, options, cascading = false, dependencyValue }) => {
    const currentValue = useWatch({ control, name: field.key }) as string[] | undefined;

    const dependencyItems = useMemo(() => {
      if (Array.isArray(dependencyValue)) {
        return dependencyValue.map((item) => String(item ?? '').trim()).filter(Boolean);
      }

      if (typeof dependencyValue === 'string') {
        return [String(dependencyValue).trim()].filter(Boolean);
      }

      return [] as string[];
    }, [dependencyValue]);

    const hasDependencies = (field.dependencies || []).length > 0;
    const resolvedOptions = useMemo(
      () => (cascading ? filterOptionsByDependencies(options, dependencyItems) : options),
      [cascading, dependencyItems, options]
    );
    const disabled = isSubmitting || (cascading && hasDependencies && dependencyItems.length === 0);

    useEffect(() => {
      if (field.ui?.widget === 'tags') return;
      if (resolvedOptions.length === 0) return;
      if (!Array.isArray(currentValue) || currentValue.length === 0) return;

      const allowedValues = new Set(resolvedOptions.map((item) => String(item.value)));
      const nextValue = currentValue.filter((item) => allowedValues.has(String(item)));
      const hasSameValues =
        nextValue.length === currentValue.length &&
        nextValue.every((item, index) => String(item) === String(currentValue[index]));

      if (!hasSameValues) {
        setValue(field.key as never, nextValue as never, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }, [currentValue, field.key, field.ui?.widget, resolvedOptions, setValue]);

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
              id={field.key}
              mode={field.ui?.widget === 'tags' ? 'tags' : 'multiple'}
              value={Array.isArray(controllerField.value) ? controllerField.value : []}
              onChange={controllerField.onChange}
              options={resolvedOptions}
              placeholder={field.placeholder || 'Select one or more options'}
              disabled={disabled}
              allowClear
              optionFilterProp="label"
              getPopupContainer={getAntdPopupContainer}
              style={{ width: '100%' }}
            />
          )}
        />
        {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
        {errorMessage && <ErrorText>{errorMessage}</ErrorText>}
      </FieldGroup>
    );
  };

  const seenSections = new Set<string>();

  const isFieldVisible = React.useCallback((field: FieldDefinition): boolean => {
    const rule = field.ui?.visible_when;
    if (!rule?.field) return true;

    const raw = dependencyValues[rule.field];

    if (typeof rule.equals !== 'undefined') {
      return raw === rule.equals;
    }

    if (rule.truthy) {
      if (Array.isArray(raw)) return raw.length > 0;
      return Boolean(raw);
    }

    return Boolean(raw);
  }, [dependencyValues]);

  // When a field becomes hidden, clear its value to avoid submitting stale data.
  // This is critical for conditional fields like Plant.export_documents_handled.
  useEffect(() => {
    const currentValues = getValues() as Record<string, unknown>;

    for (const field of stableFields) {
      if (!field.ui?.visible_when?.field) continue;

      if (isFieldVisible(field)) continue;

      const current = getValueAtPath(currentValues, field.key);
      const hasValue =
        Array.isArray(current)
          ? current.length > 0
          : typeof current === 'string'
            ? current.trim().length > 0
            : Boolean(current);

      if (!hasValue) continue;

      const shouldClearToEmptyArray =
        field.type === 'inline_form_array' ||
        field.ui?.widget === 'multi_select' ||
        field.ui?.widget === 'tags';

      setValue(field.key as never, (shouldClearToEmptyArray ? [] : '') as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [getValues, isFieldVisible, setValue, stableFields]);

  const renderField = (field: FieldDefinition) => {
    if (!isFieldVisible(field)) return null;

    const error = getValueAtPath(errors, field.key);
    const hasError = !!error;
    // Use config for required indicator (Wave 4 - Task 4.12)
    const showRequired = formConfig.showRequiredIndicator && Boolean(field.required);
    const dependencyFieldValues = (field.dependencies || []).map(
      (dependencyKey) => dependencyValues[dependencyKey]
    );
    const primaryDependencyValue = dependencyFieldValues[0];
    const dependencyLookupKey =
      typeof primaryDependencyValue === 'string'
        ? primaryDependencyValue
        : String(primaryDependencyValue || '');
    const conditionalOptions =
      field.ui?.option_groups?.[dependencyLookupKey] ||
      field.ui?.option_groups?.[dependencyLookupKey.toLowerCase()] ||
      field.ui?.option_groups?.default;
    const resolvedOptions = conditionalOptions?.length
      ? conditionalOptions.map((option) =>
          typeof option === 'string' ? { value: option, label: option } : option
        )
      : getFieldOptions(field);

    const section = field.ui?.section;
    const sectionTitle = typeof section === 'string' ? section : section?.title;
    if (sectionTitle) seenSections.add(String(sectionTitle));

    if (field.type === 'inline_form_array') {
      return <InlineFormArrayField key={field.key} field={field} showRequired={showRequired} />;
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
                  options={resolvedOptions}
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
              $hasError={hasError}
              disabled={isSubmitting}
            />
            {formConfig.showHelpText && field.help_text && <HelpText>{field.help_text}</HelpText>}
            {error && <ErrorText>{error.message as string}</ErrorText>}
          </FieldGroup>
        );

      case 'select':
        if (field.ui?.widget === 'multi_select' || field.ui?.widget === 'tags') {
          return (
            <MultiSelectField
              field={field}
              showRequired={showRequired}
              errorMessage={error?.message as string | undefined}
              options={resolvedOptions}
              cascading={field.ui?.data_source?.type === 'master_products'}
              dependencyValue={primaryDependencyValue}
            />
          );
        }

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
                  options={resolvedOptions}
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
                  $hasError={hasError}
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
              $hasError={hasError}
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
    const errorKeys = collectErrorPaths(errs || {});
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

      {(hasKeySplit ? keyFields : stableFields).map((field) => renderField(field))}

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
