import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';

import { inferOutputSchemaFromFormNode } from '../outputSchemaInference';

describe('inferOutputSchemaFromFormNode', () => {
  it('infers output fields from canonical formFields payloads', () => {
    const node: Node = {
      id: 'form-1',
      type: 'form',
      position: { x: 0, y: 0 },
      data: {
        entityType: 'supplier',
        formFields: [
          {
            id: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            defaultValue: 'buyer@example.com',
            validation: [],
          },
        ],
      },
    } as Node;

    const schema = inferOutputSchemaFromFormNode(node);

    expect(schema).not.toBeNull();
    expect(schema?.outputFields).toEqual([
      expect.objectContaining({
        fieldId: 'email',
        fieldName: 'email',
        fieldType: 'email',
        label: 'Email',
        required: true,
        defaultValue: 'buyer@example.com',
      }),
    ]);
  });
});
