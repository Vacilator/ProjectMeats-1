import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

import {
  AINodeSuggestionService,
  canonicalizeNodeTypeId,
} from './aiNodeSuggestionService';

import { NODE_TYPE_REGISTRY } from '@/components/FlowEditor/nodeTypes';

function makeNode(id: string, type: string, x = 0, y = 0): Node {
  return {
    id,
    type,
    position: { x, y },
    data: {},
  } as unknown as Node;
}

describe('aiNodeSuggestionService', () => {
  it('canonicalizeNodeTypeId maps legacy form/triggers to current registry IDs', () => {
    expect(canonicalizeNodeTypeId('FormStepSingle')).toBe('form');
    expect(canonicalizeNodeTypeId('formStepSingle')).toBe('form');
    expect(canonicalizeNodeTypeId('triggerManualStart')).toBe('triggerManual');
    expect(canonicalizeNodeTypeId('triggerScheduled')).toBe('triggerSchedule');
  });

  it('getSuggestions returns canonical nodeType IDs that exist in NODE_TYPE_REGISTRY', () => {
    const nodes: Node[] = [makeNode('t1', 'triggerManual')];
    const edges: Edge[] = [];

    const suggestions = AINodeSuggestionService.getSuggestions(nodes, edges, 't1');
    expect(suggestions.length).toBeGreaterThan(0);

    for (const s of suggestions) {
      const canonical = canonicalizeNodeTypeId(s.nodeType);
      expect(NODE_TYPE_REGISTRY[canonical]).toBeTruthy();
    }

    // Should include the canonical form step suggestion
    expect(suggestions.some((s) => canonicalizeNodeTypeId(s.nodeType) === 'form')).toBe(true);
  });
});
