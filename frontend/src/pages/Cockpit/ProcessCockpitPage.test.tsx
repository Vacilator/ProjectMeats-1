import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessCockpitPage } from './ProcessCockpitPage';
import { businessApi } from '@/services/businessApi';
import { tradeExceptionQueueService } from '@/services/tradeExceptionQueueService';
import { workflowExecutionService } from '@/services/workflowExecutionService';

vi.mock('../../components/Cockpit/ProcessQuickActions', () => ({
  ProcessQuickActions: () => <div data-testid="quick-actions">quick-actions</div>,
}));

vi.mock('../../components/Cockpit/TradeLineageFlow', () => ({
  TradeLineageFlow: () => <div data-testid="lineage-flow">lineage-flow</div>,
}));

vi.mock('../../components/Cockpit/ProcessFlowHeader', () => ({
  ProcessFlowHeader: () => <div data-testid="flow-header">flow-header</div>,
}));

vi.mock('../../components/AIAssistant/AIDraftReviewModal', () => ({
  default: () => <div data-testid="draft-review-modal">draft-review-modal</div>,
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

vi.mock('@/services/workflowExecutionService', () => ({
  workflowExecutionService: {
    getExecutions: vi.fn(),
  },
}));

vi.mock('@/services/aiService', () => ({
  aiStaffApi: {
    listPendingReviews: vi.fn().mockResolvedValue([]),
  },
  AI_INBOX_REFRESH_EVENT: 'pm:ai-inbox-refresh',
}));

vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: () => ({
    actionItems: [],
    fetchActionItems: vi.fn(),
  }),
}));

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.search}</div>;
};

describe('ProcessCockpitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(businessApi.get).mockResolvedValue({
      data: { results: [] },
    } as never);
    vi.mocked(tradeExceptionQueueService.listExceptions).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    vi.mocked(workflowExecutionService.getExecutions).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
  });

  const renderPage = (initialEntry = '/process-cockpit') => {
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

  it('renders three tabs: All Processes, Action Required, Completed', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /All Processes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Action Required/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Completed/i })).toBeInTheDocument();
  });

  it('updates the query-string when switching tabs', async () => {
    renderPage('/process-cockpit');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Action Required/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('view=action-required');
    });

    await user.click(screen.getByRole('button', { name: /Completed/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('view=completed');
    });
  });

  it('shows empty state for All Processes when no data', async () => {
    renderPage();

    expect(await screen.findByText(/No active processes/i)).toBeInTheDocument();
  });

  it('shows empty state for Action Required when caught up', async () => {
    renderPage('/process-cockpit?view=action-required');

    expect(await screen.findByText(/You're all caught up/i)).toBeInTheDocument();
  });
});
