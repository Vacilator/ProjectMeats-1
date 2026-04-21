import { describe, expect, it, beforeEach } from 'vitest';

import { schemaRegistry } from '../schemaRegistry';
import type { NodeConfigSchema } from '../types';

const resetRegistry = () => {
  // Test-only reset for the singleton registry.
  (schemaRegistry as any).schemas = new Map();
  (schemaRegistry as any).initialized = false;
};

describe('schemaRegistry: required validator normalization', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('prepends a required rule when field.required=true and no required validator exists', () => {
    const schema: NodeConfigSchema = {
      nodeType: 'test.requiredNormalization',
      displayName: 'Test',
      category: 'utility',
      description: 'test',
      version: '1.0.0',
      sections: [
        {
          id: 'main',
          title: 'Main',
          fields: [
            {
              id: 'name',
              label: 'Name',
              type: 'text',
              required: true,
              validation: [{ type: 'minLength', value: 2, message: 'too short' }],
            } as any,
          ],
        },
      ],
    };

    schemaRegistry.register(schema, true);
    const normalized = schemaRegistry.getSchema(schema.nodeType);

    const field = normalized.sections[0].fields[0] as any;
    expect(field.validation?.[0]).toMatchObject({ type: 'required' });
    expect(field.validation?.[1]).toMatchObject({ type: 'minLength' });
  });

  it('normalizes required validators inside nested childSchema sections', () => {
    const schema: NodeConfigSchema = {
      nodeType: 'test.requiredNormalization.childSchema',
      displayName: 'Test',
      category: 'utility',
      description: 'test',
      version: '1.0.0',
      sections: [
        {
          id: 'main',
          title: 'Main',
          fields: [
            {
              id: 'children',
              label: 'Children',
              type: 'nested-children',
              required: false,
              childSchema: {
                sections: [
                  {
                    id: 'child',
                    title: 'Child',
                    fields: [
                      {
                        id: 'childName',
                        label: 'Child Name',
                        type: 'text',
                        required: true,
                      } as any,
                    ],
                  },
                ],
              },
            } as any,
          ],
        },
      ],
    };

    schemaRegistry.register(schema, true);
    const normalized = schemaRegistry.getSchema(schema.nodeType) as any;

    const childField = normalized.sections[0].fields[0].childSchema.sections[0].fields[0];
    expect(childField.validation?.[0]).toMatchObject({ type: 'required' });
  });
});
