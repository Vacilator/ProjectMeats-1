/**
 * Unit Tests for History Drawer Component
 * 
 * Tests version history display, formatting, and interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HistoryDrawer } from './HistoryDrawer';
import { businessApi } from '@/services/businessApi';

// Mock businessApi
vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
  },
}));

// Mock AntD components for simpler testing
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

describe('HistoryDrawer', () => {
  const mockHistoryData = [
    {
      id: '1',
      from_status: 'pending',
      to_status: 'in_progress',
      changed_by: {
        id: 'user1',
        username: 'john_doe',
        email: 'john@example.com',
      },
      changed_at: '2026-02-27T10:00:00Z',
      comment: 'Started working on this workflow',
      submission: 'sub1',
    },
    {
      id: '2',
      from_status: 'in_progress',
      to_status: 'approved',
      changed_by: {
        id: 'user2',
        username: 'jane_smith',
        email: 'jane@example.com',
      },
      changed_at: '2026-02-27T14:30:00Z',
      comment: 'Looks good, approved!',
      submission: 'sub1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drawer with correct title', () => {
    render(
      <HistoryDrawer
        submissionId="sub1"
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Version History')).toBeInTheDocument();
  });

  it('fetches history when opened', async () => {
    const mockGet = vi.mocked(businessApi.get);
    mockGet.mockResolvedValueOnce({ data: mockHistoryData });

    render(
      <HistoryDrawer
        submissionId="sub1"
        open={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/workflows/form-submissions/sub1/history/');
    });
  });

  it('displays loading state while fetching', () => {
    const mockGet = vi.mocked(businessApi.get);
    mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <HistoryDrawer
        submissionId="sub1"
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Loading history...')).toBeInTheDocument();
  });

  it('displays empty state when no history', async () => {
    const mockGet = vi.mocked(businessApi.get);
    mockGet.mockResolvedValueOnce({ data: [] });

    render(
      <HistoryDrawer
        submissionId="sub1"
        open={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No version history yet')).toBeInTheDocument();
    });
  });

  it('displays history entries when data is available', async () => {
    const mockGet = vi.mocked(businessApi.get);
    mockGet.mockResolvedValueOnce({ data: mockHistoryData });

    render(
      <HistoryDrawer
        submissionId="sub1"
        open={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
      expect(screen.getByText('jane_smith')).toBeInTheDocument();
      expect(screen.getByText('Started working on this workflow')).toBeInTheDocument();
      expect(screen.getByText('Looks good, approved!')).toBeInTheDocument();
    });
  });

  it('does not fetch history when closed', () => {
    const mockGet = vi.mocked(businessApi.get);

    render(
      <HistoryDrawer
        submissionId="sub1"
        open={false}
        onClose={() => {}}
      />
    );

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch history when submissionId is null', () => {
    const mockGet = vi.mocked(businessApi.get);

    render(
      <HistoryDrawer
        submissionId={null}
        open={true}
        onClose={() => {}}
      />
    );

    expect(mockGet).not.toHaveBeenCalled();
  });

  describe('Status Formatting', () => {
    it('formats snake_case status to Title Case', () => {
      // This would test the formatStatus function if exported
      // For now, we verify it through rendered output
      const mockGet = vi.mocked(businessApi.get);
      mockGet.mockResolvedValueOnce({
        data: [{
          ...mockHistoryData[0],
          to_status: 'in_progress',
        }],
      });

      render(
        <HistoryDrawer
          submissionId="sub1"
          open={true}
          onClose={() => {}}
        />
      );

      waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument();
      });
    });
  });

  describe('Timestamp Formatting', () => {
    it('shows relative time for recent changes', async () => {
      const mockGet = vi.mocked(businessApi.get);
      const recentTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

      mockGet.mockResolvedValueOnce({
        data: [{
          ...mockHistoryData[0],
          changed_at: recentTimestamp,
        }],
      });

      render(
        <HistoryDrawer
          submissionId="sub1"
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/2 hours ago/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when fetch fails', async () => {
      const mockGet = vi.mocked(businessApi.get);
      mockGet.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Failed to load history',
          },
        },
      });

      render(
        <HistoryDrawer
          submissionId="sub1"
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load history')).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      const mockGet = vi.mocked(businessApi.get);
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      render(
        <HistoryDrawer
          submissionId="sub1"
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });
});
