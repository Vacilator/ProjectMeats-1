/**
 * Tests for Form Validation Utility
 */

import { describe, it, expect } from 'vitest';
import {
  validateField,
  validateFields,
  getDefaultValidationRules,
  mergeValidationRules,
  ValidationRule,
} from './formValidation';

export {};

describe('formValidation', () => {
  describe('validateField', () => {
    describe('no rules', () => {
      it('returns valid for any value when no rules', () => {
        expect(validateField('anything', undefined)).toEqual({
          isValid: true,
          error: null,
        });
      });

      it('returns valid for empty rules object', () => {
        expect(validateField('test', {})).toEqual({
          isValid: true,
          error: null,
        });
      });
    });

    describe('required rule', () => {
      const rules: ValidationRule = { required: true };

      it('fails for null value', () => {
        const result = validateField(null, rules, 'Name');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Name is required');
      });

      it('fails for undefined value', () => {
        const result = validateField(undefined, rules, 'Name');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Name is required');
      });

      it('fails for empty string', () => {
        const result = validateField('', rules, 'Name');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Name is required');
      });

      it('fails for whitespace-only string', () => {
        const result = validateField('   ', rules, 'Name');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Name is required');
      });

      it('passes for valid value', () => {
        const result = validateField('John', rules, 'Name');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    describe('min_length rule', () => {
      const rules: ValidationRule = { min_length: 3 };

      it('fails for too short string', () => {
        const result = validateField('ab', rules, 'Username');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Username must be at least 3 characters');
      });

      it('passes for exact min length', () => {
        expect(validateField('abc', rules).isValid).toBe(true);
      });

      it('passes for longer string', () => {
        expect(validateField('abcdef', rules).isValid).toBe(true);
      });

      it('skips validation for empty non-required field', () => {
        expect(validateField('', rules).isValid).toBe(true);
      });
    });

    describe('max_length rule', () => {
      const rules: ValidationRule = { max_length: 10 };

      it('fails for too long string', () => {
        const result = validateField('12345678901', rules, 'Code');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Code must be no more than 10 characters');
      });

      it('passes for exact max length', () => {
        expect(validateField('1234567890', rules).isValid).toBe(true);
      });

      it('passes for shorter string', () => {
        expect(validateField('short', rules).isValid).toBe(true);
      });
    });

    describe('min value rule', () => {
      const rules: ValidationRule = { min: 0 };

      it('fails for value below minimum', () => {
        const result = validateField(-5, rules, 'Quantity');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Quantity must be at least 0');
      });

      it('passes for exact minimum', () => {
        expect(validateField(0, rules).isValid).toBe(true);
      });

      it('passes for value above minimum', () => {
        expect(validateField(100, rules).isValid).toBe(true);
      });
    });

    describe('max value rule', () => {
      const rules: ValidationRule = { max: 100 };

      it('fails for value above maximum', () => {
        const result = validateField(150, rules, 'Percentage');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Percentage must be no more than 100');
      });

      it('passes for exact maximum', () => {
        expect(validateField(100, rules).isValid).toBe(true);
      });

      it('passes for value below maximum', () => {
        expect(validateField(50, rules).isValid).toBe(true);
      });
    });

    describe('email rule', () => {
      const rules: ValidationRule = { email: true };

      it('fails for invalid email', () => {
        const result = validateField('notanemail', rules, 'Email');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Email must be a valid email address');
      });

      it('fails for email without domain', () => {
        const result = validateField('user@', rules, 'Email');
        expect(result.isValid).toBe(false);
      });

      it('passes for valid email', () => {
        expect(validateField('user@example.com', rules).isValid).toBe(true);
      });

      it('passes for email with subdomain', () => {
        expect(validateField('user@mail.example.com', rules).isValid).toBe(true);
      });

      it('passes for email with plus sign', () => {
        expect(validateField('user+tag@example.com', rules).isValid).toBe(true);
      });
    });

    describe('url rule', () => {
      const rules: ValidationRule = { url: true };

      it('fails for invalid URL', () => {
        const result = validateField('not a url', rules, 'Website');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Website must be a valid URL');
      });

      it('passes for http URL', () => {
        expect(validateField('http://example.com', rules).isValid).toBe(true);
      });

      it('passes for https URL', () => {
        expect(validateField('https://example.com', rules).isValid).toBe(true);
      });

      it('passes for URL with path', () => {
        expect(validateField('https://example.com/path/to/page', rules).isValid).toBe(true);
      });
    });

    describe('phone rule', () => {
      const rules: ValidationRule = { phone: true };

      it('fails for invalid phone', () => {
        const result = validateField('abc123', rules, 'Phone');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Phone must be a valid phone number');
      });

      it('passes for simple phone number', () => {
        expect(validateField('1234567890', rules).isValid).toBe(true);
      });

      it('passes for phone with country code', () => {
        expect(validateField('+1-555-123-4567', rules).isValid).toBe(true);
      });

      it('passes for phone with parentheses', () => {
        expect(validateField('(555)123-4567', rules).isValid).toBe(true);
      });
    });

    describe('pattern rule', () => {
      const rules: ValidationRule = {
        pattern: '^[A-Z]{2}\\d{4}$',
        patternMessage: 'Must be 2 letters followed by 4 digits'
      };

      it('fails for non-matching value', () => {
        const result = validateField('AB123', rules, 'Code');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Must be 2 letters followed by 4 digits');
      });

      it('passes for matching value', () => {
        expect(validateField('AB1234', rules).isValid).toBe(true);
      });

      it('uses default message when patternMessage not provided', () => {
        const rulesNoMsg: ValidationRule = { pattern: '^[A-Z]+$' };
        const result = validateField('abc', rulesNoMsg, 'Field');
        expect(result.error).toBe('Field format is invalid');
      });
    });

    describe('options rule', () => {
      const rules: ValidationRule = { options: ['red', 'green', 'blue'] };

      it('fails for value not in options', () => {
        const result = validateField('yellow', rules, 'Color');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Color must be one of the allowed values');
      });

      it('passes for value in options', () => {
        expect(validateField('red', rules).isValid).toBe(true);
        expect(validateField('green', rules).isValid).toBe(true);
        expect(validateField('blue', rules).isValid).toBe(true);
      });
    });

    describe('custom rule', () => {
      it('uses custom validator function', () => {
        const rules: ValidationRule = {
          custom: (value) => value === 'forbidden' ? 'This value is not allowed' : null
        };

        const result = validateField('forbidden', rules);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('This value is not allowed');
      });

      it('passes when custom validator returns null', () => {
        const rules: ValidationRule = {
          custom: (value) => value.length > 0 ? null : 'Cannot be empty'
        };

        expect(validateField('valid', rules).isValid).toBe(true);
      });
    });

    describe('combined rules', () => {
      it('validates all rules', () => {
        const rules: ValidationRule = {
          required: true,
          min_length: 5,
          max_length: 20,
          email: true,
        };

        // Fails required
        expect(validateField('', rules, 'Email').error).toBe('Email is required');

        // Fails min_length
        expect(validateField('a@b', rules, 'Email').error).toBe('Email must be at least 5 characters');

        // Fails email format
        expect(validateField('notanemail', rules, 'Email').error).toBe('Email must be a valid email address');

        // Passes all
        expect(validateField('user@example.com', rules).isValid).toBe(true);
      });
    });
  });

  describe('validateFields', () => {
    it('returns empty object when all fields valid', () => {
      const fields = [
        { key: 'name', label: 'Name', value: 'John', required: true },
        { key: 'email', label: 'Email', value: 'john@example.com', validation_rules: { email: true } },
      ];

      expect(validateFields(fields)).toEqual({});
    });

    it('returns errors for invalid fields', () => {
      const fields = [
        { key: 'name', label: 'Name', value: '', required: true },
        { key: 'email', label: 'Email', value: 'invalid', validation_rules: { email: true } },
      ];

      const errors = validateFields(fields);
      expect(errors.name).toBe('Name is required');
      expect(errors.email).toBe('Email must be a valid email address');
    });

    it('merges required flag with validation_rules', () => {
      const fields = [
        { key: 'name', label: 'Name', value: '', required: true, validation_rules: { min_length: 2 } },
      ];

      const errors = validateFields(fields);
      expect(errors.name).toBe('Name is required');
    });
  });

  describe('getDefaultValidationRules', () => {
    it('returns email rules for email type', () => {
      const rules = getDefaultValidationRules('email');
      expect(rules.email).toBe(true);
      expect(rules.max_length).toBe(254);
    });

    it('returns url rules for url type', () => {
      const rules = getDefaultValidationRules('url');
      expect(rules.url).toBe(true);
      expect(rules.max_length).toBe(2000);
    });

    it('returns phone rules for phone type', () => {
      const rules = getDefaultValidationRules('phone');
      expect(rules.phone).toBe(true);
      expect(rules.max_length).toBe(20);
    });

    it('returns text rules for text type', () => {
      const rules = getDefaultValidationRules('text');
      expect(rules.max_length).toBe(255);
    });

    it('returns textarea rules for textarea type', () => {
      const rules = getDefaultValidationRules('textarea');
      expect(rules.max_length).toBe(5000);
    });

    it('returns empty rules for number types', () => {
      expect(getDefaultValidationRules('number')).toEqual({});
      expect(getDefaultValidationRules('decimal')).toEqual({});
      expect(getDefaultValidationRules('currency')).toEqual({});
    });

    it('returns empty rules for unknown type', () => {
      expect(getDefaultValidationRules('unknown')).toEqual({});
    });
  });

  describe('mergeValidationRules', () => {
    it('merges defaults with custom rules', () => {
      const custom: ValidationRule = { required: true, min_length: 5 };
      const merged = mergeValidationRules('email', custom);

      expect(merged.email).toBe(true); // from default
      expect(merged.max_length).toBe(254); // from default
      expect(merged.required).toBe(true); // from custom
      expect(merged.min_length).toBe(5); // from custom
    });

    it('custom rules override defaults', () => {
      const custom: ValidationRule = { max_length: 100 };
      const merged = mergeValidationRules('text', custom);

      expect(merged.max_length).toBe(100); // overridden
    });

    it('returns defaults when no custom rules', () => {
      const merged = mergeValidationRules('email', undefined);
      expect(merged).toEqual(getDefaultValidationRules('email'));
    });
  });
});
