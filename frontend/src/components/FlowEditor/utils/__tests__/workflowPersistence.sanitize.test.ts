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
        // UI-only runtime fields should never be persisted
        selected: true,
        dragging: true,
        positionAbsolute: { x: 123, y: 456 },
        measured: { width: 999, height: 888 },
        width: 999,
        height: 888,
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

    // Top-level UI-only React Flow keys should not persist
    const preparedNode = prepared.nodes[0] as any;
    expect(preparedNode.selected).toBeUndefined();
    expect(preparedNode.dragging).toBeUndefined();
    expect(preparedNode.positionAbsolute).toBeUndefined();
    expect(preparedNode.measured).toBeUndefined();
    expect(preparedNode.width).toBeUndefined();
    expect(preparedNode.height).toBeUndefined();
  });

  it('materializes non-empty schema defaults into persisted node.data', () => {
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
      {
        id: 'a2',
        type: 'action',
        position: { x: 200, y: 0 },
        data: {
          actionType: 'http',
          method: 'POST',
        },
      } as any,
    ];

    const edges: Edge[] = [];

    const prepared = prepareWorkflowForSave(nodes, edges);
    const triggerData = prepared.nodes.find((n) => n.id === 't1')!.data as any;
    const actionData = prepared.nodes.find((n) => n.id === 'a1')!.data as any;
    const action2Data = prepared.nodes.find((n) => n.id === 'a2')!.data as any;

    // Trigger defaults are persisted so the saved payload reflects what the panel shows.
    expect(triggerData.type).toBe('manual');

    // actionHTTP defaults
    expect(actionData.method).toBe('GET');
    expect(actionData.headers).toEqual(expect.objectContaining({ 'Content-Type': 'application/json' }));

    // Existing values must not be overwritten.
    expect(action2Data.method).toBe('POST');
  });

  it('canonicalizes form nodes to formFields-only payloads during save', () => {
    const nodes: Node[] = [
      {
        id: 'form-1',
        type: 'form',
        position: { x: 0, y: 0 },
        data: {
          entityType: 'supplier',
          fields: [
            {
              name: 'email',
              label: 'Email',
              type: 'EmailField',
              required: true,
              fieldId: 'sf-123',
            },
          ],
        },
      } as any,
    ];

    const prepared = prepareWorkflowForSave(nodes, []);
    const preparedNodeData = prepared.nodes[0]!.data as any;

    expect(preparedNodeData.formFields).toHaveLength(1);
    expect(preparedNodeData.formFields[0]).toMatchObject({
      id: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    });
    expect(preparedNodeData.fields).toBeUndefined();
    expect(preparedNodeData.fieldMappings).toBeUndefined();
  });
});
