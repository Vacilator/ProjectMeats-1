/**
 * useFormValidation Hook
 * 
 * Provides real-time form validation with hybrid approach:
 * - Validates on change AFTER first blur (touched state)
 * - Tracks touched/dirty state per field
 * - Calculates step validity for "Next" button disabling
 * 
 * Usage:
 *   const {
 *     errors,
 *     touchedFields,
 *     validateField,
 *     validateStep,
 *     isStepValid,
 *     markFieldTouched,
 *     handleFieldChange,
 *     handleFieldBlur,
 *   } = useFormValidation(fields, formData);
 */
import { useState, useCallback, useMemo } from 'react';
import { validateField as validateFieldUtil, mergeValidationRules, ValidationRule } from '../utils/formValidation';

export interface FieldConfig {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  validation_rules?: ValidationRule;
  options?: Array<{ value: string; label: string }> | string[];
  choices?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
}

export interface ValidationState {
  errors: Record<string, string>;
  touchedFields: Set<string>;
  dirtyFields: Set<string>;
}

export interface UseFormValidationReturn {
  /** Current field errors */
  errors: Record<string, string>;
  /** Set of field keys that have been touched (blurred) */
  touchedFields: Set<string>;
  /** Set of field keys that have been modified */
  dirtyFields: Set<string>;
  /** Validate a single field, returns error message or null */
  validateField: (fieldKey: string, value: any) => string | null;
  /** Validate all fields in current step, returns all errors */
  validateStep: () => Record<string, string>;
  /** Check if all required fields in step are valid */
  isStepValid: () => boolean;
  /** Mark a field as touched (triggers validation) */
  markFieldTouched: (fieldKey: string) => void;
  /** Handle field value change with hybrid validation */
  handleFieldChange: (fieldKey: string, value: any, immediate?: boolean) => void;
  /** Handle field blur (mark touched + validate) */
  handleFieldBlur: (fieldKey: string, value: any) => void;
  /** Clear all validation state */
  clearValidation: () => void;
  /** Get error for a specific field (only if touched) */
  getFieldError: (fieldKey: string) => string | null;
  /** Check if a field has an error (only if touched) */
  hasFieldError: (fieldKey: string) => boolean;
  /** Get count of required fields that are missing values */
  getMissingRequiredCount: () => number;
}

export function useFormValidation(
  fields: FieldConfig[],
  formData: Record<string, any>,
  onValidationChange?: (errors: Record<string, string>) => void
): UseFormValidationReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

  // Build field lookup map
  const fieldMap = useMemo(() => {
    const map = new Map<string, FieldConfig>();
    fields.forEach(f => map.set(f.key, f));
    return map;
  }, [fields]);

  // Validate a single field
  const validateField = useCallback((fieldKey: string, value: any): string | null => {
    const field = fieldMap.get(fieldKey);
    if (!field) return null;

    // Build validation rules
    const rules = mergeValidationRules(field.type, field.validation_rules as ValidationRule);
    if (field.required) {
      rules.required = true;
    }
    if (field.min !== undefined) {
      rules.min = field.min;
    }
    if (field.max !== undefined) {
      rules.max = field.max;
    }
    if (field.min_length !== undefined) {
      rules.min_length = field.min_length;
    }
    if (field.max_length !== undefined) {
      rules.max_length = field.max_length;
    }

    const result = validateFieldUtil(value, rules, field.label);
    return result.error;
  }, [fieldMap]);

  // Validate all fields in the step
  const validateStep = useCallback((): Record<string, string> => {
    const stepErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      const value = formData[field.key];
      const error = validateField(field.key, value);
      if (error) {
        stepErrors[field.key] = error;
      }
    });

    setErrors(stepErrors);
    if (onValidationChange) {
      onValidationChange(stepErrors);
    }
    return stepErrors;
  }, [fields, formData, validateField, onValidationChange]);

  // Check if step is valid (all required fields filled + no errors)
  const isStepValid = useCallback((): boolean => {
    // Check all required fields have values
    for (const field of fields) {
      if (field.required) {
        const value = formData[field.key];
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          return false;
        }
      }
    }
    
    // Check for existing errors on touched fields
    for (const fieldKey of touchedFields) {
      if (errors[fieldKey]) {
        return false;
      }
    }
    
    return true;
  }, [fields, formData, errors, touchedFields]);

  // Mark field as touched
  const markFieldTouched = useCallback((fieldKey: string) => {
    setTouchedFields(prev => {
      const next = new Set(prev);
      next.add(fieldKey);
      return next;
    });
  }, []);

  // Handle field change with hybrid validation
  const handleFieldChange = useCallback((fieldKey: string, value: any, immediate = false) => {
    // Mark as dirty
    setDirtyFields(prev => {
      const next = new Set(prev);
      next.add(fieldKey);
      return next;
    });

    // Only validate if already touched OR immediate validation requested
    if (touchedFields.has(fieldKey) || immediate) {
      const error = validateField(fieldKey, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) {
          next[fieldKey] = error;
        } else {
          delete next[fieldKey];
        }
        if (onValidationChange) {
          onValidationChange(next);
        }
        return next;
      });
    }
  }, [touchedFields, validateField, onValidationChange]);

  // Handle field blur
  const handleFieldBlur = useCallback((fieldKey: string, value: any) => {
    // Mark as touched
    setTouchedFields(prev => {
      const next = new Set(prev);
      next.add(fieldKey);
      return next;
    });

    // Validate on blur
    const error = validateField(fieldKey, value);
    setErrors(prev => {
      const next = { ...prev };
      if (error) {
        next[fieldKey] = error;
      } else {
        delete next[fieldKey];
      }
      if (onValidationChange) {
        onValidationChange(next);
      }
      return next;
    });
  }, [validateField, onValidationChange]);

  // Clear all validation state
  const clearValidation = useCallback(() => {
    setErrors({});
    setTouchedFields(new Set());
    setDirtyFields(new Set());
  }, []);

  // Get error for field (only if touched)
  const getFieldError = useCallback((fieldKey: string): string | null => {
    if (!touchedFields.has(fieldKey)) return null;
    return errors[fieldKey] || null;
  }, [errors, touchedFields]);

  // Check if field has error (only if touched)
  const hasFieldError = useCallback((fieldKey: string): boolean => {
    return touchedFields.has(fieldKey) && !!errors[fieldKey];
  }, [errors, touchedFields]);

  // Get count of missing required fields
  const getMissingRequiredCount = useCallback((): number => {
    let count = 0;
    for (const field of fields) {
      if (field.required) {
        const value = formData[field.key];
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          count++;
        }
      }
    }
    return count;
  }, [fields, formData]);

  return {
    errors,
    touchedFields,
    dirtyFields,
    validateField,
    validateStep,
    isStepValid,
    markFieldTouched,
    handleFieldChange,
    handleFieldBlur,
    clearValidation,
    getFieldError,
    hasFieldError,
    getMissingRequiredCount,
  };
}

export default useFormValidation;
