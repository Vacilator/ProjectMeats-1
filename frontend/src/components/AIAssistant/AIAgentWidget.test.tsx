import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_INBOX_REFRESH_EVENT } from '../../services/aiService';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));

const websocketInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;
  protocols?: string | string[];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    websocketInstances.push(this);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  send = vi.fn();

  emitMessage(payload: unknown) {
    this.onmessage?.(
      {
        data: JSON.stringify(payload),
      } as MessageEvent
    );
  }
}

const jwtServiceMock = vi.hoisted(() => ({
  getAccessToken: vi.fn(() => 'access-token'),
  getTenantFromToken: vi.fn(() => ({ defaultTenantId: 'tenant-123' })),
  refreshAccessToken: vi.fn(async () => 'refreshed-access-token'),
}));

const aiInboxSyncContextMock = vi.hoisted(() => ({
  syncState: {
    status: 'idle',
    summary: null,
    action: null,
    failure: null,
    progress: null,
    retryable: false,
  },
  requestSync: vi.fn(),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => toastMock,
}));

vi.mock('@/services/jwtService', () => jwtServiceMock);

vi.mock('../../services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/hooks/useHealth', () => ({
  useHealth: () => ({ data: { features: { ai: true } } }),
}));

vi.mock('@/contexts/CockpitNavigationContext', () => ({
  useCockpitNavigation: () => ({
    path: [],
    addStep: vi.fn(),
    goBack: vi.fn(),
    goToStep: vi.fn(),
    clearPath: vi.fn(),
    recentPaths: [],
    saveCurrentPath: vi.fn(),
  }),
}));

vi.mock('@/contexts/AIInboxSyncContext', () => ({
  useAIInboxSync: () => aiInboxSyncContextMock,
}));

vi.mock('@/services/aiContext', () => ({
  buildAIPageContext: () => ({}),
}));

vi.mock('@/hooks/useAIPreferences', () => ({
  useAIPreferences: () => ({
    preferences: { require_external_approval: true, show_ai_suggestions: true },
    updatePreference: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('./HITLReviewCard', () => ({
  HITLReviewCard: () => <div data-testid="hitl-review-card" />,
}));

vi.mock('./DocumentAuditBadges', () => ({
  default: () => <div data-testid="document-audit-badges" />,
}));

import { AIAgentWidget } from './AIAgentWidget';

describe('AIAgentWidget', () => {
  beforeEach(() => {
    websocketInstances.length = 0;
    toastMock.info.mockReset();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
    toastMock.warning.mockReset();
    jwtServiceMock.getAccessToken.mockReset();
    jwtServiceMock.getAccessToken.mockReturnValue('access-token');
    jwtServiceMock.getTenantFromToken.mockReset();
    jwtServiceMock.getTenantFromToken.mockReturnValue({ defaultTenantId: 'tenant-123' });
    jwtServiceMock.refreshAccessToken.mockReset();
    jwtServiceMock.refreshAccessToken.mockResolvedValue('refreshed-access-token');
    aiInboxSyncContextMock.syncState = {
      status: 'idle',
      summary: null,
      action: null,
      failure: null,
      progress: null,
      retryable: false,
    };
    aiInboxSyncContextMock.requestSync.mockReset();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('scrollTo', vi.fn());
    // Mock fetch for the WS pre-flight health check
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 426,
        redirected: false,
      }),
    );
    localStorage.clear();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('connects to the AI inbox websocket with tenant and access token', async () => {
    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(websocketInstances).toHaveLength(1);
    });

    expect(websocketInstances[0].url).toContain('/ws/ai/inbox/');
    expect(websocketInstances[0].url).toContain('tenant_id=tenant-123');
    expect(websocketInstances[0].url).toContain('access_token=access-token');
    expect(websocketInstances[0].protocols).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'AI chat widget' }));

    act(() => {
      websocketInstances[0].emitMessage({
        type: 'ai.inbox.snapshot',
        pending_count: 3,
        results: [
          {
            id: 'draft-1',
            sender: 'dispatch@example.com',
            source_subject: 'Potential BOL received',
            intent_label: 'Bill Of Lading',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('3 in Inbox')).toBeInTheDocument();
    });
  });

  it('refreshes the access token before connecting when the cached token is missing', async () => {
    jwtServiceMock.getAccessToken.mockReturnValue(null);

    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(jwtServiceMock.refreshAccessToken).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(websocketInstances).toHaveLength(1);
    });

    expect(websocketInstances[0].url).toContain('access_token=refreshed-access-token');
    expect(websocketInstances[0].protocols).toBeUndefined();
  });

  it('falls back to the stored tenant id and shows a contextual inbox update message', async () => {
    jwtServiceMock.getTenantFromToken.mockReturnValue(null);
    localStorage.setItem('tenantId', 'tenant-local');

    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(websocketInstances).toHaveLength(1);
    });

    expect(websocketInstances[0].url).toContain('tenant_id=tenant-local');

    act(() => {
      websocketInstances[0].emitMessage({
        type: 'ai.inbox.update',
        pending_count: 1,
        results: [
          {
            id: 'draft-2',
            sender: 'dispatch@example.com',
            source_subject: 'Potential BOL received',
            intent_label: 'Bill Of Lading',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(toastMock.info).toHaveBeenCalledWith(
        'Bill Of Lading from dispatch@example.com: Potential BOL received'
      );
    });
  });

  it('does not bypass reconnect backoff on visibility changes', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      render(
        <MemoryRouter>
          <AIAgentWidget />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(websocketInstances).toHaveLength(1);
      });

      act(() => {
        websocketInstances[0].onclose?.({ code: 1006 } as CloseEvent);
      });

      expect(websocketInstances).toHaveLength(1);

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(websocketInstances).toHaveLength(1);

      await waitFor(() => {
        expect(websocketInstances).toHaveLength(2);
      }, { timeout: 2500 });
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('fails closed when the websocket preflight resolves to the SPA fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      redirected: false,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/ws/ai/inbox/',
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
        }),
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(websocketInstances).toHaveLength(0);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(websocketInstances).toHaveLength(0);
  });

  it('requests an updated inbox count when the sync refresh event fires', async () => {
    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(websocketInstances).toHaveLength(1);
    });

    websocketInstances[0].readyState = MockWebSocket.OPEN;

    act(() => {
      window.dispatchEvent(new CustomEvent(AI_INBOX_REFRESH_EVENT));
    });

    expect(websocketInstances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'request_count' }),
    );
  });

  it('renders Retry Sync when the shared sync state reports a recoverable failure', async () => {
    aiInboxSyncContextMock.syncState = {
      status: 'failed',
      summary: 'Email sync timed out.',
      action: { type: 'retry_sync', label: 'Retry Sync' },
      failure: { retryable: true, hint: 'Retry the sync.' },
      progress: null,
      retryable: true,
    };

    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI chat widget' }));

    expect(await screen.findAllByRole('button', { name: 'Retry Sync' })).not.toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Retry Sync' })[0]);
    expect(aiInboxSyncContextMock.requestSync).toHaveBeenCalledWith('manual');
  });

  it('renders Reconnect Outlook when the shared sync state requires reconnect', async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignMock },
    });

    aiInboxSyncContextMock.syncState = {
      status: 'failed',
      summary: 'Outlook needs to be reconnected.',
      action: {
        type: 'reconnect_outlook',
        label: 'Reconnect Outlook',
        url: '/api/v1/integrations/oauth/authorize/?provider=microsoft&tenant_id=tenant-123&redirect=1',
      },
      failure: { retryable: false, hint: 'Reconnect Outlook.' },
      progress: null,
      retryable: false,
    };

    render(
      <MemoryRouter>
        <AIAgentWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI chat widget' }));

    const reconnectButton = await screen.findByRole('button', { name: 'Reconnect Outlook' });
    fireEvent.click(reconnectButton);

    expect(assignMock).toHaveBeenCalledWith(
      '/api/v1/integrations/oauth/authorize/?provider=microsoft&tenant_id=tenant-123&redirect=1',
    );
  });
});
