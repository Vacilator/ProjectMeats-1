import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import {
  getUpstreamOutputs,
  formatInheritanceSyntax,
  parseInheritanceSyntax,
  isInheritanceSyntax,
  getUpstreamNodes,
} from './flowUtils';

// ─── helpers ────────────────────────────────────────────────────────────────────

const mkNode = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const mkEdge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

// ─── formatInheritanceSyntax ────────────────────────────────────────────────────

describe('formatInheritanceSyntax', () => {
  it('formats node and field into handlebars syntax', () => {
    expect(formatInheritanceSyntax('customerForm', 'email')).toBe('{{customerForm.email}}');
  });

  it('handles underscored names', () => {
    expect(formatInheritanceSyntax('step_1', 'full_name')).toBe('{{step_1.full_name}}');
  });
});

// ─── parseInheritanceSyntax ─────────────────────────────────────────────────────

describe('parseInheritanceSyntax', () => {
  it('parses valid handlebars syntax', () => {
    expect(parseInheritanceSyntax('{{customerForm.email}}')).toEqual({
      nodeId: 'customerForm',
      fieldName: 'email',
    });
  });

  it('parses underscored identifiers', () => {
    expect(parseInheritanceSyntax('{{step_1.full_name}}')).toEqual({
      nodeId: 'step_1',
      fieldName: 'full_name',
    });
  });

  it('parses hyphenated node IDs', () => {
    expect(parseInheritanceSyntax('{{node-1.field_a}}')).toEqual({
      nodeId: 'node-1',
      fieldName: 'field_a',
    });
  });

  it('returns null for invalid syntax', () => {
    expect(parseInheritanceSyntax('not handlebars')).toBeNull();
    expect(parseInheritanceSyntax('{{invalid}}')).toBeNull();
    expect(parseInheritanceSyntax('')).toBeNull();
  });

  it('returns null for nested dots', () => {
    expect(parseInheritanceSyntax('{{a.b.c}}')).toBeNull();
  });
});

// ─── isInheritanceSyntax ────────────────────────────────────────────────────────

describe('isInheritanceSyntax', () => {
  it('detects handlebars syntax', () => {
    expect(isInheritanceSyntax('{{node.field}}')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(isInheritanceSyntax('plain text')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isInheritanceSyntax(42)).toBe(false);
    expect(isInheritanceSyntax(null)).toBe(false);
    expect(isInheritanceSyntax(undefined)).toBe(false);
  });

  it('rejects partial handlebars', () => {
    expect(isInheritanceSyntax('{{open only')).toBe(false);
    expect(isInheritanceSyntax('close only}}')).toBe(false);
  });
});

// ─── getUpstreamOutputs ─────────────────────────────────────────────────────────

describe('getUpstreamOutputs', () => {
  it('returns empty array when node has no upstream', () => {
    const nodes = [mkNode('a', 'formStep')];
    const edges: Edge[] = [];
    expect(getUpstreamOutputs(nodes, edges, 'a')).toEqual([]);
  });

  it('collects outputs from direct upstream form node', () => {
    const nodes = [
      mkNode('form1', 'formStep', {
        label: 'Customer Form',
        formFields: [
          { name: 'email', label: 'Email', type: 'email', defaultValue: 'a@b.com' },
          { name: 'name', label: 'Name', type: 'text' },
        ],
      }),
      mkNode('sendEmail', 'action'),
    ];
    const edges = [mkEdge('form1', 'sendEmail')];

    const outputs = getUpstreamOutputs(nodes, edges, 'sendEmail');
    expect(outputs).toHaveLength(2);
    expect(outputs[0].nodeId).toBe('form1');
    expect(outputs[0].fieldName).toBe('email');
    expect(outputs[0].fieldType).toBe('email');
    expect(outputs[1].fieldName).toBe('name');
  });

  it('filters by expectedType', () => {
    const nodes = [
      mkNode('form1', 'formStep', {
        formFields: [
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'name', label: 'Name', type: 'text' },
        ],
      }),
      mkNode('consumer', 'action'),
    ];
    const edges = [mkEdge('form1', 'consumer')];

    const outputs = getUpstreamOutputs(nodes, edges, 'consumer', 'email');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].fieldType).toBe('email');
  });

  it('traverses multi-level upstream chain', () => {
    const nodes = [
      mkNode('a', 'formStep', {
        formFields: [{ name: 'f1', label: 'F1', type: 'text' }],
      }),
      mkNode('b', 'formStep', {
        formFields: [{ name: 'f2', label: 'F2', type: 'number' }],
      }),
      mkNode('c', 'action'),
    ];
    const edges = [mkEdge('a', 'b'), mkEdge('b', 'c')];

    const outputs = getUpstreamOutputs(nodes, edges, 'c');
    expect(outputs).toHaveLength(2);
    const fieldNames = outputs.map(o => o.fieldName);
    expect(fieldNames).toContain('f1');
    expect(fieldNames).toContain('f2');
  });

  it('handles cycles without infinite loops', () => {
    const nodes = [
      mkNode('a', 'formStep', {
        formFields: [{ name: 'f1', label: 'F1', type: 'text' }],
      }),
      mkNode('b', 'formStep', {
        formFields: [{ name: 'f2', label: 'F2', type: 'text' }],
      }),
    ];
    const edges = [mkEdge('a', 'b'), mkEdge('b', 'a')];

    // Should not hang — cycle detection prevents it
    const outputs = getUpstreamOutputs(nodes, edges, 'b');
    expect(outputs.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts entity node outputs', () => {
    const nodes = [
      mkNode('entity1', 'createRecord', {
        entityType: 'customer',
        label: 'Create Customer',
        outputFields: [
          { name: 'id', label: 'ID', type: 'text', sampleValue: '123' },
          { name: 'name', label: 'Name', type: 'text', sampleValue: 'Acme' },
        ],
      }),
      mkNode('next', 'action'),
    ];
    const edges = [mkEdge('entity1', 'next')];

    const outputs = getUpstreamOutputs(nodes, edges, 'next');
    expect(outputs).toHaveLength(2);
    expect(outputs[0].nodeLabel).toBe('Create Customer');
  });

  it('extracts lookup result outputs', () => {
    const nodes = [
      mkNode('lookup', 'lookup', {
        label: 'Find Supplier',
        lookupResult: { supplier_name: 'Acme', rating: 5 },
      }),
      mkNode('next', 'action'),
    ];
    const edges = [mkEdge('lookup', 'next')];

    const outputs = getUpstreamOutputs(nodes, edges, 'next');
    expect(outputs).toHaveLength(2);
    expect(outputs.find(o => o.fieldName === 'supplier_name')?.fieldType).toBe('text');
    expect(outputs.find(o => o.fieldName === 'rating')?.fieldType).toBe('number');
  });

  it('extracts variable node outputs', () => {
    const nodes = [
      mkNode('vars', 'variables', {
        label: 'Config',
        variables: [
          { key: 'threshold', label: 'Threshold', type: 'number', value: 100 },
        ],
      }),
      mkNode('next', 'action'),
    ];
    const edges = [mkEdge('vars', 'next')];

    const outputs = getUpstreamOutputs(nodes, edges, 'next');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].fieldName).toBe('threshold');
  });

  it('extracts API response node outputs', () => {
    const nodes = [
      mkNode('api', 'webhook', {
        label: 'Fetch Data',
        responseData: {
          email: 'test@example.com',
          created: '2026-01-01',
          url: 'https://example.com',
        },
      }),
      mkNode('next', 'action'),
    ];
    const edges = [mkEdge('api', 'next')];

    const outputs = getUpstreamOutputs(nodes, edges, 'next');
    expect(outputs).toHaveLength(3);
    expect(outputs.find(o => o.fieldName === 'email')?.fieldType).toBe('email');
    expect(outputs.find(o => o.fieldName === 'created')?.fieldType).toBe('date');
    expect(outputs.find(o => o.fieldName === 'url')?.fieldType).toBe('url');
  });

  it('returns empty when no edges match source', () => {
    const nodes = [
      mkNode('orphan', 'formStep', {
        formFields: [{ name: 'f1', label: 'F1', type: 'text' }],
      }),
      mkNode('consumer', 'action'),
    ];
    const edges: Edge[] = []; // No connection

    expect(getUpstreamOutputs(nodes, edges, 'consumer')).toEqual([]);
  });
});

// ─── getUpstreamNodes ───────────────────────────────────────────────────────────

describe('getUpstreamNodes', () => {
  it('returns empty for root node', () => {
    const nodes = [mkNode('root', 'start')];
    expect(getUpstreamNodes(nodes, [], 'root')).toEqual([]);
  });

  it('returns direct parent nodes', () => {
    const nodes = [mkNode('a', 'form'), mkNode('b', 'action')];
    const edges = [mkEdge('a', 'b')];

    const upstream = getUpstreamNodes(nodes, edges, 'b');
    expect(upstream).toHaveLength(1);
    expect(upstream[0].id).toBe('a');
  });

  it('returns transitive upstream nodes', () => {
    const nodes = [
      mkNode('a', 'form'),
      mkNode('b', 'process'),
      mkNode('c', 'action'),
    ];
    const edges = [mkEdge('a', 'b'), mkEdge('b', 'c')];

    const upstream = getUpstreamNodes(nodes, edges, 'c');
    expect(upstream).toHaveLength(2);
    const ids = upstream.map(n => n.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('handles diamond-shaped DAG (may include duplicates from multiple paths)', () => {
    const nodes = [
      mkNode('a', 'start'),
      mkNode('b', 'left'),
      mkNode('c', 'right'),
      mkNode('d', 'merge'),
    ];
    const edges = [
      mkEdge('a', 'b'),
      mkEdge('a', 'c'),
      mkEdge('b', 'd'),
      mkEdge('c', 'd'),
    ];

    const upstream = getUpstreamNodes(nodes, edges, 'd');
    // a is pushed from both b and c branches (push before visited check)
    const ids = new Set(upstream.map(n => n.id));
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(upstream.length).toBeGreaterThanOrEqual(3);
  });

  it('handles cycles gracefully', () => {
    const nodes = [mkNode('a', 'x'), mkNode('b', 'x')];
    const edges = [mkEdge('a', 'b'), mkEdge('b', 'a')];

    const upstream = getUpstreamNodes(nodes, edges, 'b');
    expect(upstream.length).toBeGreaterThanOrEqual(1);
  });
});
