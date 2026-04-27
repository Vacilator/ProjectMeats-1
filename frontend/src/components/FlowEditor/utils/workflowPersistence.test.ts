import { describe, it, expect } from 'vitest';

import type { Node } from '@xyflow/react';

import { extractFormReferences } from './workflowPersistence';

const asNode = (partial: Partial<Node>): Node => partial as unknown as Node;

describe('extractFormReferences', () => {
  it('extracts unique tenantFormId references from supported node types', () => {
    const nodes: Node[] = [
      asNode({ id: '1', type: 'formStep', data: { tenantFormId: 'form-a' } }),
      asNode({ id: '2', type: 'formReference', data: { tenantFormId: 'form-b' } }),
      asNode({ id: '3', type: 'formMultiStepContainer', data: { tenantFormId: 'form-c' } }),
      asNode({ id: '4', type: 'formProcessGroup', data: { tenantFormId: 'form-d' } }),
      asNode({ id: '5', type: 'formBook', data: { tenantFormId: 'form-e' } }),
      asNode({ id: '6', type: 'smartWorkForm', data: { tenantFormId: 'form-f' } }),
      // duplicates should be de-duped
      asNode({ id: '7', type: 'formStep', data: { tenantFormId: 'form-a' } }),
    ];

    const refs = extractFormReferences(nodes).sort();
    expect(refs).toEqual(['form-a', 'form-b', 'form-c', 'form-d', 'form-e', 'form-f'].sort());
  });

  it('supports legacy formReference.data.formId when UUID-like, and ignores non-UUID formId', () => {
    const validUuid = '0a76ddda-bdd8-40dc-a6e5-262a759e0c6c';
    const invalidUuid = 'not-a-uuid';

    const nodes: Node[] = [
      asNode({ id: '1', type: 'formReference', data: { formId: validUuid } }),
      asNode({ id: '2', type: 'formReference', data: { formId: invalidUuid } }),
    ];

    expect(extractFormReferences(nodes)).toEqual([validUuid]);
  });

  it('tolerates missing data payloads without throwing', () => {
    const nodes: Node[] = [
      asNode({ id: '1', type: 'formStep', data: undefined }),
      asNode({ id: '2', type: 'formReference', data: null }),
      asNode({ id: '3', type: 'other', data: { tenantFormId: 'form-x' } }),
    ];

    expect(extractFormReferences(nodes)).toEqual([]);
  });
});
