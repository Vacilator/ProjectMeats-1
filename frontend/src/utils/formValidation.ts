/**
 * Form Validation Utility
 * 
 * Validates form field values against validation_rules stored in field config.
 * Supports: min_length, max_length, min, max, pattern, email, url, phone, required
 */

import { logger } from './logger';

export interface ValidationRule {
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  email?: boolean;
  url?: boolean;
  phone?: boolean;
  required?: boolean;
  options?: string[];  // For select fields - valid options
  custom?: (value: any) => string | null;  // Custom validator function
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

// Common regex patterns
const PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
};

/**
 * Validate a single field value against its validation rules
 */
export function validateField(
  value: any,
  rules: ValidationRule | undefined,
  fieldLabel: string = 'Field'
): ValidationResult {
  // No rules = always valid
  if (!rules || Object.keys(rules).length === 0) {
    return { isValid: true, error: null };
  }

  const strValue = value === null || value === undefined ? '' : String(value);
  const numValue = typeof value === 'number' ? value : parseFloat(strValue);

  // Required check
  if (rules.required) {
    if (value === null || value === undefined || strValue.trim() === '') {
      return { isValid: false, error: `${fieldLabel} is required` };
    }
  }

  // If value is empty and not required, skip other validations
  if (strValue === '' && !rules.required) {
    return { isValid: true, error: null };
  }

  // Min length
  if (rules.min_length !== undefined && strValue.length < rules.min_length) {
    return {
      isValid: false,
      error: `${fieldLabel} must be at least ${rules.min_length} characters`,
    };
  }

  // Max length
  if (rules.max_length !== undefined && strValue.length > rules.max_length) {
    return {
      isValid: false,
      error: `${fieldLabel} must be no more than ${rules.max_length} characters`,
    };
  }

  // Min value (for numbers)
  if (rules.min !== undefined && !isNaN(numValue) && numValue < rules.min) {
    return {
      isValid: false,
      error: `${fieldLabel} must be at least ${rules.min}`,
    };
  }

  // Max value (for numbers)
  if (rules.max !== undefined && !isNaN(numValue) && numValue > rules.max) {
    return {
      isValid: false,
      error: `${fieldLabel} must be no more than ${rules.max}`,
    };
  }

  // Email format
  if (rules.email && strValue && !PATTERNS.email.test(strValue)) {
    return {
      isValid: false,
      error: `${fieldLabel} must be a valid email address`,
    };
  }

  // URL format
  if (rules.url && strValue && !PATTERNS.url.test(strValue)) {
    return {
      isValid: false,
      error: `${fieldLabel} must be a valid URL`,
    };
  }

  // Phone format
  if (rules.phone && strValue && !PATTERNS.phone.test(strValue)) {
    return {
      isValid: false,
      error: `${fieldLabel} must be a valid phone number`,
    };
  }

  // Custom regex pattern
  if (rules.pattern && strValue) {
    try {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(strValue)) {
        return {
          isValid: false,
          error: rules.patternMessage || `${fieldLabel} format is invalid`,
        };
      }
    } catch (e) {
      logger.warn('Invalid regex pattern', { component: 'formValidation', metadata: { pattern: rules.pattern } });
    }
  }

  // Options validation (for select fields)
  if (rules.options && rules.options.length > 0 && strValue) {
    if (!rules.options.includes(strValue)) {
      return {
        isValid: false,
        error: `${fieldLabel} must be one of the allowed values`,
      };
    }
  }

  // Custom validator
  if (rules.custom && typeof rules.custom === 'function') {
    const customError = rules.custom(value);
    if (customError) {
      return { isValid: false, error: customError };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validate multiple fields at once
 */
export function validateFields(
  fields: Array<{
    key: string;
    label: string;
    value: any;
    validation_rules?: ValidationRule;
    required?: boolean;
  }>
): Record<string, string> {
  const errors: Record<string, string> = {};

  fields.forEach(field => {
    // Merge required flag into validation rules
    const rules = {
      ...field.validation_rules,
      required: field.required || field.validation_rules?.required,
    };

    const result = validateField(field.value, rules, field.label);
    if (!result.isValid && result.error) {
      errors[field.key] = result.error;
    }
  });

  return errors;
}

/**
 * Get validation rules for a field type with sensible defaults
 */
export function getDefaultValidationRules(fieldType: string): ValidationRule {
  switch (fieldType) {
    case 'email':
      return { email: true, max_length: 254 };
    case 'url':
      return { url: true, max_length: 2000 };
    case 'phone':
      return { phone: true, max_length: 20 };
    case 'text':
      return { max_length: 255 };
    case 'textarea':
      return { max_length: 5000 };
    case 'number':
    case 'decimal':
    case 'currency':
      return {};  // No default rules for numbers
    default:
      return {};
  }
}

/**
 * Merge field type defaults with custom validation rules
 */
export function mergeValidationRules(
  fieldType: string,
  customRules?: ValidationRule
): ValidationRule {
  const defaults = getDefaultValidationRules(fieldType);
  return { ...defaults, ...customRules };
}
