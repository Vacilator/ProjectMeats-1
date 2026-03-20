import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { AlertTriangle, BrainCircuit, CheckCircle2, GitBranch, Send, Wrench, X } from 'lucide-react';

import { businessApi } from '../../services/businessApi';

type AgentState = 'idle' | 'thinking' | 'action_required';

type ReviewRequiredDetail = {
  document_type?: string;
  vendor?: string;
  message?: string;
  questions_for_user?: string[];
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: number;
};

type OutlookStatus = {
  connected: boolean;
  expired: boolean;
  connectedEmail?: string;
  connectedName?: string;
};

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
  right: 20px;
  bottom: 20px;
  z-index: 1000;
  width: 360px;
  max-width: calc(100vw - 40px);
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
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 14px;
  overflow: hidden;

  ${(p) =>
    p.$state === 'action_required'
      ? css`
          border-color: rgb(var(--color-primary) / 0.60);
        `
      : ''}

  ${(p) =>
    !p.$expanded
      ? css`
          width: 56px;
          height: 56px;
          border-radius: 999px;
        `
      : css`
          height: 420px;
        `}
`;

const HeaderBtn = styled.button<{ $state: AgentState }>`
  width: 100%;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 14px;
  border: none;
  background:
    ${(p) => (p.$state === 'action_required' ? 'rgb(var(--color-primary) / 0.10)' : 'rgb(var(--color-surface))')};
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-primary) / 0.12);
  }
`;

const Left = styled.div`
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

const Messages = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 12px 0;
`;

const Bubble = styled.div<{ $role: 'assistant' | 'user' }>`
  max-width: 92%;
  margin: 0 0 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border));
  font-size: 12px;
  line-height: 1.4;

  ${(p) =>
    p.$role === 'user'
      ? css`
          margin-left: auto;
          background: rgb(var(--color-primary) / 0.10);
          color: rgb(var(--color-text-primary));
        `
      : css`
          margin-right: auto;
          background: rgb(var(--color-surface));
          color: rgb(var(--color-text-primary));
        `}
`;

const Composer = styled.form`
  padding: 10px 12px 12px;
  border-top: 1px solid rgb(var(--color-border));
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

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const AIAgentWidget: React.FC = () => {
  const [state, setState] = useState<AgentState>('idle');
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ReviewRequiredDetail>({});
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outlookStatus, setOutlookStatus] = useState<OutlookStatus | null>(null);

  const defaultActionMessage = useMemo(
    () => 'I just processed a Purchase Order from Sysco, but the delivery date is unclear. Can you verify?',
    []
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: newId(),
      role: 'assistant',
      content: 'Hi — I\'m your ProjectMeats agent. Ask me anything, or I\'ll flag documents that need review.',
      createdAt: Date.now(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, expanded]);

  useEffect(() => {
    // Placeholder integration: in Phase 7/8 this is driven by websocket/polling.
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
    window.addEventListener('pm:ai-learning', onThinking as EventListener); // legacy alias
    window.addEventListener('pm:ai-idle', onIdle as EventListener);

    return () => {
      window.removeEventListener('pm:ai-review-required', onReviewRequired as EventListener);
      window.removeEventListener('pm:ai-thinking', onThinking as EventListener);
      window.removeEventListener('pm:ai-learning', onThinking as EventListener);
      window.removeEventListener('pm:ai-idle', onIdle as EventListener);
    };
  }, [defaultActionMessage]);

  const seenPendingReviewIdsRef = useRef<Set<string>>(new Set());
  const pendingReviewPollingDisabledRef = useRef(false);
  const latestPendingReviewRef = useRef<{ id: string; document_type: string } | null>(null);

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
        // Don’t block chat UX on integration status.
        setOutlookStatus(null);
      }
    };

    void loadOutlookStatus();

    if (pendingReviewPollingDisabledRef.current) return;

    let isCancelled = false;
    let intervalId: number | undefined;

    type PendingReviewItem = {
      id: string;
      document_id: string;
      document_type: string;
      confidence_score: number;
      created_on: string;
    };

    const poll = async () => {
      if (isCancelled) return;
      try {
        const res = await businessApi.get<{ results?: PendingReviewItem[] }>('/ai-assistant/review/pending/');
        const items = Array.isArray(res.data?.results) ? res.data.results : [];

        const newItems = items.filter((i) => !seenPendingReviewIdsRef.current.has(i.id));
        newItems.forEach((i) => seenPendingReviewIdsRef.current.add(i.id));

        if (newItems.length) {
          latestPendingReviewRef.current = {
            id: newItems[0].id,
            document_type: newItems[0].document_type,
          };

          setState('action_required');
          setDetail({
            document_type: newItems[0].document_type,
            message: `I found ${newItems.length} document(s) that need review.`,
          });

          const lines = newItems
            .slice(0, 5)
            .map((i) => `- ${i.document_type} (${Math.round((i.confidence_score ?? 0) * 100)}% confidence)`)
            .join('\n');

          const suffix = newItems.length > 5 ? `\n(+${newItems.length - 5} more)` : '';

          setMessages((m) => [
            ...m,
            {
              id: newId(),
              role: 'assistant',
              content: `Pending review detected:\n${lines}${suffix}`,
              createdAt: Date.now(),
            },
          ]);
        }
      } catch {
        // Non-staff users will typically get a 403; disable polling silently.
        pendingReviewPollingDisabledRef.current = true;
        if (intervalId) window.clearInterval(intervalId);
      }
    };

    // kick immediately, then poll
    void poll();
    intervalId = window.setInterval(poll, 30000);

    return () => {
      isCancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [expanded]);

  const icon =
    state === 'action_required' ? <AlertTriangle size={18} /> : state === 'thinking' ? <BrainCircuit size={18} /> : <CheckCircle2 size={18} />;

  const pill =
    state === 'action_required'
      ? { text: 'Action required', variant: 'warn' as const }
      : state === 'thinking'
        ? { text: 'Thinking', variant: 'info' as const }
        : { text: 'Idle', variant: 'ok' as const };

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

  const handleResolveLatest = async () => {
    const latest = latestPendingReviewRef.current;
    if (!latest) {
      setMessages((m) => [
        ...m,
        { id: newId(), role: 'assistant', content: 'No pending review item found to resolve yet.', createdAt: Date.now() },
      ]);
      return;
    }

    setState('thinking');
    try {
      await businessApi.post(`/ai-assistant/review/${latest.id}/resolve/`, {});
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: `Resolved: ${latest.document_type} (${latest.id.slice(0, 8)}…)`,
          createdAt: Date.now(),
        },
      ]);
      latestPendingReviewRef.current = null;
      setState('idle');
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: 'Resolve action is unavailable (requires staff permissions).',
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
      const res = await businessApi.post<{
        tenant_id: string;
        event_type: string;
        intent: string;
        urgency: string;
        agent_chain: string[];
        notes?: string;
      }>('/ai-assistant/swarm/invoke/', {
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
    if (!text) return;

    setDraft('');
    setExpanded(true);

    setMessages((m) => [...m, { id: newId(), role: 'user', content: text, createdAt: Date.now() }]);

    // Slash commands (local, staff-only endpoints)
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

    if (text === '/pending') {
      setState('thinking');
      try {
        const res = await businessApi.get<{
          results?: Array<{ id: string; document_type: string; confidence_score: number }>;
        }>('/ai-assistant/review/pending/');

        const items = Array.isArray(res.data?.results) ? res.data.results : [];
        if (!items.length) {
          setMessages((m) => [
            ...m,
            { id: newId(), role: 'assistant', content: 'No pending review items found.', createdAt: Date.now() },
          ]);
          setState('idle');
          return;
        }

        latestPendingReviewRef.current = { id: items[0].id, document_type: items[0].document_type };

        const lines = items
          .slice(0, 10)
          .map((i) => `- ${i.document_type} (${Math.round((i.confidence_score ?? 0) * 100)}%) id=${i.id.slice(0, 8)}…`)
          .join('\n');
        const suffix = items.length > 10 ? `\n(+${items.length - 10} more)` : '';

        setMessages((m) => [
          ...m,
          { id: newId(), role: 'assistant', content: `Pending review items:\n${lines}${suffix}`, createdAt: Date.now() },
        ]);
        setState('idle');
      } catch {
        setMessages((m) => [
          ...m,
          { id: newId(), role: 'assistant', content: 'Pending list is unavailable (requires staff permissions).', createdAt: Date.now() },
        ]);
        setState('idle');
      }
      return;
    }

    if (text.startsWith('/resolve')) {
      const rest = text.replace('/resolve', '').trim();
      const parts = rest ? rest.split(' ') : [];
      const idPrefix = parts.length ? parts[0] : '';
      const jsonPart = parts.length > 1 ? rest.slice(idPrefix.length).trim() : '';

      let targetId = latestPendingReviewRef.current?.id ?? '';
      if (idPrefix) {
        // Accept full UUID or prefix (first 8 chars) - best effort.
        if (idPrefix.length >= 8) targetId = idPrefix;
      }

      if (!targetId) {
        setMessages((m) => [
          ...m,
          { id: newId(), role: 'assistant', content: 'No target id to resolve. Try /pending first.', createdAt: Date.now() },
        ]);
        return;
      }

      let corrected: unknown = undefined;
      if (jsonPart) {
        try {
          corrected = JSON.parse(jsonPart);
          if (typeof corrected !== 'object' || corrected === null || Array.isArray(corrected)) {
            throw new Error('user_corrected_data must be an object');
          }
        } catch {
          setMessages((m) => [
            ...m,
            {
              id: newId(),
              role: 'assistant',
              content: 'Invalid JSON. Usage: /resolve <idPrefix?> {"field":"value"}',
              createdAt: Date.now(),
            },
          ]);
          return;
        }
      }

      setState('thinking');
      try {
        await businessApi.post(`/ai-assistant/review/${targetId}/resolve/`, {
          user_corrected_data: corrected,
        });
        setMessages((m) => [
          ...m,
          { id: newId(), role: 'assistant', content: `Resolved review item: ${targetId.slice(0, 8)}…`, createdAt: Date.now() },
        ]);
        latestPendingReviewRef.current = null;
        setState('idle');
      } catch {
        setMessages((m) => [
          ...m,
          { id: newId(), role: 'assistant', content: 'Resolve failed or unavailable (requires staff permissions).', createdAt: Date.now() },
        ]);
        setState('idle');
      }
      return;
    }

    setState('thinking');
    try {
      const res = await businessApi.post<{
        response: string;
        session_id: string;
      }>('/ai-assistant/ai-chat/chat/', {
        message: text,
        session_id: sessionId ?? undefined,
        context: {
          ui_source: 'AIAgentWidget',
        },
      });

      const responseText = res.data?.response ?? '—';
      const nextSessionId = res.data?.session_id ?? null;
      if (nextSessionId) setSessionId(nextSessionId);

      setMessages((m) => [...m, { id: newId(), role: 'assistant', content: responseText, createdAt: Date.now() }]);
      setState('idle');
    } catch (err: any) {
      const serverError = err?.response?.data?.error || err?.response?.data?.detail;
      const message =
        typeof serverError === 'string' && serverError.length
          ? serverError
          : 'Sorry — I couldn\'t reach the AI service. Please try again.';

      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: message,
          createdAt: Date.now(),
        },
      ]);
      setState('action_required');
    }
  };

  const outlookBannerText = (() => {
    if (!outlookStatus) return 'Status unavailable';
    if (outlookStatus.connected) {
      return `Connected${outlookStatus.connectedEmail ? ` (${outlookStatus.connectedEmail})` : ''}`;
    }
    if (outlookStatus.expired) return 'Connected (Expired)';
    return 'Not connected';
  })();

  return (
    <WidgetShell $state={state} aria-live="polite">
      <Card $expanded={expanded} $state={state}>
        <HeaderBtn
          $state={state}
          onClick={() => setExpanded((v) => !v)}
          aria-label="AI agent widget"
          aria-expanded={expanded}
        >
          <Left>
            {icon}
            {expanded ? (
              <Title title="AIAgentWidget">
                {state === 'action_required' && (detail.document_type || detail.vendor)
                  ? `AIAgentWidget • ${detail.document_type ?? 'Review'}${detail.vendor ? ` (${detail.vendor})` : ''}`
                  : 'AIAgentWidget'}
              </Title>
            ) : null}
          </Left>
          {expanded ? <StatusPill $variant={pill.variant}>{pill.text}</StatusPill> : null}
        </HeaderBtn>

        {expanded ? (
          <Body>
            <IntegrationBanner>
              <IntegrationDot $connected={Boolean(outlookStatus?.connected)} />
              <span>Outlook: {outlookBannerText}</span>
              <IntegrationLink href="/settings/email-integrations">
                {outlookStatus?.connected ? 'Manage' : 'Connect'}
              </IntegrationLink>
            </IntegrationBanner>

            <Messages>
              {messages.map((m) => (
                <Bubble key={m.id} $role={m.role}>
                  {m.content}
                </Bubble>
              ))}
              <div ref={messagesEndRef} />
            </Messages>

            <Composer
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <IconBtn
                type="button"
                title="Tools"
                onClick={() => {
                  handleListTools();
                }}
              >
                <Wrench size={16} />
              </IconBtn>

              <IconBtn
                type="button"
                title="Route preview"
                onClick={() => {
                  handleRoutePreview();
                }}
              >
                <GitBranch size={16} />
              </IconBtn>

              <IconBtn type="button" title="Close" onClick={() => setExpanded(false)}>
                <X size={16} />
              </IconBtn>

              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  state === 'action_required'
                    ? 'Reply with the correct delivery date / fields…'
                    : 'Ask the agent…'
                }
                aria-label="AI agent message"
              />

              <IconBtn type="submit" title="Send">
                <Send size={16} />
              </IconBtn>
            </Composer>
          </Body>
        ) : null}
      </Card>
    </WidgetShell>
  );
};

export default AIAgentWidget;
