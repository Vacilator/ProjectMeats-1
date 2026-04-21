import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { WorkFormExecutionDetails } from './ExecutionDetails';
import { workformExecutionService } from '@/services/workformExecutionService';

vi.mock('@/services/workformExecutionService', () => ({
  workformExecutionService: {
    getExecution: vi.fn(),
  },
}));

describe('WorkFormExecutionDetails', () => {
  it('renders current step, inputs, and errors when present', async () => {
    vi.mocked(workformExecutionService.getExecution).mockResolvedValueOnce({
      id: 'ex-1',
      tenant: 't1',
      workform: 'wf-1',
      workform_name: 'My WorkForm',
      status: 'failed',
      initial_data: { entity_type: 'customer', entity_id: '1' },
      context_data: {},
      audit_trail: [],
      node_statuses: {},
      node_labels: { n1: 'Send Email' },
      current_node_id: 'n1',
      current_node_type: 'actionEmail',
      current_node_label: 'Send Email',
      last_event: 'action_error',
      errors: [{ node_id: 'n1', node_label: 'Send Email', error: 'Boom' }],
      started_by: null,
      started_by_name: null,
      started_at: null,
      completed_at: null,
      error_message: 'Boom',
      created_on: '2026-01-01T00:00:00Z',
      modified_on: '2026-01-01T00:00:01Z',
    } as any);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/executions/ex-1']}>
          <Routes>
            <Route path="/workforms/executions/:id" element={<WorkFormExecutionDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('My WorkForm')).toBeInTheDocument();
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();

    expect(await screen.findByText(/^Current step$/i)).toBeInTheDocument();
    expect(screen.getByText(/Node:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Send Email').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/n1/i).length).toBeGreaterThan(0);

    expect(await screen.findByText(/^Inputs$/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/View raw inputs/i));
    expect(await screen.findByText(/entity_type/i)).toBeInTheDocument();

    expect(await screen.findByText(/^Errors$/i)).toBeInTheDocument();
    expect(screen.getAllByText('Boom').length).toBeGreaterThan(0);
  });

  it('renders a helpful error panel when the run cannot be loaded', async () => {
    vi.mocked(workformExecutionService.getExecution).mockRejectedValueOnce({
      response: { status: 404, data: { detail: 'Not found.' } },
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/executions/ex-missing']}>
          <Routes>
            <Route path="/workforms/executions/:id" element={<WorkFormExecutionDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to catalog/i })).toBeInTheDocument();
  });
});
