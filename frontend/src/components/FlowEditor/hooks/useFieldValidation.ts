/**
 * useFieldValidation Hook
 *
 * Phase E.1: Foundation - Step 2/4 (Shared Hooks)
 *
 * Unified validation logic for form fields across config panels.
 * Replaces duplicate validation patterns in 15+ config panels.
 *
 * Features:
 * - Field-level validation
 * - Form-level validation
 * - Async validation support
 * - Custom validation rules
 * - Error message management
 *
 * @example
 * ```typescript
 * const { errors, validate, validateField, isValid } = useFieldValidation({
 *   rules: {
 *     email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
 *     name: { required: true, minLength: 3 }
 *   }
 * });
 * ```
 *
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */
import { useState, useCallback, useMemo } from 'react';

export type ValidationRule = {
  required?: boolean | string;
  minLength?: number | { value: number; message: string };
  maxLength?: number | { value: number; message: string };
  min?: number | { value: number; message: string };
  max?: number | { value: number; message: string };
  pattern?: RegExp | { value: RegExp; message: string };
  validate?: (value: any) => boolean | string | Promise<boolean | string>;
  custom?: (value: any, values: Record<string, any>) => string | null;
};

export type ValidationRules = Record<string, ValidationRule>;
export type ValidationErrors = Record<string, string>;

export interface UseFieldValidationOptions {
  /**
   * Validation rules for each field
   */
  rules: ValidationRules;

  /**
   * Validate on change (debounced)
   * @default true
   */
  validateOnChange?: boolean;

  /**
   * Validate on blur
   * @default true
   */
  validateOnBlur?: boolean;

  /**
   * Debounce delay in ms for onChange validation
   * @default 300
   */
  debounceDelay?: number;
}

export interface UseFieldValidationReturn {
  /**
   * Current validation errors
   */
  errors: ValidationErrors;

  /**
   * Validate all fields
   */
  validate: (values: Record<string, any>) => Promise<boolean>;

  /**
   * Validate single field
   */
  validateField: (field: string, value: any, values?: Record<string, any>) => Promise<string | null>;

  /**
   * Clear all errors
   */
  clearErrors: () => void;

  /**
   * Clear specific field error
   */
  clearError: (field: string) => void;

  /**
   * Set custom error
   */
  setError: (field: string, message: string) => void;

  /**
   * Whether form is valid (no errors)
   */
  isValid: boolean;

  /**
   * Whether form has been validated
   */
  hasValidated: boolean;
}

/**
 * Extract error message from validation rule
 */
function getErrorMessage(rule: any, defaultMessage: string): string {
  if (typeof rule === 'object' && rule.message) {
    return rule.message;
  }
  return defaultMessage;
}

/**
 * Validate a single value against a validation rule
 */
async function validateValue(
  value: any,
  rule: ValidationRule,
  field: string,
  allValues?: Record<string, any>
): Promise<string | null> {
  // Required
  if (rule.required) {
    const isEmpty = value === null || value === undefined || value === '' ||
                    (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      return typeof rule.required === 'string'
        ? rule.required
        : `${field} is required`;
    }
  }

  // Skip other validations if value is empty and not required
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Min length
  if (rule.minLength !== undefined) {
    const minLength = typeof rule.minLength === 'object' ? rule.minLength.value : rule.minLength;
    if (String(value).length < minLength) {
      return getErrorMessage(
        rule.minLength,
        `${field} must be at least ${minLength} characters`
      );
    }
  }

  // Max length
  if (rule.maxLength !== undefined) {
    const maxLength = typeof rule.maxLength === 'object' ? rule.maxLength.value : rule.maxLength;
    if (String(value).length > maxLength) {
      return getErrorMessage(
        rule.maxLength,
        `${field} must be at most ${maxLength} characters`
      );
    }
  }

  // Min value
  if (rule.min !== undefined) {
    const min = typeof rule.min === 'object' ? rule.min.value : rule.min;
    if (Number(value) < min) {
      return getErrorMessage(
        rule.min,
        `${field} must be at least ${min}`
      );
    }
  }

  // Max value
  if (rule.max !== undefined) {
    const max = typeof rule.max === 'object' ? rule.max.value : rule.max;
    if (Number(value) > max) {
      return getErrorMessage(
        rule.max,
        `${field} must be at most ${max}`
      );
    }
  }

  // Pattern
  if (rule.pattern) {
    const pattern =
      typeof rule.pattern === 'object' && rule.pattern !== null && 'value' in rule.pattern
        ? rule.pattern.value
        : rule.pattern;
    if (!pattern.test(String(value))) {
      return getErrorMessage(
        rule.pattern,
        `${field} format is invalid`
      );
    }
  }

  // Custom validate function
  if (rule.validate) {
    const result = await rule.validate(value);
    if (result === false) {
      return `${field} is invalid`;
    }
    if (typeof result === 'string') {
      return result;
    }
  }

  // Custom rule with access to all values
  if (rule.custom && allValues) {
    const error = rule.custom(value, allValues);
    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Hook for managing field validation
 */
export function useFieldValidation(options: UseFieldValidationOptions): UseFieldValidationReturn {
  const { rules, validateOnChange = true, validateOnBlur = true } = options;

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [hasValidated, setHasValidated] = useState(false);

  const validateField = useCallback(
    async (field: string, value: any, values?: Record<string, any>): Promise<string | null> => {
      const rule = rules[field];
      if (!rule) return null;

      const error = await validateValue(value, rule, field, values);

      // Update errors state
      setErrors(prev => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });

      return error;
    },
    [rules]
  );

  const validate = useCallback(
    async (values: Record<string, any>): Promise<boolean> => {
      setHasValidated(true);
      const newErrors: ValidationErrors = {};

      // Validate all fields
      await Promise.all(
        Object.keys(rules).map(async (field) => {
          const error = await validateValue(values[field], rules[field], field, values);
          if (error) {
            newErrors[field] = error;
          }
        })
      );

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [rules]
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    setHasValidated(false);
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    errors,
    validate,
    validateField,
    clearErrors,
    clearError,
    setError,
    isValid,
    hasValidated,
  };
}
