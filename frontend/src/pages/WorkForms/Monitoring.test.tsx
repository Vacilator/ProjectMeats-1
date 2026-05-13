import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Monitoring from './Monitoring';

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/services/workformExecutionService', () => ({
  workformExecutionService: {
    getAnalytics: vi.fn().mockResolvedValue({
      summary: {
        total_runs: 0,
        active_runs: 0,
        completed_runs: 0,
        failed_runs: 0,
        success_rate: 0,
        avg_duration_ms: null,
      },
      top_workforms: [],
      top_failed_nodes: [],
      slowest_actions: [],
    }),
    getExecutions: vi.fn().mockResolvedValue({
      results: [],
    }),
  },
}));

describe('WorkForms Monitoring', () => {
  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workforms/monitoring']}>
          <Routes>
            <Route path="/workforms/monitoring" element={<Monitoring />} />
            <Route path="/" element={<div>home-route</div>} />
            <Route path="/command-center" element={<div>command-center-route</div>} />
            <Route path="/workforms/history" element={<div>history-route</div>} />
            <Route path="/workforms/catalog" element={<div>catalog-route</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('keeps the page focused on execution drill-ins without the legacy submission queue shell', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(screen.getByText(/Command Center owns action-required triage/i)).toBeInTheDocument();
    expect(screen.queryByText(/Active Submission Queue/i)).not.toBeInTheDocument();
    expect(screen.getByText(/recent failure hotspots/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Home/i }));

    expect(screen.getByText('home-route')).toBeInTheDocument();
  });

  it('offers direct drill-in next steps to history and catalog', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: /View WorkForms History/i }));
    expect(screen.getByText('history-route')).toBeInTheDocument();
  });

  it('links empty active-execution state to the WorkForms catalog', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('button', { name: /Open WorkForms Catalog/i }));
    expect(screen.getByText('catalog-route')).toBeInTheDocument();
  });
});
