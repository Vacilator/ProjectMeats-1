import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const getReviewContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/purchaseOrderReviewService', () => ({
  purchaseOrderReviewService: {
    getReviewContext: getReviewContextMock,
  },
}));

vi.mock('@/components/Operations/OperationalDocumentActions', () => ({
  OperationalDocumentActions: ({ onChanged }: { onChanged?: () => void }) => (
    <button type="button" onClick={() => onChanged?.()}>
      Refresh review context
    </button>
  ),
}));

import PurchaseOrderReview from './PurchaseOrderReview';

const baseContext = {
  purchase_order: {
    id: 44,
    order_number: 'PO-44',
    item_description: 'Beef Trim Combo',
    status: 'draft',
    total_amount: '49000.00',
    order_date: '2026-05-06',
    supplier_contact_email: 'quotes@example.com',
    total_weight: '20000',
    weight_unit: 'LBS',
    notes: 'Drafted from supplier quote reply.',
  },
  review_state: 'pending_review',
  review_context_complete: true,
  workflow: {
    current_status: 'draft',
    allowed_transitions: ['pending_approval'],
    statuses: [],
  },
  source_lineage: {
    inquiry_id: 7,
    inquiry_number: 'INQ-44',
    rfq_id: 9,
    correlation_key: 'corr-44',
    email_message_id: 'msg-44',
    email_thread_id: 'thread-44',
  },
  inquiry: {
    id: 7,
    inquiry_number: 'INQ-44',
    route_decision: 'BROKER',
    requested_protein: 'Beef',
    requested_master_product_name: 'Trim Combo',
    customer_name: 'Acme Foods',
    contact_name: 'Buyer Jane',
    contact_email: 'buyer@example.com',
  },
  rfq: {
    id: 9,
    supplier_name: 'Quoted Supplier',
    recipient_email: 'quotes@example.com',
    subject: 'Quoted offer',
    provider_message_id: 'msg-44',
    provider_thread_id: 'thread-44',
  },
  normalized_quote: {
    availability_status: 'affirmative',
    offered_product_name: 'Beef Trim Combo',
    quantity: 20000,
    uom: 'LBS',
    price_per_unit: '2.45',
    lead_time_text: '2 business days',
    notes: 'Packed fresh and ready to ship.',
  },
  supplier_reply_parse: {
    summary: 'Supplier can cover the requested volume.',
    confidence: 0.97,
  },
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/purchase-orders/44/review']}>
        <Routes>
          <Route path="/purchase-orders/:id/review" element={<PurchaseOrderReview />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PurchaseOrderReview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('tenantId', '11111111-1111-4111-8111-111111111111');
    getReviewContextMock.mockReset();
  });

  it('renders the supplier PO review context', async () => {
    getReviewContextMock.mockResolvedValue(baseContext);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Purchase Order Review' })).toBeInTheDocument();
    expect(screen.getByText('PO-44')).toBeInTheDocument();
    expect(screen.getByText('Quoted Supplier')).toBeInTheDocument();
    expect(screen.getAllByText('Beef Trim Combo').length).toBeGreaterThan(0);
    expect(screen.getByText('Supplier can cover the requested volume.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh review context' })).toBeInTheDocument();
  });

  it('refetches review context after operational changes', async () => {
    getReviewContextMock
      .mockResolvedValueOnce(baseContext)
      .mockResolvedValueOnce({
        ...baseContext,
        purchase_order: {
          ...baseContext.purchase_order,
          status: 'pending_approval',
        },
        workflow: {
          ...baseContext.workflow,
          current_status: 'pending_approval',
          allowed_transitions: ['approved'],
        },
      });

    renderPage();

    expect(await screen.findByText('PO-44')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh review context' }));

    await waitFor(() => {
      expect(getReviewContextMock).toHaveBeenCalledTimes(2);
    });
  });
});
