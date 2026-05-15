/**
 * TradeWorkflowStepper — Data-driven trade workflow progress indicator
 *
 * Replaces the hardcoded PurchaseOrderWorkflow demo React Flow diagram.
 * Shows real progress through the E2E trade pipeline:
 *   Inquiry → PO → SO → Carrier PO → Fulfillment → Invoice
 *
 * Each step shows its status, required actions, and clickability.
 */
import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Tooltip, Tag } from 'antd';
import {
  FileText,
  ShoppingCart,
  Receipt,
  Truck,
  Package,
  CreditCard,
  Check,
  ArrowRight,
} from 'lucide-react';

// ── Step definitions ──

interface TradeStep {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  requiredActions: string[];
}

const TRADE_STEPS: TradeStep[] = [
  {
    key: 'inquiry',
    label: 'Inquiry',
    icon: <FileText size={18} />,
    description: 'Customer inquiry received and quoted',
    requiredActions: [
      'Add products and pricing',
      'Add supplier bids',
      'Send quote to customer',
      'Accept or reject deal',
    ],
  },
  {
    key: 'purchase_order',
    label: 'Purchase Order',
    icon: <ShoppingCart size={18} />,
    description: 'Supplier PO created and approved',
    requiredActions: [
      'Review PO details',
      'Approve purchase order',
      'Send to supplier',
    ],
  },
  {
    key: 'sales_order',
    label: 'Sales Order',
    icon: <Receipt size={18} />,
    description: 'Customer sales order confirmed',
    requiredActions: [
      'Review SO details',
      'Get customer confirmation',
      'Approve sales order',
    ],
  },
  {
    key: 'carrier_po',
    label: 'Carrier PO',
    icon: <Truck size={18} />,
    description: 'Carrier logistics arranged',
    requiredActions: [
      'Select carrier',
      'Confirm pickup/delivery schedule',
      'Approve carrier PO',
    ],
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    icon: <Package size={18} />,
    description: 'Product shipped and delivered',
    requiredActions: [
      'Confirm shipment dispatched',
      'Track delivery',
      'Confirm receipt',
    ],
  },
  {
    key: 'invoice',
    label: 'Invoice',
    icon: <CreditCard size={18} />,
    description: 'Invoice sent and payment received',
    requiredActions: [
      'Generate invoice',
      'Send to customer',
      'Track payment',
    ],
  },
];

// ── Map TradeSession status to current step index ──

const STATUS_TO_STEP: Record<string, number> = {
  initiated: 0,
  sourcing: 0,
  quoted: 0,
  ordered: 1,
  logistics: 3,
  completed: 6,
  cancelled: -1,
  halted: -1,
};

// ── Props ──

interface TradeWorkflowStepperProps {
  tradeStatus: string;
  currentStep?: string;
  inquiryStatus?: string;
  compact?: boolean;
}

// ── Component ──

export const TradeWorkflowStepper: React.FC<TradeWorkflowStepperProps> = ({
  tradeStatus,
  currentStep,
  inquiryStatus,
  compact = false,
}) => {
  const activeStepIndex = useMemo(() => {
    const fromStatus = STATUS_TO_STEP[tradeStatus] ?? 0;
    // Refine with orchestrator step if available
    if (currentStep) {
      if (currentStep.includes('supplier_rfq') || currentStep.includes('supplier_reply')) return 0;
      if (currentStep.includes('supplier_po') || currentStep.includes('draft_supplier')) return 1;
      if (currentStep.includes('sales_order')) return 2;
      if (currentStep.includes('carrier')) return 3;
      if (currentStep.includes('fulfillment')) return 4;
      if (currentStep.includes('invoice')) return 5;
    }
    return fromStatus;
  }, [tradeStatus, currentStep]);

  const isCancelled = tradeStatus === 'cancelled' || tradeStatus === 'halted';
  const isCompleted = tradeStatus === 'completed';

  return (
    <StepperContainer $compact={compact}>
      {TRADE_STEPS.map((step, index) => {
        const isActive = index === activeStepIndex && !isCancelled && !isCompleted;
        const isDone = index < activeStepIndex || isCompleted;
        const isFuture = index > activeStepIndex && !isCompleted;

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <StepConnector $done={isDone} $active={isActive} />
            )}
            <Tooltip
              title={
                <div>
                  <strong>{step.label}</strong>
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{step.description}</div>
                  {isActive && step.requiredActions.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <strong>Action Required:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {step.requiredActions.map((action, i) => (
                          <li key={i} style={{ fontSize: '0.8rem' }}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              }
            >
              <StepNode $active={isActive} $done={isDone} $future={isFuture} $compact={compact}>
                <StepIcon $active={isActive} $done={isDone}>
                  {isDone ? <Check size={compact ? 14 : 16} /> : step.icon}
                </StepIcon>
                {!compact && <StepLabel $active={isActive} $done={isDone}>{step.label}</StepLabel>}
                {isActive && !compact && (
                  <ActiveIndicator />
                )}
              </StepNode>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </StepperContainer>
  );
};

// ── Styled Components ──

const StepperContainer = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ $compact }) => $compact ? '0.25rem' : '0'};
  padding: ${({ $compact }) => $compact ? '0.5rem' : '1rem 0.5rem'};
  overflow-x: auto;
`;

const StepConnector = styled.div<{ $done: boolean; $active: boolean }>`
  flex: 1;
  height: 2px;
  min-width: 20px;
  background: ${({ $done, $active }) =>
    $done
      ? 'rgb(var(--color-success))'
      : $active
      ? 'linear-gradient(90deg, rgb(var(--color-success)), rgb(var(--color-primary)))'
      : 'rgba(var(--color-border), 0.4)'};
  transition: background 0.3s ease;
`;

const StepNode = styled.div<{ $active: boolean; $done: boolean; $future: boolean; $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  position: relative;
  min-width: ${({ $compact }) => $compact ? '32px' : '64px'};
  cursor: ${({ $active }) => $active ? 'pointer' : 'default'};
  opacity: ${({ $future }) => $future ? 0.4 : 1};
  transition: opacity 0.3s ease;
`;

const StepIcon = styled.div<{ $active: boolean; $done: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  background: ${({ $active, $done }) =>
    $done
      ? 'rgb(var(--color-success))'
      : $active
      ? 'rgb(var(--color-primary))'
      : 'rgba(var(--color-surface-hover), 0.8)'};
  color: ${({ $active, $done }) =>
    $done || $active ? 'rgb(255, 255, 255)' : 'rgb(var(--color-text-secondary))'};
  border: 2px solid ${({ $active, $done }) =>
    $done
      ? 'rgb(var(--color-success))'
      : $active
      ? 'rgb(var(--color-primary))'
      : 'rgba(var(--color-border), 0.3)'};

  ${({ $active }) => $active && `
    box-shadow: 0 0 0 4px rgba(var(--color-primary), 0.2);
  `}
`;

const StepLabel = styled.span<{ $active: boolean; $done: boolean }>`
  font-size: 0.75rem;
  font-weight: ${({ $active }) => $active ? 600 : 400};
  color: ${({ $active, $done }) =>
    $active
      ? 'rgb(var(--color-primary))'
      : $done
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-text-secondary))'};
  white-space: nowrap;
`;

const ActiveIndicator = styled.div`
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--color-primary));
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
    50% { opacity: 0.5; transform: translateX(-50%) scale(1.5); }
  }
`;

export default TradeWorkflowStepper;
