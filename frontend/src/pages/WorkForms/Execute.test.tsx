import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ExecuteWorkForm from './Execute';
import { createFormSubmission, executeTenantWorkForm } from '@/services/workformsApi';
import { showAlert } from '@/utils/uiDialogs';

vi.mock('@/services/workformsApi', () => ({
  executeTenantWorkForm: vi.fn(),
  createFormSubmission: vi.fn(),
}));

vi.mock('@/utils/uiDialogs', () => ({
  showAlert: vi.fn(),
}));

describe('ExecuteWorkForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const renderWithRoutes = (initialPath: string) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/workforms/execute/:id" element={<ExecuteWorkForm />} />
            <Route path="/workforms/executions/:id" element={<div data-testid="dest-execution" />} />
            <Route path="/workforms/in-progress/:id" element={<div data-testid="dest-in-progress" />} />
            <Route path="/workforms/catalog" element={<div data-testid="dest-catalog" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('executes a WorkForm and navigates to execution details (including active record context)', async () => {
    sessionStorage.setItem(
      'pm.activeRecordContext',
      JSON.stringify({ activeRecord: { type: 'customer', id: 123 } })
    );

    vi.mocked(executeTenantWorkForm).mockResolvedValueOnce({
      id: 'ex-1',
      status: 'completed',
    } as any);

    renderWithRoutes('/workforms/execute/wf-1');

    expect(await screen.findByTestId('dest-execution')).toBeInTheDocument();
    expect(executeTenantWorkForm).toHaveBeenCalledWith('wf-1', {
      entity_type: 'customer',
      entity_id: '123',
    });
  });

  it('falls back to legacy form submission only when legacy=1 and the WorkForm execute endpoint returns 404', async () => {
    vi.mocked(executeTenantWorkForm).mockRejectedValueOnce({ response: { status: 404 } });
    vi.mocked(createFormSubmission).mockResolvedValueOnce({ id: 'sub-1' } as any);

    renderWithRoutes('/workforms/execute/legacy-form-1?legacy=1');

    expect(await screen.findByTestId('dest-in-progress')).toBeInTheDocument();
    expect(createFormSubmission).toHaveBeenCalledWith('legacy-form-1');
  });

  it('shows an error and returns to catalog when execution fails unexpectedly', async () => {
    vi.mocked(executeTenantWorkForm).mockRejectedValueOnce({
      response: { data: { error: 'Nope' } },
    });

    renderWithRoutes('/workforms/execute/wf-bad');

    expect(await screen.findByTestId('dest-catalog')).toBeInTheDocument();
    expect(showAlert).toHaveBeenCalled();
  });

  it('does not silently fall back to legacy runner on 404 without legacy=1', async () => {
    vi.mocked(executeTenantWorkForm).mockRejectedValueOnce({ response: { status: 404 } });

    renderWithRoutes('/workforms/execute/legacy-form-1');

    expect(await screen.findByTestId('dest-catalog')).toBeInTheDocument();
    expect(createFormSubmission).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalled();
  });

  it('shows an execution-failed alert when the engine returns failed status', async () => {
    vi.mocked(executeTenantWorkForm).mockResolvedValueOnce({
      id: 'ex-2',
      status: 'failed',
      error_message: 'Boom',
    } as any);

    renderWithRoutes('/workforms/execute/wf-2');

    expect(await screen.findByTestId('dest-execution')).toBeInTheDocument();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Execution failed',
        content: 'Boom',
      })
    );
  });
});
