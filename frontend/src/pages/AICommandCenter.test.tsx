import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AICommandCenter from './AICommandCenter';

// Mock services
const mockListActiveTrades = vi.fn().mockResolvedValue({ results: [] });
const mockListPendingReviews = vi.fn().mockResolvedValue([]);
const mockAdvanceTrade = vi.fn();
const mockGetProposals = vi.fn().mockResolvedValue({ results: [] });

vi.mock('@/services/traderService', () => ({
  traderService: {
    listActiveTrades: (...args: unknown[]) => mockListActiveTrades(...args),
    advanceTrade: (...args: unknown[]) => mockAdvanceTrade(...args),
    getProposals: (...args: unknown[]) => mockGetProposals(...args),
  },
}));

vi.mock('@/services/aiService', () => ({
  aiStaffApi: {
    listPendingReviews: (...args: unknown[]) => mockListPendingReviews(...args),
    resolvePendingReview: vi.fn(),
    batchResolve: vi.fn(),
  },
}));

vi.mock('@/utils/queryKeys', () => ({
  withTenantQueryKey: (key: string) => [key],
}));

// Mock heavy child components to keep tests fast
vi.mock('@/components/Trader/TradePipelineTracker', () => ({
  TradePipelineTracker: () => <div data-testid="pipeline-tracker">Pipeline</div>,
}));

vi.mock('@/components/Trader/SmartTradeCreator', () => ({
  SmartTradeCreator: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="smart-trade-creator"><button onClick={onClose}>Close</button></div> : null,
}));

vi.mock('@/components/Trader/AITradeProposals', () => ({
  AITradeProposals: () => <div data-testid="ai-proposals">Proposals</div>,
}));

vi.mock('@/components/Trader/OperationsPanel', () => ({
  OperationsPanel: () => <div data-testid="operations-panel">Operations</div>,
}));

vi.mock('@/components/Shared/StatCardGrid', () => ({
  StatCardGrid: ({ stats }: { stats: Array<{ label: string }> }) => (
    <div data-testid="stat-grid">{stats?.map(s => s.label).join(',')}</div>
  ),
}));

vi.mock('@/components/Shared/CockpitPanel', () => ({
  CockpitPanel: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid={`panel-${title}`}>{children}</div>
  ),
}));

vi.mock('@/components/Shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/Cockpit/ProcessQuickActions', () => ({
  ProcessQuickActions: () => <div data-testid="quick-actions">QuickActions</div>,
}));

vi.mock('@/components/Cockpit/TradeLineageFlow', () => ({
  TradeLineageFlow: () => <div data-testid="lineage-flow">Flow</div>,
}));

vi.mock('@/components/Cockpit/ProcessFlowHeader', () => ({
  ProcessFlowHeader: () => <div data-testid="flow-header">Header</div>,
}));

vi.mock('@/components/AIAssistant/AIDraftReviewModal', () => ({
  AIDraftReviewModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="draft-modal">DraftModal</div> : null,
}));

vi.mock('@/services/businessApi', () => ({
  businessApi: { get: vi.fn().mockResolvedValue({ data: [] }) },
}));

function createWrapper(initialRoute = '/command-center') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AICommandCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListActiveTrades.mockResolvedValue({ results: [] });
    mockListPendingReviews.mockResolvedValue([]);
    mockGetProposals.mockResolvedValue({ results: [] });
  });

  it('renders page title and subtitle', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByText(/Command Center/)).toBeInTheDocument();
    expect(screen.getByText(/unified hub/i)).toBeInTheDocument();
  });

  it('renders quick action buttons', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByText('New Trade')).toBeInTheDocument();
    expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
  });

  it('has accessible search input', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Search command center')).toBeInTheDocument();
  });

  it('has accessible refresh button', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Refresh all data')).toBeInTheDocument();
  });

  it('shows Overview tab by default', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    // Overview tab should show the proposals section
    await waitFor(() => {
      expect(screen.getByTestId('ai-proposals')).toBeInTheDocument();
    });
  });

  it('opens trade wizard modal on New Trade click', async () => {
    const user = userEvent.setup();
    render(<AICommandCenter />, { wrapper: createWrapper() });

    const newTradeBtn = screen.getByText('New Trade');
    await user.click(newTradeBtn);

    // The SmartTradeCreator is inside an AntD Modal — check modal appeared
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('renders with ?tab=action-required param', async () => {
    render(<AICommandCenter />, {
      wrapper: createWrapper('/command-center?tab=action-required'),
    });

    await waitFor(() => {
      // Action required tab should be shown (no AI proposals visible in that tab)
      expect(screen.queryByTestId('ai-proposals')).not.toBeInTheDocument();
    });
  });

  it('renders pipeline tab with empty state when no trades', async () => {
    render(<AICommandCenter />, {
      wrapper: createWrapper('/command-center?tab=pipeline'),
    });

    await waitFor(() => {
      expect(screen.getByText('No active trades')).toBeInTheDocument();
    });
  });

  it('shows AI inbox badge when reviews exist', async () => {
    mockListPendingReviews.mockResolvedValue([
      {
        id: 'r1',
        document_id: 'd1',
        document_type: 'email',
        confidence_score: 0.9,
        precision_delta: 0.1,
        created_on: '2026-01-01',
        intent_label: 'Create Contact',
        review_entity_type: 'contact',
        original_extracted_data: {},
        sender: 'test@example.com',
        source_subject: 'New supplier inquiry',
      },
    ]);

    render(<AICommandCenter />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Inbox')).toBeInTheDocument();
    });
  });

  it('has role=main on page container', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('has toolbar role on quick actions', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('has navigation role on tab container', async () => {
    render(<AICommandCenter />, { wrapper: createWrapper() });
    expect(screen.getByRole('navigation', { name: /command center sections/i })).toBeInTheDocument();
  });
});
