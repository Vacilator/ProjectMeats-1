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

vi.mock('../Cockpit/ProcessMonitor', () => ({
  default: () => <div data-testid="process-monitor">submission-queue</div>,
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
            <Route path="/command-center" element={<div>command-center-route</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('frames the page as a secondary execution drill-in and links back to Command Center', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(screen.getByText(/Command Center owns action-required triage/i)).toBeInTheDocument();
    expect(screen.getByTestId('process-monitor')).toHaveTextContent('submission-queue');

    await user.click(screen.getByRole('button', { name: /Open Command Center/i }));

    expect(screen.getByText('command-center-route')).toBeInTheDocument();
  });
});
