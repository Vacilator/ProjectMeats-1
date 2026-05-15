/**
 * TradeWorkflowStepper — Data-driven trade workflow progress indicator
 *
 * Shows real progress through the E2E trade pipeline:
 *   Inquiry → PO → SO → Carrier PO → Fulfillment → Invoice
 *
 * Clicking on a completed or active step opens a popover with:
 * - Required action checklist
 * - Related documents from that stage (fetched from trade-documents API)
 */
import React, { useMemo, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Popover, Tag, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ShoppingCart,
  Receipt,
  Truck,
  Package,
  CreditCard,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
  Mail,
} from 'lucide-react';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { tradeDocumentsService, type TradeDocument } from '@/services/tradeDocumentsService';

// ── Step definitions ──

interface StepAction {
  label: string;
  /** Section of the record to scroll to or highlight */
  section?: string;
}

interface TradeStep {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  requiredActions: StepAction[];
  /** Entity type used to navigate to the record */
  entityType?: string;
}

export const TRADE_STEPS: TradeStep[] = [
  {
    key: 'inquiry',
    label: 'Inquiry',
    icon: <FileText size={18} />,
    description: 'Customer inquiry received and quoted',
    entityType: 'inquiry',
    requiredActions: [
      { label: 'Add products and pricing', section: 'products' },
      { label: 'Add supplier bids', section: 'supplier-bids' },
      { label: 'Set respond-by & fulfillment dates', section: 'supplier-bids' },
      { label: 'Send quote to customer', section: 'actions' },
      { label: 'Accept or reject deal', section: 'status' },
    ],
  },
  {
    key: 'purchase_order',
    label: 'Purchase Order',
    icon: <ShoppingCart size={18} />,
    description: 'Supplier PO created and approved',
    entityType: 'purchase_order',
    requiredActions: [
      { label: 'Review PO details', section: 'details' },
      { label: 'Approve purchase order', section: 'status' },
      { label: 'Send to supplier', section: 'actions' },
    ],
  },
  {
    key: 'sales_order',
    label: 'Sales Order',
    icon: <Receipt size={18} />,
    description: 'Customer sales order confirmed',
    entityType: 'sales_order',
    requiredActions: [
      { label: 'Review SO details', section: 'details' },
      { label: 'Get customer confirmation', section: 'actions' },
      { label: 'Approve sales order', section: 'status' },
    ],
  },
  {
    key: 'carrier_po',
    label: 'Carrier PO',
    icon: <Truck size={18} />,
    description: 'Carrier logistics arranged',
    entityType: 'carrier_po',
    requiredActions: [
      { label: 'Select carrier', section: 'carrier' },
      { label: 'Confirm pickup/delivery schedule', section: 'schedule' },
      { label: 'Approve carrier PO', section: 'status' },
    ],
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    icon: <Package size={18} />,
    description: 'Product shipped and delivered',
    entityType: 'fulfillment',
    requiredActions: [
      { label: 'Confirm shipment dispatched', section: 'dispatch' },
      { label: 'Track delivery', section: 'tracking' },
      { label: 'Confirm receipt', section: 'status' },
    ],
  },
  {
    key: 'invoice',
    label: 'Invoice',
    icon: <CreditCard size={18} />,
    description: 'Invoice sent and payment received',
    entityType: 'invoice',
    requiredActions: [
      { label: 'Generate invoice', section: 'generate' },
      { label: 'Send to customer', section: 'actions' },
      { label: 'Track payment', section: 'payment' },
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

// ── Document type icon map ──

const DOC_ICON: Record<string, React.ReactNode> = {
  pdf: <FileText size={12} />,
  email: <Mail size={12} />,
  attachment: <Paperclip size={12} />,
};

// ── Popover document content for a stage ──

const StageDocumentsContent: React.FC<{
  stageKey: string;
  tradeSessionId?: number | string;
  step: TradeStep;
  isActive: boolean;
  isDone: boolean;
  onActionClick?: (action: StepAction, step: TradeStep) => void;
}> = ({ stageKey, tradeSessionId, step, isActive, isDone, onActionClick }) => {
  const queryKey = useMemo(
    () => withTenantQueryKey('trade-docs-stage', stageKey, String(tradeSessionId ?? '')),
    [stageKey, tradeSessionId],
  );

  const { data: docs, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tradeSessionId) return [];
      const all = await tradeDocumentsService.listByTradeSession(tradeSessionId);
      return all.filter((d) => d.stage === stageKey);
    },
    enabled: Boolean(tradeSessionId),
    staleTime: 30_000,
    retry: false,
  });

  return (
    <PopoverContent>
      <PopoverTitle>{step.label}</PopoverTitle>
      <PopoverDesc>{step.description}</PopoverDesc>

      {isActive && step.requiredActions.length > 0 && (
        <PopoverSection>
          <PopoverSectionTitle>Action Required</PopoverSectionTitle>
          <ActionList>
            {step.requiredActions.map((action) => (
              <ActionItem
                key={action.label}
                $clickable={Boolean(onActionClick)}
                onClick={() => onActionClick?.(action, step)}
                role={onActionClick ? 'button' : undefined}
                tabIndex={onActionClick ? 0 : undefined}
              >
                {action.label}
                {onActionClick && <ArrowUpRight size={10} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </ActionItem>
            ))}
          </ActionList>
        </PopoverSection>
      )}

      {isDone && (
        <PopoverSection>
          <PopoverSectionTitle>
            {isActive ? '✓ Completed' : '✓ Stage Complete'}
          </PopoverSectionTitle>
        </PopoverSection>
      )}

      <PopoverSection>
        <PopoverSectionTitle>
          Documents {docs && docs.length > 0 ? `(${docs.length})` : ''}
        </PopoverSectionTitle>
        {isLoading ? (
          <Spin size="small" />
        ) : !docs || docs.length === 0 ? (
          <NoDocs>No documents in this stage yet.</NoDocs>
        ) : (
          <DocList>
            {docs.map((doc: TradeDocument) => (
              <DocItem key={doc.id}>
                <DocDirection>
                  {doc.direction === 'sent' ? (
                    <Tag color="blue" style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
                      <ArrowUpRight size={10} /> Sent
                    </Tag>
                  ) : (
                    <Tag color="green" style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
                      <ArrowDownLeft size={10} /> Rcvd
                    </Tag>
                  )}
                </DocDirection>
                <DocIcon>{DOC_ICON[doc.document_type] ?? <FileText size={12} />}</DocIcon>
                {doc.download_url ? (
                  <DocLink href={doc.download_url} target="_blank" rel="noopener noreferrer">
                    {doc.title}
                  </DocLink>
                ) : (
                  <DocName>{doc.title}</DocName>
                )}
              </DocItem>
            ))}
          </DocList>
        )}
      </PopoverSection>
    </PopoverContent>
  );
};

// ── Props ──

export interface TradeWorkflowStepperProps {
  tradeStatus: string;
  currentStep?: string;
  inquiryStatus?: string;
  compact?: boolean;
  /** Trade session ID — enables per-stage document preview on step click */
  tradeSessionId?: number | string;
  /** Called when a required action item is clicked — navigate to relevant record/section */
  onActionClick?: (action: { label: string; section?: string }, step: { key: string; entityType?: string }) => void;
}

// ── Component ──

export const TradeWorkflowStepper: React.FC<TradeWorkflowStepperProps> = ({
  tradeStatus,
  currentStep,
  inquiryStatus,
  compact = false,
  tradeSessionId,
  onActionClick,
}) => {
  const [openStep, setOpenStep] = useState<string | null>(null);

  const activeStepIndex = useMemo(() => {
    const fromStatus = STATUS_TO_STEP[tradeStatus] ?? 0;
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

  const handleOpenChange = useCallback((stepKey: string, open: boolean) => {
    setOpenStep(open ? stepKey : null);
  }, []);

  return (
    <StepperContainer $compact={compact}>
      {TRADE_STEPS.map((step, index) => {
        const isActive = index === activeStepIndex && !isCancelled && !isCompleted;
        const isDone = index < activeStepIndex || isCompleted;
        const isFuture = index > activeStepIndex && !isCompleted;
        const isClickable = (isActive || isDone) && !compact;

        const stepNode = (
          <StepNode
            $active={isActive}
            $done={isDone}
            $future={isFuture}
            $compact={compact}
            $clickable={isClickable}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? `${step.label} – ${isDone ? 'completed' : 'in progress'}` : undefined}
          >
            <StepIcon $active={isActive} $done={isDone}>
              {isDone ? <Check size={compact ? 14 : 16} /> : step.icon}
            </StepIcon>
            {!compact && <StepLabel $active={isActive} $done={isDone}>{step.label}</StepLabel>}
            {isActive && !compact && (
              <ActiveIndicator />
            )}
          </StepNode>
        );

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <StepConnector $done={isDone} $active={isActive} />
            )}
            {isClickable ? (
              <Popover
                open={openStep === step.key}
                onOpenChange={(open) => handleOpenChange(step.key, open)}
                trigger="click"
                placement="bottom"
                overlayStyle={{ maxWidth: 360 }}
                content={
                  <StageDocumentsContent
                    stageKey={step.key}
                    tradeSessionId={tradeSessionId}
                    step={step}
                    isActive={isActive}
                    isDone={isDone}
                    onActionClick={onActionClick}
                  />
                }
              >
                {stepNode}
              </Popover>
            ) : (
              stepNode
            )}
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

const StepNode = styled.div<{ $active: boolean; $done: boolean; $future: boolean; $compact?: boolean; $clickable?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  position: relative;
  min-width: ${({ $compact }) => $compact ? '32px' : '64px'};
  cursor: ${({ $clickable }) => $clickable ? 'pointer' : 'default'};
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

// ── Popover inner styles ──

const PopoverContent = styled.div`
  max-width: 320px;
`;

const PopoverTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  margin-bottom: 2px;
`;

const PopoverDesc = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
`;

const PopoverSection = styled.div`
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--color-border), 0.3);
`;

const PopoverSectionTitle = styled.div`
  font-weight: 600;
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  margin-bottom: 6px;
`;

const ActionList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const ActionItem = styled.li<{ $clickable?: boolean }>`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 2px;
  padding: 4px 8px;
  border-radius: var(--radius-sm, 4px);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: ${({ $clickable }) => $clickable ? 'pointer' : 'default'};

  &::before {
    content: '→';
    margin-right: 4px;
    color: rgb(var(--color-primary));
    font-weight: 600;
    opacity: ${({ $clickable }) => $clickable ? 1 : 0.4};
  }

  ${({ $clickable }) => $clickable && `
    &:hover {
      background: rgba(var(--color-primary), 0.08);
      color: rgb(var(--color-primary));
    }
  `}
`;

const NoDocs = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-style: italic;
`;

const DocList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DocItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
`;

const DocDirection = styled.span`
  flex-shrink: 0;
`;

const DocIcon = styled.span`
  flex-shrink: 0;
  color: rgb(var(--color-text-secondary));
`;

const DocLink = styled.a`
  font-size: 12px;
  color: rgb(var(--color-primary));
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

const DocName = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default TradeWorkflowStepper;
