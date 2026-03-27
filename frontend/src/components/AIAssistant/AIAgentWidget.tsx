/**
 * AIAgentWidget
 *
 * Bottom-right, always-available AI surface.
 *
 * Responsibilities:
 * - Send user chat to backend AI endpoints
 * - Display assistant responses and HITL review cards when required
 * - React to global UX shortcuts (e.g., Cmd/Ctrl+J) via window events
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { useLocation } from 'react-router-dom';

import { useCockpitNavigation } from '@/contexts/CockpitNavigationContext';
import { buildAIPageContext } from '@/services/aiContext';
import {
  FileText,
  GitBranch,
  History,
  LoaderCircle,
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
import { HITLReviewCard } from './HITLReviewCard';

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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
  created_on?: string;
};

type UploadedAttachment = {
  id: string;
  original_filename: string;
  file_url?: string;
  content_type?: string;
};

const SUPPORTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
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

  .pm-spin {
    animation: pm-spin 1s linear infinite;
  }

  @keyframes pm-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

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

const normalizeSessions = (raw: unknown): ServerSession[] => {
  if (Array.isArray(raw)) return raw as ServerSession[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as ServerSession[];
  }
  return [];
};

const normalizeServerMessages = (raw: unknown): ServerMessage[] => {
  if (Array.isArray(raw)) return raw as ServerMessage[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as ServerMessage[];
  }
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

const hasHumanReviewMessage = (msgs: ChatMessage[]) =>
  msgs.some((m) => Boolean(m.metadata?.requires_human_review));

export const AIAgentWidget: React.FC = () => {
  const toast = useToast();
  const location = useLocation();
  const cockpitNav = useCockpitNavigation();

  const pageContext = useMemo(
    () => buildAIPageContext({ pathname: location.pathname, search: location.search }, cockpitNav.path),
    [location.pathname, location.search, cockpitNav.path]
  );

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

  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sendTextRef = useRef<
    (text: string, contextOverride?: Record<string, unknown>) => Promise<void>
  >(async () => {});

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
        const res = await businessApi.get<{ connections?: unknown[] }>('/integrations/oauth/status/');
        const connections = Array.isArray(res.data?.connections) ? res.data.connections : [];
        const outlook = connections
          .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : null))
          .find((c) => c?.provider === 'microsoft');
        if (!outlook) {
          setOutlookStatus({ connected: false, expired: false });
          return;
        }

        setOutlookStatus({
          connected: !Boolean(outlook?.is_expired),
          expired: Boolean(outlook?.is_expired),
          connectedEmail: typeof outlook?.connected_email === 'string' ? outlook.connected_email : undefined,
          connectedName: typeof outlook?.connected_name === 'string' ? outlook.connected_name : undefined,
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
        if (ui.length) {
          setMessages(ui);
          setState(hasHumanReviewMessage(ui) ? 'action_required' : 'idle');
        }
      } catch {
        // ignore
      }
    };

    void loadHistory();
  }, [expanded, sessionId]);

  useEffect(() => {
    const onToggle = () => {
      setExpanded((prev) => !prev);
    };

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

    const onSend = (event: Event) => {
      const e = event as CustomEvent<{ message?: string; context?: Record<string, unknown> }>;
      const msg = (e.detail?.message || '').toString().trim();
      if (!msg) return;

      setExpanded(true);
      setMessages((m) => [...m, { id: newId(), role: 'user', content: msg, createdAt: Date.now() }]);
      void sendTextRef.current(msg, e.detail?.context);
    };

    window.addEventListener('pm:ai-toggle', onToggle as EventListener);
    window.addEventListener('pm:ai-send', onSend as EventListener);
    window.addEventListener('pm:ai-review-required', onReviewRequired as EventListener);
    window.addEventListener('pm:ai-thinking', onThinking as EventListener);
    window.addEventListener('pm:ai-learning', onThinking as EventListener);
    window.addEventListener('pm:ai-idle', onIdle as EventListener);

    return () => {
      window.removeEventListener('pm:ai-toggle', onToggle as EventListener);
      window.removeEventListener('pm:ai-send', onSend as EventListener);
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

  const addAttachments = async (files: File[]) => {
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

    setUploadingAttachments((n) => n + accepted.length);
    try {
      const sid = await ensureSession();

      for (const file of accepted) {
        const form = new FormData();
        form.append('file', file);
        form.append('session', sid);

        const res = await businessApi.post('/ai-assistant/ai-documents/', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const doc = (res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : {}) || {};
        const next: UploadedAttachment = {
          id: String(doc.id || `${Date.now()}`),
          original_filename: String(doc.original_filename || file.name),
          file_url: String(doc.file_url || doc.file || ''),
          content_type: String(doc.content_type || file.type || ''),
        };

        setAttachments((prev) => [...prev, next]);
      }

      toast.success(`Uploaded ${accepted.length} attachment(s)`);

      // The backend creates a DOCUMENT ChatMessage on upload (session-bound), so refresh history.
      await loadSessionMessages(sid);
    } catch (e: unknown) {
      const errObj = e && typeof e === 'object' ? (e as Record<string, unknown>) : null;
      const response = errObj?.response && typeof errObj.response === 'object' ? (errObj.response as Record<string, unknown>) : null;
      const data = response?.data && typeof response.data === 'object' ? (response.data as Record<string, unknown>) : null;
      const serverError = typeof data?.error === 'string' ? data.error : null;
      toast.error(serverError || 'Failed to upload attachment(s)');
    } finally {
      setUploadingAttachments((n) => Math.max(0, n - accepted.length));
    }
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;

    const res = await businessApi.post<ServerSession>('/ai-assistant/ai-sessions/', {
      title: `Chat ${new Date().toLocaleString()}`,
      context_data: { ui_source: 'AIAgentWidget' },
    });

    const nextId = res.data?.id;
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

    if (ui.length) {
      setState(hasHumanReviewMessage(ui) ? 'action_required' : 'idle');
    }
  };

  const handleNewChat = async () => {
    setState('thinking');
    try {
      const res = await businessApi.post<ServerSession>('/ai-assistant/ai-sessions/', {
        title: `Chat ${new Date().toLocaleString()}`,
        context_data: { ui_source: 'AIAgentWidget' },
      });

      const nextId = res.data?.id;
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
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : null;
      setState('action_required');
      toast.error(msg || 'Failed to start new session');
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


  const handleListTools = async () => {
    setState('thinking');
    try {
      const res = await businessApi.get<unknown>('/ai-assistant/tools/openapi/');

      const dataObj = res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : null;
      const tools = Array.isArray(dataObj?.tools) ? dataObj.tools : [];
      const toolNamesFromTools = tools
        .map((t: unknown) => {
          const toolObj = t && typeof t === 'object' ? (t as Record<string, unknown>) : null;
          const fnObj = toolObj?.function && typeof toolObj.function === 'object'
            ? (toolObj.function as Record<string, unknown>)
            : null;
          const name = fnObj?.name;
          return typeof name === 'string' ? name : undefined;
        })
        .filter((x): x is string => typeof x === 'string' && x.length > 0);

      const openapi = (dataObj?.openapi ?? dataObj) as unknown;
      const openapiObj = openapi && typeof openapi === 'object' ? (openapi as Record<string, unknown>) : null;
      const paths = (openapiObj?.paths && typeof openapiObj.paths === 'object'
        ? (openapiObj.paths as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const toolNamesFromOpenApi = Object.keys(paths)
        .map((p) => {
          const pathObj = paths[p] && typeof paths[p] === 'object' ? (paths[p] as Record<string, unknown>) : null;
          const postObj = pathObj?.post && typeof pathObj.post === 'object' ? (pathObj.post as Record<string, unknown>) : null;
          const operationId = postObj?.operationId;
          return typeof operationId === 'string' ? operationId : undefined;
        })
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
      const res = await businessApi.post<unknown>('/ai-assistant/swarm/invoke/', {
        event_type: 'user_chat',
        payload: {
          message,
          session_id: sessionId ?? undefined,
          ui_source: 'AIAgentWidget',
        },
        correlation_id: sessionId ?? undefined,
      });

      const dataObj = res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : null;
      const chain = Array.isArray(dataObj?.agent_chain) ? (dataObj.agent_chain as unknown[]).join(' → ') : '—';
      const intent = typeof dataObj?.intent === 'string' ? dataObj.intent : '—';
      const urgency = typeof dataObj?.urgency === 'string' ? dataObj.urgency : '—';
      const notes = typeof dataObj?.notes === 'string' && dataObj.notes.length ? `\nNotes: ${dataObj.notes}` : '';

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

  const sendText = useCallback(
    async (text: string, contextOverride?: Record<string, unknown>) => {
      if (!text) return;

      setState('thinking');
      try {
        const sid = await ensureSession();

        const res = await businessApi.post<{ response: string; session_id: string }>('/ai-assistant/chat/', {
          message: text,
          session_id: sid,
          context: {
            ui_source: 'AIAgentWidget',
            ...pageContext,
            ...(contextOverride || {}),
          },
        });

        const responseText = res.data?.response ?? '—';
        setMessages((m) => [...m, { id: newId(), role: 'assistant', content: responseText, createdAt: Date.now() }]);

        await reloadSessions();
        await loadSessionMessages(sid);
        setAttachments([]);

        setState('idle');
      } catch (err: unknown) {
        const errObj = err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
        const response =
          errObj?.response && typeof errObj.response === 'object' ? (errObj.response as Record<string, unknown>) : null;
        const data = response?.data && typeof response.data === 'object' ? (response.data as Record<string, unknown>) : null;
        const serverError =
          (typeof data?.error === 'string' ? data.error : null) ?? (typeof data?.detail === 'string' ? data.detail : null);
        const message =
          typeof serverError === 'string' && serverError.length
            ? serverError
            : "Sorry — I couldn't reach the AI service. Please try again.";

        setMessages((m) => [...m, { id: newId(), role: 'assistant', content: message, createdAt: Date.now() }]);
        setState('action_required');
      }
    },
    [ensureSession, loadSessionMessages, pageContext, reloadSessions, setAttachments, setMessages, setState]
  );

  sendTextRef.current = sendText;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;

    setExpanded(true);
    setDraft('');

    if (text) {
      setMessages((m) => [...m, { id: newId(), role: 'user', content: text, createdAt: Date.now() }]);
    }

    const appendAssistant = (content: string) => {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content,
          createdAt: Date.now(),
        },
      ]);
    };

    // Local slash commands (HITL staff endpoints)
    if (text === '/help') {
      appendAssistant(
        'Commands:\n' +
          '- /pending — list pending review items\n' +
          '- /resolve [idPrefix] [json] — resolve item (optional corrected JSON)\n' +
          '- /resolve — resolves latest pending item\n',
      );
      return;
    }

    if (text === '/pending') {
      setState('thinking');
      try {
        const res = await businessApi.get<unknown>('/ai-assistant/review/pending/');
        const dataObj = res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : null;
        const pending = Array.isArray(dataObj?.pending_reviews) ? dataObj.pending_reviews : null;
        const results = Array.isArray(dataObj?.results) ? dataObj.results : null;
        const items = (pending ?? results ?? []) as unknown[];

        if (!items.length) {
          appendAssistant('No pending review items (or you are not staff).');
          setState('idle');
          return;
        }

        const lines = items.slice(0, 10).map((it) => {
          const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
          const id = String(obj.id || '');
          const prefix = id ? `${id.slice(0, 8)}…` : '—';
          const docType = typeof obj.document_type === 'string' ? obj.document_type : 'unknown';
          const conf = typeof obj.confidence_score === 'number' ? obj.confidence_score.toFixed(2) : '—';
          return `- ${prefix} ${docType} (confidence=${conf})`;
        });

        appendAssistant(`Pending review items:\n${lines.join('\n')}`);
        setState('idle');
      } catch {
        appendAssistant('Pending review queue unavailable (requires staff permissions).');
        setState('idle');
      }
      return;
    }

    if (text.startsWith('/resolve')) {
      setState('thinking');
      try {
        const rest = text.slice('/resolve'.length).trim();
        const prefix = rest ? rest.split(/\s+/)[0] : '';
        const jsonStr = rest ? rest.slice(prefix.length).trim() : '';

        const pendingRes = await businessApi.get<unknown>('/ai-assistant/review/pending/');
        const pendingObj =
          pendingRes.data && typeof pendingRes.data === 'object' ? (pendingRes.data as Record<string, unknown>) : null;
        const pending = Array.isArray(pendingObj?.pending_reviews) ? pendingObj.pending_reviews : null;
        const results = Array.isArray(pendingObj?.results) ? pendingObj.results : null;
        const items = (pending ?? results ?? []) as unknown[];

        if (!items.length) {
          appendAssistant('No pending review items (or you are not staff).');
          setState('idle');
          return;
        }

        const target = prefix
          ? items.find((it) => {
              const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
              return String(obj.id || '').startsWith(prefix);
            })
          : items[0];

        if (!target) {
          appendAssistant(`No pending review item found matching prefix: ${prefix}`);
          setState('idle');
          return;
        }

        let corrected: unknown = undefined;
        if (jsonStr) {
          try {
            corrected = JSON.parse(jsonStr);
          } catch {
            appendAssistant('Invalid JSON for /resolve. Example: /resolve abcd1234 {"key":"value"}');
            setState('idle');
            return;
          }
        }

        const targetObj = target && typeof target === 'object' ? (target as Record<string, unknown>) : {};
        const feedbackId = String(targetObj.id ?? '');
        if (!feedbackId) {
          appendAssistant('Resolve failed: review item did not have an id.');
          setState('idle');
          return;
        }
        await businessApi.post(`/ai-assistant/review/${feedbackId}/resolve/`, {
          user_corrected_data: corrected ?? null,
        });

        appendAssistant(`Resolved review item: ${feedbackId.slice(0, 8)}…`);
        setState('idle');
      } catch {
        appendAssistant('Resolve failed (requires staff permissions).');
        setState('idle');
      }
      return;
    }

    // Attachments are uploaded immediately on selection; clear pills after a send cycle.
    if (text) {
      await sendText(text);
      return;
    }

    // Attachments-only: just refresh the server-backed history for this session.
    setState('thinking');
    try {
      const sid = await ensureSession();
      await reloadSessions();
      await loadSessionMessages(sid);
      setAttachments([]);
      setState('idle');
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: 'Sorry — I could not refresh the session right now. Please try again.',
          createdAt: Date.now(),
        },
      ]);
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
                if (files.length) void addAttachments(files);
              }}
            >
              {messages.map((m) => {
                const requiresReview = Boolean(m.metadata?.requires_human_review);
                const extractedData = (m.metadata?.extracted_data || m.metadata?.original_extracted_data) as
                  | Record<string, unknown>
                  | undefined;
                const documentId = (m.metadata?.document_id || m.metadata?.documentId) as string | undefined;
                const feedbackId = (m.metadata?.feedback_id || m.metadata?.feedbackId || m.metadata?.feedback_log_id) as
                  | string
                  | undefined;

                return (
                  <Bubble key={m.id} $role={m.role}>
                    {m.role === 'document' ? (
                      <DocumentRow>
                        <FileText size={16} />
                        <DocumentMeta>
                          {(() => {
                            const fileUrl =
                              m.metadata && typeof m.metadata === 'object' && typeof (m.metadata as any).file_url === 'string'
                                ? ((m.metadata as any).file_url as string)
                                : undefined;
                            const originalFilename =
                              m.metadata &&
                              typeof m.metadata === 'object' &&
                              typeof (m.metadata as any).original_filename === 'string'
                                ? ((m.metadata as any).original_filename as string)
                                : undefined;

                            const label = originalFilename ?? m.content;

                            return fileUrl ? (
                              <a href={fileUrl} target="_blank" rel="noreferrer">
                                {label}
                              </a>
                            ) : (
                              <div>{label}</div>
                            );
                          })()}
                          <div>
                            {(() => {
                              const ct =
                                m.metadata && typeof m.metadata === 'object' && typeof (m.metadata as any).content_type === 'string'
                                  ? ((m.metadata as any).content_type as string)
                                  : undefined;
                              return ct ?? 'Document';
                            })()}
                          </div>
                        </DocumentMeta>
                      </DocumentRow>
                    ) : (
                      m.content
                    )}

                    {requiresReview && extractedData && documentId ? (
                      <HITLReviewCard
                        extractedData={extractedData}
                        documentId={documentId}
                        feedbackId={feedbackId}
                        onEmitChatMessage={(content) =>
                          setMessages((prev) => [
                            ...prev,
                            { id: newId(), role: 'assistant', content, createdAt: Date.now() },
                          ])
                        }
                        onSubmitted={() => {
                          if (sessionId) void loadSessionMessages(sessionId);
                        }}
                      />
                    ) : null}
                  </Bubble>
                );
              })}
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
                  if (list.length) void addAttachments(list);
                  e.target.value = '';
                }}
              />

              {attachments.length ? (
                <AttachmentsBar>
                  {attachments.map((a, idx) => (
                    <AttachmentChip key={`${a.id}-${idx}`}>
                      <FileText size={14} />
                      <span>{a.original_filename}</span>
                      <ChipRemove
                        type="button"
                        aria-label={`Remove ${a.original_filename}`}
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
                  {uploadingAttachments > 0 ? <LoaderCircle className="pm-spin" size={16} /> : <Paperclip size={16} />}
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
