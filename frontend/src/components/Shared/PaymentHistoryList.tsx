/**
 * Payment History List Component
 * 
 * Displays a chronological list of payment transactions for an order or invoice.
 * Shows date, reference number, amount, and payment method.
 * 
 * Features:
 * - Fetches payment history from API based on entity type and ID
 * - Shows empty state when no payments exist
 * - Clean, readable design matching theme
 * - Automatic formatting of dates and currency
 * 
 * Usage:
 * <PaymentHistoryList 
 *   entityType="purchase_order"
 *   entityId={123}
 * />
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { formatCurrency } from '../../shared/utils';
import { paymentHistoryService, type PaymentHistoryRecord } from '../../services/paymentHistoryService';
import type { SettlementEntityType } from '../../services/settlementQueueService';
import { formatDateLocal } from '../../utils/formatters';
import { withTenantQueryKey } from '../../utils/queryKeys';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface PaymentHistoryListProps {
  entityType: SettlementEntityType;
  entityId: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PaymentItem = styled.div`
  padding: 12px;
   background: rgb(var(--color-surface-hover));
   border-radius: 6px;
   border: 1px solid rgb(var(--color-border));
   display: flex;
   flex-direction: column;
   gap: 6px;
`;

const PaymentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PaymentDate = styled.span`
  font-size: 14px;
  font-weight: 600;
   color: rgb(var(--color-text-primary));
`;

const PaymentAmount = styled.span`
  font-size: 16px;
  font-weight: 700;
   color: rgb(var(--color-success));
`;

const PaymentDetails = styled.div`
  display: flex;
   flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
   color: rgb(var(--color-text-secondary));
`;

const DetailItem = styled.div`
  display: flex;
  gap: 4px;
`;

const DetailLabel = styled.span`
  font-weight: 500;
`;

const DetailValue = styled.span`
  color: rgb(var(--color-text-primary));
`;

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
   color: rgb(var(--color-text-secondary));
  font-size: 14px;
   background: rgb(var(--color-surface-hover));
  border-radius: 6px;
   border: 1px dashed rgb(var(--color-border));
`;

const LoadingState = styled.div`
  padding: 24px;
  text-align: center;
   color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const ErrorState = styled.div`
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
   color: rgb(var(--color-error));
  border-radius: 6px;
  font-size: 14px;
`;

const Provenance = styled.div`
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

export const PaymentHistoryList: React.FC<PaymentHistoryListProps> = ({ 
  entityType, 
  entityId 
}) => {
  const queryKey = useMemo(
    () => withTenantQueryKey('payment-history', entityType, entityId),
    [entityType, entityId],
  );
  const paymentsQuery = useQuery({
    queryKey,
    queryFn: () => paymentHistoryService.listPayments(entityType, entityId),
    enabled: entityId > 0,
  });

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'check': 'Check',
      'wire_transfer': 'Wire Transfer',
      'ach': 'ACH',
      'credit_card': 'Credit Card',
      'cash': 'Cash',
      'other': 'Other'
    };
    return labels[method] || method;
  };

  const getSettlementSummary = (payment: PaymentHistoryRecord): string | null => {
    if (!payment.source_settlement_event_id) {
      return null;
    }
    const parts = ['Settlement'];
    if (payment.source_settlement_provider_code) {
      parts.push(payment.source_settlement_provider_code);
    }
    if (payment.source_settlement_reason_code) {
      parts.push(payment.source_settlement_reason_code.replace(/_/g, ' '));
    }
    if (payment.source_settlement_review_action) {
      parts.push(payment.source_settlement_review_action.replace(/_/g, ' '));
    }
    return parts.join(' · ');
  };

  if (paymentsQuery.isLoading) {
    return <LoadingState>Loading payment history...</LoadingState>;
  }

  if (paymentsQuery.isError) {
    return <ErrorState>Failed to load payment history</ErrorState>;
  }

  if ((paymentsQuery.data ?? []).length === 0) {
    return (
      <EmptyState>
        No payment history yet
      </EmptyState>
    );
  }

  return (
    <Container>
      {(paymentsQuery.data ?? []).map(payment => (
        <PaymentItem key={payment.id}>
          <PaymentHeader>
            <PaymentDate>{formatDateLocal(payment.payment_date)}</PaymentDate>
            <PaymentAmount>{formatCurrency(parseFloat(payment.amount))}</PaymentAmount>
          </PaymentHeader>
          
          <PaymentDetails>
            <DetailItem>
              <DetailLabel>Method:</DetailLabel>
              <DetailValue>{getPaymentMethodLabel(payment.payment_method)}</DetailValue>
            </DetailItem>
            
            {payment.reference_number && (
              <DetailItem>
                <DetailLabel>Ref:</DetailLabel>
                <DetailValue>{payment.reference_number}</DetailValue>
              </DetailItem>
            )}
            
            <DetailItem>
              <DetailLabel>By:</DetailLabel>
              <DetailValue>{payment.created_by_name}</DetailValue>
            </DetailItem>
          </PaymentDetails>

          {getSettlementSummary(payment) && <Provenance>{getSettlementSummary(payment)}</Provenance>}
          
          {payment.notes && (
            <DetailItem style={{ fontSize: '12px', marginTop: '4px' }}>
              <DetailLabel>Note:</DetailLabel>
              <DetailValue>{payment.notes}</DetailValue>
            </DetailItem>
          )}
        </PaymentItem>
      ))}
    </Container>
  );
};

export default PaymentHistoryList;
