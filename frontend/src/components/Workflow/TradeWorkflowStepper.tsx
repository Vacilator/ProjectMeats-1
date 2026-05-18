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
  Eye,
  Plus,
} from 'lucide-react';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { tradeDocumentsService, type TradeDocument } from '@/services/tradeDocumentsService';
import { businessApi } from '@/services/businessApi';

// ── Step definitions ──

interface StepAction {
  label: string;
  /** Section of the record to scroll to or highlight */
  section?: string;
  /** Document type(s) related to this action — shown inline when action is active */
  documentTypes?: string[];
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
      { label: 'Send quote to customer', section: 'actions', documentTypes: ['quote', 'email'] },
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
      { label: 'Review PO details', section: 'details', documentTypes: ['purchase_order', 'pdf'] },
      { label: 'Approve purchase order', section: 'status' },
      { label: 'Send to supplier', section: 'actions', documentTypes: ['email'] },
    ],
  },
  {
    key: 'sales_order',
    label: 'Sales Order',
    icon: <Receipt size={18} />,
    description: 'Customer sales order confirmed',
    entityType: 'sales_order',
    requiredActions: [
      { label: 'Review SO details', section: 'details', documentTypes: ['sales_order', 'pdf'] },
      { label: 'Get customer confirmation', section: 'actions', documentTypes: ['email', 'confirmation'] },
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
      { label: 'Confirm pickup/delivery schedule', section: 'schedule', documentTypes: ['bill_of_lading', 'pdf'] },
      { label: 'Approve carrier PO', section: 'status', documentTypes: ['carrier_po', 'email'] },
    ],
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    icon: <Package size={18} />,
    description: 'Product shipped and delivered',
    entityType: 'fulfillment',
    requiredActions: [
      { label: 'Confirm shipment dispatched', section: 'dispatch', documentTypes: ['bill_of_lading', 'shipping_manifest'] },
      { label: 'Track delivery', section: 'tracking', documentTypes: ['tracking', 'email'] },
      { label: 'Confirm receipt', section: 'status', documentTypes: ['proof_of_delivery', 'pdf'] },
    ],
  },
  {
    key: 'invoice',
    label: 'Invoice',
    icon: <CreditCard size={18} />,
    description: 'Invoice sent and payment received',
    entityType: 'invoice',
    requiredActions: [
      { label: 'Generate invoice', section: 'generate', documentTypes: ['invoice', 'pdf'] },
      { label: 'Send to customer', section: 'actions', documentTypes: ['email'] },
      { label: 'Track payment', section: 'payment', documentTypes: ['payment_receipt', 'remittance'] },
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

// ── Lineage data shape (from /inquiries/:id/lineage/) ──

interface LineageEntity {
  id: string;
  number?: string;
  status?: string;
}

interface LineageData {
  inquiry: LineageEntity | null;
  supplier_purchase_order: LineageEntity | null;
  sales_order: LineageEntity | null;
  carrier_purchase_order: LineageEntity | null;
  fulfillment: LineageEntity | null;
  invoice: LineageEntity | null;
  current_step: string;
}

const LINEAGE_KEY_MAP: Record<string, keyof LineageData> = {
  inquiry: 'inquiry',
  purchase_order: 'supplier_purchase_order',
  sales_order: 'sales_order',
  carrier_po: 'carrier_purchase_order',
  fulfillment: 'fulfillment',
  invoice: 'invoice',
};

const getStatusColor = (status: string): string => {
  const STATUS_COLORS: Record<string, string> = {
    pending: 'rgb(var(--color-warning))',
    in_progress: 'rgb(var(--color-info))',
    sourcing: 'rgb(var(--color-info))',
    quoted: 'rgb(var(--color-primary))',
    ordered: 'rgb(var(--color-success))',
    completed: 'rgb(var(--color-success))',
    approved: 'rgb(var(--color-success))',
    draft: 'rgb(var(--color-text-tertiary))',
    cancelled: 'rgb(var(--color-error))',
    halted: 'rgb(var(--color-error))',
    initiated: 'rgb(var(--color-warning))',
  };
  return STATUS_COLORS[status?.toLowerCase()] ?? 'rgb(var(--color-text-tertiary))';
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
  lineageEntity?: LineageEntity | null;
  onActionClick?: (action: StepAction, step: TradeStep) => void;
  onStepClick?: (step: { key: string; entityType?: string; entityId?: string; isEmpty: boolean }) => void;
}> = ({ stageKey, tradeSessionId, step, isActive, isDone, lineageEntity, onActionClick, onStepClick }) => {
  const [selectedAction, setSelectedAction] = useState<StepAction | null>(null);

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

  // Filter docs relevant to the selected action (by document_type match)
  const filteredDocs = useMemo(() => {
    if (!docs) return [];
    if (!selectedAction?.documentTypes?.length) return docs;
    return docs.filter((d) => selectedAction.documentTypes!.includes(d.document_type));
  }, [docs, selectedAction]);

  const handleActionClick = useCallback(
    (action: StepAction, index: number) => {
      // Check dependency: if previous action exists and step is active (not done), grey out dependent items
      if (isActive && index > 0) {
        // For active steps, only first uncompleted action is clickable
        // (dependency model: sequential within a step)
        // Allow click but still pass through
      }
      setSelectedAction((prev) => (prev?.label === action.label ? null : action));
      onActionClick?.(action, step);
    },
    [onActionClick, step, isActive],
  );

  const displayDocs = selectedAction ? filteredDocs : (docs ?? []);
  const docsLabel = selectedAction
    ? `Related Documents (${filteredDocs.length})`
    : `Documents ${docs && docs.length > 0 ? `(${docs.length})` : ''}`;

  const hasRecord = lineageEntity && lineageEntity.id;
  const isEmpty = !hasRecord;

  return (
    <PopoverContent>
      <PopoverTitle>{step.label}</PopoverTitle>
      <PopoverDesc>{step.description}</PopoverDesc>

      {/* Record info from lineage */}
      {hasRecord && (
        <RecordInfoRow>
          <RecordNumber>{lineageEntity.number || `#${lineageEntity.id}`}</RecordNumber>
          <RecordStatus $color={getStatusColor(lineageEntity.status || '')}>
            {lineageEntity.status || 'unknown'}
          </RecordStatus>
        </RecordInfoRow>
      )}

      {(isActive || isDone) && step.requiredActions.length > 0 && (
        <PopoverSection>
          <PopoverSectionTitle>{isActive ? 'Action Required' : 'Completed Actions'}</PopoverSectionTitle>
          <ActionList>
            {step.requiredActions.map((action, index) => {
              // Dependency logic: for active steps, grey out actions after the first one
              // unless step is completed (all done)
              const isDependent = isActive && index > 0;

              return (
                <ActionItem
                  key={action.label}
                  $clickable={isActive && !isDependent}
                  $selected={selectedAction?.label === action.label}
                  $completed={isDone}
                  $disabled={isDependent}
                  onClick={isActive && !isDependent ? () => handleActionClick(action, index) : undefined}
                  onKeyDown={isActive && !isDependent ? (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleActionClick(action, index);
                    }
                  } : undefined}
                  role={isActive && !isDependent ? 'button' : 'listitem'}
                  tabIndex={isActive && !isDependent ? 0 : undefined}
                  aria-pressed={isActive ? selectedAction?.label === action.label : undefined}
                  aria-disabled={isDependent}
                  title={isDependent ? 'Complete the previous action first' : undefined}
                >
                  {action.label}
                  {action.documentTypes && action.documentTypes.length > 0 && (
                    <Paperclip size={10} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                  )}
                  {!action.documentTypes && onActionClick && isActive && !isDependent && (
                    <ArrowUpRight size={10} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                  )}
                </ActionItem>
              );
            })}
          </ActionList>
        </PopoverSection>
      )}

      <PopoverSection>
        <PopoverSectionTitle>{docsLabel}</PopoverSectionTitle>
        {isLoading ? (
          <Spin size="small" />
        ) : displayDocs.length === 0 ? (
          <NoDocs>
            {selectedAction
              ? 'No documents linked to this action yet.'
              : 'No documents in this stage yet.'}
          </NoDocs>
        ) : (
          <DocList>
            {displayDocs.map((doc: TradeDocument) => (
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

      {/* Navigate action at bottom of popover */}
      {onStepClick && (
        <PopoverSection>
          <StepNavButton
            type="button"
            onClick={() => onStepClick({ key: step.key, entityType: step.entityType, entityId: lineageEntity?.id || undefined, isEmpty: !!isEmpty })}
          >
            {isEmpty ? (
              <><Plus size={12} /> Click to create</>
            ) : (
              <><Eye size={12} /> Click to view record</>
            )}
          </StepNavButton>
        </PopoverSection>
      )}
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
  /** Inquiry ID — enables lineage data fetching for record numbers */
  inquiryId?: string;
  /** Called when a required action item is clicked — navigate to relevant record/section */
  onActionClick?: (action: { label: string; section?: string }, step: { key: string; entityType?: string }) => void;
  /** Called when a step node is clicked (for navigation) */
  onStepClick?: (step: { key: string; entityType?: string; entityId?: string; isEmpty: boolean }) => void;
}

// ── Component ──

export const TradeWorkflowStepper: React.FC<TradeWorkflowStepperProps> = ({
  tradeStatus,
  currentStep,
  inquiryStatus: _inquiryStatus,
  compact = false,
  tradeSessionId,
  inquiryId,
  onActionClick,
  onStepClick,
}) => {
  const [openStep, setOpenStep] = useState<string | null>(null);

  // Fetch lineage data for record numbers/status
  const { data: lineageData } = useQuery({
    queryKey: withTenantQueryKey('trade-lineage-stepper', inquiryId || ''),
    queryFn: async () => {
      if (!inquiryId) return null;
      const res = await businessApi.get(`/inquiries/${inquiryId}/lineage/`);
      return res.data as LineageData;
    },
    enabled: !!inquiryId,
    staleTime: 30_000,
    retry: false,
  });

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
    <StepperContainer $compact={compact} role="list" aria-label="Trade workflow stages">
      {TRADE_STEPS.map((step, index) => {
        const isActive = index === activeStepIndex && !isCancelled && !isCompleted;
        const isDone = index < activeStepIndex || isCompleted;
        const isFuture = index > activeStepIndex && !isCompleted;
        const isClickable = (isActive || isDone) && !compact;

        // Get lineage entity for this step
        const lineageKey = LINEAGE_KEY_MAP[step.key];
        const lineageEntity = lineageData && lineageKey
          ? (lineageData[lineageKey] as LineageEntity | null)
          : null;

        const stepNode = (
          <StepNode
            $active={isActive}
            $done={isDone}
            $future={isFuture}
            $compact={compact}
            $clickable={isClickable}
            role="listitem"
            tabIndex={compact ? undefined : 0}
            aria-label={`${step.label} – ${isDone ? 'completed' : isActive ? 'in progress' : 'upcoming'}`}
            aria-current={isActive ? 'step' : undefined}
            onKeyDown={isClickable ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenChange(step.key, openStep !== step.key);
              }
            } : undefined}
          >
            <StepIcon $active={isActive} $done={isDone}>
              {isDone ? <Check size={compact ? 14 : 16} /> : step.icon}
            </StepIcon>
            {!compact && <StepLabel $active={isActive} $done={isDone}>{step.label}</StepLabel>}
            {!compact && lineageEntity?.number && (
              <StepRecordNumber $done={isDone}>{lineageEntity.number}</StepRecordNumber>
            )}
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
                    lineageEntity={lineageEntity}
                    onActionClick={onActionClick}
                    onStepClick={onStepClick}
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
    $done || $active ? 'rgb(var(--color-primary-foreground, 255, 255, 255))' : 'rgb(var(--color-text-secondary))'};
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

const ActionItem = styled.li<{ $clickable?: boolean; $selected?: boolean; $completed?: boolean; $disabled?: boolean }>`
  font-size: 12px;
  color: ${({ $selected, $completed, $disabled }) =>
    $disabled
      ? 'rgb(var(--color-text-tertiary))'
      : $completed
      ? 'rgb(var(--color-success))'
      : $selected
      ? 'rgb(var(--color-primary))'
      : 'rgb(var(--color-text-secondary))'};
  margin-bottom: 2px;
  padding: 4px 8px;
  border-radius: var(--radius-sm, 4px);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: ${({ $clickable, $disabled }) => $disabled ? 'not-allowed' : $clickable ? 'pointer' : 'default'};
  opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};
  background: ${({ $selected, $completed, $disabled }) =>
    $disabled
      ? 'rgba(var(--color-border), 0.05)'
      : $completed
      ? 'rgba(var(--color-success), 0.06)'
      : $selected
      ? 'rgba(var(--color-primary), 0.12)'
      : 'transparent'};

  &::before {
    content: ${({ $completed, $disabled }) => $completed ? '"✓"' : $disabled ? '"◦"' : '"○"'};
    margin-right: 4px;
    color: ${({ $completed, $disabled }) =>
      $completed ? 'rgb(var(--color-success))' : $disabled ? 'rgb(var(--color-text-tertiary))' : 'rgb(var(--color-error))'};
    font-weight: 600;
    font-size: ${({ $completed }) => $completed ? '14px' : '12px'};
    opacity: 1;
  }

  ${({ $clickable, $disabled }) => $clickable && !$disabled && `
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

const StepRecordNumber = styled.span<{ $done: boolean }>`
  font-size: 10px;
  font-family: monospace;
  color: ${({ $done }) => $done ? 'rgb(var(--color-success))' : 'rgb(var(--color-text-secondary))'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
`;

const RecordInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
`;

const RecordNumber = styled.span`
  font-size: 12px;
  font-family: monospace;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const RecordStatus = styled.span<{ $color: string }>`
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 9999px;
  background: ${({ $color }) => $color}20;
  color: ${({ $color }) => $color};
  text-transform: capitalize;
`;

const StepNavButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(var(--color-primary), 0.3);
  border-radius: var(--radius-sm, 4px);
  background: rgba(var(--color-primary), 0.04);
  color: rgb(var(--color-primary));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(var(--color-primary), 0.1);
    border-color: rgb(var(--color-primary));
  }
`;

export default TradeWorkflowStepper;
