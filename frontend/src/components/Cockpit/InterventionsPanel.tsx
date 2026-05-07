import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { TradeLineageFlow } from './TradeLineageFlow';
import {
  useResolveTradeException,
  useRetryTradeException,
  useTradeExceptionDetail,
  useTradeExceptions,
} from '@/hooks/useTradeExceptionQueue';
import type {
  TradeExceptionEntityLink,
  TradeExceptionQueueItem,
  TradeExceptionStatus,
} from '@/services/tradeExceptionQueueService';

const STATUS_LABELS: Record<TradeExceptionStatus, string> = {
  open: 'Open',
  retrying: 'Retrying',
  resolved: 'Resolved',
  exhausted: 'Exhausted',
};

const Container = styled.div`
  display: grid;
  gap: 16px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`;

const SummaryCard = styled.div`
  padding: 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(var(--color-text-secondary));
`;

const SummaryValue = styled.div`
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
`;

const SearchWrapper = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 240px;
  padding: 10px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-secondary));
`;

const SearchInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const FilterSelect = styled.select`
  min-width: 180px;
  padding: 10px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 16px;

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
`;

const PanelCard = styled.section`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 16px 18px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const PanelSubtitle = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
`;

const ItemButton = styled.button<{ $active: boolean }>`
  padding: 14px 18px;
  border: none;
  border-bottom: 1px solid rgb(var(--color-border));
  background: ${({ $active }) =>
    $active ? 'rgb(var(--color-primary) / 0.08)' : 'rgb(var(--color-surface))'};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ItemTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
`;

const ItemTitle = styled.div`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ItemMeta = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const StatusBadge = styled.span<{ $status: TradeExceptionStatus }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  ${({ $status }) => {
    switch ($status) {
      case 'open':
        return 'background: rgb(239 68 68 / 0.12); color: rgb(239 68 68);';
      case 'retrying':
        return 'background: rgb(59 130 246 / 0.12); color: rgb(59 130 246);';
      case 'resolved':
        return 'background: rgb(34 197 94 / 0.12); color: rgb(34 197 94);';
      case 'exhausted':
        return 'background: rgb(234 179 8 / 0.16); color: rgb(161 98 7);';
      default:
        return 'background: rgb(var(--color-border)); color: rgb(var(--color-text-primary));';
    }
  }}
`;

const EmptyState = styled.div`
  padding: 40px 24px;
  display: grid;
  place-items: center;
  gap: 10px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
`;

const DetailBody = styled.div`
  display: grid;
  gap: 16px;
  padding: 18px;
`;

const DetailSection = styled.div`
  display: grid;
  gap: 10px;
`;

const DetailHeading = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const DetailText = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  line-height: 1.5;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`;

const MetaCard = styled.div`
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
`;

const MetaLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const MetaValue = styled.div`
  margin-top: 4px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  font-weight: 600;
`;

const LinkList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const LinkButton = styled.button`
  padding: 8px 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  color: rgb(var(--color-primary));
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }
`;

const ActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid
    ${({ $variant }) =>
      $variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  background: ${({ $variant }) =>
    $variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))'};
  color: ${({ $variant }) =>
    $variant === 'primary' ? 'rgb(var(--color-text-on-primary, 255 255 255))' : 'rgb(var(--color-text-primary))'};
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  resize: vertical;
`;

const InlineMessage = styled.div<{ $tone: 'info' | 'error' }>`
  padding: 12px;
  border-radius: var(--radius-md);
  background: ${({ $tone }) =>
    $tone === 'error' ? 'rgb(239 68 68 / 0.08)' : 'rgb(59 130 246 / 0.08)'};
  color: ${({ $tone }) => ($tone === 'error' ? 'rgb(239 68 68)' : 'rgb(59 130 246)')};
  font-size: 13px;
`;

const CodeBlock = styled.pre`
  margin: 0;
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatStepLabel = (value: string): string =>
  value
    .split('.')
    .map((part) =>
      part
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    )
    .join(' / ');

const summarizeVisibleItems = (items: TradeExceptionQueueItem[]) =>
  items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      if (item.active_sibling_count > 0) {
        acc.blocked += 1;
      }
      return acc;
    },
    {
      total: 0,
      open: 0,
      retrying: 0,
      resolved: 0,
      exhausted: 0,
      blocked: 0,
    } as Record<TradeExceptionStatus | 'total' | 'blocked', number>,
  );

const buildEntityButtonLabel = (entity: TradeExceptionEntityLink): string => {
  const typeLabel = entity.entity_type.replace(/_/g, ' ');
  return entity.status ? `${entity.label} · ${typeLabel} · ${entity.status}` : `${entity.label} · ${typeLabel}`;
};

export const InterventionsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const listQuery = useTradeExceptions({
    status: statusFilter === 'active' ? undefined : statusFilter,
    q: searchQuery.trim() || undefined,
  });
  const items = useMemo(() => listQuery.data?.results ?? [], [listQuery.data]);
  const summary = useMemo(() => summarizeVisibleItems(items), [items]);

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const detailQuery = useTradeExceptionDetail(selectedId);
  const retryMutation = useRetryTradeException();
  const resolveMutation = useResolveTradeException();

  const selectedDetail = detailQuery.data;
  const isMutating = retryMutation.isPending || resolveMutation.isPending;

  const handleRetry = async () => {
    if (!selectedId) {
      return;
    }
    setMessage(null);
    try {
      const result = await retryMutation.mutateAsync(selectedId);
      setMessage({
        tone: 'info',
        text: `Retry queued. Exception is now ${STATUS_LABELS[result.status]}.`,
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Retry failed.',
      });
    }
  };

  const handleResolve = async () => {
    if (!selectedId) {
      return;
    }
    const notes = resolutionNotes.trim();
    if (!notes) {
      setMessage({ tone: 'error', text: 'Resolution notes are required before resolving an exception.' });
      return;
    }
    setMessage(null);
    try {
      const result = await resolveMutation.mutateAsync({ id: selectedId, resolution_notes: notes });
      setResolutionNotes('');
      setMessage({
        tone: 'info',
        text: result.trade_resumed
          ? 'Exception resolved and trade session resumed.'
          : result.resume_blocked_reason || 'Exception resolved. Trade session remains halted.',
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Resolve failed.',
      });
    }
  };

  return (
    <Container>
      <SummaryGrid>
        <SummaryCard>
          <SummaryLabel>Visible Exceptions</SummaryLabel>
          <SummaryValue>{summary.total}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Open</SummaryLabel>
          <SummaryValue>{summary.open}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Retrying</SummaryLabel>
          <SummaryValue>{summary.retrying}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Blocked By Siblings</SummaryLabel>
          <SummaryValue>{summary.blocked}</SummaryValue>
        </SummaryCard>
      </SummaryGrid>

      <Filters>
        <SearchWrapper>
          <Search size={16} />
          <SearchInput
            aria-label="Search intervention queue"
            placeholder="Search trade ID, reason, step, or entity"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </SearchWrapper>

        <FilterSelect
          aria-label="Filter intervention status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="active">Open + Retrying</option>
          <option value="open">Open</option>
          <option value="retrying">Retrying</option>
          <option value="resolved">Resolved</option>
          <option value="exhausted">Exhausted</option>
        </FilterSelect>

        <RefreshButton type="button" onClick={() => listQuery.refetch()} aria-label="Refresh interventions">
          <RefreshCw size={16} />
          Refresh
        </RefreshButton>
      </Filters>

      <Layout>
        <PanelCard>
          <PanelHeader>
            <div>
              <PanelTitle>Trades Requiring Intervention</PanelTitle>
              <PanelSubtitle>Halted or retrying trade steps that need operator recovery.</PanelSubtitle>
            </div>
          </PanelHeader>

          {listQuery.isLoading ? (
            <EmptyState>
              <RefreshCw size={20} />
              <span>Loading intervention queue…</span>
            </EmptyState>
          ) : listQuery.isError ? (
            <EmptyState>
              <AlertTriangle size={20} />
              <span>Unable to load the intervention queue.</span>
            </EmptyState>
          ) : items.length === 0 ? (
            <EmptyState>
              <AlertTriangle size={20} />
              <span>No intervention items match the current filters.</span>
            </EmptyState>
          ) : (
            <ItemsList>
              {items.map((item) => (
                <ItemButton
                  key={item.id}
                  type="button"
                  $active={item.id === selectedId}
                  onClick={() => {
                    setSelectedId(item.id);
                    setMessage(null);
                  }}
                >
                  <ItemTitleRow>
                    <ItemTitle>{item.trade_id || `Exception #${item.id}`}</ItemTitle>
                    <StatusBadge $status={item.status}>{STATUS_LABELS[item.status]}</StatusBadge>
                  </ItemTitleRow>
                  <ItemMeta>
                    <span>{formatStepLabel(item.failed_step)}</span>
                    <span>{item.reason_code}</span>
                    <span>{formatDateTime(item.created_on)}</span>
                    {item.active_sibling_count > 0 ? (
                      <span>{item.active_sibling_count} other active exception(s)</span>
                    ) : null}
                  </ItemMeta>
                </ItemButton>
              ))}
            </ItemsList>
          )}
        </PanelCard>

        <PanelCard>
          <PanelHeader>
            <div>
              <PanelTitle>Intervention Detail</PanelTitle>
              <PanelSubtitle>
                {selectedDetail?.trade_session?.trade_id
                  ? `Current trade session: ${selectedDetail.trade_session.trade_id}`
                  : 'Select an exception to inspect lineage and recovery context.'}
              </PanelSubtitle>
            </div>
          </PanelHeader>

          {!selectedId ? (
            <EmptyState>
              <AlertTriangle size={20} />
              <span>Select an exception to view details.</span>
            </EmptyState>
          ) : detailQuery.isLoading ? (
            <EmptyState>
              <RefreshCw size={20} />
              <span>Loading intervention details…</span>
            </EmptyState>
          ) : detailQuery.isError || !selectedDetail ? (
            <EmptyState>
              <AlertTriangle size={20} />
              <span>Unable to load the selected exception.</span>
            </EmptyState>
          ) : (
            <DetailBody>
              {message ? <InlineMessage $tone={message.tone}>{message.text}</InlineMessage> : null}

              <DetailSection>
                <DetailHeading>Failure</DetailHeading>
                <DetailText>{selectedDetail.error_message}</DetailText>
                <MetaGrid>
                  <MetaCard>
                    <MetaLabel>Failed Step</MetaLabel>
                    <MetaValue>{formatStepLabel(selectedDetail.failed_step)}</MetaValue>
                  </MetaCard>
                  <MetaCard>
                    <MetaLabel>Reason Code</MetaLabel>
                    <MetaValue>{selectedDetail.reason_code}</MetaValue>
                  </MetaCard>
                  <MetaCard>
                    <MetaLabel>Status</MetaLabel>
                    <MetaValue>{STATUS_LABELS[selectedDetail.status]}</MetaValue>
                  </MetaCard>
                  <MetaCard>
                    <MetaLabel>Retry Count</MetaLabel>
                    <MetaValue>{selectedDetail.retry_count}</MetaValue>
                  </MetaCard>
                </MetaGrid>
              </DetailSection>

              {selectedDetail.trade_session ? (
                <DetailSection>
                  <DetailHeading>Trade Session</DetailHeading>
                  <MetaGrid>
                    <MetaCard>
                      <MetaLabel>Trade ID</MetaLabel>
                      <MetaValue>{selectedDetail.trade_session.trade_id}</MetaValue>
                    </MetaCard>
                    <MetaCard>
                      <MetaLabel>Current Trade State</MetaLabel>
                      <MetaValue>{selectedDetail.trade_session.status}</MetaValue>
                    </MetaCard>
                    <MetaCard>
                      <MetaLabel>Route Decision</MetaLabel>
                      <MetaValue>{selectedDetail.trade_session.route_decision || '—'}</MetaValue>
                    </MetaCard>
                    <MetaCard>
                      <MetaLabel>Source Email</MetaLabel>
                      <MetaValue>{selectedDetail.trade_session.source_email_sender || '—'}</MetaValue>
                    </MetaCard>
                  </MetaGrid>
                  {selectedDetail.trade_session.source_email_subject ? (
                    <DetailText>{selectedDetail.trade_session.source_email_subject}</DetailText>
                  ) : null}
                </DetailSection>
              ) : null}

              {selectedDetail.related_entities?.length ? (
                <DetailSection>
                  <DetailHeading>Related Records</DetailHeading>
                  <LinkList>
                    {selectedDetail.related_entities.map((entity) =>
                      entity.record_path ? (
                        <LinkButton
                          key={`${entity.entity_type}-${entity.entity_id}`}
                          type="button"
                          onClick={() => navigate(entity.record_path!)}
                        >
                          {buildEntityButtonLabel(entity)}
                        </LinkButton>
                      ) : null,
                    )}
                  </LinkList>
                </DetailSection>
              ) : null}

              {selectedDetail.trade_session?.inquiry_id ? (
                <DetailSection>
                  <DetailHeading>Trade Lineage</DetailHeading>
                  <TradeLineageFlow inquiryId={String(selectedDetail.trade_session.inquiry_id)} compact />
                </DetailSection>
              ) : null}

              {selectedDetail.recent_events?.length ? (
                <DetailSection>
                  <DetailHeading>Recent Events</DetailHeading>
                  <MetaGrid>
                    {selectedDetail.recent_events.map((event) => (
                      <MetaCard key={event.event_id}>
                        <MetaLabel>{formatDateTime(event.created_on)}</MetaLabel>
                        <MetaValue>{event.event_type}</MetaValue>
                        <DetailText>
                          {event.entity_type || 'event'}
                          {event.entity_id ? ` · ${event.entity_id}` : ''}
                        </DetailText>
                      </MetaCard>
                    ))}
                  </MetaGrid>
                </DetailSection>
              ) : null}

              <DetailSection>
                <DetailHeading>Recovery Actions</DetailHeading>
                <ActionsRow>
                  <ActionButton
                    type="button"
                    onClick={handleRetry}
                    disabled={!selectedDetail.can_retry || isMutating}
                  >
                    <RotateCcw size={16} />
                    Retry Step
                  </ActionButton>
                  <ActionButton
                    type="button"
                    $variant="primary"
                    onClick={handleResolve}
                    disabled={!selectedDetail.can_resolve || isMutating}
                  >
                    Resolve Exception
                  </ActionButton>
                </ActionsRow>
                {selectedDetail.active_sibling_count > 0 ? (
                  <InlineMessage $tone="info">
                    {selectedDetail.active_sibling_count} other active exception(s) still block this trade session.
                  </InlineMessage>
                ) : null}
                <TextArea
                  aria-label="Resolution notes"
                  placeholder="Describe what you fixed or why it is safe to resume this trade."
                  value={resolutionNotes}
                  onChange={(event) => setResolutionNotes(event.target.value)}
                />
              </DetailSection>

              {selectedDetail.context_payload &&
              Object.keys(selectedDetail.context_payload).length > 0 ? (
                <DetailSection>
                  <DetailHeading>Context Payload</DetailHeading>
                  <CodeBlock>{JSON.stringify(selectedDetail.context_payload, null, 2)}</CodeBlock>
                </DetailSection>
              ) : null}

              {selectedDetail.stack_trace ? (
                <DetailSection>
                  <DetailHeading>Stack Trace</DetailHeading>
                  <CodeBlock>{selectedDetail.stack_trace}</CodeBlock>
                </DetailSection>
              ) : null}
            </DetailBody>
          )}
        </PanelCard>
      </Layout>
    </Container>
  );
};

export default InterventionsPanel;
