import { describe, it, expect } from 'vitest';

import {
  toFormFieldsFromSelectedFields,
  toSelectedFieldsFromFormFields,
  isSelectedFieldArray,
  isFormBuilderFieldArray,
  getResolvedFormFields,
  getResolvedSelectedFields,
} from './formFieldsDualModel';

import type { SelectedField } from '../ConfigPanel/EntityFieldPicker';
import type { FormField } from '@/components/form-builder/types';

describe('formFieldsDualModel', () => {
  // --- Type guards ---

  describe('isSelectedFieldArray', () => {
    it('returns true for valid SelectedField[]', () => {
      const fields = [
        { name: 'email', label: 'Email', type: 'email', required: true, fieldId: 'email' },
        { name: 'phone', label: 'Phone', type: 'phone', required: false, fieldId: 'phone' },
      ];
      expect(isSelectedFieldArray(fields)).toBe(true);
    });

    it('returns false for non-arrays', () => {
      expect(isSelectedFieldArray(null)).toBe(false);
      expect(isSelectedFieldArray(undefined)).toBe(false);
      expect(isSelectedFieldArray('string')).toBe(false);
      expect(isSelectedFieldArray(42)).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(isSelectedFieldArray([])).toBe(true);
    });

    it('returns false for objects missing name/fieldId', () => {
      expect(isSelectedFieldArray([{ label: 'X', type: 'text' }])).toBe(false);
    });
  });

  describe('isFormBuilderFieldArray', () => {
    it('returns true for valid FormField[]', () => {
      const fields = [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ];
      expect(isFormBuilderFieldArray(fields)).toBe(true);
    });

    it('returns false for non-arrays', () => {
      expect(isFormBuilderFieldArray(null)).toBe(false);
      expect(isFormBuilderFieldArray({})).toBe(false);
    });

    it('returns false for objects missing id or label', () => {
      expect(isFormBuilderFieldArray([{ id: 'x' }])).toBe(false);
      expect(isFormBuilderFieldArray([{ label: 'x' }])).toBe(false);
    });
  });

  // --- Converters ---

  describe('toFormFieldsFromSelectedFields', () => {
    it('converts SelectedField[] to FormField[]', () => {
      const selected: SelectedField[] = [
        { name: 'email', label: 'Email', type: 'email', required: true, fieldId: 'email' },
      ];
      const result = toFormFieldsFromSelectedFields(selected);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('email');
      expect(result[0].type).toBe('email');
      expect(result[0].label).toBe('Email');
      expect(result[0].required).toBe(true);
    });

    it('handles empty input', () => {
      expect(toFormFieldsFromSelectedFields([])).toEqual([]);
    });

    it('filters out entries with empty id', () => {
      const selected = [{ name: '', label: 'Empty', type: 'text', required: false, fieldId: '' }] as SelectedField[];
      expect(toFormFieldsFromSelectedFields(selected)).toEqual([]);
    });

    it('coerces unknown types to text', () => {
      const selected = [{ name: 'x', label: 'X', type: 'unknown_thing', required: false, fieldId: 'x' }] as SelectedField[];
      const result = toFormFieldsFromSelectedFields(selected);
      expect(result[0].type).toBe('text');
    });

    it('coerces phone-related types', () => {
      const selected = [{ name: 'tel', label: 'Tel', type: 'telephone', required: false, fieldId: 'tel' }] as SelectedField[];
      const result = toFormFieldsFromSelectedFields(selected);
      expect(result[0].type).toBe('phone');
    });
  });

  describe('toSelectedFieldsFromFormFields', () => {
    it('converts FormField[] to SelectedField[]', () => {
      const fields: FormField[] = [
        { id: 'email', label: 'Email', type: 'email', required: true, validation: [] },
      ];
      const result = toSelectedFieldsFromFormFields(fields);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('email');
      expect(result[0].fieldId).toBe('email');
      expect(result[0].label).toBe('Email');
    });

    it('handles empty input', () => {
      expect(toSelectedFieldsFromFormFields([])).toEqual([]);
    });
  });

  // --- Resolvers ---

  describe('getResolvedFormFields', () => {
    it('returns formFields when present as FormField[]', () => {
      const data = {
        formFields: [{ id: 'f1', label: 'Field 1', type: 'text' }],
      };
      const result = getResolvedFormFields(data);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f1');
    });

    it('converts SelectedField[] fields when no formFields', () => {
      const data = {
        fields: [{ name: 'email', label: 'Email', type: 'email', fieldId: 'email', required: false }],
      };
      const result = getResolvedFormFields(data);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('email');
      expect(result[0].type).toBe('email');
    });

    it('returns FormField[] fields directly when applicable', () => {
      const data = {
        fields: [{ id: 'x', label: 'X', type: 'text' }],
      };
      const result = getResolvedFormFields(data);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('x');
    });

    it('returns empty array for null/undefined data', () => {
      expect(getResolvedFormFields(null)).toEqual([]);
      expect(getResolvedFormFields(undefined)).toEqual([]);
      expect(getResolvedFormFields({})).toEqual([]);
    });
  });

  describe('getResolvedSelectedFields', () => {
    it('returns SelectedField[] fields when present', () => {
      const data = {
        fields: [{ name: 'phone', label: 'Phone', type: 'phone', fieldId: 'phone', required: true }],
      };
      const result = getResolvedSelectedFields(data);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('phone');
    });

    it('converts FormField[] formFields to SelectedField[]', () => {
      const data = {
        formFields: [{ id: 'email', label: 'Email', type: 'email', required: false, validation: [] }],
      };
      const result = getResolvedSelectedFields(data);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('email');
    });

    it('returns empty for no data', () => {
      expect(getResolvedSelectedFields(null)).toEqual([]);
      expect(getResolvedSelectedFields({})).toEqual([]);
    });
  });

  // --- Round-trip stability ---

  describe('round-trip conversion stability', () => {
    it('SelectedField → FormField → SelectedField preserves identity', () => {
      const original: SelectedField[] = [
        { name: 'email', label: 'Email', type: 'email', required: true, fieldId: 'email' },
        { name: 'phone', label: 'Phone', type: 'phone', required: false, fieldId: 'phone' },
      ];
      const formFields = toFormFieldsFromSelectedFields(original);
      const roundTripped = toSelectedFieldsFromFormFields(formFields);

      expect(roundTripped).toHaveLength(2);
      expect(roundTripped[0].name).toBe('email');
      expect(roundTripped[0].fieldId).toBe('email');
      expect(roundTripped[1].name).toBe('phone');
      expect(roundTripped[1].fieldId).toBe('phone');
    });
  });
});
