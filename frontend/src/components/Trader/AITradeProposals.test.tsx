import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AITradeProposals } from './AITradeProposals';
import type { TradeProposal } from '@/services/traderService';

// Mock traderService
const mockGetProposals = vi.fn();
const mockExecuteProposal = vi.fn();
const mockSubmitProposalFeedback = vi.fn();

vi.mock('@/services/traderService', () => ({
  traderService: {
    getProposals: (...args: unknown[]) => mockGetProposals(...args),
    executeProposal: (...args: unknown[]) => mockExecuteProposal(...args),
    submitProposalFeedback: (...args: unknown[]) => mockSubmitProposalFeedback(...args),
  },
}));

vi.mock('@/utils/queryKeys', () => ({
  withTenantQueryKey: (key: string) => [key],
}));

const PROPOSAL_HIGH: TradeProposal = {
  id: 'prop-1',
  title: 'Chicken thighs for BigBuyer',
  confidence: 0.92,
  source: 'email',
  route: 'FULFILL',
  customer_name: 'BigBuyer Inc.',
  supplier_name: 'FreshFarm Ltd.',
  type_of_protein: 'Chicken Thighs',
  weight: '5,000 lbs',
  delivery_context: 'supplier_delivery',
  suggested_fields: [],
  created_at: '2026-05-09T12:00:00Z',
  expires_at: null,
  status: 'pending',
};

const PROPOSAL_AUTO: TradeProposal = {
  ...PROPOSAL_HIGH,
  id: 'prop-2',
  title: 'Auto-execute beef deal',
  confidence: 0.97,
  source: 'history',
  route: 'BROKER',
  type_of_protein: 'Beef Ribeye',
  status: 'pending',
};

const PROPOSAL_LOW: TradeProposal = {
  ...PROPOSAL_HIGH,
  id: 'prop-3',
  title: 'Uncertain pork deal',
  confidence: 0.55,
  source: 'pattern',
  customer_name: null,
  supplier_name: null,
  type_of_protein: null,
  weight: null,
  status: 'pending',
};

const PROPOSAL_EXECUTED: TradeProposal = {
  ...PROPOSAL_HIGH,
  id: 'prop-4',
  title: 'Already done deal',
  status: 'executed',
};

function renderProposals(onExecuted?: (id: string) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AITradeProposals onProposalExecuted={onExecuted} />
    </QueryClientProvider>,
  );
}

describe('AITradeProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProposals.mockResolvedValue([PROPOSAL_HIGH, PROPOSAL_AUTO, PROPOSAL_LOW, PROPOSAL_EXECUTED]);
    mockExecuteProposal.mockResolvedValue({
      trade_id: 'TRD-001',
      trade_session_id: 'session-abc',
    });
    mockSubmitProposalFeedback.mockResolvedValue({});
  });

  // ---- Rendering ----

  it('renders pending proposals and hides executed ones', async () => {
    renderProposals();

    await waitFor(() => {
      expect(screen.getByText('Chicken thighs for BigBuyer')).toBeInTheDocument();
      expect(screen.getByText('Auto-execute beef deal')).toBeInTheDocument();
      expect(screen.getByText('Uncertain pork deal')).toBeInTheDocument();
    });
    // Executed proposal should not appear
    expect(screen.queryByText('Already done deal')).not.toBeInTheDocument();
  });

  it('shows proposal count badge', async () => {
    renderProposals();
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('displays confidence percentage', async () => {
    renderProposals();
    await waitFor(() => {
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('97%')).toBeInTheDocument();
      expect(screen.getByText('55%')).toBeInTheDocument();
    });
  });

  it('shows auto-execute indicator for proposals above threshold', async () => {
    renderProposals();
    await waitFor(() => {
      // The 97% proposal (above 0.95 threshold) should have the auto-execute badge
      const badge97 = screen.getByLabelText(/97%/);
      expect(badge97).toBeInTheDocument();
    });
  });

  it('shows customer, supplier, protein, weight tags', async () => {
    renderProposals();
    await waitFor(() => {
      const region = screen.getByRole('region', { name: 'AI Trade Proposals' });
      expect(region.textContent).toContain('Customer:');
      expect(region.textContent).toContain('BigBuyer Inc.');
      expect(region.textContent).toContain('Supplier:');
      expect(region.textContent).toContain('FreshFarm Ltd.');
      expect(region.textContent).toContain('Chicken Thighs');
      expect(region.textContent).toContain('5,000 lbs');
    });
  });

  it('shows route tags', async () => {
    renderProposals();
    await waitFor(() => {
      const allFulfill = screen.getAllByText('FULFILL');
      expect(allFulfill.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('BROKER')).toBeInTheDocument();
    });
  });

  it('shows source tags', async () => {
    renderProposals();
    await waitFor(() => {
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('history')).toBeInTheDocument();
      expect(screen.getByText('pattern')).toBeInTheDocument();
    });
  });

  it('renders loading skeleton', () => {
    mockGetProposals.mockReturnValue(new Promise(() => {})); // never resolves
    renderProposals();
    expect(screen.getByLabelText('Loading AI trade proposals')).toBeInTheDocument();
  });

  it('renders nothing when no pending proposals', async () => {
    mockGetProposals.mockResolvedValue([PROPOSAL_EXECUTED]);
    renderProposals();

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading AI trade proposals')).not.toBeInTheDocument();
    });
    // No pending proposals → shows empty state
    expect(screen.queryByText('AI Trade Proposals')).not.toBeInTheDocument();
    expect(screen.getByText(/No AI trade proposals right now/)).toBeInTheDocument();
  });

  it('renders error state with retry on error', async () => {
    mockGetProposals.mockRejectedValue(new Error('fail'));
    renderProposals();

    await waitFor(() => {
      expect(screen.queryByLabelText('Loading AI trade proposals')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Unable to load AI proposals')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('has accessible region role', async () => {
    renderProposals();
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'AI Trade Proposals' })).toBeInTheDocument();
    });
  });

  // ---- Execute ----

  it('calls executeProposal on Execute Trade click', async () => {
    const user = userEvent.setup();
    const onExecuted = vi.fn();
    renderProposals(onExecuted);

    await waitFor(() => expect(screen.getByText('Chicken thighs for BigBuyer')).toBeInTheDocument());

    const executeBtn = screen.getByLabelText('Execute trade from proposal: Chicken thighs for BigBuyer');
    await user.click(executeBtn);

    await waitFor(() => {
      expect(mockExecuteProposal).toHaveBeenCalledWith('prop-1');
    });
    await waitFor(() => {
      expect(onExecuted).toHaveBeenCalledWith('session-abc');
    });
  });

  // ---- Feedback ----

  it('submits thumbs up feedback directly', async () => {
    const user = userEvent.setup();
    renderProposals();

    await waitFor(() => expect(screen.getByText('Chicken thighs for BigBuyer')).toBeInTheDocument());

    const thumbsUpBtn = screen.getByLabelText('Approve proposal: Chicken thighs for BigBuyer');
    await user.click(thumbsUpBtn);

    await waitFor(() => {
      expect(mockSubmitProposalFeedback).toHaveBeenCalledWith('prop-1', 'thumbs_up', undefined);
    });
  });

  it('opens feedback modal on thumbs down', async () => {
    const user = userEvent.setup();
    renderProposals();

    await waitFor(() => expect(screen.getByText('Chicken thighs for BigBuyer')).toBeInTheDocument());

    const thumbsDownBtn = screen.getByLabelText('Reject proposal: Chicken thighs for BigBuyer');
    await user.click(thumbsDownBtn);

    await waitFor(() => {
      expect(screen.getByText('Why is this proposal incorrect?')).toBeInTheDocument();
    });
  });

  it('submits negative feedback with comment', async () => {
    const user = userEvent.setup();
    renderProposals();

    await waitFor(() => expect(screen.getByText('Chicken thighs for BigBuyer')).toBeInTheDocument());

    // Open feedback modal
    await user.click(screen.getByLabelText('Reject proposal: Chicken thighs for BigBuyer'));

    await waitFor(() => {
      expect(screen.getByText('Why is this proposal incorrect?')).toBeInTheDocument();
    });

    // Type feedback
    const textarea = screen.getByPlaceholderText(/Wrong customer/i);
    await user.type(textarea, 'Wrong protein type');

    // Submit
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));

    await waitFor(() => {
      expect(mockSubmitProposalFeedback).toHaveBeenCalledWith(
        'prop-1',
        'thumbs_down',
        'Wrong protein type',
      );
    });
  });
});
