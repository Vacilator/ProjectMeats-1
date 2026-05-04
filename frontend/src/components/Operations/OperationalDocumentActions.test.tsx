import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectivityState = vi.hoisted(() => ({
  isOnline: true,
  status: 'online',
  lastChangedAt: null as number | null,
}));

const connectivityMock = vi.hoisted(() => ({
  useConnectivity: vi.fn(() => connectivityState),
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
import { OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY } from './operationalOfflineMode';

const renderActions = (
  props: Partial<React.ComponentProps<typeof OperationalDocumentActions>> = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <OperationalDocumentActions entityType="carrier_purchase_order" entityId="42" {...props} />
    </QueryClientProvider>
  );

  return {
    queryClient,
    ...view,
  };
};

describe('OperationalDocumentActions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ENV;
    window.localStorage.setItem('tenantId', 'tenant-123');
    connectivityState.isOnline = true;
    connectivityState.status = 'online';
    connectivityState.lastChangedAt = null;
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

  it('disables offline queueing when the rollout guard is set', async () => {
    window.localStorage.setItem(OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY, '1');
    businessApiMock.post.mockRejectedValueOnce(new Error('Network error'));

    renderActions();

    expect(await screen.findByText('Current status: processing')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update status/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Current status: processing')).toBeInTheDocument();
    });

    expect(screen.queryByText(/queued offline/i)).not.toBeInTheDocument();
    expect(messageMock.error).toHaveBeenCalledWith('Network error');
    expect(window.localStorage.getItem('projectmeats.operational-status-queue.v1:tenant-123')).toBeNull();
  });

  it('replays queued transitions when connectivity returns', async () => {
    connectivityState.isOnline = false;
    connectivityState.status = 'offline';
    connectivityState.lastChangedAt = 1;

    window.localStorage.setItem(
      'projectmeats.operational-status-queue.v1:tenant-123',
      JSON.stringify([
        {
          tenantId: 'tenant-123',
          entityType: 'carrier_purchase_order',
          entityId: '42',
          nextStatus: 'delivered',
          queuedAt: '2026-05-04T00:00:00.000Z',
        },
      ]),
    );

    let currentStatus = 'processing';
    businessApiMock.get.mockImplementation(async () => ({
      data: {
        current_status: currentStatus,
        allowed_transitions: currentStatus === 'processing' ? ['delivered'] : [],
        statuses: [
          { value: 'processing', label: 'Processing' },
          { value: 'delivered', label: 'Delivered' },
        ],
      },
    }));
    businessApiMock.post.mockImplementation(async () => {
      currentStatus = 'delivered';
      return { data: { status: 'delivered' } };
    });

    const onChanged = vi.fn();
    const view = renderActions({ onChanged });

    expect(await screen.findByText('Queued offline: delivered')).toBeInTheDocument();

    connectivityState.isOnline = true;
    connectivityState.status = 'online';
    connectivityState.lastChangedAt = 2;

    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <OperationalDocumentActions
          entityType="carrier_purchase_order"
          entityId="42"
          onChanged={onChanged}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(window.localStorage.getItem('projectmeats.operational-status-queue.v1:tenant-123')).toBeNull();
    });
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
