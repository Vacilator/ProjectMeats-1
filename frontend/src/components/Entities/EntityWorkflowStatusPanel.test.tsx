import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EntityWorkflowStatusPanel } from './EntityWorkflowStatusPanel';
import { workformExecutionService } from '@/services/workformExecutionService';

vi.mock('@/services/workformExecutionService', () => ({
  workformExecutionService: {
    getExecutions: vi.fn(async () => ({ count: 0, next: null, previous: null, results: [] })),
  },
}));

describe('EntityWorkflowStatusPanel', () => {
  it('renders empty state when no executions exist', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EntityWorkflowStatusPanel entityType="customer" entityId="1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/No workflow executions found/i)).toBeInTheDocument();
  });

  it('renders an execution with audit events and details link', async () => {
    vi.mocked(workformExecutionService.getExecutions).mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'ex-1',
          tenant: 't1',
          workform: 'wf-1',
          workform_name: 'My WorkForm',
          status: 'completed',
          initial_data: {},
          context_data: {},
          audit_trail: [{ event: 'execution_start', node_id: 'n1', ts: '2026-01-01T00:00:00Z' }],
          node_statuses: { n1: 'completed' },
          current_node_id: 'n1',
          current_node_type: 'actionEmail',
          last_event: 'execution_start',
          errors: [{ node_id: 'n1', error: 'Boom' }],
          started_by: null,
          started_by_name: 'Tester',
          started_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-01T00:00:01Z',
          error_message: '',
          created_on: '2026-01-01T00:00:00Z',
          modified_on: '2026-01-01T00:00:01Z',
        },
      ],
    } as any);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EntityWorkflowStatusPanel entityType="customer" entityId="1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('My WorkForm')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();

    // Expand collapse to show audit
    await userEvent.click(screen.getByText('My WorkForm'));
    expect(await screen.findByText(/Current step/i)).toBeInTheDocument();
    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    expect(await screen.findByText(/Step status/i)).toBeInTheDocument();
    const pills = screen.getAllByText((_, node) =>
      (node?.textContent ?? '').replace(/\s+/g, ' ').trim() === 'n1: completed'
    );
    expect(pills.length).toBeGreaterThan(0);

    expect(await screen.findByText(/execution_start/i)).toBeInTheDocument();
    expect(screen.getByText(/View execution details/i)).toBeInTheDocument();
  });
});
