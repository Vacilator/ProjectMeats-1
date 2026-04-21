/**
 * Validation Engine
 * 
 * Validates field values against declarative validation rules.
 * Returns user-friendly error messages.
 * 
 * Created: 2026-02-18
 * Phase: D.2 - Dynamic Panel
 */

import { ValidationRule, ConfigField } from './types';

/**
 * Validate a single field value against its validation rules
 * 
 * @param field - Field configuration with validation rules
 * @param value - Current field value
 * @param allValues - All form values (for cross-field validation)
 * @returns Error message if validation fails, null if valid
 */
export function validateField(
  field: ConfigField,
  value: any,
  allValues: Record<string, any>
): string | null {
  if (!field.validation || field.validation.length === 0) {
    return null;
  }

  // Run all validation rules, return first error
  for (const rule of field.validation) {
    const error = validateRule(rule, value, allValues);
    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Validate a single validation rule
 * 
 * @param rule - Validation rule
 * @param value - Field value
 * @param allValues - All form values
 * @returns Error message if validation fails, null if valid
 */
function validateRule(
  rule: ValidationRule,
  value: any,
  allValues: Record<string, any>
): string | null {
  switch (rule.type) {
    case 'required':
      if (value === null || value === undefined || value === '') {
        return rule.message;
      }
      if (Array.isArray(value) && value.length === 0) {
        return rule.message;
      }
      // Treat empty plain objects as empty (e.g., keyValueMode='record' fields).
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        (value as any).constructor === Object &&
        Object.keys(value as any).length === 0
      ) {
        return rule.message;
      }
      return null;

    case 'minLength':
      if (typeof value === 'string' && value.length < rule.value) {
        return rule.message;
      }
      if (Array.isArray(value) && value.length < rule.value) {
        return rule.message;
      }
      return null;

    case 'maxLength':
      if (typeof value === 'string' && value.length > rule.value) {
        return rule.message;
      }
      if (Array.isArray(value) && value.length > rule.value) {
        return rule.message;
      }
      return null;

    case 'min':
      if (typeof value === 'number' && value < rule.value) {
        return rule.message;
      }
      return null;

    case 'max':
      if (typeof value === 'number' && value > rule.value) {
        return rule.message;
      }
      return null;

    case 'regex':
    case 'pattern':
      if (typeof value === 'string') {
        // Template variables (e.g. {{customer.email}}) cannot be validated reliably client-side.
        // Treat them as valid so panels remain usable.
        if (value.includes('{{') && value.includes('}}')) return null;

        const regex = rule.value instanceof RegExp ? rule.value : new RegExp(rule.value);
        if (!regex.test(value)) {
          return rule.message;
        }
      }
      return null;

    case 'email':
      if (typeof value === 'string') {
        if (value.includes('{{') && value.includes('}}')) return null;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const parts = value
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);

        const allValid = parts.length === 0 ? emailRegex.test(value.trim()) : parts.every((p) => emailRegex.test(p));
        if (!allValid) {
          return rule.message;
        }
      }
      return null;

    case 'url':
      if (typeof value === 'string') {
        if (value.includes('{{') && value.includes('}}')) return null;

        try {
          new URL(value);
          return null;
        } catch {
          return rule.message;
        }
      }
      return null;

    case 'custom':
      if (rule.validator) {
        const isValid = rule.validator(value, allValues);
        return isValid ? null : rule.message;
      }
      return null;

    default:
      console.warn(`Unknown validation rule type: ${rule.type}`);
      return null;
  }
}

/**
 * Validate all fields in form data
 * 
 * @param fields - Array of field configurations
 * @param formData - Current form values
 * @returns Map of field ID to error message (only includes fields with errors)
 */
export function validateAllFields(
  fields: ConfigField[],
  formData: Record<string, any>
): Map<string, string> {
  const errors = new Map<string, string>();

  fields.forEach(field => {
    const value = formData[field.id];
    const error = validateField(field, value, formData);
    if (error) {
      errors.set(field.id, error);
    }
  });

  return errors;
}

/**
 * Check if form data is valid (no validation errors)
 * 
 * @param fields - Array of field configurations
 * @param formData - Current form values
 * @returns True if all fields are valid
 */
export function isFormValid(
  fields: ConfigField[],
  formData: Record<string, any>
): boolean {
  return validateAllFields(fields, formData).size === 0;
}
