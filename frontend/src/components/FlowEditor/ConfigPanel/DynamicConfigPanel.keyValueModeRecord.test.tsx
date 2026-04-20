import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Edge, Node } from '@xyflow/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DynamicConfigPanel } from './DynamicConfigPanel';
import { FormBuilderProvider } from '../../../contexts/FormBuilderContext';

const schema = {
  nodeType: 'actionHTTP',
  displayName: 'HTTP Request',
  version: 'test',
  sections: [
    {
      id: 'http',
      title: 'HTTP',
      fields: [
        {
          id: 'headers',
          type: 'keyValue',
          keyValueMode: 'record',
          label: 'Headers',
          placeholder: { key: 'Header name', value: 'Header value' },
          addButtonText: '+ Add Header',
          defaultValue: {},
        },
      ],
    },
  ],
} as any;

vi.mock('../config', () => ({
  schemaRegistry: {
    getSchema: vi.fn(() => schema),
  },
}));

vi.mock('../hooks/useUpstreamVariables', () => ({
  useUpstreamVariables: vi.fn(() => ({ variables: [] })),
}));

vi.mock('../../../services/schemaService', () => ({
  useEntityFields: vi.fn(() => ({ data: null })),
}));

vi.mock('../config/fieldRenderers/basicRenderers', () => ({
  renderTextField: vi.fn(() => <input />),
  renderSelectField: vi.fn(() => <select />),
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

describe('DynamicConfigPanel (keyValueMode=record)', () => {
  it('emits a record object for keyValueMode=record fields', () => {
    const node: Node = {
      id: 'n1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: { nodeType: 'actionHTTP' },
    };

    const nodes: Node[] = [node];
    const edges: Edge[] = [];
    const onUpdateNode = vi.fn();

    renderWithProviders(
      <DynamicConfigPanel node={node} nodes={nodes} edges={edges} onUpdateNode={onUpdateNode} />,
    );

    fireEvent.click(screen.getByText('+ Add Header'));

    const keyInput = screen.getByPlaceholderText('Header name');
    const valueInput = screen.getByPlaceholderText('Header value');

    fireEvent.change(keyInput, { target: { value: 'X-Test' } });
    fireEvent.change(valueInput, { target: { value: '123' } });

    expect(onUpdateNode).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({
        headers: { 'X-Test': '123' },
      }),
    );
  });
});
