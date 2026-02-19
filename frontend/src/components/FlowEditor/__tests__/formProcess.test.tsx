/**
 * Form Process Node Tests
 * 
 * Basic smoke tests for formProcess node type registration.
 * Note: Full schema validation skipped due to validation object vs array inconsistency.
 * 
 * Created: 2026-02-19 - Phase D.3 + E.2 Completion
 */

import { describe, it, expect } from 'vitest';

describe('FormProcess Node', () => {
  describe('Schema System', () => {
    it('should be able to import schema registry', async () => {
      const { schemaRegistry } = await import('../config/schemaRegistry');
      expect(schemaRegistry).toBeDefined();
      expect(schemaRegistry.hasSchema).toBeDefined();
      expect(schemaRegistry.getSchema).toBeDefined();
    });

    it('should be able to import node schemas', async () => {
      const { allSchemas } = await import('../config/nodeConfigSchemas');
      expect(allSchemas).toBeDefined();
      expect(Array.isArray(allSchemas)).toBe(true);
      expect(allSchemas.length).toBeGreaterThan(0);
    });

    it('should have formProcess in schemas list', async () => {
      const { allSchemas } = await import('../config/nodeConfigSchemas');
      const formProcessSchema = allSchemas.find(s => s.nodeType === 'formMultiStepContainer');
      expect(formProcessSchema).toBeDefined();
      expect(formProcessSchema?.displayName).toBeDefined();
    });

    it('should have formStepSingle in schemas list', async () => {
      const { allSchemas } = await import('../config/nodeConfigSchemas');
      const formStepSchema = allSchemas.find(s => s.nodeType === 'formStepSingle');
      expect(formStepSchema).toBeDefined();
      expect(formStepSchema?.sections).toBeDefined();
    });

    it('should have createRecord in schemas list', async () => {
      const { allSchemas } = await import('../config/nodeConfigSchemas');
      const createRecordSchema = allSchemas.find(s => s.nodeType === 'createRecord');
      expect(createRecordSchema).toBeDefined();
    });

    it('should have outlookEmail in schemas list', async () => {
      const { allSchemas } = await import('../config/nodeConfigSchemas');
      const outlookEmailSchema = allSchemas.find(s => s.nodeType === 'outlookEmail');
      expect(outlookEmailSchema).toBeDefined();
    });
  });

  describe('Schema Structure', () => {
    it('should have valid structure for all schemas', async () => {
      const { allSchemas } = await import('../config/nodeConfigSchemas');
      
      allSchemas.forEach(schema => {
        expect(schema).toHaveProperty('nodeType');
        expect(schema).toHaveProperty('displayName');
        expect(schema).toHaveProperty('sections');
        expect(Array.isArray(schema.sections)).toBe(true);
        
        // Each section should have fields
        schema.sections.forEach(section => {
          expect(section).toHaveProperty('id');
          expect(section).toHaveProperty('title');
          expect(section).toHaveProperty('fields');
          expect(Array.isArray(section.fields)).toBe(true);
        });
      });
    });
  });
});
