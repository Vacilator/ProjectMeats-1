/**
 * Field Validation Hook (Phase 2.5: Enhanced Inheritance)
 *
 * Provides type-safe validation with inheritance from entity models.
 */
import { useState, useCallback } from 'react';
import { businessApi } from '@/services/businessApi';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidationRules {
  type?: string;
  required?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  min?: number;
  max?: number;
  min_items?: number;
  max_items?: number;
  options?: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

/**
 * Hook for field validation with inheritance support.
 *
 * @param fieldId - UUID of the field
 *
 * @returns Object with validation operations:
 *   - validateValue: Validate a value against field rules
 *   - syncValidation: Sync computed validation from entity model
 *   - getEffectiveRules: Get merged validation rules
 *   - loading: Whether operation is in progress
 *   - error: Error message if operation failed
 *
 * @example
 * ```tsx
 * const EmailField = ({ fieldId }) => {
 *   const { validateValue, loading } = useFieldValidation(fieldId);
 *   const [email, setEmail] = useState('');
 *   const [errors, setErrors] = useState<string[]>([]);
 *
 *   const handleChange = async (value: string) => {
 *     setEmail(value);
 *
 *     const result = await validateValue(value);
 *     setErrors(result.errors);
 *   };
 *
 *   return (
 *     <>
 *       <Input
 *         value={email}
 *         onChange={e => handleChange(e.target.value)}
 *         status={errors.length > 0 ? 'error' : undefined}
 *       />
 *       {errors.map(err => (
 *         <Text type="danger" key={err}>{err}</Text>
 *       ))}
 *     </>
 *   );
 * };
 * ```
 */
export const useFieldValidation = (fieldId: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateValue = useCallback(async (value: unknown): Promise<ValidationResult> => {
    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.post(
        `/form-fields/${fieldId}/validate-value/`,
        { value }
      );

      return response.data;
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      const errorMsg = (typeof data.error === 'string' ? data.error : '') || 'Validation failed';
      setError(errorMsg);

      // Return error state
      return {
        valid: false,
        errors: [errorMsg]
      };
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  const syncValidation = useCallback(async (): Promise<ValidationRules> => {
    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.post(
        `/form-fields/${fieldId}/sync-validation/`
      );

      return response.data.computed_validation;
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      const errorMsg = (typeof data.error === 'string' ? data.error : '') || 'Failed to sync validation';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  const getEffectiveRules = useCallback(async (): Promise<ValidationRules> => {
    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.get(
        `/form-fields/${fieldId}/effective-validation/`
      );

      return response.data;
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      const errorMsg = (typeof data.error === 'string' ? data.error : '') || 'Failed to get validation rules';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  return {
    validateValue,
    syncValidation,
    getEffectiveRules,
    loading,
    error
  };
};

/**
 * Client-side validation function (no API call).
 *
 * @param value - Value to validate
 * @param rules - Validation rules
 * @returns Validation result
 */
export const validateLocally = (value: unknown, rules: ValidationRules): ValidationResult => {
  const errors: string[] = [];

  // Required check
  if (rules.required && !value) {
    errors.push('This field is required');
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.min_length && value.length < rules.min_length) {
      errors.push(`Minimum length is ${rules.min_length}`);
    }
    if (rules.max_length && value.length > rules.max_length) {
      errors.push(`Maximum length is ${rules.max_length}`);
    }
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      errors.push('Value does not match required pattern');
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`Minimum value is ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push(`Maximum value is ${rules.max}`);
    }
  }

  // Array validations
  if (Array.isArray(value)) {
    if (rules.min_items && value.length < rules.min_items) {
      errors.push(`Minimum ${rules.min_items} items required`);
    }
    if (rules.max_items && value.length > rules.max_items) {
      errors.push(`Maximum ${rules.max_items} items allowed`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Helper to generate validation rules for common field types.
 *
 * @param fieldType - Field type (email, number, etc.)
 * @returns Default validation rules
 */
export const getDefaultValidationRules = (fieldType: string): ValidationRules => {
  switch (fieldType) {
    case 'email':
      return {
        type: 'string',
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        format: 'email'
      };
    case 'number':
      return {
        type: 'number'
      };
    case 'integer':
      return {
        type: 'integer'
      };
    case 'date':
      return {
        type: 'string',
        format: 'date'
      };
    case 'boolean':
      return {
        type: 'boolean'
      };
    default:
      return {
        type: 'string'
      };
  }
};
