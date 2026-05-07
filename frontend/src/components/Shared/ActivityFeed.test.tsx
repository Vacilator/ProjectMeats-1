import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActivityFeed } from './ActivityFeed';
import { activityFeedService } from '@/services/activityFeedService';

vi.mock('@/services/activityFeedService', () => ({
  activityFeedService: {
    list: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
  },
}));

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an error alert when loading fails', async () => {
    vi.mocked(activityFeedService.list).mockRejectedValueOnce({
      response: {
        data: {
          detail: 'Activity failed',
        },
      },
    });

    render(<ActivityFeed entityType="plant" entityId="12" />);

    expect(await screen.findByText('Activity failed')).toBeInTheDocument();
  });

  it('passes source and date filters to the unified activity endpoint', async () => {
    vi.mocked(activityFeedService.list).mockResolvedValue({
      count: 1,
      results: [
        {
          id: 'ai:1',
          source: 'ai',
          source_label: 'AI',
          action: 'email_review_draft_created',
          title: 'Created AI review draft',
          description: 'PO email from buyer@example.com',
          actor_name: 'AI Inbox',
          actor_email: '',
          entity_type: 'supplier',
          entity_id: '15',
          entity_label: 'North Packing',
          source_record_id: '1',
          occurred_at: '2026-03-01T10:00:00Z',
          editable: false,
          tags: ['Email Review Draft Created'],
          metadata: {},
        },
      ],
    });

    const user = userEvent.setup();
    render(<ActivityFeed title="Tenant Activity" showFilters />);

    expect(await screen.findByText('Created AI review draft')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filter activity by source/i), 'ai');
    await user.selectOptions(screen.getByLabelText(/filter activity by entity type/i), 'supplier');
    await user.type(screen.getByLabelText(/filter activity by entity id/i), '15');
    await user.type(screen.getByLabelText(/filter activity start date/i), '2026-03-01');

    await waitFor(() => {
      expect(vi.mocked(activityFeedService.list)).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entityType: 'supplier',
          entityId: '15',
          sources: ['ai'],
          startDate: '2026-03-01',
        })
      );
    });
  });

  it('creates notes only for note-supported entity records', async () => {
    vi.mocked(activityFeedService.list).mockResolvedValue({ count: 0, results: [] });
    vi.mocked(activityFeedService.createNote).mockResolvedValue({
      id: 9,
      entity_type: 'contact',
      entity_id: 7,
      title: 'Ops follow-up',
      content: 'Confirmed pickup window with the plant.',
      created_by: 1,
      created_by_name: 'Ava Reviewer',
      created_on: '2026-03-01T12:00:00Z',
      modified_on: '2026-03-01T12:00:00Z',
    });

    const user = userEvent.setup();
    render(<ActivityFeed entityType="contact" entityId={7} showCreateForm />);

    await user.click(await screen.findByRole('button', { name: /add note/i }));
    await user.type(screen.getByLabelText(/note content/i), 'Confirmed pickup window with the plant.');
    await user.click(screen.getByRole('button', { name: /save note/i }));

    await waitFor(() => {
      expect(vi.mocked(activityFeedService.createNote)).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'contact',
          entityId: '7',
        })
      );
    });

    expect(await screen.findByText('Confirmed pickup window with the plant.')).toBeInTheDocument();
  });
});
