import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

import { validateWorkflow } from '../validationEngine';

describe('workflow validationEngine (schema parity)', () => {
  it('blocks publish when schema-required fields are missing (generic actionType inference)', () => {
    const nodes: Node[] = [
      {
        id: 't1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {},
      } as any,
      {
        id: 'a1',
        type: 'action',
        position: { x: 100, y: 0 },
        data: {
          actionType: 'http',
        },
      } as any,
    ];

    const edges: Edge[] = [
      {
        id: 'e1',
        source: 't1',
        target: 'a1',
      } as any,
    ];

    const result = validateWorkflow(nodes, edges);

    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.nodeId === 'a1' && i.message === 'URL is required')).toBe(true);

    // Trigger defaults to manual, so schedule-only required fields must not block.
    expect(result.issues.some((i) => i.message === 'Interval is required')).toBe(false);
  });
});
