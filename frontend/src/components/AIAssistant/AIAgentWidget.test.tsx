import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/services/aiContext', () => ({
  buildAIPageContext: () => ({}),
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
    jwtServiceMock.getAccessToken.mockClear();
    jwtServiceMock.getTenantFromToken.mockClear();
    jwtServiceMock.refreshAccessToken.mockClear();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('scrollTo', vi.fn());
    // Mock fetch for the WS pre-flight health check
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
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
    expect(websocketInstances[0].protocols).toEqual(['pm.ai.inbox', 'access_token', 'access-token']);

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
    expect(websocketInstances[0].protocols).toEqual([
      'pm.ai.inbox',
      'access_token',
      'refreshed-access-token',
    ]);
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
});
