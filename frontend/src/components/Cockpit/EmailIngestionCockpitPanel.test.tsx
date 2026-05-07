import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailIngestionCockpitPanel } from './EmailIngestionCockpitPanel';
import { businessApi } from '@/services/businessApi';
import { aiStaffApi } from '@/services/aiService';

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/aiService', () => ({
  AI_INBOX_REFRESH_EVENT: 'pm:ai-inbox-refresh',
  emitAIInboxRefreshEvent: vi.fn(),
  aiStaffApi: {
    listPendingReviews: vi.fn(),
    resolvePendingReview: vi.fn(),
  },
}));

vi.mock('@/components/Shared/EntityFormSurface', () => ({
  EntityFormSurface: ({ entityType }: { entityType: string }) => (
    <div data-testid="entity-form-surface">{entityType}</div>
  ),
}));

describe('EmailIngestionCockpitPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(businessApi.get).mockResolvedValue({
      data: {
        emails: [
          {
            id: 'email-1',
            subject: 'Need boneless ribeye',
            sender: 'Alex Buyer <buyer@northmeats.com>',
            status: 'action_required',
            has_attachments: true,
            error_message: null,
            created_at: '2026-05-04T12:00:00Z',
            draft: {
              id: 'draft-1',
              draft_type: 'inquiry',
              status: 'pending_review',
              summary: 'Inbound inquiry needs review',
              classification_confidence: 0.94,
            },
          },
        ],
        count: 1,
      },
    } as never);
    vi.mocked(aiStaffApi.listPendingReviews).mockResolvedValue([
      {
        id: 'draft-1',
        document_id: 'document-1',
        document_type: 'inquiry',
        confidence_score: 0.94,
        precision_delta: 0,
        created_on: '2026-05-04T12:00:00Z',
        source_subject: 'Need boneless ribeye',
        source_summary: 'Please quote boneless ribeye for next week.',
        intent_label: 'Inquiry',
        review_entity_type: 'inquiry',
        review_target_url: '/inquiries?review=inquiry&inquiry=42',
        original_extracted_data: {
          inquiry_id: '42',
          customer_name: 'North Meats',
          contact_name: 'Alex Buyer',
          sender_email: 'buyer@northmeats.com',
        },
      },
    ] as any);
  });

  it('renders recent emails and expands the inline review form', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/process-cockpit?draft=draft-1']}>
          <EmailIngestionCockpitPanel />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText(/Need boneless ribeye/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Inbound inquiry needs review/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('entity-form-surface')).toHaveTextContent('inquiry');
    });

    expect(screen.getAllByRole('button', { name: /Review Details/i }).length).toBeGreaterThan(0);
  });

  it('opens a collapsed review from the recent email action', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EmailIngestionCockpitPanel />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText(/Need boneless ribeye/i)).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Open Draft Review/i }));

    await waitFor(() => {
      expect(screen.getByTestId('entity-form-surface')).toHaveTextContent('inquiry');
    });
  });
});
