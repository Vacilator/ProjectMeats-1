import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentsPanel } from './CommentsPanel';

const listComments = vi.fn();
const createComment = vi.fn();
const searchMentionSuggestions = vi.fn();

vi.mock('../../services/commentsService', () => ({
  commentsService: {
    listComments: (...args: unknown[]) => listComments(...args),
    createComment: (...args: unknown[]) => createComment(...args),
    searchMentionSuggestions: (...args: unknown[]) => searchMentionSuggestions(...args),
  },
}));

describe('CommentsPanel', () => {
  beforeEach(() => {
    vi.useRealTimers();
    listComments.mockReset();
    createComment.mockReset();
    searchMentionSuggestions.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads comments and posts a comment with selected mentions', async () => {
    listComments.mockResolvedValueOnce([
      {
        id: 1,
        tenant_id: 'tenant-1',
        entity_type: 'customer',
        entity_id: '42',
        body: 'Existing comment',
        created_by: { id: 1, username: 'alex', display_name: 'Alex' },
        created_by_name: 'Alex',
        mentioned_users: [],
        created_on: '2026-01-01T10:00:00Z',
        modified_on: '2026-01-01T10:00:00Z',
      },
    ]);
    searchMentionSuggestions.mockResolvedValueOnce([
      {
        id: 7,
        username: 'jamie',
        firstName: 'Jamie',
        lastName: 'Smith',
        email: 'jamie@example.com',
        displayName: 'Jamie Smith',
      },
    ]);
    createComment.mockResolvedValueOnce({
      id: 2,
      tenant_id: 'tenant-1',
      entity_type: 'customer',
      entity_id: '42',
      body: 'Hello @jamie',
      created_by: { id: 2, username: 'morgan', display_name: 'Morgan' },
      created_by_name: 'Morgan',
      mentioned_users: [{ id: 7, username: 'jamie', display_name: 'Jamie Smith' }],
      created_on: '2026-01-02T10:00:00Z',
      modified_on: '2026-01-02T10:00:00Z',
    });

    render(<CommentsPanel entityType="customer" entityId="42" />);

    expect(await screen.findByText('Existing comment')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Comment body'), { target: { value: 'Hello @ja' } });
    expect(await screen.findByText('Jamie Smith')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Jamie Smith'));
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({
        entityType: 'customer',
        entityId: '42',
        body: 'Hello @jamie',
        mentionedUserIds: [7],
      });
    });

    expect(await screen.findByText('Hello @jamie')).toBeInTheDocument();
  });
});
