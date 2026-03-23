import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sparkles, ChevronDown } from 'lucide-react';
import { Spin, message } from 'antd';

import { businessApi } from '@/services/businessApi';

export interface AIOverviewCardProps {
  entityType: string;
  entityId: string | number;
}

type SummaryState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

const Card = styled.div`
  background: linear-gradient(180deg, rgba(var(--color-primary), 0.08) 0%, rgb(var(--color-surface)) 70%);
  border: 1px solid rgba(var(--color-primary), 0.18);
  border-radius: var(--radius-lg);
  padding: 14px 14px 12px;
  margin-bottom: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
  letter-spacing: 0.2px;
`;

const Badge = styled.span`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-primary), 0.25);
  color: rgb(var(--color-primary));
  background: rgba(var(--color-primary), 0.08);
`;

const Body = styled.div`
  margin-top: 10px;
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  line-height: 1.55;
`;

const TextWrap = styled.div<{ $expanded: boolean }>`
  position: relative;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  ${p => (p.$expanded ? '' : '-webkit-line-clamp: 3;')}
`;

const Fade = styled.div<{ $expanded: boolean }>`
  display: ${p => (p.$expanded ? 'none' : 'block')};
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2.2em;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgb(var(--color-surface)) 70%);
`;

const Actions = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
`;

const ToggleButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(var(--color-primary));
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--color-primary), 0.35);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }
`;

const Placeholder = styled.div`
  color: rgb(var(--color-text-tertiary));
`;

function normalizeSummaryText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed;
}

export const AIOverviewCard: React.FC<AIOverviewCardProps> = ({ entityType, entityId }) => {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<SummaryState>({ status: 'idle' });

  const endpoint = useMemo(() => {
    // Additive-only: endpoint may not exist yet in some environments.
    // When it does, keep it tenant-safe on the backend.
    return `/cockpit/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}/ai-overview/`;
  }, [entityId, entityType]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const resp = await businessApi.get(endpoint);
      const text = normalizeSummaryText((resp.data as any)?.summary ?? (resp.data as any)?.text);

      if (!text) {
        setState({ status: 'unavailable' });
        return;
      }

      setState({ status: 'ready', text });
    } catch (err: any) {
      const status = err?.response?.status;

      // Common case in dev: endpoint not implemented yet.
      if (status === 404 || status === 501) {
        setState({ status: 'unavailable' });
        return;
      }

      console.error('[AIOverviewCard] Failed to load AI overview:', err);
      setState({ status: 'error', message: 'AI Summary temporarily unavailable.' });
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.status === 'error') {
      message.error(state.message);
    }
  }, [state]);

  const content = (() => {
    if (state.status === 'loading' || state.status === 'idle') {
      return (
        <Placeholder>
          <Spin size="small" /> <span style={{ marginLeft: 8 }}>Generating overview…</span>
        </Placeholder>
      );
    }

    if (state.status === 'unavailable') {
      return (
        <Placeholder>
          AI overview is <strong>enabled for this environment</strong>. No summary is available yet for this record.
        </Placeholder>
      );
    }

    if (state.status === 'error') {
      return (
        <Placeholder>
          {state.message}
        </Placeholder>
      );
    }

    return (
      <>
        <TextWrap $expanded={expanded}>
          {state.text}
          <Fade $expanded={expanded} />
        </TextWrap>
        <Actions>
          <ToggleButton type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show more'}
            <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
          </ToggleButton>
        </Actions>
      </>
    );
  })();

  return (
    <Card>
      <Header>
        <Title>
          <Sparkles size={16} /> AI Overview
        </Title>
        <Badge>Preview</Badge>
      </Header>
      <Body>{content}</Body>
    </Card>
  );
};

export default AIOverviewCard;
