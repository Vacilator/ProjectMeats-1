import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SettlementQueue from './SettlementQueue';

const listMock = vi.fn();
const overrideMock = vi.fn();

vi.mock('@/components/Admin', () => ({
  AdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/services/settlementEventsService', () => ({
  settlementEventsService: {
    list: (...args: unknown[]) => listMock(...args),
    override: (...args: unknown[]) => overrideMock(...args),
    reject: vi.fn(),
  },
}));

describe('SettlementQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([
      {
        id: 42,
        source: 1,
        source_public_id: '11111111-1111-4111-8111-111111111111',
        source_name: 'Stripe Main',
        provider_code: 'stripe',
        provider_account_reference: 'acct_main',
        external_event_id: 'evt_42',
        event_type: 'payment.settled',
        direction: 'credit',
        occurred_at: '2026-05-06T10:00:00Z',
        amount: '25.50',
        currency: 'USD',
        raw_payload: '{"invoice_number":"INV-42"}',
        raw_payload_sha256: 'abc',
        idempotency_key: 'idempotency-key-42',
        state: 'ready_to_post',
        normalized_payload: { invoice_number: 'INV-42' },
        reconciliation_reason_code: 'amount_mismatch',
        matched_purchase_order: null,
        matched_sales_order: null,
        matched_invoice: null,
        payment_transaction: null,
        reviewed_by: null,
        reviewed_by_name: '',
        reviewed_at: null,
        review_note: '',
        delivery_count: 1,
        received_at: '2026-05-06T10:01:00Z',
        last_received_at: '2026-05-06T10:01:00Z',
        processed_at: '2026-05-06T10:02:00Z',
        processing_task_id: 'task-42',
        last_error: '',
        created_on: '2026-05-06T10:01:00Z',
        modified_on: '2026-05-06T10:02:00Z',
      },
    ]);
    overrideMock.mockResolvedValue({ id: 42, state: 'posted' });
  });

  it('loads review queue rows and submits an override from the drawer', async () => {
    render(<SettlementQueue />);

    expect(await screen.findByText('Settlement Queue')).toBeInTheDocument();
    expect(await screen.findByText('Stripe Main')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Stripe Main'));

    expect(await screen.findByText('Settlement event #42')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /override \/ relink/i }));

    fireEvent.change(screen.getByRole('spinbutton', { name: /target record id/i }), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /review note/i }), {
      target: { value: 'Linked to the corrected invoice.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply override/i }));

    await waitFor(() => {
      expect(overrideMock).toHaveBeenCalledWith(42, {
        target_type: 'invoice',
        target_id: 12,
        review_note: 'Linked to the corrected invoice.',
      });
    });
  });
});
