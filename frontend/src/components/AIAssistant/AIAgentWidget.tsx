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
      const res = await businessApi.get<{ paths?: Record<string, any> }>('/ai-assistant/tools/openapi/');
      const paths = res.data?.paths ?? {};
      const toolNames = Object.keys(paths)
        .map((p) => paths[p]?.post?.operationId as string | undefined)
        .filter((x): x is string => !!x)
        .sort();

      const preview = toolNames.length ? toolNames.slice(0, 25).join(', ') : 'No tools registered.';
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
          content: 'Tools list is unavailable (requires staff permissions).',
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
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          content: 'Sorry — I couldn\'t reach the AI service. Please try again.',
          createdAt: Date.now(),
        },
      ]);
      setState('action_required');
    }
  };

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
