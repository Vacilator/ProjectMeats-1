/**
 * Tests for ChoicesService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  FIELD_TO_CHOICE_TYPE, 
  isStaticChoiceField,
  clearChoicesCache 
} from './choicesService';

describe('ChoicesService', () => {
  beforeEach(() => {
    clearChoicesCache();
  });

  describe('FIELD_TO_CHOICE_TYPE mapping', () => {
    it('contains protein_type mapping', () => {
      expect(FIELD_TO_CHOICE_TYPE['protein_type']).toBe('protein_type');
      expect(FIELD_TO_CHOICE_TYPE['type_of_protein']).toBe('protein_type');
      expect(FIELD_TO_CHOICE_TYPE['preferred_protein_types']).toBe('protein_type');
    });

    it('contains customer field mappings', () => {
      expect(FIELD_TO_CHOICE_TYPE['edible_inedible']).toBe('edible_inedible');
      expect(FIELD_TO_CHOICE_TYPE['accounting_payment_terms']).toBe('accounting_payment_terms');
      expect(FIELD_TO_CHOICE_TYPE['credit_limit']).toBe('credit_limit');
      expect(FIELD_TO_CHOICE_TYPE['credit_limits']).toBe('credit_limit');
    });

    it('contains product field mappings', () => {
      expect(FIELD_TO_CHOICE_TYPE['fresh_or_frozen']).toBe('fresh_or_frozen');
      expect(FIELD_TO_CHOICE_TYPE['package_type']).toBe('package_type');
      expect(FIELD_TO_CHOICE_TYPE['net_or_catch']).toBe('net_or_catch');
      expect(FIELD_TO_CHOICE_TYPE['origin']).toBe('origin');
    });

    it('contains plant field mappings', () => {
      expect(FIELD_TO_CHOICE_TYPE['plant_type']).toBe('plant_type');
      expect(FIELD_TO_CHOICE_TYPE['shipping_offered']).toBe('shipping_offered');
      expect(FIELD_TO_CHOICE_TYPE['appointment_method']).toBe('appointment_method');
    });

    it('contains contact field mappings', () => {
      expect(FIELD_TO_CHOICE_TYPE['contact_type']).toBe('contact_type');
      expect(FIELD_TO_CHOICE_TYPE['department']).toBe('department_supplier');
    });
  });

  describe('isStaticChoiceField', () => {
    it('returns true for known static choice fields', () => {
      expect(isStaticChoiceField('protein_type')).toBe(true);
      expect(isStaticChoiceField('fresh_or_frozen')).toBe(true);
      expect(isStaticChoiceField('contact_type')).toBe(true);
      expect(isStaticChoiceField('plant_type')).toBe(true);
    });

    it('returns false for unknown fields', () => {
      expect(isStaticChoiceField('unknown_field')).toBe(false);
      expect(isStaticChoiceField('customer_name')).toBe(false);
      expect(isStaticChoiceField('email')).toBe(false);
    });

    it('handles field names case-insensitively', () => {
      expect(isStaticChoiceField('Protein_Type')).toBe(true);
      expect(isStaticChoiceField('PROTEIN_TYPE')).toBe(true);
    });

    it('handles field names with spaces', () => {
      expect(isStaticChoiceField('protein type')).toBe(true);
      expect(isStaticChoiceField('fresh or frozen')).toBe(true);
    });
  });

  describe('clearChoicesCache', () => {
    it('clears the cache without errors', () => {
      // Should not throw
      expect(() => clearChoicesCache()).not.toThrow();
    });

    it('can be called multiple times', () => {
      clearChoicesCache();
      clearChoicesCache();
      clearChoicesCache();
      // Should not throw
    });
  });
});
