import React from 'react';
import styled from 'styled-components';

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
`;

const humanize = (value: string) => value.replace(/_/g, ' ');

export interface SettlementReasonBadgeProps {
  reasonCode: string;
}

export const SettlementReasonBadge: React.FC<SettlementReasonBadgeProps> = ({ reasonCode }) => {
  return <Badge>{humanize(reasonCode || 'pending_review')}</Badge>;
};

export default SettlementReasonBadge;

