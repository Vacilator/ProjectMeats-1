import React from 'react';
import styled from 'styled-components';

import type { SettlementEventRecord } from '@/services/settlementQueueService';
import { formatCurrency } from '@/shared/utils';
import { formatDateLocal } from '@/utils/formatters';

import SettlementReasonBadge from './SettlementReasonBadge';
import SettlementStateBadge from './SettlementStateBadge';

const TableShell = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  overflow: hidden;
  background: rgb(var(--color-surface));
`;

const HeaderRow = styled.div`
  display: grid;
  grid-template-columns: 1.1fr 0.8fr 0.9fr 0.8fr;
  gap: 16px;
  padding: 12px 16px;
  background: rgb(var(--color-surface-hover));
  border-bottom: 1px solid rgb(var(--color-border));
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const RowButton = styled.button<{ $selected: boolean }>`
  width: 100%;
  border: none;
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1.1fr 0.8fr 0.9fr 0.8fr;
  gap: 16px;
  text-align: left;
  background: ${({ $selected }) =>
    $selected ? 'rgba(var(--color-primary), 0.08)' : 'rgb(var(--color-surface))'};
  border-bottom: 1px solid rgb(var(--color-border));
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-primary), 0.06);
  }
`;

const PrimaryText = styled.div`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const SecondaryText = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

export interface SettlementQueueTableProps {
  events: SettlementEventRecord[];
  selectedEventId: number | null;
  onSelect: (eventId: number) => void;
}

export const SettlementQueueTable: React.FC<SettlementQueueTableProps> = ({
  events,
  selectedEventId,
  onSelect,
}) => {
  if (events.length === 0) {
    return <EmptyState>No settlement events match the current filter.</EmptyState>;
  }

  return (
    <TableShell>
      <HeaderRow>
        <span>Settlement</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Received</span>
      </HeaderRow>
      {events.map((event) => (
        <RowButton
          key={event.id}
          type="button"
          $selected={event.id === selectedEventId}
          onClick={() => onSelect(event.id)}
        >
          <div>
            <PrimaryText>{event.external_event_id || event.idempotency_key.slice(0, 12)}</PrimaryText>
            <SecondaryText>
              {event.source_name} · {event.provider_code}
            </SecondaryText>
            <SecondaryText>
              <SettlementReasonBadge reasonCode={event.reconciliation_reason_code} />
            </SecondaryText>
          </div>
          <div>
            <PrimaryText>{formatCurrency(Number(event.amount || 0))}</PrimaryText>
            <SecondaryText>{event.currency}</SecondaryText>
          </div>
          <div>
            <SettlementStateBadge state={event.state} />
          </div>
          <div>
            <PrimaryText>{formatDateLocal(event.received_at)}</PrimaryText>
            <SecondaryText>{formatDateLocal(event.occurred_at)}</SecondaryText>
          </div>
        </RowButton>
      ))}
    </TableShell>
  );
};

export default SettlementQueueTable;

