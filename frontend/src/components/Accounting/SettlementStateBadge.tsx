import React from 'react';
import styled, { css } from 'styled-components';

import type { SettlementEventState } from '@/services/settlementQueueService';

const toneByState: Record<SettlementEventState, keyof typeof toneStyles> = {
  received: 'info',
  validated: 'info',
  duplicate: 'warning',
  ready_to_post: 'warning',
  posted: 'success',
  ignored: 'muted',
  failed: 'error',
};

const toneStyles = {
  info: css`
    background: rgba(var(--color-info), 0.12);
    color: rgb(var(--color-info));
  `,
  success: css`
    background: rgba(var(--color-success), 0.12);
    color: rgb(var(--color-success));
  `,
  warning: css`
    background: rgba(var(--color-warning), 0.14);
    color: rgb(var(--color-warning));
  `,
  error: css`
    background: rgba(var(--color-error), 0.12);
    color: rgb(var(--color-error));
  `,
  muted: css`
    background: rgba(var(--color-text-muted), 0.12);
    color: rgb(var(--color-text-secondary));
  `,
};

const Badge = styled.span<{ $tone: keyof typeof toneStyles }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  ${({ $tone }) => toneStyles[$tone]}
`;

const humanize = (value: string) => value.replace(/_/g, ' ');

export interface SettlementStateBadgeProps {
  state: SettlementEventState;
}

export const SettlementStateBadge: React.FC<SettlementStateBadgeProps> = ({ state }) => {
  return <Badge $tone={toneByState[state]}>{humanize(state)}</Badge>;
};

export default SettlementStateBadge;
