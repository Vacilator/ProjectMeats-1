import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import SettlementQueue from './SettlementQueue';

const {
  listSettlementEvents,
  getSettlementEvent,
  approveSettlementEvent,
  relinkSettlementEvent,
  rejectSettlementEvent,
} = vi.hoisted(() => ({
  listSettlementEvents: vi.fn(),
  getSettlementEvent: vi.fn(),
  approveSettlementEvent: vi.fn(),
  relinkSettlementEvent: vi.fn(),
  rejectSettlementEvent: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
  }),
}));

vi.mock('@/services/settlementQueueService', () => ({
  settlementQueueService: {
    listSettlementEvents,
    getSettlementEvent,
    approveSettlementEvent,
    relinkSettlementEvent,
    rejectSettlementEvent,
  },
}));

vi.mock('@/components/Shared/SearchableSelectEntity', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input
      aria-label="Target record"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const baseEvent = {
  id: 11,
  source: 1,
  source_public_id: 'source-1',
  source_name: 'Stripe Main',
  provider_code: 'stripe',
  provider_account_reference: 'acct_main',
  external_event_id: 'evt_11',
  event_type: 'payment.settled',
  direction: 'credit',
  occurred_at: '2026-05-06T10:00:00Z',
  amount: '25.50',
  currency: 'USD',
  raw_payload: '{"invoice_number":"INV-100"}',
  raw_payload_sha256: 'hash',
  idempotency_key: 'idem-11',
  state: 'ready_to_post',
  normalized_payload: { invoice_number: 'INV-100' },
  reconciliation_reason_code: 'reference_not_found',
  reviewed_by: null,
  reviewed_by_name: null,
  reviewed_at: null,
  review_action: '',
  review_note: '',
  matched_purchase_order: null,
  matched_sales_order: null,
  matched_invoice: null,
  matched_entity_type: null,
  matched_entity_reference: null,
  payment_transaction: null,
  delivery_count: 1,
  received_at: '2026-05-06T10:00:00Z',
  last_received_at: '2026-05-06T10:00:00Z',
  processed_at: null,
  processing_task_id: '',
  last_error: '',
  created_on: '2026-05-06T10:00:00Z',
  modified_on: '2026-05-06T10:00:00Z',
  candidate_matches: [
    {
      entity_type: 'invoice',
      object_id: 99,
      reference_value: 'INV-100',
      outstanding_amount: '25.50',
      exact_amount_match: true,
    },
  ],
};

const renderSubject = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SettlementQueue />
    </QueryClientProvider>,
  );
};

describe('SettlementQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSettlementEvents.mockResolvedValue([baseEvent]);
    getSettlementEvent.mockResolvedValue(baseEvent);
    approveSettlementEvent.mockResolvedValue(baseEvent);
    relinkSettlementEvent.mockResolvedValue(baseEvent);
    rejectSettlementEvent.mockResolvedValue({ ...baseEvent, state: 'ignored', review_action: 'reject' });
  });

  it('renders queued settlement detail and submits approve actions', async () => {
    renderSubject();

    await waitFor(() => {
      expect(screen.getByText(/Settlement Queue/i)).toBeInTheDocument();
    });
    expect(await screen.findByText(/evt_11/i)).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText(/Review note/i), {
      target: { value: 'Reviewed by accounting.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Approve Match/i }));

    await waitFor(() => {
      expect(approveSettlementEvent).toHaveBeenCalledWith(11, { note: 'Reviewed by accounting.' });
    });
  });
});
