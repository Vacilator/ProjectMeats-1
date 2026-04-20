import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Edge, Node } from '@xyflow/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DynamicConfigPanel } from './DynamicConfigPanel';
import { FormBuilderProvider } from '../../../contexts/FormBuilderContext';

// Minimal schema for conditional visibility based on a defaulted field.
const httpSchema = {
  nodeType: 'actionHTTP',
  displayName: 'HTTP Request',
  version: 'test',
  sections: [
    {
      id: 'http',
      title: 'HTTP Request',
      fields: [
        {
          id: 'method',
          type: 'select',
          label: 'HTTP Method',
          defaultValue: 'GET',
          options: [
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
          ],
        },
        {
          id: 'body',
          type: 'textarea',
          label: 'Request Body',
          conditional: { field: 'method', operator: 'equals', value: 'POST' },
        },
      ],
    },
  ],
} as any;

vi.mock('../config', () => ({
  schemaRegistry: {
    getSchema: vi.fn(() => httpSchema),
  },
}));

vi.mock('../hooks/useUpstreamVariables', () => ({
  useUpstreamVariables: vi.fn(() => ({ variables: [] })),
}));

vi.mock('../../../services/schemaService', () => ({
  useEntityFields: vi.fn(() => ({ data: null })),
}));

vi.mock('../config/fieldRenderers/basicRenderers', () => ({
  renderTextField: vi.fn(({ field, value, onChange }) => (
    <input
      data-testid={`field-${field.id}`}
      value={value ?? ''}
      onChange={(e: any) => onChange(e.target.value)}
    />
  )),
  renderSelectField: vi.fn(({ field, value, onChange }) => (
    <select
      data-testid={`field-${field.id}`}
      value={value ?? ''}
      onChange={(e: any) => onChange(e.target.value)}
    >
      {(field.options ?? []).map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )),
  renderToggleField: vi.fn(() => <input type="checkbox" />),
  renderEntityTypeSelect: vi.fn(() => <select />),
}));

vi.mock('../config/fieldRenderers/complexRenderers', () => ({
  renderEntitySelector: vi.fn(() => <div />),
  renderEntityFieldPicker: vi.fn(() => <div />),
  renderFieldMapping: vi.fn(() => <div />),
  renderVariablePicker: vi.fn(() => <div />),
  renderValidationBuilder: vi.fn(() => <div />),
}));

vi.mock('./NestedChildrenRenderer', () => ({
  NestedChildrenRenderer: () => <div />,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <FormBuilderProvider>{children}</FormBuilderProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

describe('DynamicConfigPanel (visibility + defaults)', () => {
  it('hides conditional fields when defaultValue does not satisfy condition', () => {
    const node: Node = {
      id: 'n1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: { nodeType: 'actionHTTP' },
    };

    const nodes: Node[] = [node];
    const edges: Edge[] = [];

    renderWithProviders(
      <DynamicConfigPanel node={node} nodes={nodes} edges={edges} onUpdateNode={vi.fn()} />,
    );

    const body = screen.getByTestId('field-body');

    // FieldTransitionWrapper should collapse when not visible.
    const wrapper = body.parentElement as HTMLElement;
    expect(wrapper).toHaveStyle({ maxHeight: '0' });
    expect(wrapper).toHaveStyle({ opacity: '0' });
  });
});
