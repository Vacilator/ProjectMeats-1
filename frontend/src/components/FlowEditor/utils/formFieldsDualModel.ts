import type { FormField, FieldType, ValidationRule } from '@/components/form-builder/types';
import type { SelectedField } from '../ConfigPanel/EntityFieldPicker';

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFieldType(value: unknown): value is FieldType {
  return (
    value === 'text' ||
    value === 'textarea' ||
    value === 'number' ||
    value === 'email' ||
    value === 'phone' ||
    value === 'date' ||
    value === 'datetime' ||
    value === 'select' ||
    value === 'multiSelect' ||
    value === 'radio' ||
    value === 'checkbox' ||
    value === 'file' ||
    value === 'signature' ||
    value === 'rating' ||
    value === 'slider'
  );
}

function coerceFieldType(value: unknown): FieldType {
  if (isFieldType(value)) return value;
  const raw = String(value || '').toLowerCase();

  if (raw.includes('email')) return 'email';
  if (raw.includes('phone') || raw.includes('tel')) return 'phone';
  if (raw.includes('datetime')) return 'datetime';
  if (raw === 'date' || raw.includes('date')) return 'date';
  if (raw.includes('number') || raw.includes('int') || raw.includes('float') || raw.includes('decimal')) {
    return 'number';
  }
  if (raw.includes('textarea') || raw.includes('longtext')) return 'textarea';
  if (raw.includes('multi') && raw.includes('select')) return 'multiSelect';
  if (raw.includes('select') || raw.includes('choice')) return 'select';
  if (raw.includes('radio')) return 'radio';
  if (raw.includes('checkbox') || raw.includes('bool')) return 'checkbox';
  if (raw.includes('file')) return 'file';
  if (raw.includes('signature')) return 'signature';
  if (raw.includes('rating')) return 'rating';
  if (raw.includes('slider')) return 'slider';

  return 'text';
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return Boolean(value);
}

function coerceValidation(value: unknown): ValidationRule[] {
  return Array.isArray(value) ? (value as ValidationRule[]) : [];
}

export function isFormBuilderFieldArray(value: unknown): value is FormField[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => isRecord(v) && typeof v.id === 'string' && typeof v.label === 'string');
}

export function isSelectedFieldArray(value: unknown): value is SelectedField[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => isRecord(v) && (typeof v.name === 'string' || typeof v.fieldId === 'string'));
}

export function toFormFieldsFromSelectedFields(selected: SelectedField[]): FormField[] {
  return (selected || [])
    .filter((f) => isRecord(f))
    .map((f) => {
      const id = String(f.name ?? (f as any).key ?? (f as any).id ?? f.fieldId ?? '').trim();

      return {
        id,
        type: coerceFieldType((f as any).type),
        label: String((f as any).customLabel ?? (f as any).label ?? id),
        placeholder: (f as any).placeholder,
        helpText: (f as any).helpText,
        required: coerceBoolean((f as any).required ?? (f as any).is_required),
        validation: coerceValidation((f as any).validation),
        options: Array.isArray((f as any).options) ? (f as any).options : undefined,
      } satisfies FormField;
    })
    .filter((f) => Boolean(f.id));
}

export function toSelectedFieldsFromFormFields(fields: FormField[]): SelectedField[] {
  return (fields || [])
    .filter((f) => isRecord(f) && typeof f.id === 'string')
    .map((f) => {
      return {
        // EntityField shape (best-effort)
        name: String(f.id),
        label: String(f.label ?? f.id),
        type: String(f.type ?? 'text'),
        required: Boolean(f.required),

        // SelectedField extras
        fieldId: String(f.id),
      } as SelectedField;
    });
}

export function getResolvedFormFields(data: unknown): FormField[] {
  if (!isRecord(data)) return [];

  if (isFormBuilderFieldArray((data as any).formFields)) {
    return (data as any).formFields;
  }

  if (isFormBuilderFieldArray((data as any).fields)) {
    return (data as any).fields;
  }

  if (isSelectedFieldArray((data as any).fields)) {
    return toFormFieldsFromSelectedFields((data as any).fields);
  }

  return [];
}

export function getResolvedSelectedFields(data: unknown): SelectedField[] {
  if (!isRecord(data)) return [];

  if (isSelectedFieldArray((data as any).fields)) {
    return (data as any).fields;
  }

  if (isFormBuilderFieldArray((data as any).formFields)) {
    return toSelectedFieldsFromFormFields((data as any).formFields);
  }

  if (isFormBuilderFieldArray((data as any).fields)) {
    return toSelectedFieldsFromFormFields((data as any).fields);
  }

  return [];
}
