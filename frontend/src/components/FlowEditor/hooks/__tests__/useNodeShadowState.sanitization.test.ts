import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import type { Node } from '@xyflow/react';

import { useNodeShadowState } from '../useNodeShadowState';

function setup(initialNodes: Node[], nodeId: string) {
  return renderHook(() => {
    const [nodes, setNodes] = React.useState<Node[]>(initialNodes);
    const api = useNodeShadowState(nodeId, nodes, setNodes);
    return { nodes, api };
  });
}

describe('useNodeShadowState (sanitization)', () => {
  it('commits config changes but strips shadow bookkeeping + underscore keys', () => {
    const initialNodes: Node[] = [
      {
        id: 'n1',
        type: 'actionEmail',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'actionEmail',
          subject: 'old',
          _upstreamVariables: [{ id: 'x' }],
          shadowConfig: { subject: 'wip', configStatus: 'dirty' },
          configStatus: 'dirty',
          config: { subject: 'old' },
        },
      } as any,
    ];

    const { result } = setup(initialNodes, 'n1');

    act(() => {
      // Simulate panel update that could accidentally include UI-only keys.
      result.current.api.updateShadow({
        subject: 'new',
        shadowConfig: { injected: true },
        configStatus: 'dirty',
        _upstreamVariables: [{ id: 'y' }],
      } as any);
    });

    act(() => {
      result.current.api.commitShadow();
    });

    const committed = result.current.nodes.find((n) => n.id === 'n1')!;

    expect((committed.data as any).subject).toBe('new');

    // UI-only keys should not persist post-commit
    expect((committed.data as any).shadowConfig).toBeUndefined();
    expect((committed.data as any).configStatus).toBe('pristine');
    expect((committed.data as any)._upstreamVariables).toBeUndefined();

    // Config snapshot should be sanitized too
    expect((committed.data as any).config).toEqual({ subject: 'new', nodeType: 'actionEmail' });
  });
});
