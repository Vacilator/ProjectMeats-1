import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { WorkFormsEditor } from './Editor';
import { loadWorkflow } from '../../components/FlowEditor/utils/workflowPersistence';
import { ApiServiceError } from '../../services/apiErrors';

vi.mock('../../components/FlowEditor/utils/workflowPersistence', () => ({
  loadWorkflow: vi.fn(),
}));

vi.mock('../../hooks/useWorkFormPermissions', () => ({
  useWorkFormPermissions: () => ({
    permissions: {
      can_create: true,
      can_edit: true,
      can_publish: true,
      can_archive: true,
      can_delete: true,
      allowed_modes: ['wizard', 'visual', 'expert'],
      allowed_node_categories: [],
      can_access_system_templates: true,
      can_create_global_templates: false,
      max_active_flows: null,
      role: 'owner',
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  canUseEditorMode: () => true,
  getUpgradeMessage: () => null,
}));

describe('WorkForms Editor load error state', () => {
  it('shows a retryable error panel when a workform fails to load', async () => {
    const err = { response: { status: 500, data: { detail: 'Boom' } }, message: 'Boom' };
    vi.mocked(loadWorkflow).mockRejectedValueOnce(err);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/editor/123']}>
          <Routes>
            <Route path="/workforms/editor/:id" element={<WorkFormsEditor />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Couldn't load workform")).toBeInTheDocument();
    expect(screen.getByText(/Boom/)).toBeInTheDocument();
    expect(screen.getByText(/status 500/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    vi.mocked(loadWorkflow).mockRejectedValueOnce(err);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(loadWorkflow).toHaveBeenCalledTimes(2);
    });
  });

  it('surfaces circuit-breaker friendly errors with status', async () => {
    const err = new ApiServiceError('Server temporarily unreachable. Please try again shortly.', {
      kind: 'circuit_breaker',
      status: 502,
      code: 'CIRCUIT_BREAKER',
    });

    vi.mocked(loadWorkflow).mockRejectedValueOnce(err);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/editor/123']}>
          <Routes>
            <Route path="/workforms/editor/:id" element={<WorkFormsEditor />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Couldn't load workform")).toBeInTheDocument();
    expect(screen.getByText(/Server temporarily unreachable\. Please try again shortly\./)).toBeInTheDocument();
    expect(screen.getByText(/status 502/i)).toBeInTheDocument();
  });
});
