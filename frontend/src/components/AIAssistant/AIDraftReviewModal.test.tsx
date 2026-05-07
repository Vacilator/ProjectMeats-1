import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AIDraftReviewModal } from './AIDraftReviewModal';

const mockResolvePendingReview = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      ...actual.message,
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      error: (...args: unknown[]) => mockMessageError(...args),
    },
  };
});

vi.mock('@/services/aiService', () => ({
  aiStaffApi: {
    resolvePendingReview: (...args: unknown[]) => mockResolvePendingReview(...args),
  },
}));

vi.mock('@/components/Shared/EntityFormSurface', () => ({
  EntityFormSurface: ({ entityType, initialValues, onSuccess }: any) => (
    <div>
      <div data-testid="entity-type">{entityType}</div>
      <pre data-testid="initial-values">{JSON.stringify(initialValues)}</pre>
      <button onClick={() => onSuccess({ id: 'saved-po-1', order_number: 'PO-1001' })}>
        Simulate Save
      </button>
    </div>
  ),
}));

describe('AIDraftReviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates purchase order drafts and resolves after save', async () => {
    const onClose = vi.fn();
    const onResolved = vi.fn();

    render(
      <MemoryRouter>
        <AIDraftReviewModal
          open
          onClose={onClose}
          onResolved={onResolved}
          item={{
            id: 'draft-1',
            document_id: 'document-1',
            document_type: 'purchase_order',
            confidence_score: 0.62,
            precision_delta: 0,
            created_on: new Date().toISOString(),
            intent_label: 'Purchase Order',
            review_entity_type: 'purchase_order',
            original_extracted_data: {
              order_number: 'PO-1001',
              vendor_name: 'Acme Meats',
              items: [
                {
                  description: 'Beef trim',
                  quantity: 4,
                  total_net_weight: 1200,
                  weight_unit: 'LBS',
                },
              ],
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('entity-type')).toHaveTextContent('purchase_order');
    expect(screen.getByTestId('initial-values').textContent).toContain('PO-1001');
    expect(screen.getByTestId('initial-values').textContent).toContain('Acme Meats');

    await userEvent.click(screen.getByRole('button', { name: /Simulate Save/i }));

    await waitFor(() => {
      expect(mockResolvePendingReview).toHaveBeenCalledWith('draft-1', {
        user_corrected_data: { id: 'saved-po-1', order_number: 'PO-1001' },
      });
    });
    expect(onResolved).toHaveBeenCalledWith('draft-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('hydrates inquiry drafts into the inquiry form surface', async () => {
    render(
      <MemoryRouter>
        <AIDraftReviewModal
          open
          onClose={() => {}}
          item={{
            id: 'draft-2',
            document_id: 'document-2',
            document_type: 'inquiry',
            confidence_score: 0.81,
            precision_delta: 0,
            created_on: new Date().toISOString(),
            intent_label: 'Inquiry',
            review_entity_type: 'inquiry',
            original_extracted_data: {
              inquiry_id: '42',
              customer_name: 'North Meats',
              contact_name: 'Alex Buyer',
              sender_email: 'buyer@northmeats.com',
              requested_protein: 'Beef',
              due_date: '2026-05-10T00:00:00Z',
              summary: 'Need beef trim for next week.',
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('entity-type')).toHaveTextContent('inquiry');
    expect(screen.getByTestId('initial-values').textContent).toContain('Alex Buyer');
    expect(screen.getByTestId('initial-values').textContent).toContain('buyer@northmeats.com');
    expect(screen.getByTestId('initial-values').textContent).toContain('2026-05-10');
  });
});
