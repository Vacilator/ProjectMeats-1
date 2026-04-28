import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRealTimeEntity } from './useRealTimeEntity';

const invalidateQueries = vi.fn();
const getAccessToken = vi.fn(() => 'jwt-token');
const getValidTenantId = vi.fn(() => 'tenant-123');

vi.mock('@/contexts/AuthContext', () => ({
  useAuthState: () => ({
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock('@/services/jwtService', () => ({
  getAccessToken: () => getAccessToken(),
}));

vi.mock('@/utils/tenantId', () => ({
  getValidTenantId: () => getValidTenantId(),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

describe('useRealTimeEntity', () => {
  beforeEach(() => {
    invalidateQueries.mockReset();
    getAccessToken.mockReturnValue('jwt-token');
    getValidTenantId.mockReturnValue('tenant-123');
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient();
    queryClient.invalidateQueries = invalidateQueries;
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  it('invalidates matching query keys when a direct entity mutation arrives', async () => {
    renderHook(
      () =>
        useRealTimeEntity('customer', '42', {
          queryKeys: [['entity-workflow-status', 'customer', '42']],
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    MockWebSocket.instances[0].onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          entity_type: 'customer',
          id: '42',
        }),
      })
    );

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['entity-workflow-status', 'customer', '42'],
      });
    });
  });

  it('invalidates when a related execution mutation targets the subscribed entity', async () => {
    renderHook(
      () =>
        useRealTimeEntity('purchase_order', 'po-9', {
          queryKeys: [['entity-workflow-status', 'purchase_order', 'po-9']],
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    MockWebSocket.instances[0].onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          entity_type: 'tenantworkformexecution',
          id: 'exec-1',
          related_entity_type: 'purchase_order',
          related_entity_id: 'po-9',
        }),
      })
    );

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['entity-workflow-status', 'purchase_order', 'po-9'],
      });
    });
  });
});
