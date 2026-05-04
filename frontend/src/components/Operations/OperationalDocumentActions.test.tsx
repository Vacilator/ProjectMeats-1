import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectivityMock = vi.hoisted(() => ({
  useConnectivity: vi.fn(() => ({
    isOnline: true,
    status: 'online',
    lastChangedAt: null,
  })),
}));

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const messageMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@/contexts/ConnectivityContext', () => ({
  useConnectivity: connectivityMock.useConnectivity,
}));

vi.mock('@/services/businessApi', () => ({
  businessApi: businessApiMock,
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: messageMock,
  };
});

import { OperationalDocumentActions } from './OperationalDocumentActions';

const renderActions = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OperationalDocumentActions entityType="carrier_purchase_order" entityId="42" />
    </QueryClientProvider>
  );
};

describe('OperationalDocumentActions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('tenantId', 'tenant-123');
    businessApiMock.get.mockReset();
    businessApiMock.post.mockReset();
    messageMock.success.mockReset();
    messageMock.error.mockReset();
    messageMock.warning.mockReset();

    businessApiMock.get.mockResolvedValue({
      data: {
        current_status: 'processing',
        allowed_transitions: ['delivered'],
        statuses: [
          { value: 'processing', label: 'Processing' },
          { value: 'delivered', label: 'Delivered' },
        ],
      },
    });
  });

  it('queues optimistic transitions when connectivity drops mid-mutation', async () => {
    businessApiMock.post.mockRejectedValueOnce(new Error('Network error'));

    renderActions();

    expect(await screen.findByText('Current status: processing')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update status/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Current status: delivered')).toBeInTheDocument();
    });

    expect(screen.getByText(/queued offline: delivered/i)).toBeInTheDocument();
    expect(messageMock.warning).toHaveBeenCalled();
    expect(window.localStorage.getItem('projectmeats.operational-status-queue.v1:tenant-123')).toContain(
      '"nextStatus":"delivered"'
    );
  });

  it('rolls back optimistic transitions on hard server failures', async () => {
    businessApiMock.post.mockRejectedValueOnce(new Error('Server exploded'));

    renderActions();

    expect(await screen.findByText('Current status: processing')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update status/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Current status: processing')).toBeInTheDocument();
    });

    expect(screen.queryByText(/queued offline/i)).not.toBeInTheDocument();
    expect(messageMock.error).toHaveBeenCalledWith('Server exploded');
    expect(window.localStorage.getItem('projectmeats.operational-status-queue.v1:tenant-123')).toBeNull();
  });
});
