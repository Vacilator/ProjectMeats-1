import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AIDraftReviewDialog } from './AIDraftReviewDialog';

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

vi.mock('@/components/AIAssistant/AIInboxFeedbackActions', () => ({
  AIInboxFeedbackActions: ({ item }: any) => (
    <div data-testid="feedback-actions">{item?.id}</div>
  ),
}));

vi.mock('@/components/UnifiedForm', () => ({
  UnifiedForm: ({ entityType, mode, initialValues, onSuccess }: any) => (
    <div>
      <div data-testid="entity-type">{entityType}</div>
      <div data-testid="form-mode">{mode}</div>
      <pre data-testid="initial-values">{JSON.stringify(initialValues)}</pre>
      <button onClick={() => onSuccess({ id: 'saved-po-1', order_number: 'PO-1001' })}>
        Simulate Save
      </button>
    </div>
  ),
}));

describe('AIDraftReviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates purchase order drafts and resolves after save', async () => {
    const onClose = vi.fn();
    const onResolved = vi.fn();

    render(
      <MemoryRouter>
        <AIDraftReviewDialog
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
    expect(screen.getByTestId('form-mode')).toHaveTextContent('draft');
    expect(screen.getByTestId('initial-values').textContent).toContain('PO-1001');
    expect(screen.getByTestId('initial-values').textContent).toContain('Acme Meats');
    expect(screen.getByTestId('feedback-actions')).toHaveTextContent('draft-1');

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
        <AIDraftReviewDialog
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
    expect(screen.getByTestId('form-mode')).toHaveTextContent('draft');
    expect(screen.getByTestId('initial-values').textContent).toContain('Alex Buyer');
    expect(screen.getByTestId('initial-values').textContent).toContain('buyer@northmeats.com');
    expect(screen.getByTestId('initial-values').textContent).toContain('2026-05-10');
    expect(screen.getByTestId('feedback-actions')).toHaveTextContent('draft-2');
  });

  it('renders routed contact context when the parsed payload includes contact routing', async () => {
    render(
      <MemoryRouter>
        <AIDraftReviewDialog
          open
          onClose={() => {}}
          item={{
            id: 'draft-3',
            document_id: 'document-3',
            document_type: 'purchase_order',
            confidence_score: 0.88,
            precision_delta: 0,
            created_on: new Date().toISOString(),
            intent_label: 'Purchase Order',
            review_entity_type: 'purchase_order',
            original_extracted_data: {
              order_number: 'PO-2001',
              contact_routing: {
                supplier_contact: {
                  contact_id: 42,
                  recipient_name: 'Angie Sanchez',
                  recipient_email: 'angie@example.com',
                  department: 'sales',
                  title: 'Account Manager',
                  plant_name: 'Allen Lund',
                  matched_items: ['Beef Trim'],
                  matched_documents: ['Spec Sheets'],
                },
              },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Contact Routing/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolved Sales - Angie Sanchez \(Allen Lund\)/i)).toBeInTheDocument();
    expect(screen.getByText('Spec Sheets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open contact/i })).toBeInTheDocument();
  });

  it('reject all calls resolvePendingReview with _rejected data', async () => {
    const onClose = vi.fn();
    const onResolved = vi.fn();
    mockResolvePendingReview.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <AIDraftReviewDialog
          open
          onClose={onClose}
          onResolved={onResolved}
          item={{
            id: 'draft-rej',
            document_id: 'doc-rej',
            document_type: 'purchase_order',
            confidence_score: 0.5,
            precision_delta: 0,
            created_on: new Date().toISOString(),
            intent_label: 'PO',
            review_entity_type: 'purchase_order',
            original_extracted_data: { order_number: 'PO-REJ' },
          }}
        />
      </MemoryRouter>,
    );

    const rejectBtn = screen.getByRole('button', { name: /Reject All/i });
    await userEvent.click(rejectBtn);

    await waitFor(() => {
      expect(mockResolvePendingReview).toHaveBeenCalledWith('draft-rej', {
        user_corrected_data: { _rejected: true },
      });
    });
    expect(onResolved).toHaveBeenCalledWith('draft-rej');
  });

  it('displays intent banner with confidence badge', async () => {
    render(
      <MemoryRouter>
        <AIDraftReviewDialog
          open
          onClose={() => {}}
          item={{
            id: 'draft-intent',
            document_id: 'doc-intent',
            document_type: 'sales_order',
            confidence_score: 0.92,
            precision_delta: 0,
            created_on: new Date().toISOString(),
            intent_label: 'New Sales Order for Beef Trim',
            review_entity_type: 'sales_order',
            original_extracted_data: { summary: 'Sales order request' },
          }}
        />
      </MemoryRouter>,
    );

    const intentTexts = screen.getAllByText(/New Sales Order for Beef Trim/i);
    expect(intentTexts.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/92%/i).length).toBeGreaterThan(0);
  });

  it('renders provenance, retryability, and lineage badges in source context', async () => {
    render(
      <MemoryRouter>
        <AIDraftReviewDialog
          open
          onClose={() => {}}
          item={{
            id: 'draft-audit',
            document_id: 'doc-audit',
            document_type: 'purchase_order',
            confidence_score: 0.67,
            precision_delta: 0,
            created_on: new Date().toISOString(),
            intent_label: 'Purchase Order',
            review_entity_type: 'purchase_order',
            source_subject: 'PO follow-up',
            source_document_name: 'po-1001.pdf',
            processing_status: 'failed',
            source_metadata: {
              source: 'microsoft_graph_attachment',
              message_id: 'msg-99',
            },
            processing_metadata: {
              parse_error_code: 'UNSTRUCTURED_UNREACHABLE',
              parse_error_message: 'Parsing service unavailable',
            },
            lineage_summary: {
              event_count: 3,
              latest_event_type: 'document_failed',
              latest_summary: 'Awaiting parser retry.',
              recent_events: [],
            },
            original_extracted_data: {
              order_number: 'PO-1001',
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Document source: Outlook attachment')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Document status: Retry later (UNSTRUCTURED_UNREACHABLE)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Lineage: Awaiting parser retry. (3 events)')).toBeInTheDocument();
  });
});
