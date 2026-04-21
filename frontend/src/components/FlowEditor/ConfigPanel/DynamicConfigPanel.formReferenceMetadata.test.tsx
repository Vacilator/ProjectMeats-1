import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Node, Edge } from '@xyflow/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormBuilderProvider } from '../../../contexts/FormBuilderContext';

import { DynamicConfigPanel } from './DynamicConfigPanel';

vi.mock('../config', () => ({
  schemaRegistry: {
    getSchema: vi.fn((type: string) => {
      if (type === 'triggerForm') {
        return {
          displayName: 'Trigger (Form)',
          sections: [
            {
              id: 'form',
              title: 'Form Trigger',
              fields: [
                {
                  id: 'formId',
                  label: 'Form',
                  type: 'formReference',
                  required: true,
                },
              ],
            },
          ],
        };
      }
      return null;
    }),
  },
}));

vi.mock('../../../services/workformsApi', () => ({
  listTenantForms: vi.fn(async () => [
    {
      id: 'form-1',
      name: 'Intake Form',
      description: 'Main intake',
      created_at: '2026-01-01T00:00:00Z',
    },
  ]),
  getTenantForm: vi.fn(async () => ({
    id: 'form-1',
    name: 'Intake Form',
    description: 'Main intake',
    form_definition: {
      fields: [{ id: 'a' }, { id: 'b' }],
    },
  })),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <FormBuilderProvider>{children}</FormBuilderProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

describe('DynamicConfigPanel (formReference metadata)', () => {
  const mockNodes: Node[] = [];
  const mockEdges: Edge[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches selected form metadata and stages node preview fields', async () => {
    const onUpdateNode = vi.fn();
    const node: Node = {
      id: 'n1',
      type: 'triggerForm',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'triggerForm',
        formId: '',
      },
    };

    renderWithProviders(
      <DynamicConfigPanel
        node={node}
        nodes={mockNodes}
        edges={mockEdges}
        onUpdateNode={onUpdateNode}
      />
    );

    // Wait for the forms list to be loaded into the select.
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'form-1' } });

    await waitFor(() => {
      const lastCall = onUpdateNode.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe('n1');
      expect(lastCall?.[1]?.formId).toBe('form-1');
      expect(lastCall?.[1]?.tenantFormId).toBe('form-1');
      expect(lastCall?.[1]?.formName).toBe('Intake Form');
      expect(lastCall?.[1]?.formDescription).toBe('Main intake');
      expect(lastCall?.[1]?.fieldCount).toBe(2);
      expect(lastCall?.[1]?.sectionCount).toBe(1);
    });
  });
});
