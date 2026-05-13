/**
 * Tests for ApprovalQueuePanel component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock aiService
vi.mock('../../../services/aiService', () => ({
  approvalQueueApi: {
    list: vi.fn().mockResolvedValue([]),
    stats: vi.fn().mockResolvedValue({
      pending: 3,
      approved_today: 5,
      rejected_today: 1,
      expired_today: 0,
      by_type: { email: 2, purchase_order: 1 },
    }),
    approve: vi.fn().mockResolvedValue({}),
    reject: vi.fn().mockResolvedValue({}),
    batchAction: vi.fn().mockResolvedValue({ updated: 0 }),
  },
}));

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

import ApprovalQueuePanel from '../ApprovalQueuePanel';
import { approvalQueueApi } from '../../../services/aiService';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('ApprovalQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no items', async () => {
    vi.mocked(approvalQueueApi.list).mockResolvedValue([]);

    render(<ApprovalQueuePanel />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no pending approvals/i)).toBeInTheDocument();
    });
  });

  it('should call list API on mount', async () => {
    vi.mocked(approvalQueueApi.list).mockResolvedValue([]);

    render(<ApprovalQueuePanel />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(approvalQueueApi.list).toHaveBeenCalled();
    });
  });

  it('should call stats API on mount', async () => {
    vi.mocked(approvalQueueApi.list).mockResolvedValue([]);

    render(<ApprovalQueuePanel />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(approvalQueueApi.stats).toHaveBeenCalled();
    });
  });

  it('should render items when data is available', async () => {
    vi.mocked(approvalQueueApi.list).mockResolvedValue([
      {
        id: 'test-1',
        request_type: 'purchase_order',
        status: 'pending',
        priority: 'normal',
        subject: 'PO-2026-0101 to Acme Meats',
        recipient_type: 'supplier',
        recipient_entity_id: '1',
        recipient_name: 'Acme Meats',
        recipient_email: 'orders@acme.com',
        content_preview: 'Test PO content',
        content_payload: {},
        edited_content: null,
        source_entity_type: 'purchase_order',
        source_entity_id: '42',
        ai_generated: true,
        ai_confidence: 0.85,
        requested_by: 1,
        requested_by_name: 'Test User',
        reviewed_by: null,
        reviewed_by_name: null,
        reviewed_at: null,
        reviewer_notes: '',
        delegated_to: null,
        delegated_to_name: null,
        expires_at: '2026-01-04T00:00:00Z',
        created_on: '2026-01-01T00:00:00Z',
        modified_on: '2026-01-01T00:00:00Z',
      },
    ]);

    render(<ApprovalQueuePanel />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('PO-2026-0101 to Acme Meats')).toBeInTheDocument();
    });
  });

  it('should display stats in non-compact mode', async () => {
    vi.mocked(approvalQueueApi.list).mockResolvedValue([]);

    render(<ApprovalQueuePanel compact={false} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(approvalQueueApi.stats).toHaveBeenCalled();
    });
  });

  it('should render filter controls', async () => {
    vi.mocked(approvalQueueApi.list).mockResolvedValue([]);

    render(<ApprovalQueuePanel />, { wrapper: createWrapper() });

    // Filter bar should render
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });
  });
});
