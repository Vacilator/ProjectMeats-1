import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { IngestionMonitor } from './IngestionMonitor';
import { businessApi } from '@/services/businessApi';

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('IngestionMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(businessApi.get).mockResolvedValue({
      data: {
        emails: [
          {
            id: 'email-1',
            message_id: 'graph-1',
            subject: 'PO 12345',
            sender: 'Accounting <accounting@nameats.com>',
            status: 'draft_created',
            provider_type: 'microsoft',
            has_attachments: true,
            extracted_data: { confidence: 0.92 },
            related_order_id: null,
            draft: {
              id: 'draft-1',
              draft_type: 'purchase_order',
              status: 'pending_review',
              summary: 'Potential PO from accounting@nameats.com',
              classification_confidence: 0.92,
            },
            error_message: null,
            created_at: '2026-05-04T12:00:00Z',
            processed_at: '2026-05-04T12:01:00Z',
          },
        ],
        count: 1,
      },
    } as never);
  });

  it('renders actionable draft emails with a review action', async () => {
    render(
      <MemoryRouter initialEntries={['/my-tasks?tab=ai-review&draft=draft-1']}>
        <IngestionMonitor />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('PO 12345')).toBeInTheDocument();
    });

    expect(screen.getByText('Potential PO from accounting@nameats.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review in AI Queue' })).toBeInTheDocument();
    expect(screen.getByText('Draft Ready')).toBeInTheDocument();
  });
});
