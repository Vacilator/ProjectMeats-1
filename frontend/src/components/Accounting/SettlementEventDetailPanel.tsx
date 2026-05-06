import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import SearchableSelectEntity from '@/components/Shared/SearchableSelectEntity';
import type {
  SettlementEntityType,
  SettlementEventRecord,
  SettlementEventState,
} from '@/services/settlementQueueService';
import { formatCurrency } from '@/shared/utils';
import { formatDateLocal } from '@/utils/formatters';

import SettlementReasonBadge from './SettlementReasonBadge';
import SettlementStateBadge from './SettlementStateBadge';

const Panel = styled.section`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  background: rgb(var(--color-surface));
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Heading = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  color: rgb(var(--color-text-primary));
`;

const Muted = styled.p`
  margin: 4px 0 0;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Label = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Value = styled.span`
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const CandidateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CandidateCard = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  padding: 12px;
  background: rgb(var(--color-surface-hover));
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 88px;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  padding: 12px;
  font: inherit;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.15);
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  background: ${({ $variant }) => {
    if ($variant === 'danger') return 'rgb(var(--color-error))';
    if ($variant === 'secondary') return 'rgba(var(--color-primary), 0.1)';
    return 'rgb(var(--color-primary))';
  }};
  color: ${({ $variant }) =>
    $variant === 'secondary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-button-text, 255 255 255))'};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};

  &:disabled {
    cursor: not-allowed;
  }
`;

const InlineFields = styled.div`
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  align-items: end;
`;

const Select = styled.select`
  width: 100%;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  padding: 10px 12px;
  font: inherit;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
`;

const Callout = styled.div<{ $tone?: 'warning' | 'error' | 'info' }>`
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid
    ${({ $tone }) => {
      if ($tone === 'error') return 'rgba(var(--color-error), 0.3)';
      if ($tone === 'warning') return 'rgba(var(--color-warning), 0.35)';
      return 'rgba(var(--color-primary), 0.3)';
    }};
  background: ${({ $tone }) => {
    if ($tone === 'error') return 'rgba(var(--color-error), 0.08)';
    if ($tone === 'warning') return 'rgba(var(--color-warning), 0.1)';
    return 'rgba(var(--color-primary), 0.08)';
  }};
  color: rgb(var(--color-text-primary));
`;

const PayloadPreview = styled.pre`
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  background: rgb(var(--color-surface-hover));
  color: rgb(var(--color-text-primary));
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
`;

const reviewableStates = new Set<SettlementEventState>(['ready_to_post', 'failed']);

const humanize = (value: string) => value.replace(/_/g, ' ');

export interface SettlementEventDetailPanelProps {
  event: SettlementEventRecord;
  isMutating: boolean;
  mutationError: string | null;
  onApprove: (input: { eventId: number; note: string }) => Promise<unknown>;
  onRelink: (input: {
    eventId: number;
    note: string;
    entityType: SettlementEntityType;
    objectId: number;
  }) => Promise<unknown>;
  onReject: (input: { eventId: number; note: string }) => Promise<unknown>;
}

export const SettlementEventDetailPanel: React.FC<SettlementEventDetailPanelProps> = ({
  event,
  isMutating,
  mutationError,
  onApprove,
  onRelink,
  onReject,
}) => {
  const [note, setNote] = useState('');
  const [entityType, setEntityType] = useState<SettlementEntityType>('invoice');
  const [targetId, setTargetId] = useState('');

  useEffect(() => {
    setNote('');
    setTargetId('');
  }, [event.id]);

  const canReview = reviewableStates.has(event.state);
  const canRelink = canReview && Boolean(targetId);
  const parsedTargetId = useMemo(() => Number.parseInt(targetId, 10), [targetId]);

  return (
    <Panel>
      <Heading>
        <div>
          <Title>{event.external_event_id || event.idempotency_key.slice(0, 12)}</Title>
          <Muted>
            {event.source_name} · {event.provider_code} · received {formatDateLocal(event.received_at)}
          </Muted>
        </div>
        <SettlementStateBadge state={event.state} />
      </Heading>

      <Grid>
        <Section>
          <Label>Reason</Label>
          <SettlementReasonBadge reasonCode={event.reconciliation_reason_code} />
        </Section>
        <Section>
          <Label>Amount</Label>
          <Value>{formatCurrency(Number(event.amount || 0))}</Value>
        </Section>
        <Section>
          <Label>Matched Entity</Label>
          <Value>{event.matched_entity_reference || 'Not yet linked'}</Value>
        </Section>
        <Section>
          <Label>Review Audit</Label>
          <Value>
            {event.review_action
              ? `${humanize(event.review_action)} by ${event.reviewed_by_name || 'system'} on ${formatDateLocal(
                  event.reviewed_at || event.modified_on,
                )}`
              : 'Awaiting review'}
          </Value>
        </Section>
      </Grid>

      {event.candidate_matches && event.candidate_matches.length > 0 && (
        <Section>
          <Label>Candidate Matches</Label>
          <CandidateList>
            {event.candidate_matches.map((candidate) => (
              <CandidateCard key={`${candidate.entity_type}-${candidate.object_id}`}>
                <Value>
                  {humanize(candidate.entity_type)} · {candidate.reference_value} ·{' '}
                  {formatCurrency(Number(candidate.outstanding_amount || 0))}
                </Value>
                <Muted>
                  {candidate.exact_amount_match ? 'Exact outstanding amount match' : 'Outstanding amount differs'}
                </Muted>
              </CandidateCard>
            ))}
          </CandidateList>
        </Section>
      )}

      <Section>
        <Label>Manual Review Note</Label>
        <TextArea
          aria-label="Review note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Document the accountant decision for audit history."
        />
      </Section>

      {mutationError && <Callout $tone="error">{mutationError}</Callout>}

      {!canReview && (
        <Callout $tone="info">
          This settlement has already been resolved. Switch filters to inspect other queued items.
        </Callout>
      )}

      <Section>
        <Label>Actions</Label>
        <ActionRow>
          <Button
            type="button"
            disabled={!canReview || isMutating || note.trim().length === 0}
            onClick={() => onApprove({ eventId: event.id, note: note.trim() })}
          >
            Approve Match
          </Button>
          <Button
            type="button"
            $variant="danger"
            disabled={!canReview || isMutating || note.trim().length === 0}
            onClick={() => onReject({ eventId: event.id, note: note.trim() })}
          >
            Reject Event
          </Button>
        </ActionRow>
      </Section>

      <Section>
        <Label>Manual Relink</Label>
        <InlineFields>
          <div>
            <Label>Target Type</Label>
            <Select
              aria-label="Relink entity type"
              value={entityType}
              onChange={(inputEvent) => {
                setEntityType(inputEvent.target.value as SettlementEntityType);
                setTargetId('');
              }}
            >
              <option value="invoice">Invoice</option>
              <option value="sales_order">Sales order</option>
              <option value="purchase_order">Purchase order</option>
            </Select>
          </div>
          <div>
            <Label>Target Record</Label>
            <SearchableSelectEntity
              entityType={entityType}
              value={targetId}
              onChange={setTargetId}
              allowCreate={false}
              forceSearch={true}
              placeholder={`Search ${humanize(entityType)}`}
            />
          </div>
        </InlineFields>
        <ActionRow>
          <Button
            type="button"
            $variant="secondary"
            disabled={!canRelink || isMutating || note.trim().length === 0 || Number.isNaN(parsedTargetId)}
            onClick={() =>
              onRelink({
                eventId: event.id,
                note: note.trim(),
                entityType,
                objectId: parsedTargetId,
              })
            }
          >
            Relink Settlement
          </Button>
        </ActionRow>
      </Section>

      {event.last_error && <Callout $tone="warning">{event.last_error}</Callout>}

      <Section>
        <Label>Raw Payload</Label>
        <PayloadPreview>{event.raw_payload}</PayloadPreview>
      </Section>
    </Panel>
  );
};

export default SettlementEventDetailPanel;
