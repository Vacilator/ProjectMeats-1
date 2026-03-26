import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { config, getRuntimeConfig } from '../../../config/runtime';

export type CollaborationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CollaborationCursor {
  x: number;
  y: number;
}

export interface CollaborationPresenceUser {
  userId: string;
  name?: string;
  color?: string;
  cursor?: CollaborationCursor;
  selection?: {
    nodeIds: string[];
  };
  lastSeen: number;
}

export interface CollaborationMessage {
  type:
    | 'presence_state'
    | 'presence_join'
    | 'presence_leave'
    | 'cursor_move'
    | 'selection_change'
    | 'ping'
    | 'pong'
    | string;
  userId?: string;
  timestamp?: number;
  data?: any;
}

export interface UseCollaborationArgs {
  workflowId?: string;
  tenantId?: string;
}

export interface UseCollaborationResult {
  status: CollaborationStatus;
  presence: CollaborationPresenceUser[];
  sendCursor: (cursor: CollaborationCursor) => void;
  sendSelection: (nodeIds: string[]) => void;
  disconnect: () => void;
}

function deriveWsBaseUrl(): string {
  // Allow explicit override (runtime, build-time, legacy env)
  const explicit = getRuntimeConfig('WSS_BASE_URL', '');
  if (explicit) return explicit.replace(/\/$/, '');

  // Derive from API_BASE_URL (which already includes /api/v1)
  const httpBase = config.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const protocol = httpBase.startsWith('https://') ? 'wss://' : 'ws://';
  const host = httpBase.replace(/^https?:\/\//, '');

  return `${protocol}${host}`;
}

export function useCollaboration({ workflowId, tenantId }: UseCollaborationArgs): UseCollaborationResult {
  const [status, setStatus] = useState<CollaborationStatus>('disconnected');
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, CollaborationPresenceUser>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isManuallyClosedRef = useRef(false);
  const connectRef = useRef<(() => void) | null>(null);

  // Local client identifier (used only for filtering if the server echoes it back)
  const localClientIdRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local-${Date.now()}`
  );

  const wsUrl = useMemo(() => {
    if (!workflowId || !tenantId) return null;

    const base = deriveWsBaseUrl();
    const url = new URL(`${base}/ws/workflows/${workflowId}/collab/`);
    url.searchParams.set('tenant_id', tenantId);
    url.searchParams.set('client_id', localClientIdRef.current);
    return url.toString();
  }, [workflowId, tenantId]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    clearReconnectTimer();

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)
    ) {
      try {
        wsRef.current.close(1000, 'client_disconnect');
      } catch {
        // ignore
      }
    }

    wsRef.current = null;
    reconnectAttemptRef.current = 0;
    setStatus('disconnected');
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(() => {
    if (!wsUrl || isManuallyClosedRef.current) return;

    clearReconnectTimer();
    reconnectAttemptRef.current += 1;

    // Exponential backoff with cap
    const delayMs = Math.min(15_000, 500 * 2 ** (reconnectAttemptRef.current - 1));

    reconnectTimerRef.current = window.setTimeout(() => {
      connectRef.current?.();
    }, delayMs);
  }, [wsUrl, clearReconnectTimer]);

  const handleMessage = useCallback((raw: MessageEvent) => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(String(raw.data));
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== 'object') return;

    const msg = parsed as CollaborationMessage;
    const now = Date.now();

    if (msg.type === 'presence_state' && msg.data && typeof msg.data === 'object') {
      const incomingUsers = Array.isArray(msg.data.users) ? msg.data.users : [];
      setPresenceByUserId(() => {
        const next: Record<string, CollaborationPresenceUser> = {};
        for (const u of incomingUsers) {
          if (!u?.userId) continue;
          if (u.userId === localClientIdRef.current) continue;

          next[u.userId] = {
            userId: u.userId,
            name: u.name,
            color: u.color,
            cursor: u.cursor,
            selection: u.selection,
            lastSeen: now,
          };
        }
        return next;
      });
      return;
    }

    if (msg.type === 'presence_leave' && msg.userId) {
      setPresenceByUserId(prev => {
        const next = { ...prev };
        delete next[msg.userId!];
        return next;
      });
      return;
    }

    // Cursor / selection updates
    if ((msg.type === 'cursor_move' || msg.type === 'selection_change') && msg.userId) {
      if (msg.userId === localClientIdRef.current) return;

      setPresenceByUserId(prev => {
        const existing = prev[msg.userId!];
        const base: CollaborationPresenceUser = existing ?? { userId: msg.userId!, lastSeen: now };

        const next: CollaborationPresenceUser = {
          ...base,
          lastSeen: now,
        };

        if (msg.type === 'cursor_move' && msg.data?.cursor) {
          next.cursor = msg.data.cursor;
        }

        if (msg.type === 'selection_change' && msg.data?.selection) {
          next.selection = msg.data.selection;
        }

        return { ...prev, [msg.userId!]: next };
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (!wsUrl) return;

    isManuallyClosedRef.current = false;

    // Clean up any prior socket
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)
    ) {
      try {
        wsRef.current.close(1000, 'reconnect');
      } catch {
        // ignore
      }
    }

    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setStatus('error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        setStatus('disconnected');
        scheduleReconnect();
      };
    } catch {
      setStatus('error');
      scheduleReconnect();
    }
  }, [wsUrl, handleMessage, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!wsUrl) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [wsUrl, connect, disconnect]);

  const send = useCallback((payload: CollaborationMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  const sendCursor = useCallback((cursor: CollaborationCursor) => {
    send({
      type: 'cursor_move',
      userId: localClientIdRef.current,
      timestamp: Date.now(),
      data: { cursor },
    });
  }, [send]);

  const sendSelection = useCallback((nodeIds: string[]) => {
    send({
      type: 'selection_change',
      userId: localClientIdRef.current,
      timestamp: Date.now(),
      data: { selection: { nodeIds } },
    });
  }, [send]);

  const presence = useMemo(() => {
    // Sort by recent activity; also prune stale users (best-effort)
    const now = Date.now();
    const users = Object.values(presenceByUserId).filter(u => now - u.lastSeen < 60_000);
    return users.sort((a, b) => b.lastSeen - a.lastSeen);
  }, [presenceByUserId]);

  return {
    status,
    presence,
    sendCursor,
    sendSelection,
    disconnect,
  };
}
