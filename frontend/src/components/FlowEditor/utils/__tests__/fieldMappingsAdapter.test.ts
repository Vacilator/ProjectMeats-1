import { describe, it, expect } from 'vitest';

import { normalizeFieldMappings } from '../fieldMappingsAdapter';

describe('fieldMappingsAdapter', () => {
  it('normalizes legacy AutoMappingService shape into FieldMappingPanel shape', () => {
    const out = normalizeFieldMappings([
      {
        id: 's1',
        targetFieldName: 'email',
        sourceNodeId: 'n1',
        sourceFieldName: 'email',
      },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 's1',
      entityField: 'email',
      formFieldId: 'n1.email',
      transformation: { type: 'direct' },
      autoPopulate: {
        sourceStep: 'n1',
        sourceField: 'email',
        mode: 'copy',
      },
    });
  });
});
