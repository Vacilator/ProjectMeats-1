import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

vi.mock('@/components/Shared', () => ({
  ActivityFeed: ({ entityType, entityId }: { entityType: string; entityId: string | number }) => (
    <div data-testid="activity-feed">
      {entityType}:{String(entityId)}
    </div>
  ),
}));

describe('WorkFormExecutionDetails', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  it('renders current step, inputs, and errors when present', async () => {
    vi.mocked(workformExecutionService.getExecution).mockResolvedValueOnce({
      id: 'ex-1',
      tenant: 't1',
      workform: 'wf-1',
      workform_name: 'My WorkForm',
      status: 'failed',
      initial_data: { entity_type: 'customer', entity_id: '1' },
      context_data: {},
      audit_trail: [
        { event: 'execution_start', ts: '2026-01-01T00:00:00Z' },
        { event: 'node_enter', node_id: 'n1', node_type: 'actionEmail', ts: '2026-01-01T00:00:01Z' },
        {
          event: 'action_error',
          node_id: 'n1',
          node_type: 'actionEmail',
          error: 'Boom',
          routed_to: 'n2',
          ts: '2026-01-01T00:00:02Z',
        },
      ],
      node_statuses: {},
      node_labels: { n1: 'Send Email', n2: 'Create Task' },
      current_node_id: 'n1',
      current_node_type: 'actionEmail',
      current_node_label: 'Send Email',
      last_event: 'action_error',
      errors: [{ node_id: 'n1', node_label: 'Send Email', error: 'Boom', routed_to: 'n2' }],
      started_by: null,
      started_by_name: null,
      started_at: '2026-01-01T00:00:00Z',
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

    expect(await screen.findByRole('heading', { name: /execution story/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /execution story/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.getByText(/Action failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Routed to: Create Task/i)).toBeInTheDocument();

    expect(await screen.findByText(/^Current step$/i)).toBeInTheDocument();
    expect(screen.getByText(/Node:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Send Email').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/n1/i).length).toBeGreaterThan(0);

    expect(await screen.findByText(/^Errors$/i)).toBeInTheDocument();
    expect(screen.getAllByText('Boom').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText(/^Debug data$/i));
    expect(await screen.findByText(/^Inputs$/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/View raw inputs/i));
    expect(await screen.findByText(/entity_type/i)).toBeInTheDocument();
  });

  it('renders an activity tab scoped to the execution id', async () => {
    vi.mocked(workformExecutionService.getExecution).mockResolvedValueOnce({
      id: 'ex-1',
      tenant: 't1',
      workform: 'wf-1',
      workform_name: 'My WorkForm',
      status: 'completed',
      initial_data: {},
      context_data: {},
      audit_trail: [],
      node_statuses: {},
      node_labels: {},
      errors: [],
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

    await userEvent.click(await screen.findByRole('tab', { name: /activity/i }));
    expect(await screen.findByTestId('activity-feed')).toHaveTextContent('workform_execution:ex-1');
  });

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
    await Promise.resolve();
  };

  const waitForCondition = async (cond: () => boolean, maxTicks = 50) => {
    for (let i = 0; i < maxTicks; i++) {
      if (cond()) return;
      await advance(0);
      await advance(10);
    }
    throw new Error('Condition not met');
  };

  it('stops polling after a refetch error (prevents error-loop)', async () => {
    vi.useFakeTimers();

    vi.mocked(workformExecutionService.getExecution)
      .mockResolvedValueOnce({
        id: 'ex-1',
        workform_name: 'WF',
        status: 'pending',
        initial_data: {},
        audit_trail: [],
        errors: [],
      } as any)
      .mockRejectedValueOnce({
        response: { status: 500, data: { detail: 'Boom' } },
      });

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

    await waitForCondition(() => Boolean(screen.queryByTestId('workform-execution-status')));
    expect(screen.getByTestId('workform-execution-status')).toHaveTextContent('pending');

    // Trigger first poll tick (status pending => 2000ms)
    await advance(2000);

    // After a refetch error, we should land in the error panel.
    await waitForCondition(() => Boolean(screen.queryByRole('button', { name: /try again/i }))); 
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Advance multiple more ticks; should NOT keep polling.
    await advance(10000);
    expect(vi.mocked(workformExecutionService.getExecution).mock.calls.length).toBe(2);
  });

  it('refetches once on Try again and does not continue polling for terminal status', async () => {
    vi.useFakeTimers();

    vi.mocked(workformExecutionService.getExecution)
      .mockResolvedValueOnce({
        id: 'ex-1',
        workform_name: 'WF',
        status: 'pending',
        initial_data: {},
        audit_trail: [],
        errors: [],
      } as any)
      .mockRejectedValueOnce({
        response: { status: 500, data: { detail: 'Boom' } },
      })
      .mockResolvedValueOnce({
        id: 'ex-1',
        workform_name: 'WF',
        status: 'failed',
        initial_data: {},
        audit_trail: [],
        errors: [],
        error_message: 'Boom',
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

    await waitForCondition(() => Boolean(screen.queryByTestId('workform-execution-status')));
    expect(screen.getByTestId('workform-execution-status')).toHaveTextContent('pending');

    await advance(2000);
    await waitForCondition(() => Boolean(screen.queryByRole('button', { name: /try again/i })));

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(vi.mocked(workformExecutionService.getExecution).mock.calls.length).toBe(3);

    // Terminal status should disable polling.
    await advance(10000);
    expect(vi.mocked(workformExecutionService.getExecution).mock.calls.length).toBe(3);
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
