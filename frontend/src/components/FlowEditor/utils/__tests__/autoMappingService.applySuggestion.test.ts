import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';

import { AutoMappingService } from '../autoMappingService';

describe('AutoMappingService.applySuggestion', () => {
  const baseNode: Node = {
    id: 'n1',
    type: 'formStep',
    position: { x: 0, y: 0 },
    data: {
      fieldMappings: [],
    },
  };

  const suggestion = {
    id: 's1',
    targetFieldName: 'name',
    sourceNodeId: 'up1',
    sourceFieldName: 'full_name',
    sourceFieldLabel: 'Full Name',
    matchScore: 0.95,
    matchReason: 'exact_name' as const,
    autoApply: true,
  };

  it('adds a mapping immutably', () => {
    const updated = AutoMappingService.applySuggestion(baseNode, suggestion);

    expect(updated).not.toBe(baseNode);
    expect(updated.data).not.toBe(baseNode.data);

    const mappings = (updated.data as any).fieldMappings;
    expect(Array.isArray(mappings)).toBe(true);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({
      id: 's1',
      targetFieldName: 'name',
      sourceNodeId: 'up1',
      sourceFieldName: 'full_name',
    });
  });

  it('does not duplicate existing mappings', () => {
    const once = AutoMappingService.applySuggestion(baseNode, suggestion);
    const twice = AutoMappingService.applySuggestion(once, suggestion);

    const mappings = (twice.data as any).fieldMappings;
    expect(mappings).toHaveLength(1);
  });
});
