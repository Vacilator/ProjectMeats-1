import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessCockpitPage } from './ProcessCockpitPage';
import { businessApi } from '@/services/businessApi';
import { tradeExceptionQueueService } from '@/services/tradeExceptionQueueService';

vi.mock('../../components/Cockpit/InterventionsPanel', () => ({
  InterventionsPanel: () => <div data-testid="interventions-panel">interventions-panel</div>,
}));

vi.mock('./ProcessMonitor', () => ({
  default: () => <div data-testid="process-monitor">process-monitor</div>,
}));

vi.mock('../../components/Cockpit/EmailIngestionCockpitPanel', () => ({
  default: () => <div data-testid="email-ingestion-panel">email-ingestion-panel</div>,
}));

vi.mock('@/utils/tenantId', () => ({
  getValidTenantId: () => 'tenant-1',
}));

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/tradeExceptionQueueService', () => ({
  tradeExceptionQueueService: {
    listExceptions: vi.fn(),
  },
}));

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.search}</div>;
};

describe('ProcessCockpitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(businessApi.get).mockResolvedValue({
      data: {
        results: [],
      },
    } as never);
    vi.mocked(tradeExceptionQueueService.listExceptions).mockResolvedValue({
      count: 3,
      next: null,
      previous: null,
      results: [],
    });
  });

  const renderPage = (initialEntry = '/process-cockpit?view=interventions') => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ProcessCockpitPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('honors the interventions view deep-link and shows the badge count', async () => {
    renderPage();

    expect(await screen.findByTestId('interventions-panel')).toBeInTheDocument();
    const interventionsButton = screen.getByRole('button', { name: /Interventions/i });
    await waitFor(() => {
      expect(interventionsButton).toHaveTextContent('3');
    });
  });

  it('updates the query-string when switching views', async () => {
    renderPage('/process-cockpit?view=interventions&draft=draft-42');
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('?view=interventions&draft=draft-42');
    });

    await user.click(screen.getByRole('button', { name: /Live Activity/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('?view=activity&draft=draft-42');
    });
  });
});
