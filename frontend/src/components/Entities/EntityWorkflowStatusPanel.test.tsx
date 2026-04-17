import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EntityWorkflowStatusPanel } from './EntityWorkflowStatusPanel';

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
});
