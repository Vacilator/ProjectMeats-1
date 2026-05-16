/**
 * Payment Processing Card
 *
 * Interaction card for payment processing workflow nodes.
 *
 * Features:
 * - Payment amount display from context
 * - Transaction ID entry
 * - Payment status polling indicator
 * - Payment method indicator
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { DollarSign, CreditCard, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { InteractionCardProps } from '../InteractionCardRegistry';
import { resolveTemplateString } from '../hooks/useWorkflowContext';

type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';

const CardContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const CardIcon = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-success) / 0.1);
  border-radius: var(--radius-md);
  color: rgb(var(--color-success));

  svg {
    width: 24px;
    height: 24px;
  }
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-tertiary));
  margin: 4px 0 0;
`;

const AmountDisplay = styled.div`
  background: rgb(var(--color-bg-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
`;

const AmountLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
`;

const AmountValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const FormField = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-bg-primary));
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.15);
  }

  &:disabled {
    background: rgb(var(--color-bg-tertiary));
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.div<{ $status: PaymentStatus }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;

  ${({ $status }) => {
    switch ($status) {
      case 'completed':
        return `
          background: rgb(var(--color-success) / 0.1);
          color: rgb(var(--color-success));
        `;
      case 'processing':
        return `
          background: rgb(var(--color-warning) / 0.1);
          color: rgb(var(--color-warning));
        `;
      case 'failed':
        return `
          background: rgb(var(--color-error) / 0.1);
          color: rgb(var(--color-error));
        `;
      default:
        return `
          background: rgb(var(--color-bg-tertiary));
          color: rgb(var(--color-text-secondary));
        `;
    }
  }}
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 12px;
  background: rgb(var(--color-success));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusIcon: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} />;
    case 'processing':
      return <Clock size={16} />;
    case 'failed':
      return <AlertCircle size={16} />;
    default:
      return <CreditCard size={16} />;
  }
};

export const PaymentCard: React.FC<InteractionCardProps> = ({
  node,
  context,
  onComplete,
  readOnly = false,
}) => {
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');

  const nodeData = (node?.data || {}) as Record<string, unknown>;
  const amount = nodeData.amount
    ? resolveTemplateString(String(nodeData.amount), context)
    : '';

  const handleSubmit = () => {
    if (!transactionId.trim()) return;
    setPaymentStatus('completed');
    onComplete({
      transaction_id: transactionId.trim(),
      payment_status: 'completed',
      completed_at: new Date().toISOString(),
    });
  };

  return (
    <CardContainer>
      <CardHeader>
        <CardIcon>
          <DollarSign />
        </CardIcon>
        <div>
          <Title>Payment Required</Title>
          <Subtitle>
            {nodeData.description
              ? resolveTemplateString(String(nodeData.description), context)
              : 'Enter payment transaction details to continue'}
          </Subtitle>
        </div>
      </CardHeader>

      {amount && (
        <AmountDisplay>
          <AmountLabel>Amount Due</AmountLabel>
          <AmountValue>${amount}</AmountValue>
        </AmountDisplay>
      )}

      <div style={{ marginBottom: 12 }}>
        <StatusBadge $status={paymentStatus}>
          <StatusIcon status={paymentStatus} />
          {paymentStatus === 'pending' && 'Awaiting Payment'}
          {paymentStatus === 'processing' && 'Processing...'}
          {paymentStatus === 'completed' && 'Payment Complete'}
          {paymentStatus === 'failed' && 'Payment Failed'}
        </StatusBadge>
      </div>

      <FormField>
        <Label htmlFor="transaction-id">Transaction ID</Label>
        <Input
          id="transaction-id"
          type="text"
          placeholder="Enter transaction or reference ID"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          disabled={readOnly || paymentStatus === 'completed'}
        />
      </FormField>

      {!readOnly && paymentStatus !== 'completed' && (
        <SubmitButton
          onClick={handleSubmit}
          disabled={!transactionId.trim()}
        >
          <CheckCircle size={16} />
          Confirm Payment
        </SubmitButton>
      )}
    </CardContainer>
  );
};
