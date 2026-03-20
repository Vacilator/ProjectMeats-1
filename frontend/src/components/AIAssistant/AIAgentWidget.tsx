import React, { useEffect, useMemo, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { AlertTriangle, Brain, CheckCircle2, X } from 'lucide-react';

type AgentState = 'idle' | 'learning' | 'action_required';

type ReviewRequiredDetail = {
  document_type?: string;
  vendor?: string;
  message?: string;
  questions_for_user?: string[];
};

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 6px 18px rgb(var(--color-text-primary) / 0.10); }
  50% { transform: scale(1.03); box-shadow: 0 10px 26px rgb(var(--color-text-primary) / 0.16); }
`;

const WidgetShell = styled.div<{ $state: AgentState }>`
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
  width: 320px;
  max-width: calc(100vw - 40px);
  pointer-events: auto;

  ${(p) =>
    p.$state === 'action_required'
      ? css`
          animation: ${pulse} 1.3s ease-in-out infinite;
        `
      : ''}
`;

const Card = styled.div<{ $expanded: boolean }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 28px rgb(var(--color-text-primary) / 0.10);

  ${(p) =>
    !p.$expanded
      ? css`
          width: 56px;
          height: 56px;
          border-radius: 999px;
        `
      : ''}
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
  background: ${(p) =>
    p.$state === 'action_required'
      ? 'rgba(var(--color-primary), 0.10)'
      : 'rgb(var(--color-surface))'};
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-primary), 0.12);
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
  background: rgba(var(--color-primary), 0.06);
`;

const Body = styled.div`
  padding: 12px 14px 14px;
  border-top: 1px solid rgb(var(--color-border));
`;

const Message = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  line-height: 1.4;
`;

const QuestionList = styled.ul`
  margin: 10px 0 0;
  padding-left: 18px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const Actions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const ActionBtn = styled.button<{ $primary?: boolean }>`
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$primary ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))')};
  color: ${(p) => (p.$primary ? 'white' : 'rgb(var(--color-text-primary))')};
  font-size: 12px;
  font-weight: 900;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;

  &:hover {
    filter: brightness(0.98);
  }
`;

export const AIAgentWidget: React.FC = () => {
  const [state, setState] = useState<AgentState>('idle');
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ReviewRequiredDetail>({});

  const defaultActionMessage = useMemo(
    () =>
      'I just processed a Purchase Order from Sysco, but the delivery date is unclear. Can you verify?',
    []
  );

  useEffect(() => {
    // Placeholder integration: in Phase 7.0, a websocket/polling loop would push these events.
    const onReviewRequired = (event: Event) => {
      const e = event as CustomEvent<ReviewRequiredDetail>;
      setState('action_required');
      setDetail(e.detail || {});
      setExpanded(true);
    };

    const onLearning = () => {
      setState('learning');
    };

    const onIdle = () => {
      setState('idle');
      setDetail({});
      setExpanded(false);
    };

    window.addEventListener('pm:ai-review-required', onReviewRequired as EventListener);
    window.addEventListener('pm:ai-learning', onLearning as EventListener);
    window.addEventListener('pm:ai-idle', onIdle as EventListener);

    return () => {
      window.removeEventListener('pm:ai-review-required', onReviewRequired as EventListener);
      window.removeEventListener('pm:ai-learning', onLearning as EventListener);
      window.removeEventListener('pm:ai-idle', onIdle as EventListener);
    };
  }, []);

  const icon = state === 'action_required' ? <AlertTriangle size={18} /> : state === 'learning' ? <Brain size={18} /> : <CheckCircle2 size={18} />;
  const pill =
    state === 'action_required'
      ? { text: 'Action required', variant: 'warn' as const }
      : state === 'learning'
        ? { text: 'Learning', variant: 'info' as const }
        : { text: 'Idle', variant: 'ok' as const };

  const title = state === 'action_required' ? 'AI Agent' : 'AI Agent';
  const message = detail.message || defaultActionMessage;
  const questions = Array.isArray(detail.questions_for_user) ? detail.questions_for_user : [];

  return (
    <WidgetShell $state={state} aria-live="polite">
      <Card $expanded={expanded}>
        <HeaderBtn
          $state={state}
          onClick={() => setExpanded((v) => !v)}
          aria-label="AI agent widget"
          aria-expanded={expanded}
        >
          <Left>
            {icon}
            {expanded ? <Title title={title}>{title}</Title> : null}
          </Left>
          {expanded ? <StatusPill $variant={pill.variant}>{pill.text}</StatusPill> : null}
        </HeaderBtn>

        {expanded ? (
          <Body>
            <Message>{message}</Message>
            {questions.length > 0 ? (
              <QuestionList>
                {questions.slice(0, 4).map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </QuestionList>
            ) : null}

            <Actions>
              <ActionBtn
                onClick={() => {
                  setExpanded(false);
                }}
                title="Dismiss"
              >
                <X size={14} style={{ marginRight: 6 }} />
                Later
              </ActionBtn>
              <ActionBtn
                $primary
                onClick={() => {
                  // Placeholder: open the HITL screen / settings in a later iteration.
                  setState('learning');
                }}
                title="Verify"
              >
                Verify
              </ActionBtn>
            </Actions>
          </Body>
        ) : null}
      </Card>
    </WidgetShell>
  );
};

export default AIAgentWidget;
