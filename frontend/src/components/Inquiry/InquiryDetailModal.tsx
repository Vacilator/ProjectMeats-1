/**
 * Inquiry Detail Modal
 * 
 * Modal for viewing and managing inquiry details.
 * Features:
 * - View inquiry information and products
 * - Status workflow actions (update status)
 * - Create fulfillment from accepted inquiry
 * - Edit contact and notes
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService';
import { 
  Inquiry, 
  InquiryProduct,
  InquiryStatus,
} from '../../types';
import { CreateFulfillmentModal } from '../Fulfillment';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface InquiryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  inquiry: Inquiry | null;
  onUpdate?: (inquiry: Inquiry) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div<{ isOpen: boolean }>`
  display: ${props => props.isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
`;

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

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgba(34, 197, 94, 0.1)';
      case 'fulfilled': return 'rgba(34, 197, 94, 0.2)';
      case 'pending': return 'rgba(234, 179, 8, 0.1)';
      case 'quoted': return 'rgba(59, 130, 246, 0.1)';
      case 'rejected': return 'rgba(239, 68, 68, 0.1)';
      case 'expired': return 'rgba(107, 114, 128, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgb(22, 163, 74)';
      case 'fulfilled': return 'rgb(22, 163, 74)';
      case 'pending': return 'rgb(202, 138, 4)';
      case 'quoted': return 'rgb(37, 99, 235)';
      case 'rejected': return 'rgb(220, 38, 38)';
      case 'expired': return 'rgb(75, 85, 99)';
      default: return 'rgb(75, 85, 99)';
    }
  }};
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

const ProductRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgb(var(--color-border));
  align-items: center;
  
  &:last-child {
    border-bottom: none;
  }
  
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
    ? 'rgb(22, 163, 74)' 
    : 'rgb(37, 99, 235)'};
  font-weight: 500;
`;

const MarginCell = styled.div<{ positive?: boolean }>`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.positive ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)'};
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
          color: white;
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'success':
        return `
          background: rgb(22, 163, 74);
          color: white;
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'danger':
        return `
          background: rgb(220, 38, 38);
          color: white;
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

const StatusActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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

// ============================================================================
// Component
// ============================================================================

export const InquiryDetailModal: React.FC<InquiryDetailModalProps> = ({
  isOpen,
  onClose,
  inquiry,
  onUpdate,
}) => {
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!isOpen || !inquiry) return null;

  const handleStatusUpdate = async (newStatus: InquiryStatus) => {
    setUpdatingStatus(true);
    try {
      const response = await apiClient.post(`inquiries/${inquiry.id}/update-status/`, {
        status: newStatus,
      });
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFulfillmentSuccess = (fulfillment: any) => {
    setShowFulfillmentModal(false);
    // Update inquiry status to fulfilled
    handleStatusUpdate('fulfilled');
    console.log('Fulfillment created:', fulfillment.fulfillment_number);
  };

  const canCreateFulfillment = inquiry.status === 'accepted';
  const canQuote = inquiry.status === 'draft' || inquiry.status === 'pending';
  const canAcceptReject = inquiry.status === 'quoted';

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <>
      <Overlay isOpen={isOpen} onClick={onClose}>
        <Modal onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <HeaderLeft>
              <ModalTitle>
                📋 {inquiry.inquiry_number}
              </ModalTitle>
              <HeaderMeta>
                <span>Created {formatDate(inquiry.created_on)}</span>
                {inquiry.created_by_name && <span>by {inquiry.created_by_name}</span>}
              </HeaderMeta>
            </HeaderLeft>
            <CloseButton type="button" onClick={onClose}>×</CloseButton>
          </ModalHeader>

          <ModalBody>
            {/* Status & Actions */}
            <Section>
              <SectionHeader>
                <SectionTitle>Status</SectionTitle>
                <StatusBadge status={inquiry.status}>
                  {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                </StatusBadge>
              </SectionHeader>
              
              <StatusActions>
                {canQuote && (
                  <ActionButton
                    variant="primary"
                    onClick={() => handleStatusUpdate('quoted')}
                    disabled={updatingStatus}
                  >
                    Mark as Quoted
                  </ActionButton>
                )}
                {canAcceptReject && (
                  <>
                    <ActionButton
                      variant="success"
                      onClick={() => handleStatusUpdate('accepted')}
                      disabled={updatingStatus}
                    >
                      ✓ Accept
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={() => handleStatusUpdate('rejected')}
                      disabled={updatingStatus}
                    >
                      ✗ Reject
                    </ActionButton>
                  </>
                )}
                {canCreateFulfillment && (
                  <ActionButton
                    variant="success"
                    onClick={() => setShowFulfillmentModal(true)}
                    disabled={updatingStatus}
                  >
                    📦 Create Fulfillment
                  </ActionButton>
                )}
              </StatusActions>
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
                  <span className="label">Valid Until</span>
                  <span className="value" style={{ color: inquiry.is_expired ? 'rgb(220, 38, 38)' : undefined }}>
                    {formatDate(inquiry.valid_until)} {inquiry.is_expired && '(Expired)'}
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
                    <ProductRow key={product.id}>
                      <ProductInfo>
                        <div className="code">{product.product_code}</div>
                        <div className="description">{product.product_description}</div>
                      </ProductInfo>
                      <div>{product.quantity}</div>
                      <PriceCell variant="desired">
                        {formatCurrency(product.desired_price_per_unit)}
                      </PriceCell>
                      <PriceCell variant="actual">
                        {formatCurrency(product.actual_price_per_unit)}
                      </PriceCell>
                      <div>{formatCurrency(product.actual_total || product.desired_total)}</div>
                      <MarginCell positive={(product.margin || 0) >= 0}>
                        {product.margin !== undefined ? `${product.margin >= 0 ? '+' : ''}${formatCurrency(product.margin)}` : '-'}
                        {product.margin_percent !== undefined && ` (${product.margin_percent.toFixed(1)}%)`}
                      </MarginCell>
                    </ProductRow>
                  ))}
                  
                  <TotalsRow>
                    <div>Total</div>
                    <div></div>
                    <PriceCell variant="desired">{formatCurrency(inquiry.total_desired)}</PriceCell>
                    <PriceCell variant="actual">{formatCurrency(inquiry.total_actual)}</PriceCell>
                    <div>{formatCurrency(inquiry.total_actual || inquiry.total_desired)}</div>
                    <MarginCell positive={(inquiry.total_margin || 0) >= 0}>
                      {inquiry.total_margin !== undefined ? `${inquiry.total_margin >= 0 ? '+' : ''}${formatCurrency(inquiry.total_margin)}` : '-'}
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
            </FooterLeft>
            <FooterRight>
              <CloseModalButton onClick={onClose}>
                Close
              </CloseModalButton>
            </FooterRight>
          </ModalFooter>
        </Modal>
      </Overlay>

      {/* Fulfillment Modal */}
      {showFulfillmentModal && (
        <CreateFulfillmentModal
          isOpen={showFulfillmentModal}
          onClose={() => setShowFulfillmentModal(false)}
          onSuccess={handleFulfillmentSuccess}
          inquiry={inquiry}
        />
      )}
    </>
  );
};

export default InquiryDetailModal;
