/**
 * Tests for useFormValidation Hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation, FieldConfig } from './useFormValidation';

export {};

describe('useFormValidation', () => {
  const basicFields: FieldConfig[] = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'age', label: 'Age', type: 'number', required: false },
  ];

  const emptyFormData = { name: '', email: '', age: '' };
  const validFormData = { name: 'John', email: 'john@example.com', age: 30 };

  describe('initial state', () => {
    it('starts with empty errors', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      expect(result.current.errors).toEqual({});
    });

    it('starts with empty touched fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      expect(result.current.touchedFields.size).toBe(0);
    });

    it('starts with empty dirty fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      expect(result.current.dirtyFields.size).toBe(0);
    });
  });

  describe('validateField', () => {
    it('returns null for valid field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, validFormData)
      );

      const error = result.current.validateField('name', 'John');
      expect(error).toBeNull();
    });

    it('returns error for required empty field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      const error = result.current.validateField('name', '');
      expect(error).toBe('Name is required');
    });

    it('returns error for invalid email', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      const error = result.current.validateField('email', 'invalid');
      expect(error).toBe('Email must be a valid email address');
    });

    it('returns null for non-required empty field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      const error = result.current.validateField('age', '');
      expect(error).toBeNull();
    });

    it('returns null for unknown field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      const error = result.current.validateField('unknown', 'value');
      expect(error).toBeNull();
    });
  });

  describe('validateStep', () => {
    it('returns errors for invalid fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      let errors: Record<string, string>;
      act(() => {
        errors = result.current.validateStep();
      });

      expect(errors!).toHaveProperty('name', 'Name is required');
      expect(errors!).toHaveProperty('email', 'Email is required');
    });

    it('returns empty object for valid form', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, validFormData)
      );

      let errors: Record<string, string>;
      act(() => {
        errors = result.current.validateStep();
      });

      expect(errors!).toEqual({});
    });

    it('updates errors state', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.validateStep();
      });

      expect(result.current.errors).toHaveProperty('name');
      expect(result.current.errors).toHaveProperty('email');
    });

    it('calls onValidationChange callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData, callback)
      );

      act(() => {
        result.current.validateStep();
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('isStepValid', () => {
    it('returns false when required fields empty', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      expect(result.current.isStepValid()).toBe(false);
    });

    it('returns true when all required fields valid', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, validFormData)
      );

      expect(result.current.isStepValid()).toBe(true);
    });

    it('returns false when touched field has error', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, { ...validFormData, email: 'invalid' })
      );

      act(() => {
        result.current.handleFieldBlur('email', 'invalid');
      });

      expect(result.current.isStepValid()).toBe(false);
    });
  });

  describe('markFieldTouched', () => {
    it('adds field to touched set', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.markFieldTouched('name');
      });

      expect(result.current.touchedFields.has('name')).toBe(true);
    });

    it('does not remove other touched fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.markFieldTouched('name');
        result.current.markFieldTouched('email');
      });

      expect(result.current.touchedFields.has('name')).toBe(true);
      expect(result.current.touchedFields.has('email')).toBe(true);
    });
  });

  describe('handleFieldChange', () => {
    it('marks field as dirty', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldChange('name', 'John');
      });

      expect(result.current.dirtyFields.has('name')).toBe(true);
    });

    it('does not validate if not touched', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldChange('email', 'invalid');
      });

      // No error because field hasn't been touched
      expect(result.current.errors).not.toHaveProperty('email');
    });

    it('validates if field is touched', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldBlur('email', 'invalid');
      });

      act(() => {
        result.current.handleFieldChange('email', 'still-invalid');
      });

      expect(result.current.errors.email).toBe('Email must be a valid email address');
    });

    it('validates immediately when immediate=true', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldChange('email', 'invalid', true);
      });

      expect(result.current.errors.email).toBe('Email must be a valid email address');
    });

    it('clears error when value becomes valid', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      // First touch and set invalid value
      act(() => {
        result.current.handleFieldBlur('email', 'invalid');
      });

      expect(result.current.errors.email).toBe('Email must be a valid email address');

      // Now change to valid value
      act(() => {
        result.current.handleFieldChange('email', 'valid@example.com');
      });

      expect(result.current.errors.email).toBeUndefined();
    });
  });

  describe('handleFieldBlur', () => {
    it('marks field as touched', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', '');
      });

      expect(result.current.touchedFields.has('name')).toBe(true);
    });

    it('validates field on blur', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', '');
      });

      expect(result.current.errors.name).toBe('Name is required');
    });

    it('clears error for valid value', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', 'John');
      });

      expect(result.current.errors.name).toBeUndefined();
    });
  });

  describe('clearValidation', () => {
    it('clears all errors', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.validateStep();
      });

      expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

      act(() => {
        result.current.clearValidation();
      });

      expect(result.current.errors).toEqual({});
    });

    it('clears touched fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.markFieldTouched('name');
        result.current.clearValidation();
      });

      expect(result.current.touchedFields.size).toBe(0);
    });

    it('clears dirty fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldChange('name', 'test');
        result.current.clearValidation();
      });

      expect(result.current.dirtyFields.size).toBe(0);
    });
  });

  describe('getFieldError', () => {
    it('returns null if field not touched', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      // Validate to create error, but don't touch field individually
      act(() => {
        result.current.validateStep();
      });

      // getFieldError only shows errors for touched fields
      expect(result.current.getFieldError('name')).toBeNull();
    });

    it('returns error for touched field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', '');
      });

      expect(result.current.getFieldError('name')).toBe('Name is required');
    });

    it('returns null for valid touched field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, validFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', 'John');
      });

      expect(result.current.getFieldError('name')).toBeNull();
    });
  });

  describe('hasFieldError', () => {
    it('returns false if field not touched', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      expect(result.current.hasFieldError('name')).toBe(false);
    });

    it('returns true for touched field with error', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', '');
      });

      expect(result.current.hasFieldError('name')).toBe(true);
    });

    it('returns false for touched valid field', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, validFormData)
      );

      act(() => {
        result.current.handleFieldBlur('name', 'John');
      });

      expect(result.current.hasFieldError('name')).toBe(false);
    });
  });

  describe('getMissingRequiredCount', () => {
    it('returns count of empty required fields', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, emptyFormData)
      );

      // name and email are required, age is not
      expect(result.current.getMissingRequiredCount()).toBe(2);
    });

    it('returns 0 when all required fields filled', () => {
      const { result } = renderHook(() =>
        useFormValidation(basicFields, validFormData)
      );

      expect(result.current.getMissingRequiredCount()).toBe(0);
    });

    it('handles array values', () => {
      const fieldsWithArray: FieldConfig[] = [
        { key: 'tags', label: 'Tags', type: 'multiselect', required: true },
      ];

      const { result } = renderHook(() =>
        useFormValidation(fieldsWithArray, { tags: [] })
      );

      expect(result.current.getMissingRequiredCount()).toBe(1);
    });
  });

  describe('field config options', () => {
    it('respects min/max from field config', () => {
      const fieldsWithMinMax: FieldConfig[] = [
        { key: 'quantity', label: 'Quantity', type: 'number', min: 1, max: 100 },
      ];

      const { result } = renderHook(() =>
        useFormValidation(fieldsWithMinMax, { quantity: 0 })
      );

      const error = result.current.validateField('quantity', 0);
      expect(error).toBe('Quantity must be at least 1');
    });

    it('respects min_length/max_length from field config', () => {
      const fieldsWithLength: FieldConfig[] = [
        { key: 'code', label: 'Code', type: 'text', min_length: 3, max_length: 10 },
      ];

      const { result } = renderHook(() =>
        useFormValidation(fieldsWithLength, { code: 'ab' })
      );

      const error = result.current.validateField('code', 'ab');
      expect(error).toBe('Code must be at least 3 characters');
    });
  });
});
