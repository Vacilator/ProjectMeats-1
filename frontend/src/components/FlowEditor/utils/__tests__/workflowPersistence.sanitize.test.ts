import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

import { prepareWorkflowForSave } from '../workflowPersistence';

describe('prepareWorkflowForSave (sanitization)', () => {
  it('removes UI-only node.data keys from the persisted workflow payload', () => {
    const nodes: Node[] = [
      {
        id: 'n1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'actionEmail',
          subject: 'hello',
          shadowConfig: { subject: 'draft' },
          configStatus: 'dirty',
          hasBreakpoint: true,
          _upstreamVariables: [{ id: 'v1' }],
          config: {
            nodeType: 'actionEmail',
            subject: 'hello',
            shadowConfig: { nope: true },
            configStatus: 'dirty',
            _upstreamVariables: [{ id: 'v2' }],
          },
        },
      } as any,
    ];

    const edges: Edge[] = [];

    const prepared = prepareWorkflowForSave(nodes, edges);
    const preparedNodeData = prepared.nodes[0]!.data as any;

    expect(preparedNodeData.subject).toBe('hello');
    expect(preparedNodeData.nodeType).toBe('actionEmail');

    expect(preparedNodeData.shadowConfig).toBeUndefined();
    expect(preparedNodeData.configStatus).toBeUndefined();
    expect(preparedNodeData.hasBreakpoint).toBeUndefined();
    expect(preparedNodeData._upstreamVariables).toBeUndefined();

    expect(preparedNodeData.config?.shadowConfig).toBeUndefined();
    expect(preparedNodeData.config?.configStatus).toBeUndefined();
    expect(preparedNodeData.config?._upstreamVariables).toBeUndefined();
  });
});
