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
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
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
import { TradeLineageFlow } from '../Cockpit/TradeLineageFlow';
import { ProcessFlowHeader } from '../Cockpit/ProcessFlowHeader';
import { logger } from '@/utils/logger';
import { SupplierBidPanel } from './SupplierBidPanel';
import { TradeWorkflowStepper } from '../Workflow/TradeWorkflowStepper';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { WorkflowStatusBar } from '@/components/Workflow';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';

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

const ProductMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0 0.75rem 0.5rem;
`;

const MetaTag = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  background: rgba(var(--color-surface-hover), 0.5);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
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

interface ActionBannerConfig {
  icon: string;
  title: string;
  description: string;
  intent: 'info' | 'warning' | 'success';
}

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
};

const WorkflowActionBanner: React.FC<{ inquiry: Inquiry }> = ({ inquiry }) => {
  const config = INQUIRY_ACTION_MAP[inquiry.status];
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

  return (
    <ActionBannerContainer $borderColor={borderColor} $bgColor={bgColor}>
      <ActionBannerIcon>{config.icon}</ActionBannerIcon>
      <ActionBannerContent>
        <ActionBannerTitle>{config.title}</ActionBannerTitle>
        <ActionBannerDesc>{config.description}</ActionBannerDesc>
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

// ============================================================================
// Component
// ============================================================================

export const InquiryDetailModal: React.FC<InquiryDetailModalProps> = ({
  isOpen,
  onClose,
  inquiry,
  reviewMode = false,
  onUpdate,
  onClone,
}) => {
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const queryClient = useQueryClient();

  const handleFulfillmentClose = useCallback(() => setShowFulfillmentModal(false), []);

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
      <InquiryModalOverlay $open={isOpen} onClick={onClose}>
        <InquiryModalContainer data-testid="inquiry-detail-modal" $maxWidth={900} onClick={(e) => e.stopPropagation()}>
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
            <CloseButton type="button" onClick={onClose}>×</CloseButton>
          </ModalHeader>

          <ModalBody>
            {/* Contextual Action Banner — shows what the user needs to do at the current step */}
            <WorkflowActionBanner inquiry={inquiry} />

            {/* Trade Workflow Progress — shows where in the E2E process this inquiry is */}
            {inquiry.status !== 'rejected' && (
              <TradeWorkflowStepper
                tradeStatus={
                  inquiry.status === 'fulfilled' ? 'completed'
                    : inquiry.status === 'accepted' ? 'ordered'
                    : inquiry.status === 'quoted' ? 'quoted'
                    : 'initiated'
                }
                inquiryStatus={inquiry.status}
                compact
              />
            )}

            {/* Status & Actions — golden workflow component */}
            <Section>
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
            <Section>
              <SectionHeader>
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
                      {/* Fulfillment dates & ship-to */}
                      {(product.fulfillment_date_time || product.respond_by_date_time || product.ship_to_location_name) && (
                        <ProductMeta>
                          {product.fulfillment_date_time && (
                            <MetaTag>📦 Fulfill by: {formatDateLocal(product.fulfillment_date_time)}</MetaTag>
                          )}
                          {product.respond_by_date_time && (
                            <MetaTag>⏰ Bids due: {formatDateLocal(product.respond_by_date_time)}</MetaTag>
                          )}
                          {product.ship_to_location_name && (
                            <MetaTag>📍 Ship to: {product.ship_to_location_name}</MetaTag>
                          )}
                        </ProductMeta>
                      )}
                      {/* Supplier bids child panel */}
                      <SupplierBidPanel
                        product={product}
                        inquiryStatus={inquiry.status}
                        readOnly={inquiry.status === 'accepted' || inquiry.status === 'fulfilled'}
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

            {/* Trade Lineage Flow */}
            <Section>
              <SectionHeader>
                <SectionTitle>Process Flow</SectionTitle>
              </SectionHeader>
              <ProcessFlowHeader inquiryId={String(inquiry.id)} />
              <TradeLineageFlow inquiryId={String(inquiry.id)} compact />
            </Section>

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
