import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  FileText,
  GitBranch,
  History,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';

import { useToast } from '../../hooks/useToast';
import { businessApi } from '../../services/businessApi';

type AgentState = 'idle' | 'thinking' | 'action_required';

type ReviewRequiredDetail = {
  document_type?: string;
  vendor?: string;
  message?: string;
  questions_for_user?: string[];
};

type ChatMessageRole = 'assistant' | 'user' | 'system' | 'document';

type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, any>;
};

type OutlookStatus = {
  connected: boolean;
  expired: boolean;
  connectedEmail?: string;
  connectedName?: string;
};

type ServerSession = {
  id: string;
  title?: string | null;
  last_activity?: string;
  created_on?: string;
  message_count?: number;
};

type ServerMessage = {
  id: string;
  message_type: 'user' | 'assistant' | 'system' | 'document';
  content: string;
  metadata?: Record<string, any>;
  created_on?: string;
};

const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const LOCAL_STORAGE_SESSION_KEY = 'pm.ai.widget.sessionId';

const calmPulse = keyframes`
  0%, 100% { transform: translateY(0); box-shadow: 0 10px 28px rgb(var(--color-text-primary) / 0.10); }
  50% { transform: translateY(-1px); box-shadow: 0 12px 34px rgb(var(--color-text-primary) / 0.14); }
`;

const urgentGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 0 0 0 rgb(var(--color-primary) / 0.00),
      0 12px 34px rgb(var(--color-text-primary) / 0.14);
  }
  50% {
    box-shadow:
      0 0 0 6px rgb(var(--color-primary) / 0.14),
      0 16px 42px rgb(var(--color-text-primary) / 0.18);
  }
`;

const thinkingFlicker = keyframes`
  0%, 100% { box-shadow: 0 12px 34px rgb(var(--color-text-primary) / 0.14); }
  50% { box-shadow: 0 18px 52px rgb(var(--color-text-primary) / 0.20); }
`;

const WidgetShell = styled.div<{ $state: AgentState }>`
  position: fixed;
  right: calc(16px + env(safe-area-inset-right, 0px));
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 1000;
  pointer-events: auto;

  ${(p) =>
    p.$state === 'action_required'
      ? css`
          animation: ${urgentGlow} 1.2s ease-in-out infinite;
        `
      : p.$state === 'thinking'
        ? css`
            animation: ${thinkingFlicker} 0.65s ease-in-out infinite;
          `
        : css`
            animation: ${calmPulse} 3s ease-in-out infinite;
          `}
`;

const Card = styled.div<{ $expanded: boolean; $state: AgentState }>`
  width: ${(p) => (p.$expanded ? '420px' : '56px')};
  max-width: calc(100vw - 32px);
  height: ${(p) => (p.$expanded ? '560px' : '56px')};
  border-radius: ${(p) => (p.$expanded ? '14px' : '999px')};
  overflow: hidden;
  background: ${(p) => (p.$expanded ? 'rgb(var(--color-surface))' : 'rgb(var(--color-primary))')};
  border: 1px solid
    ${(p) =>
      p.$expanded
        ? p.$state === 'action_required'
          ? 'rgb(var(--color-primary) / 0.60)'
          : 'rgb(var(--color-border))'
        : 'rgb(var(--color-primary))'};
`;

const HeaderBtn = styled.button<{ $expanded: boolean }>`
  width: 100%;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$expanded ? 'space-between' : 'center')};
  gap: 10px;
  padding: ${(p) => (p.$expanded ? '0 14px' : '0')};
  border: none;
  cursor: pointer;
  background: ${(p) => (p.$expanded ? 'rgb(var(--color-surface))' : 'rgb(var(--color-primary))')};
  color: ${(p) => (p.$expanded ? 'rgb(var(--color-text-primary))' : 'white')};

  &:hover {
    background: ${(p) => (p.$expanded ? 'rgb(var(--color-primary) / 0.10)' : 'rgb(var(--color-primary))')};
  }
`;

const HeaderLeft = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const Title = styled.div`
  font-weight: 900;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusPill = styled.div<{ $variant: 'ok' | 'warn' | 'info' }>`
  font-size: 11px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgb(var(--color-border));
  color: ${(p) => {
    if (p.$variant === 'warn') return 'rgb(234, 179, 8)';
    if (p.$variant === 'ok') return 'rgb(34, 197, 94)';
    return 'rgb(var(--color-text-secondary))';
  }};
  background: rgb(var(--color-primary) / 0.06);
`;

const Body = styled.div`
  height: calc(100% - 56px);
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgb(var(--color-border));
`;

const SessionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const SessionTitle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  max-width: 240px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background: rgb(var(--color-primary) / 0.08);
  }
`;

const SessionActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const IconBtn = styled.button<{ $danger?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${(p) => (p.$danger ? 'rgb(239, 68, 68)' : 'rgb(var(--color-text-secondary))')};

  &:hover {
    background: rgb(var(--color-primary) / 0.10);
    color: ${(p) => (p.$danger ? 'rgb(239, 68, 68)' : 'rgb(var(--color-text-primary))')};
  }
`;

const SessionMenu = styled.div`
  position: absolute;
  right: 16px;
  bottom: 88px;
  width: min(380px, calc(100vw - 32px));
  max-height: 380px;
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  box-shadow: 0 18px 54px rgb(var(--color-text-primary) / 0.18);
  padding: 10px;
`;

const SessionRow = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  border: 1px solid ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.45)' : 'transparent')};
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.08)' : 'transparent')};
  color: rgb(var(--color-text-primary));
  padding: 10px;
  border-radius: 12px;
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-primary), 0.08);
  }
`;

const SessionRowTitle = styled.div`
  font-weight: 900;
  font-size: 12px;
`;

const SessionRowMeta = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const IntegrationBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const IntegrationDot = styled.span<{ $connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => (p.$connected ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)')};
`;

const IntegrationLink = styled.a`
  margin-left: auto;
  color: rgb(var(--color-primary));
  font-weight: 800;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const Messages = styled.div<{ $dragOver: boolean }>`
  flex: 1;
  overflow: auto;
  padding: 12px 12px 0;
  background: ${(p) => (p.$dragOver ? 'rgb(var(--color-primary) / 0.05)' : 'transparent')};
  outline: ${(p) => (p.$dragOver ? '2px dashed rgba(var(--color-primary), 0.45)' : 'none')};
  outline-offset: -8px;
`;

const Bubble = styled.div<{ $role: ChatMessageRole }>`
  max-width: 92%;
  margin: 0 0 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border));
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;

  ${(p) =>
    p.$role === 'user'
      ? css`
          margin-left: auto;
          background: rgb(var(--color-primary) / 0.10);
          color: rgb(var(--color-text-primary));
        `
      : p.$role === 'document'
        ? css`
            margin-right: auto;
            background: rgb(var(--color-surface));
            color: rgb(var(--color-text-primary));
            border-color: rgba(var(--color-primary), 0.35);
          `
        : p.$role === 'system'
          ? css`
              margin-right: auto;
              background: rgb(var(--color-text-primary) / 0.04);
              color: rgb(var(--color-text-secondary));
            `
          : css`
              margin-right: auto;
              background: rgb(var(--color-surface));
              color: rgb(var(--color-text-primary));
            `}
`;

const DocumentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const DocumentMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  a {
    color: rgb(var(--color-primary));
    font-weight: 850;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  div {
    color: rgb(var(--color-text-secondary));
    font-size: 11px;
  }
`;

const Composer = styled.form`
  padding: 10px 12px 12px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const AttachmentsBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const AttachmentChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-primary), 0.30);
  background: rgba(var(--color-primary), 0.08);
  font-size: 12px;
  color: rgb(var(--color-text-primary));
`;

const ChipRemove = styled.button`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: none;
  background: rgb(var(--color-text-primary) / 0.10);
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgb(var(--color-text-primary) / 0.18);
  }
`;

const ComposerRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Input = styled.input`
  flex: 1;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  border-radius: 10px;
  padding: 10px 10px;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary) / 0.65);
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.15);
  }
`;

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeSessions = (raw: any): ServerSession[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
};

const normalizeServerMessages = (raw: any): ServerMessage[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
};

const toUiMessages = (server: ServerMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  for (const m of server) {
    const role = m.message_type;
    out.push({
      id: m.id,
      role,
      content: m.content,
      metadata: m.metadata || undefined,
      createdAt: m.created_on ? Date.parse(m.created_on) : Date.now(),
    });
  }
  return out;
};

export const AIAgentWidget: React.FC = () => {
  const toast = useToast();

  const [state, setState] = useState<AgentState>('idle');
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ReviewRequiredDetail>({});
  const [draft, setDraft] = useState('');

  const [sessionId, setSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    } catch {
      return null;
    }
  });

  const [sessions, setSessions] = useState<ServerSession[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const [outlookStatus, setOutlookStatus] = useState<OutlookStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: newId(),
      role: 'assistant',
      content:
        "Hi — I'm your ProjectMeats agent. Ask me anything, attach documents for analysis, or restore a previous chat session.",
      createdAt: Date.now(),
    },
  ]);

  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const defaultActionMessage = useMemo(
    () => 'I just processed a Purchase Order from Sysco, but the delivery date is unclear. Can you verify?',
    []
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, expanded]);

  useEffect(() => {
    if (!expanded) return;

    const loadOutlookStatus = async () => {
      try {
        const res = await businessApi.get<{ connections?: any[] }>('/integrations/oauth/status/');
        const connections = Array.isArray(res.data?.connections) ? res.data.connections : [];
        const outlook = connections.find((c) => c?.provider === 'microsoft');
        if (!outlook) {
          setOutlookStatus({ connected: false, expired: false });
          return;
        }

        setOutlookStatus({
          connected: !outlook.is_expired,
          expired: Boolean(outlook.is_expired),
          connectedEmail: outlook.connected_email,
          connectedName: outlook.connected_name,
        });
      } catch {
        setOutlookStatus(null);
      }
    };

    const loadSessions = async () => {
      try {
        const res = await businessApi.get('/ai-assistant/ai-sessions/');
        setSessions(normalizeSessions(res.data));
      } catch {
        setSessions([]);
      }
    };

    void loadOutlookStatus();
    void loadSessions();
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !sessionId) return;

    const loadHistory = async () => {
      try {
        const res = await businessApi.get(`/ai-assistant/ai-sessions/${sessionId}/messages/`);
        const serverMsgs = normalizeServerMessages(res.data);
        const ui = toUiMessages(serverMsgs);
        if (ui.length) setMessages(ui);
      } catch {
        // ignore
      }
    };

    void loadHistory();
  }, [expanded, sessionId]);

  useEffect(() => {
    // Widget contract events.
    const onReviewRequired = (event: Event) => {
      const e = event as CustomEvent<ReviewRequiredDetail>;
      const d = e.detail || {};

      setState('action_required');
      setDetail(d);
      setExpanded(true);

      const msg = d.message || defaultActionMessage;
      const questions = Array.isArray(d.questions_for_user) ? d.questions_for_user : [];
      const suffix = questions.length ? `\n\nQuestions:\n- ${questions.slice(0, 6).join('\n- ')}` : '';

      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: `${msg}${suffix}`,
          createdAt: Date.now(),
        },
      ]);
    };

    const onThinking = () => {
      setState('thinking');
    };

    const onIdle = () => {
      setState('idle');
      setDetail({});
    };

    window.addEventListener('pm:ai-review-required', onReviewRequired as EventListener);
    window.addEventListener('pm:ai-thinking', onThinking as EventListener);
    window.addEventListener('pm:ai-learning', onThinking as EventListener);
    window.addEventListener('pm:ai-idle', onIdle as EventListener);

    return () => {
      window.removeEventListener('pm:ai-review-required', onReviewRequired as EventListener);
      window.removeEventListener('pm:ai-thinking', onThinking as EventListener);
      window.removeEventListener('pm:ai-learning', onThinking as EventListener);
      window.removeEventListener('pm:ai-idle', onIdle as EventListener);
    };
  }, [defaultActionMessage]);

  const pill =
    state === 'action_required'
      ? { text: 'Action required', variant: 'warn' as const }
      : state === 'thinking'
        ? { text: 'Thinking', variant: 'info' as const }
        : { text: 'Idle', variant: 'ok' as const };

  const outlookBannerText = (() => {
    if (!outlookStatus) return 'Status unavailable';
    if (outlookStatus.connected) {
      return `Connected${outlookStatus.connectedEmail ? ` (${outlookStatus.connectedEmail})` : ''}`;
    }
    if (outlookStatus.expired) return 'Connected (Expired)';
    return 'Not connected';
  })();

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size too large. Max ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB.`;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`;
    }
    return null;
  };

  const addAttachments = (files: File[]) => {
    const accepted: File[] = [];
    for (const f of files) {
      const err = validateFile(f);
      if (err) {
        toast.error(err);
        continue;
      }
      accepted.push(f);
    }

    if (!accepted.length) return;
    setAttachments((prev) => [...prev, ...accepted]);
    toast.success(`Added ${accepted.length} attachment(s)`);
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;

    const res = await businessApi.post<ServerSession>('/ai-assistant/ai-sessions/', {
      title: `Chat ${new Date().toLocaleString()}`,
      context_data: { ui_source: 'AIAgentWidget' },
    });

    const nextId = (res.data as any)?.id as string | undefined;
    if (!nextId) throw new Error('Failed to create session');

    setSessionId(nextId);
    try {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, nextId);
    } catch {
      // ignore
    }

    return nextId;
  };

  const reloadSessions = async () => {
    try {
      const res = await businessApi.get('/ai-assistant/ai-sessions/');
      setSessions(normalizeSessions(res.data));
    } catch {
      // ignore
    }
  };

  const loadSessionMessages = async (id: string) => {
    const res = await businessApi.get(`/ai-assistant/ai-sessions/${id}/messages/`);
    const serverMsgs = normalizeServerMessages(res.data);
    const ui = toUiMessages(serverMsgs);
    setMessages(
      ui.length
        ? ui
        : [
            {
              id: newId(),
              role: 'assistant',
              content: 'This session has no messages yet. Send a message or attach documents to begin.',
              createdAt: Date.now(),
            },
          ]
    );
  };

  const handleNewChat = async () => {
    setState('thinking');
    try {
      const res = await businessApi.post<ServerSession>('/ai-assistant/ai-sessions/', {
        title: `Chat ${new Date().toLocaleString()}`,
        context_data: { ui_source: 'AIAgentWidget' },
      });

      const nextId = (res.data as any)?.id as string | undefined;
      if (!nextId) throw new Error('Failed to create session');

      setSessionsOpen(false);
      setSessionId(nextId);
      setAttachments([]);
      setDraft('');

      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, nextId);
      } catch {
        // ignore
      }

      await reloadSessions();
      setMessages([
        {
          id: newId(),
          role: 'assistant',
          content: 'New session started. What would you like to work on?',
          createdAt: Date.now(),
        },
      ]);
      setState('idle');
    } catch (e: any) {
      setState('action_required');
      toast.error(e?.message || 'Failed to start new session');
    }
  };

  const handleSelectSession = async (id: string) => {
    setState('thinking');
    try {
      setSessionsOpen(false);
      setSessionId(id);
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, id);
      } catch {
        // ignore
      }
      await loadSessionMessages(id);
      setState('idle');
    } catch {
      setState('action_required');
      toast.error('Failed to load session');
    }
  };

  const uploadAttachments = async (sid: string) => {
    for (const file of attachments) {
      const form = new FormData();
      form.append('file', file);
      form.append('session', sid);
      await businessApi.post('/ai-assistant/ai-documents/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
  };

  const handleListTools = async () => {
    setState('thinking');
    try {
      const res = await businessApi.get<any>('/ai-assistant/tools/openapi/');

      const tools = Array.isArray(res.data?.tools) ? res.data.tools : [];
      const toolNamesFromTools = tools
        .map((t: any) => t?.function?.name as string | undefined)
        .filter((x: any): x is string => typeof x === 'string' && x.length > 0);

      const openapi = res.data?.openapi ?? res.data;
      const paths = openapi?.paths ?? {};
      const toolNamesFromOpenApi = Object.keys(paths)
        .map((p) => paths[p]?.post?.operationId as string | undefined)
        .filter((x): x is string => !!x);

      const toolNames = Array.from(new Set([...toolNamesFromTools, ...toolNamesFromOpenApi])).sort();

      const preview = toolNames.length ? toolNames.slice(0, 25).join(', ') : 'No tools available.';
      const suffix = toolNames.length > 25 ? ` (+${toolNames.length - 25} more)` : '';

      setMessages((m) => [
        ...m,
        { id: newId(), role: 'assistant', content: `Available tools: ${preview}${suffix}`, createdAt: Date.now() },
      ]);
      setState('idle');
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: 'Tools list is unavailable right now. Please try again.',
          createdAt: Date.now(),
        },
      ]);
      setState('idle');
    }
  };

  const handleRoutePreview = async () => {
    const text = draft.trim();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const message = text || lastUserMessage;

    if (!message) {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: 'Add a message first (or send one) to preview routing.',
          createdAt: Date.now(),
        },
      ]);
      return;
    }

    setState('thinking');
    try {
      const res = await businessApi.post<any>('/ai-assistant/swarm/invoke/', {
        event_type: 'user_chat',
        payload: {
          message,
          session_id: sessionId ?? undefined,
          ui_source: 'AIAgentWidget',
        },
        correlation_id: sessionId ?? undefined,
      });

      const chain = Array.isArray(res.data?.agent_chain) ? res.data.agent_chain.join(' → ') : '—';
      const intent = res.data?.intent ?? '—';
      const urgency = res.data?.urgency ?? '—';
      const notes = res.data?.notes ? `\nNotes: ${res.data.notes}` : '';

      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: `Router decision: intent=${intent}, urgency=${urgency}\nAgent chain: ${chain}${notes}`,
          createdAt: Date.now(),
        },
      ]);
      setState('idle');
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: 'Routing preview is unavailable (requires staff permissions).',
          createdAt: Date.now(),
        },
      ]);
      setState('idle');
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;

    setExpanded(true);
    setDraft('');

    if (text) {
      setMessages((m) => [...m, { id: newId(), role: 'user', content: text, createdAt: Date.now() }]);
    }

    // Local slash commands (staff-only endpoints)
    if (text === '/help') {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content:
            'Commands:\n' +
            '- /pending — list pending review items\n' +
            '- /resolve [idPrefix] [json] — resolve item (optional corrected JSON)\n' +
            '- /resolve — resolves latest pending item\n',
          createdAt: Date.now(),
        },
      ]);
      return;
    }

    setState('thinking');
    try {
      const sid = await ensureSession();

      if (attachments.length) {
        await uploadAttachments(sid);
        setAttachments([]);
        toast.success('Uploaded attachment(s)');
      }

      if (text) {
        const res = await businessApi.post<{ response: string; session_id: string }>('/ai-assistant/ai-chat/chat/', {
          message: text,
          session_id: sid,
          context: { ui_source: 'AIAgentWidget' },
        });

        const responseText = res.data?.response ?? '—';
        setMessages((m) => [...m, { id: newId(), role: 'assistant', content: responseText, createdAt: Date.now() }]);
      }

      await reloadSessions();
      await loadSessionMessages(sid);

      setState('idle');
    } catch (err: any) {
      const serverError = err?.response?.data?.error || err?.response?.data?.detail;
      const message =
        typeof serverError === 'string' && serverError.length
          ? serverError
          : 'Sorry — I couldn\'t reach the AI service. Please try again.';

      setMessages((m) => [...m, { id: newId(), role: 'assistant', content: message, createdAt: Date.now() }]);
      setState('action_required');
    }
  };

  const icon = state === 'action_required' ? <TriangleAlert size={18} /> : <Sparkles size={18} />;

  const headerTitle = (() => {
    if (state === 'action_required' && (detail.document_type || detail.vendor)) {
      return `AI • ${detail.document_type ?? 'Review'}${detail.vendor ? ` (${detail.vendor})` : ''}`;
    }
    return 'AI';
  })();

  const activeSessionTitle = (() => {
    const active = sessions.find((s) => s.id === sessionId);
    return active?.title || (sessionId ? `Session ${sessionId.slice(0, 8)}…` : 'No session');
  })();

  return (
    <WidgetShell $state={state} aria-live="polite">
      <Card $expanded={expanded} $state={state}>
        <HeaderBtn
          $expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          aria-label="AI chat widget"
          aria-expanded={expanded}
          title={expanded ? undefined : 'AI'}
        >
          {expanded ? (
            <>
              <HeaderLeft>
                {icon}
                <Title title={headerTitle}>{headerTitle}</Title>
              </HeaderLeft>
              <StatusPill $variant={pill.variant}>{pill.text}</StatusPill>
            </>
          ) : (
            icon
          )}
        </HeaderBtn>

        {expanded ? (
          <Body>
            <SessionBar>
              <SessionTitle type="button" onClick={() => setSessionsOpen((v) => !v)} aria-label="Chat sessions">
                <History size={16} />
                <span>{activeSessionTitle}</span>
              </SessionTitle>
              <SessionActions>
                <IconBtn type="button" title="New session" onClick={() => void handleNewChat()}>
                  <Plus size={16} />
                </IconBtn>
                <IconBtn type="button" title="Close" onClick={() => setExpanded(false)}>
                  <X size={16} />
                </IconBtn>
              </SessionActions>
            </SessionBar>

            {sessionsOpen ? (
              <SessionMenu role="dialog" aria-label="Session history">
                {sessions.length ? (
                  sessions.slice(0, 25).map((s) => (
                    <SessionRow
                      key={s.id}
                      type="button"
                      $active={s.id === sessionId}
                      onClick={() => void handleSelectSession(s.id)}
                    >
                      <SessionRowTitle>{s.title || `Session ${s.id.slice(0, 8)}…`}</SessionRowTitle>
                      <SessionRowMeta>
                        {typeof s.message_count === 'number' ? `${s.message_count} msgs` : '—'}
                        {s.last_activity ? ` • ${new Date(s.last_activity).toLocaleString()}` : ''}
                      </SessionRowMeta>
                    </SessionRow>
                  ))
                ) : (
                  <SessionRow as="div">No sessions yet.</SessionRow>
                )}
              </SessionMenu>
            ) : null}

            <IntegrationBanner>
              <IntegrationDot $connected={Boolean(outlookStatus?.connected)} />
              <span>Outlook: {outlookBannerText}</span>
              <IntegrationLink href="/settings/email-integrations">{outlookStatus?.connected ? 'Manage' : 'Connect'}</IntegrationLink>
            </IntegrationBanner>

            <Messages
              $dragOver={dragOver}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                if (files.length) addAttachments(files);
              }}
            >
              {messages.map((m) => (
                <Bubble key={m.id} $role={m.role}>
                  {m.role === 'document' ? (
                    <DocumentRow>
                      <FileText size={16} />
                      <DocumentMeta>
                        {m.metadata?.file_url ? (
                          <a href={m.metadata.file_url} target="_blank" rel="noreferrer">
                            {m.metadata?.original_filename || m.content}
                          </a>
                        ) : (
                          <div>{m.metadata?.original_filename || m.content}</div>
                        )}
                        <div>{m.metadata?.content_type || 'Document'}</div>
                      </DocumentMeta>
                    </DocumentRow>
                  ) : (
                    m.content
                  )}
                </Bubble>
              ))}
              <div ref={messagesEndRef} />
            </Messages>

            <Composer
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={SUPPORTED_EXTENSIONS.map((x) => `.${x}`).join(',')}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  if (list.length) addAttachments(list);
                  e.target.value = '';
                }}
              />

              {attachments.length ? (
                <AttachmentsBar>
                  {attachments.map((f, idx) => (
                    <AttachmentChip key={`${f.name}-${idx}`}>
                      <FileText size={14} />
                      <span>{f.name}</span>
                      <ChipRemove
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </ChipRemove>
                    </AttachmentChip>
                  ))}
                </AttachmentsBar>
              ) : null}

              <ComposerRow>
                <IconBtn type="button" title="Attach" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={16} />
                </IconBtn>

                <IconBtn type="button" title="Tools" onClick={() => void handleListTools()}>
                  <Wrench size={16} />
                </IconBtn>

                <IconBtn type="button" title="Route preview" onClick={() => void handleRoutePreview()}>
                  <GitBranch size={16} />
                </IconBtn>

                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={state === 'action_required' ? 'Reply with the correct fields…' : 'Ask the agent…'}
                  aria-label="AI message"
                />

                <IconBtn type="submit" title="Send" aria-label="Send message">
                  <Send size={16} />
                </IconBtn>
              </ComposerRow>
            </Composer>
          </Body>
        ) : null}
      </Card>
    </WidgetShell>
  );
};

export default AIAgentWidget;
