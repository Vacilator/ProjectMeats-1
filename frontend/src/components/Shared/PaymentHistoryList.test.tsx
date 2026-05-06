import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import PaymentHistoryList from './PaymentHistoryList';

const { listPayments } = vi.hoisted(() => ({
  listPayments: vi.fn(),
}));

vi.mock('../../services/paymentHistoryService', () => ({
  paymentHistoryService: {
    listPayments,
  },
}));

const renderSubject = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentHistoryList entityType="invoice" entityId={42} />
    </QueryClientProvider>,
  );
};

describe('PaymentHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settlement provenance when available', async () => {
    listPayments.mockResolvedValueOnce([
      {
        id: 1,
        amount: '125.00',
        payment_date: '2026-05-06',
        payment_method: 'wire_transfer',
        reference_number: 'WIRE-1',
        notes: 'Booked from bank feed',
        created_by_name: 'Alex',
        created_on: '2026-05-06T10:00:00Z',
        source_settlement_event_id: 9,
        source_settlement_reason_code: 'manual_relinked',
        source_settlement_provider_code: 'stripe',
        source_settlement_review_action: 'relink',
      },
    ]);

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText(/Settlement · stripe · manual relinked · relink/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/WIRE-1/)).toBeInTheDocument();
  });
});
