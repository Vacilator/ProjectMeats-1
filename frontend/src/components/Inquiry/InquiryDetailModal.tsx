/**
 * Inquiry Detail Modal
 *
 * Modal for viewing and managing inquiry details.
 * Features:
 * - View inquiry information and products
 * - Status workflow actions (update status)
 * - Create fulfillment from accepted inquiry
 * - Clone inquiry
 * - Edit contact and notes
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { message } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { formatDateLocal } from '@/utils/formatters';
import {
  Inquiry,
  InquiryProduct,
  InquiryStatus,
} from '../../types';
import { inquiryService } from '../../services/inquiryService';
import { CreateFulfillmentModal } from '../Fulfillment';
import { InquiryModalContainer, InquiryModalOverlay } from './InquiryModalFrame';
import {
  formatCurrencyValue,
  formatFixedWithFallback,
  formatIntegerValue,
} from './numberFormatting';
import { ProcessFlowHeader } from '../Cockpit/ProcessFlowHeader';
import { logger } from '@/utils/logger';
import { SupplierBidPanel } from './SupplierBidPanel';
import { ProductShipToField } from './ProductShipToField';
import { TradeWorkflowStepper } from '../Workflow/TradeWorkflowStepper';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { WorkflowStatusBar } from '@/components/Workflow';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';
import { TradeDocumentsPanel } from '../Trader/TradeDocumentsPanel';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface InquiryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  inquiry: Inquiry | null;
  reviewMode?: boolean;
  onUpdate?: (inquiry: Inquiry) => void;
  onClone?: (inquiry: Inquiry) => void;
}

// ============================================================================
// Styled Components
// ============================================================================


const ModalHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: sticky;
  top: 0;
  background: rgb(var(--color-surface));
  z-index: 10;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const HeaderMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0.25rem;
  border-radius: var(--radius-md);

  &:hover {
    color: rgb(var(--color-text-primary));
    background: rgba(var(--color-text-primary), 0.1);
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 1.5rem;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  .label {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .value {
    font-size: 0.875rem;
    color: rgb(var(--color-text-primary));
    font-weight: 500;
  }
`;

const ProductsTable = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const ProductsHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(var(--color-primary), 0.1);
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const ProductRowWrapper = styled.div`
  border-bottom: 1px solid rgb(var(--color-border));
  &:last-child {
    border-bottom: none;
  }
`;

const ProductRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  align-items: center;

  &:hover {
    background: rgba(var(--color-primary), 0.02);
  }
`;

const ProductInfo = styled.div`
  .code {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
  }

  .description {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
  }
`;

const PriceCell = styled.div<{ variant?: 'desired' | 'actual' }>`
  font-size: 0.875rem;
  color: ${props => props.variant === 'actual'
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-info))'};
  font-weight: 500;
`;

const MarginCell = styled.div<{ $positive?: boolean }>`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.$positive ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))'};
`;

const TotalsRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(var(--color-primary), 0.05);
  font-weight: 600;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'success' | 'danger' }>`
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: all 0.2s;

  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: rgb(var(--color-text-inverse));
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'success':
        return `
          background: rgb(var(--color-success));
          color: rgb(var(--color-text-inverse));
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'danger':
        return `
          background: rgb(var(--color-error));
          color: rgb(var(--color-text-inverse));
          border: none;
          &:hover { opacity: 0.9; }
        `;
      default:
        return `
          background: transparent;
          color: rgb(var(--color-text-primary));
          border: 1px solid rgb(var(--color-border));
          &:hover { background: rgba(var(--color-text-primary), 0.05); }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalFooter = styled.div`
  padding: 1.5rem;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  bottom: 0;
  background: rgb(var(--color-surface));
`;

const FooterLeft = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const FooterRight = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const CloseModalButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-text-primary), 0.05);
  }
`;

const NotesBox = styled.div`
  background: rgba(var(--color-text-secondary), 0.05);
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 1rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
`;

const EmptyNotes = styled.div`
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;

// ReviewBanner removed — replaced by contextual WorkflowActionBanner

// ============================================================================
// Contextual Action Banner — shows what the trader needs to do next
// ============================================================================

const INQUIRY_ACTION_MAP: Record<string, ActionBannerConfig> = {
  draft: {
    icon: '📝',
    title: 'Complete Inquiry Details',
    description: 'Add products, set pricing, and review customer details. When ready, send the quote to the customer.',
    intent: 'info',
  },
  pending: {
    icon: '📝',
    title: 'Complete Inquiry Details',
    description: 'Add products, set pricing, and review customer details. When ready, send the quote to the customer.',
    intent: 'info',
  },
  quoted: {
    icon: '⏳',
    title: 'Awaiting Customer Response',
    description: 'Quote has been sent. When the customer accepts, click "Accept Deal" to auto-create a Purchase Order and advance the trade.',
    intent: 'warning',
  },
  accepted: {
    icon: '✅',
    title: 'Deal Accepted — Purchase Order Created',
    description: 'This inquiry has been accepted. A Purchase Order has been auto-created. Navigate to the PO to continue the trade workflow.',
    intent: 'success',
  },
  fulfilled: {
    icon: '🏆',
    title: 'Inquiry Fulfilled',
    description: 'This inquiry has been fully fulfilled. All deliveries are complete.',
    intent: 'success',
  },
  rejected: {
    icon: '❌',
    title: 'Inquiry Rejected',
    description: 'This inquiry was rejected. You can clone it to start a new version if needed.',
    intent: 'warning',
  },
  cancelled: {
    icon: '🚫',
    title: 'Inquiry Cancelled',
    description: 'This inquiry has been cancelled. No further action is needed.',
    intent: 'warning',
  },
};

interface ActionBannerConfig {
  icon: string;
  title: string;
  description: string;
  intent: 'info' | 'warning' | 'success';
  /** If set, the banner shows a "Go to…" CTA pointing to this entity type */
  navigateTo?: 'purchase_order' | 'sales_order' | 'carrier_po' | 'fulfillment' | 'invoice';
  /** If set, the banner shows a CTA that scrolls to a section within the modal */
  scrollToId?: string;
  scrollToLabel?: string;
}

/** Extended action guidance based on trade session orchestrator step */
const TRADE_STEP_ACTION_MAP: Record<string, ActionBannerConfig> = {
  supplier_rfq: {
    icon: '📤',
    title: 'Request Supplier Bids',
    description: 'Add suppliers to products, set respond-by dates, and send bid requests. Await supplier responses.',
    intent: 'info',
    scrollToId: 'supplier-bids-section',
    scrollToLabel: 'Go to Supplier Bids ↓',
  },
  supplier_reply_parse: {
    icon: '📥',
    title: 'Awaiting Supplier Replies',
    description: 'Bid requests have been sent. Supplier responses will be auto-parsed when received via email.',
    intent: 'warning',
    scrollToId: 'supplier-bids-section',
    scrollToLabel: 'View Bid Status ↓',
  },
  draft_supplier_po: {
    icon: '🛒',
    title: 'Purchase Order Pending Approval',
    description: 'Review the auto-generated Purchase Order and approve it to advance to the next stage.',
    intent: 'info',
    navigateTo: 'purchase_order',
  },
  approve_supplier_po: {
    icon: '✍️',
    title: 'Approve Purchase Order',
    description: 'The PO is ready for approval. Once approved, a Sales Order will be auto-created for the customer.',
    intent: 'warning',
    navigateTo: 'purchase_order',
  },
  draft_sales_order: {
    icon: '📋',
    title: 'Sales Order Created',
    description: 'Review the Sales Order details and get customer confirmation before approving.',
    intent: 'info',
    navigateTo: 'sales_order',
  },
  approve_sales_order: {
    icon: '✍️',
    title: 'Approve Sales Order',
    description: 'The SO is ready for approval. Once approved, carrier logistics will be arranged.',
    intent: 'warning',
    navigateTo: 'sales_order',
  },
  carrier_fan_out: {
    icon: '🚛',
    title: 'Arrange Carrier Logistics',
    description: 'Select a carrier, confirm pickup/delivery schedule, and create the Carrier PO.',
    intent: 'info',
    navigateTo: 'carrier_po',
  },
  carrier_reply_parse: {
    icon: '📥',
    title: 'Awaiting Carrier Confirmation',
    description: 'Carrier inquiry has been sent. Awaiting confirmation of pickup/delivery schedule.',
    intent: 'warning',
    navigateTo: 'carrier_po',
  },
  draft_carrier_po: {
    icon: '🚛',
    title: 'Carrier PO Pending Approval',
    description: 'Review and approve the Carrier PO to begin fulfillment.',
    intent: 'info',
    navigateTo: 'carrier_po',
  },
  completed: {
    icon: '🏆',
    title: 'Trade Completed',
    description: 'All stages of this trade have been completed successfully. View the fulfillment and invoice records below.',
    intent: 'success',
    navigateTo: 'fulfillment',
  },
};

const NAVIGATE_TO_LABELS: Record<string, { label: string; field: string; prefix: string }> = {
  purchase_order: { label: 'Go to Purchase Order', field: 'supplier_purchase_order', prefix: '/records/purchase_order' },
  sales_order: { label: 'Go to Sales Order', field: 'sales_order', prefix: '/records/sales_order' },
  carrier_po: { label: 'Go to Carrier PO', field: 'carrier_purchase_order', prefix: '/records/carrier' },
  fulfillment: { label: 'Go to Fulfillment', field: 'fulfillment_id', prefix: '/records/fulfillment' },
  invoice: { label: 'Go to Invoice', field: 'invoice_id', prefix: '/records/invoice' },
};

const WorkflowActionBanner: React.FC<{
  inquiry: Inquiry;
  onNavigate?: (path: string) => void;
}> = ({ inquiry, onNavigate }) => {
  // Prefer trade-step-level guidance when the inquiry has been accepted and trade session is active
  const tradeStep = inquiry.trade_session_current_step;
  const config = (tradeStep && TRADE_STEP_ACTION_MAP[tradeStep])
    || INQUIRY_ACTION_MAP[inquiry.status];
  if (!config) return null;

  const borderColor = config.intent === 'success'
    ? 'var(--color-success)'
    : config.intent === 'warning'
    ? 'var(--color-warning)'
    : 'var(--color-info)';
  const bgColor = config.intent === 'success'
    ? 'var(--color-success)'
    : config.intent === 'warning'
    ? 'var(--color-warning)'
    : 'var(--color-info)';

  // Resolve navigation CTA if config specifies a linked entity
  const navTarget = config.navigateTo ? NAVIGATE_TO_LABELS[config.navigateTo] : null;
  const linkedEntityId = navTarget
    ? String((inquiry as unknown as Record<string, unknown>)[navTarget.field] ?? '')
    : '';

  return (
    <ActionBannerContainer $borderColor={borderColor} $bgColor={bgColor}>
      <ActionBannerIcon>{config.icon}</ActionBannerIcon>
      <ActionBannerContent>
        <ActionBannerTitle>{config.title}</ActionBannerTitle>
        <ActionBannerDesc>{config.description}</ActionBannerDesc>
        {navTarget && linkedEntityId && onNavigate && (
          <ActionBannerCTA
            onClick={() => onNavigate(`${navTarget.prefix}/${linkedEntityId}`)}
            aria-label={navTarget.label}
          >
            {navTarget.label} →
          </ActionBannerCTA>
        )}
        {config.scrollToId && (
          <ActionBannerCTA
            onClick={() => {
              document.getElementById(config.scrollToId!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            aria-label={config.scrollToLabel ?? 'Scroll to section'}
          >
            {config.scrollToLabel ?? 'Go to Section ↓'}
          </ActionBannerCTA>
        )}
      </ActionBannerContent>
    </ActionBannerContainer>
  );
};

const ActionBannerContainer = styled.div<{ $borderColor: string; $bgColor: string }>`
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid rgba(${(p) => p.$borderColor}, 0.4);
  background: rgba(${(p) => p.$bgColor}, 0.08);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`;

const ActionBannerIcon = styled.span`
  font-size: 1.25rem;
  line-height: 1.4;
  flex-shrink: 0;
`;

const ActionBannerContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionBannerTitle = styled.strong`
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9375rem;
  color: rgb(var(--color-text-primary));
`;

const ActionBannerDesc = styled.span`
  display: block;
  font-size: 0.8125rem;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const ActionBannerCTA = styled.button`
  display: inline-flex;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground, 255 255 255));
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.85; }
  &:focus-visible { outline: 2px solid rgb(var(--color-primary)); outline-offset: 2px; }
`;

// ============================================================================
// Component
// ============================================================================

export const InquiryDetailModal: React.FC<InquiryDetailModalProps> = ({
  isOpen,
  onClose,
  inquiry,
  reviewMode: _reviewMode = false,
  onUpdate,
  onClone,
}) => {
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [_updatingStatus, setUpdatingStatus] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: trap focus inside modal and restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the close button or first focusable element after mount
      requestAnimationFrame(() => {
        const closeBtn = modalRef.current?.querySelector<HTMLElement>('[aria-label="Close inquiry details"]');
        closeBtn?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: Tab/Shift+Tab cycle within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleFulfillmentClose = useCallback(() => setShowFulfillmentModal(false), []);

  /** Navigate to linked entity record when a stepper action is clicked */
  const handleStepperActionClick = useCallback(
    (action: { label: string; section?: string }, step: { key: string; entityType?: string }) => {
      if (!inquiry) return;

      // Map step keys to entity record paths using linked FKs on the inquiry
      const STEP_ENTITY_MAP: Record<string, { field: string; prefix: string }> = {
        purchase_order: { field: 'supplier_purchase_order', prefix: '/records/purchase_order' },
        sales_order: { field: 'sales_order', prefix: '/records/sales_order' },
        carrier_po: { field: 'carrier_purchase_order', prefix: '/records/carrier' },
        fulfillment: { field: 'fulfillment_id', prefix: '/records/fulfillment' },
        invoice: { field: 'invoice_id', prefix: '/records/invoice' },
      };

      const mapping = STEP_ENTITY_MAP[step.key];
      if (mapping) {
        const entityId = (inquiry as unknown as Record<string, unknown>)[mapping.field];
        if (entityId) {
          onClose();
          navigate(`${mapping.prefix}/${entityId}`);
          return;
        }
      }

      // For inquiry step or if no linked entity yet, scroll to relevant section
      if (action.section) {
        const el = document.getElementById(action.section);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [inquiry, navigate, onClose],
  );

  if (!isOpen || !inquiry) return null;

  const handleStatusUpdate = async (newStatus: InquiryStatus) => {
    setUpdatingStatus(true);
    try {
      const response = await inquiryService.updateInquiryStatus(String(inquiry.id), newStatus);
      const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      message.success(`Inquiry marked as ${statusLabel}`);
      if (onUpdate) {
        onUpdate(response);
      }
    } catch (err) {
      logger.error('Failed to update status:', err);
      message.error('Failed to update inquiry status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFulfillmentSuccess = () => {
    setShowFulfillmentModal(false);
    // Update inquiry status to fulfilled
    handleStatusUpdate('fulfilled');
  };

  const canCreateFulfillment = inquiry.status === 'accepted';

  return (
    <>
      <InquiryModalOverlay $open={isOpen} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Inquiry ${inquiry.inquiry_number} details`}>
        <InquiryModalContainer ref={modalRef} data-testid="inquiry-detail-modal" $maxWidth={900} onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <HeaderLeft>
              <ModalTitle>
                📋 {inquiry.inquiry_number}
              </ModalTitle>
              <HeaderMeta>
                <span>Created {formatDateLocal(inquiry.created_on)}</span>
                {inquiry.created_by_name && <span>by {inquiry.created_by_name}</span>}
              </HeaderMeta>
            </HeaderLeft>
            <CloseButton type="button" onClick={onClose} aria-label="Close inquiry details">×</CloseButton>
          </ModalHeader>

          <ModalBody>
            {/* Contextual Action Banner — shows what the user needs to do at the current step */}
            <WorkflowActionBanner
              inquiry={inquiry}
              onNavigate={(path) => { onClose(); navigate(path); }}
            />

            {/* Trade Workflow Progress — shows where in the E2E process this inquiry is */}
            {inquiry.status !== 'rejected' && (
              <TradeWorkflowStepper
                tradeStatus={inquiry.trade_session_status || (
                  inquiry.status === 'fulfilled' ? 'completed'
                    : inquiry.status === 'accepted' ? 'ordered'
                    : inquiry.status === 'quoted' ? 'quoted'
                    : 'initiated'
                )}
                currentStep={inquiry.trade_session_current_step ?? undefined}
                inquiryStatus={inquiry.status}
                tradeSessionId={inquiry.trade_session_id ?? undefined}
                onActionClick={handleStepperActionClick}
                compact
              />
            )}

            {/* Status & Actions — golden workflow component */}
            <Section id="actions">
              <WorkflowStatusBar
                entityType="inquiry"
                entityId={String(inquiry.id)}
                compact
                onTransitioned={() => {
                  // Refresh lineage flow + trades after status change
                  void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-lineage') });
                  void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trades') });
                  onUpdate?.(inquiry);
                }}
              />
            </Section>

            {/* Customer/Supplier Info */}
            <Section>
              <SectionHeader>
                <SectionTitle>
                  {inquiry.entity_type === 'customer' ? 'Customer' : 'Supplier'} Information
                </SectionTitle>
              </SectionHeader>

              <InfoGrid>
                <InfoItem>
                  <span className="label">{inquiry.entity_type === 'customer' ? 'Customer' : 'Supplier'}</span>
                  <span className="value">{inquiry.customer_name || inquiry.supplier_name || '-'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Contact</span>
                  <span className="value">{inquiry.contact_snapshot_name || inquiry.contact_name || '-'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Email</span>
                  <span className="value">{inquiry.contact_snapshot_email || '-'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Phone</span>
                  <span className="value">{inquiry.contact_snapshot_phone || '-'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Source</span>
                  <span className="value">{inquiry.source.replace(/_/g, ' ')}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Route Decision</span>
                  <span className="value">{inquiry.route_decision || 'BROKER'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Requested Protein</span>
                  <span className="value">{inquiry.requested_protein || '-'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Source Email Message ID</span>
                  <span className="value">{inquiry.source_email_message_id || '-'}</span>
                </InfoItem>
                <InfoItem>
                  <span className="label">Valid Until</span>
                  <span className="value" style={{ color: inquiry.is_expired ? 'rgb(var(--color-error))' : undefined }}>
                    {formatDateLocal(inquiry.valid_until)} {inquiry.is_expired && '(Expired)'}
                  </span>
                </InfoItem>
              </InfoGrid>
            </Section>

            {/* Products */}
            <Section id="products">
              <SectionHeader id="supplier-bids-section">
                <SectionTitle>Products ({inquiry.products?.length || 0})</SectionTitle>
              </SectionHeader>

              {inquiry.products && inquiry.products.length > 0 ? (
                <ProductsTable>
                  <ProductsHeader>
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Desired Price</span>
                    <span>Actual Price</span>
                    <span>Line Total</span>
                    <span>Margin</span>
                  </ProductsHeader>

                  {inquiry.products.map((product: InquiryProduct) => (
                    <ProductRowWrapper key={product.id}>
                      <ProductRow>
                        <ProductInfo>
                          <div className="code">{product.product_code}</div>
                          <div className="description">{product.product_description}</div>
                        </ProductInfo>
                        <div>{formatIntegerValue(product.quantity)}</div>
                        <PriceCell variant="desired">
                          {formatCurrencyValue(product.desired_price_per_unit)}
                        </PriceCell>
                        <PriceCell variant="actual">
                          {formatCurrencyValue(product.actual_price_per_unit)}
                        </PriceCell>
                        <div>{formatCurrencyValue(product.actual_total ?? product.desired_total)}</div>
                        <MarginCell $positive={(product.margin || 0) >= 0}>
                          {product.margin !== undefined
                            ? `${product.margin >= 0 ? '+' : ''}${formatCurrencyValue(product.margin)}`
                            : '-'}
                          {product.margin_percent !== undefined &&
                            ` (${formatFixedWithFallback(product.margin_percent, 1)}%)`}
                        </MarginCell>
                      </ProductRow>
                      {/* Ship-to location at product level — interactive dropdown with "Add Location" */}
                      <ProductShipToField
                        product={product}
                        customerId={inquiry.customer}
                        readOnly={
                          inquiry.status === 'fulfilled' ||
                          inquiry.status === 'accepted'
                        }
                      />
                      {/* Supplier bids child panel */}
                      <SupplierBidPanel
                        product={product}
                        inquiryStatus={inquiry.status}
                        readOnly={
                          inquiry.status === 'fulfilled' ||
                          (inquiry.status === 'accepted' && !['supplier_rfq', 'supplier_reply_parse'].includes(inquiry.trade_session_current_step ?? ''))
                        }
                      />
                    </ProductRowWrapper>
                  ))}

                  <TotalsRow>
                    <div>Total</div>
                    <div />
                    <PriceCell variant="desired">{formatCurrencyValue(inquiry.total_desired)}</PriceCell>
                    <PriceCell variant="actual">{formatCurrencyValue(inquiry.total_actual)}</PriceCell>
                    <div>{formatCurrencyValue(inquiry.total_actual ?? inquiry.total_desired)}</div>
                    <MarginCell $positive={(inquiry.total_margin || 0) >= 0}>
                      {inquiry.total_margin !== undefined
                        ? `${inquiry.total_margin >= 0 ? '+' : ''}${formatCurrencyValue(inquiry.total_margin)}`
                        : '-'}
                    </MarginCell>
                  </TotalsRow>
                </ProductsTable>
              ) : (
                <EmptyNotes>No products added to this inquiry.</EmptyNotes>
              )}
            </Section>

            {/* Competitor Info */}
            {(inquiry.competitor_names || inquiry.competitor_pricing_notes) && (
              <Section>
                <SectionHeader>
                  <SectionTitle>Competitor Information</SectionTitle>
                </SectionHeader>

                <InfoGrid>
                  {inquiry.competitor_names && (
                    <InfoItem>
                      <span className="label">Competitors</span>
                      <span className="value">{inquiry.competitor_names}</span>
                    </InfoItem>
                  )}
                </InfoGrid>
                {inquiry.competitor_pricing_notes && (
                  <NotesBox style={{ marginTop: '1rem' }}>
                    {inquiry.competitor_pricing_notes}
                  </NotesBox>
                )}
              </Section>
            )}

            {/* Workflow Progress (consolidated stepper) */}
            <Section>
              <SectionHeader>
                <SectionTitle>Workflow Progress</SectionTitle>
              </SectionHeader>
              <ProcessFlowHeader inquiryId={String(inquiry.id)} />
              <TradeWorkflowStepper
                tradeStatus={inquiry.trade_session_status ?? inquiry.status ?? 'pending'}
                currentStep={inquiry.trade_session_current_step ?? undefined}
                inquiryId={String(inquiry.id)}
                tradeSessionId={inquiry.trade_session_id ?? undefined}
                compact
              />
            </Section>

            {/* Trade Documents — grouped by stage, Sent/Received */}
            {inquiry.trade_session_id && (
              <Section id="trade-documents">
                <SectionHeader>
                  <SectionTitle>Trade Documents</SectionTitle>
                </SectionHeader>
                <TradeDocumentsPanel
                  entityType="inquiry"
                  entityId={String(inquiry.id)}
                  tradeSessionId={inquiry.trade_session_id}
                />
              </Section>
            )}

            {/* AI Insights & Workflow */}
            <Section>
              <AIEntityInsights entityType="inquiry" entityId={String(inquiry.id)} />
            </Section>

            <Section>
              <EntityWorkflowStatusPanel entityType="inquiry" entityId={String(inquiry.id)} />
            </Section>

            {/* Notes */}
            <Section>
              <SectionHeader>
                <SectionTitle>Notes</SectionTitle>
              </SectionHeader>

              {inquiry.notes ? (
                <NotesBox>{inquiry.notes}</NotesBox>
              ) : (
                <EmptyNotes>No notes added.</EmptyNotes>
              )}
            </Section>
          </ModalBody>

          <ModalFooter>
            <FooterLeft>
              {canCreateFulfillment && (
                <ActionButton
                  variant="success"
                  onClick={() => setShowFulfillmentModal(true)}
                >
                  📦 Create Fulfillment
                </ActionButton>
              )}
              {onClone && (
                <ActionButton
                  variant="secondary"
                  onClick={() => onClone(inquiry)}
                >
                  📋 Clone
                </ActionButton>
              )}
              <ActionButton
                variant="secondary"
                onClick={() => {
                  // Download PDF quote
                  window.open(`/api/v1/inquiries/${inquiry.id}/download-quote/`, '_blank', 'noopener,noreferrer');
                }}
              >
                📄 Download Quote
              </ActionButton>
            </FooterLeft>
            <FooterRight>
              <CloseModalButton onClick={onClose}>
                Close
              </CloseModalButton>
            </FooterRight>
          </ModalFooter>
        </InquiryModalContainer>
      </InquiryModalOverlay>

      {/* Fulfillment Modal */}
      {showFulfillmentModal && (
        <CreateFulfillmentModal
          isOpen={showFulfillmentModal}
          onClose={handleFulfillmentClose}
          onSuccess={handleFulfillmentSuccess}
          inquiry={inquiry}
        />
      )}
    </>
  );
};

export default InquiryDetailModal;
