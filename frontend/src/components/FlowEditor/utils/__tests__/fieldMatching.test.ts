/**
 * Tests for Field Matching Engine
 *
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import {
  areTypesCompatible,
  normalizeFieldName,
  calculateNameSimilarity,
  findFieldMatches,
  deduplicateMatches,
} from '../fieldMatching';
import { OutputFieldSchema } from '../outputSchemaInference';

describe('Field Matching Engine', () => {
  describe('areTypesCompatible', () => {
    it('should match identical types', () => {
      expect(areTypesCompatible('text', 'text')).toBe(true);
      expect(areTypesCompatible('number', 'number')).toBe(true);
    });

    it('should match compatible types', () => {
      expect(areTypesCompatible('text', 'email')).toBe(true);
      expect(areTypesCompatible('number', 'text')).toBe(true);
      expect(areTypesCompatible('date', 'datetime')).toBe(true);
    });

    it('should reject incompatible types', () => {
      expect(areTypesCompatible('text', 'number')).toBe(false);
      expect(areTypesCompatible('select', 'number')).toBe(false);
    });
  });

  describe('normalizeFieldName', () => {
    it('should remove common prefixes', () => {
      expect(normalizeFieldName('customer_name')).toBe('name');
      expect(normalizeFieldName('product_sku')).toBe('sku');
      expect(normalizeFieldName('order_total')).toBe('total');
    });

    it('should remove common suffixes', () => {
      expect(normalizeFieldName('customer_id')).toBe('customer');
      expect(normalizeFieldName('product_name')).toBe('product');
      expect(normalizeFieldName('order_number')).toBe('order');
    });

    it('should handle combined transformations', () => {
      expect(normalizeFieldName('customer_email_id')).toBe('email');
      expect(normalizeFieldName('product_sku_code')).toBe('sku');
    });

    it('should convert to lowercase', () => {
      expect(normalizeFieldName('CustomerName')).toBe('name');
      expect(normalizeFieldName('PRODUCT_SKU')).toBe('sku');
    });
  });

  describe('calculateNameSimilarity', () => {
    it('should score exact matches as 1.0', () => {
      expect(calculateNameSimilarity('email', 'email')).toBe(1.0);
      expect(calculateNameSimilarity('customer_name', 'customer_name')).toBe(1.0);
    });

    it('should score normalized matches as 0.9', () => {
      expect(calculateNameSimilarity('customer_name', 'name')).toBe(0.9);
      expect(calculateNameSimilarity('product_sku', 'sku')).toBe(0.9);
    });

    it('should score substring matches as 0.7', () => {
      expect(calculateNameSimilarity('email_address', 'email')).toBe(0.7);
      expect(calculateNameSimilarity('total', 'total_amount')).toBe(0.7);
    });

    it('should score fuzzy matches lower', () => {
      const score1 = calculateNameSimilarity('email', 'mail');
      const score2 = calculateNameSimilarity('address', 'addres');

      expect(score1).toBeGreaterThan(0.3);
      expect(score1).toBeLessThan(0.7);
      expect(score2).toBeGreaterThan(0.5);
    });

    it('should return 0 for very different names', () => {
      expect(calculateNameSimilarity('email', 'quantity')).toBe(0);
      expect(calculateNameSimilarity('customer', 'product')).toBe(0);
    });
  });

  describe('findFieldMatches', () => {
    const sourceFields: OutputFieldSchema[] = [
      {
        fieldId: 'customer_name',
        fieldName: 'customer_name',
        fieldType: 'text',
        label: 'Customer Name',
        required: true,
      },
      {
        fieldId: 'customer_email',
        fieldName: 'customer_email',
        fieldType: 'email',
        label: 'Email Address',
        required: true,
      },
      {
        fieldId: 'order_total',
        fieldName: 'order_total',
        fieldType: 'number',
        label: 'Total Amount',
        required: false,
      },
    ];

    it('should find exact name matches', () => {
      const matches = findFieldMatches(
        'node-1',
        sourceFields,
        ['customer_name', 'customer_email']
      );

      expect(matches).toHaveLength(2);
      expect(matches[0].matchScore).toBe(1.0);
      expect(matches[0].matchReason).toBe('exact_name');
    });

    it('should find normalized name matches', () => {
      const matches = findFieldMatches(
        'node-1',
        sourceFields,
        ['name', 'email']
      );

      expect(matches).toHaveLength(2);
      expect(matches.find(m => m.targetFieldName === 'name')?.matchScore).toBe(0.9);
    });

    it('should respect type compatibility', () => {
      const matches = findFieldMatches(
        'node-1',
        sourceFields,
        ['email'],
        { 'email': 'number' } // Incompatible type
      );

      expect(matches).toHaveLength(0); // Should reject incompatible type
    });

    it('should only return matches above threshold', () => {
      const matches = findFieldMatches(
        'node-1',
        sourceFields,
        ['completely_different_field']
      );

      expect(matches).toHaveLength(0);
    });
  });

  describe('deduplicateMatches', () => {
    it('should keep best match for each target field', () => {
      const matches = [
        {
          sourceNodeId: 'node-1',
          sourceField: {
            fieldId: 'email',
            fieldName: 'email',
            fieldType: 'email',
            label: 'Email',
            required: true
          },
          targetFieldName: 'contact_email',
          matchScore: 0.7,
          matchReason: 'fuzzy_name' as const,
        },
        {
          sourceNodeId: 'node-2',
          sourceField: {
            fieldId: 'customer_email',
            fieldName: 'customer_email',
            fieldType: 'email',
            label: 'Customer Email',
            required: true
          },
          targetFieldName: 'contact_email',
          matchScore: 0.9,
          matchReason: 'normalized_name' as const,
        },
      ];

      const deduplicated = deduplicateMatches(matches);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].matchScore).toBe(0.9);
      expect(deduplicated[0].sourceNodeId).toBe('node-2');
    });
  });
});
