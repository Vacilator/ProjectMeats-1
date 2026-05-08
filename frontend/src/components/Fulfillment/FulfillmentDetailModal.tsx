/**
 * FulfillmentDetailModal
 * 
 * Modal for viewing and managing fulfillment details.
 * Features:
 * - View fulfillment information
 * - Product list with quantities
 * - Tracking numbers management
 * - Status workflow actions (Ship/Deliver/Complete)
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface FulfillmentProduct {
  id: string;
  product_code: string;
  product_description: string;
  inquiry_quantity: number;
  quantity_fulfilled: number;
  unit_price: number | null;
  total: number | null;
}

interface FulfillmentDetail {
  id: string;
  fulfillment_number: string;
  inquiry: string;
  inquiry_number: string;
  status: string;
  supplier: string | null;
  supplier_name: string | null;
  customer: string | null;
  customer_name: string | null;
  carrier: string | null;
  carrier_name: string | null;
  ship_date: string | null;
  expected_delivery: string | null;
  actual_delivery: string | null;
  tracking_numbers: string[];
  notes: string;
  products: FulfillmentProduct[];
  total_value: number;
  is_partial: boolean;
  created_by_name: string | null;
  shipped_by_name: string | null;
  created_on: string;
}

interface FulfillmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fulfillmentId: string;
  onUpdate?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: rgb(var(--color-text-secondary));
  padding: 0.25rem;
  
  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const Content = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const Section = styled.div`
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem 0;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

const InfoItem = styled.div`
  .label {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
    margin-bottom: 0.25rem;
  }
  
  .value {
    font-size: 0.875rem;
    color: rgb(var(--color-text-primary));
    font-weight: 500;
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.$status) {
      case 'pending': return 'rgba(var(--color-warning), 0.1)';
      case 'in_progress': return 'rgba(var(--color-info), 0.1)';
      case 'shipped': return 'rgba(147, 51, 234, 0.1)';
      case 'delivered': return 'rgba(var(--color-success), 0.1)';
      case 'completed': return 'rgba(var(--color-success), 0.1)';
      case 'cancelled': return 'rgba(var(--color-error), 0.1)';
      default: return 'rgba(156, 163, 175, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'pending': return 'rgb(var(--color-warning))';
      case 'in_progress': return 'rgb(var(--color-info))';
      case 'shipped': return 'rgb(126, 34, 206)';
      case 'delivered': return 'rgb(var(--color-success))';
      case 'completed': return 'rgb(var(--color-success))';
      case 'cancelled': return 'rgb(var(--color-error))';
      default: return 'rgb(var(--color-neutral))';
    }
  }};
`;

const ProductsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  
  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid rgb(var(--color-border));
  }
  
  th {
    font-weight: 600;
    color: rgb(var(--color-text-secondary));
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  td {
    color: rgb(var(--color-text-primary));
  }
  
  tr:last-child td {
    border-bottom: none;
  }
`;

const TrackingList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const TrackingTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: monospace;
`;

const AddTrackingInput = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  
  input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
    
    &:focus {
      outline: none;
      border-color: rgb(var(--color-primary));
    }
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgb(var(--color-border));
  background: rgba(var(--color-primary), 0.02);
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'success' | 'danger' }>`
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.15s;
  
  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: white;
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'success':
        return `
          background: rgb(var(--color-success));
          color: white;
          border: none;
          &:hover { background: rgb(var(--color-success)); opacity: 0.85; }
        `;
      case 'danger':
        return `
          background: rgb(var(--color-error));
          color: white;
          border: none;
          &:hover { background: rgb(var(--color-error)); opacity: 0.85; }
        `;
      default:
        return `
          background: transparent;
          color: rgb(var(--color-text-primary));
          border: 1px solid rgb(var(--color-border));
          &:hover {
            background: rgba(var(--color-primary), 0.05);
            border-color: rgb(var(--color-primary));
          }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
  border-top: 2px solid rgb(var(--color-border));
  font-weight: 600;
  
  .label {
    color: rgb(var(--color-text-secondary));
    margin-right: 1rem;
  }
  
  .value {
    color: rgb(var(--color-primary));
    font-size: 1.125rem;
  }
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  color: rgb(var(--color-text-secondary));
`;

const Notes = styled.div`
  background: rgba(var(--color-primary), 0.05);
  padding: 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
`;

// ============================================================================
// Component
// ============================================================================

export const FulfillmentDetailModal: React.FC<FulfillmentDetailModalProps> = ({
  isOpen,
  onClose,
  fulfillmentId,
  onUpdate,
}) => {
  const [fulfillment, setFulfillment] = useState<FulfillmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [newTracking, setNewTracking] = useState('');

  // Load fulfillment data when modal opens
  React.useEffect(() => {
    if (isOpen && fulfillmentId) {
      loadFulfillment();
    }
  }, [isOpen, fulfillmentId]);

  const loadFulfillment = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/fulfillments/${fulfillmentId}/`);
      setFulfillment(response.data);
    } catch (error) {
      logger.error('Failed to load fulfillment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'ship' | 'deliver' | 'complete') => {
    if (!fulfillment) return;
    
    setIsActionLoading(true);
    try {
      await apiClient.post(`/fulfillments/${fulfillment.id}/${action}/`);
      await loadFulfillment();
      onUpdate?.();
    } catch (error) {
      logger.error(`Failed to ${action} fulfillment:`, error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddTracking = async () => {
    if (!fulfillment || !newTracking.trim()) return;
    
    setIsActionLoading(true);
    try {
      await apiClient.post(`/fulfillments/${fulfillment.id}/add_tracking/`, {
        tracking_numbers: [newTracking.trim()],
      });
      setNewTracking('');
      await loadFulfillment();
      onUpdate?.();
    } catch (error) {
      logger.error('Failed to add tracking number:', error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const renderActionButtons = () => {
    if (!fulfillment) return null;

    switch (fulfillment.status) {
      case 'pending':
      case 'in_progress':
        return (
          <Button 
            $variant="primary" 
            onClick={() => handleAction('ship')}
            disabled={isActionLoading}
          >
            📦 Mark as Shipped
          </Button>
        );
      case 'shipped':
        return (
          <Button 
            $variant="success" 
            onClick={() => handleAction('deliver')}
            disabled={isActionLoading}
          >
            ✓ Mark as Delivered
          </Button>
        );
      case 'delivered':
        return (
          <Button 
            $variant="success" 
            onClick={() => handleAction('complete')}
            disabled={isActionLoading}
          >
            ✓ Mark as Complete
          </Button>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay $isOpen={isOpen} onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <Header>
          <Title>
            📦 {fulfillment?.fulfillment_number || 'Loading...'}
            {fulfillment && (
              <StatusBadge $status={fulfillment.status}>
                {getStatusLabel(fulfillment.status)}
              </StatusBadge>
            )}
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>

        <Content>
          {isLoading ? (
            <LoadingState>Loading fulfillment details...</LoadingState>
          ) : fulfillment ? (
            <>
              {/* Overview Section */}
              <Section>
                <SectionTitle>Overview</SectionTitle>
                <InfoGrid>
                  <InfoItem>
                    <div className="label">Inquiry</div>
                    <div className="value">{fulfillment.inquiry_number}</div>
                  </InfoItem>
                  <InfoItem>
                    <div className="label">Supplier</div>
                    <div className="value">{fulfillment.supplier_name || '-'}</div>
                  </InfoItem>
                  <InfoItem>
                    <div className="label">Customer</div>
                    <div className="value">{fulfillment.customer_name || '-'}</div>
                  </InfoItem>
                  <InfoItem>
                    <div className="label">Carrier</div>
                    <div className="value">{fulfillment.carrier_name || '-'}</div>
                  </InfoItem>
                </InfoGrid>
              </Section>

              {/* Dates Section */}
              <Section>
                <SectionTitle>Dates</SectionTitle>
                <InfoGrid>
                  <InfoItem>
                    <div className="label">Created</div>
                    <div className="value">{formatDate(fulfillment.created_on)}</div>
                  </InfoItem>
                  <InfoItem>
                    <div className="label">Ship Date</div>
                    <div className="value">{formatDate(fulfillment.ship_date)}</div>
                  </InfoItem>
                  <InfoItem>
                    <div className="label">Expected Delivery</div>
                    <div className="value">{formatDate(fulfillment.expected_delivery)}</div>
                  </InfoItem>
                  <InfoItem>
                    <div className="label">Actual Delivery</div>
                    <div className="value">{formatDate(fulfillment.actual_delivery)}</div>
                  </InfoItem>
                </InfoGrid>
              </Section>

              {/* Tracking Section */}
              <Section>
                <SectionTitle>Tracking Numbers</SectionTitle>
                {fulfillment.tracking_numbers.length > 0 ? (
                  <TrackingList>
                    {fulfillment.tracking_numbers.map((num, idx) => (
                      <TrackingTag key={idx}>{num}</TrackingTag>
                    ))}
                  </TrackingList>
                ) : (
                  <span style={{ color: 'rgb(var(--color-text-secondary))', fontSize: '0.875rem' }}>
                    No tracking numbers added
                  </span>
                )}
                {fulfillment.status !== 'completed' && fulfillment.status !== 'cancelled' && (
                  <AddTrackingInput>
                    <input
                      type="text"
                      value={newTracking}
                      onChange={e => setNewTracking(e.target.value)}
                      placeholder="Add tracking number..."
                      onKeyPress={e => e.key === 'Enter' && handleAddTracking()}
                    />
                    <Button onClick={handleAddTracking} disabled={isActionLoading || !newTracking.trim()}>
                      Add
                    </Button>
                  </AddTrackingInput>
                )}
              </Section>

              {/* Products Section */}
              <Section>
                <SectionTitle>Products ({fulfillment.products.length})</SectionTitle>
                <ProductsTable>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Inquiry Qty</th>
                      <th style={{ textAlign: 'right' }}>Fulfilled</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fulfillment.products.map(product => (
                      <tr key={product.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{product.product_code}</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))' }}>
                            {product.product_description?.substring(0, 50)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{product.inquiry_quantity}</td>
                        <td style={{ textAlign: 'right' }}>{product.quantity_fulfilled}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(product.unit_price)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(product.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </ProductsTable>
                <TotalRow>
                  <span className="label">Total Value:</span>
                  <span className="value">{formatCurrency(fulfillment.total_value)}</span>
                </TotalRow>
              </Section>

              {/* Notes Section */}
              {fulfillment.notes && (
                <Section>
                  <SectionTitle>Notes</SectionTitle>
                  <Notes>{fulfillment.notes}</Notes>
                </Section>
              )}
            </>
          ) : (
            <LoadingState>Failed to load fulfillment</LoadingState>
          )}
        </Content>

        <Footer>
          <div>
            {fulfillment?.is_partial && (
              <span style={{ color: 'rgb(var(--color-warning))', fontSize: '0.875rem' }}>
                ⚠️ Partial Fulfillment
              </span>
            )}
          </div>
          <ActionButtons>
            <Button onClick={onClose}>Close</Button>
            {renderActionButtons()}
          </ActionButtons>
        </Footer>
      </Modal>
    </Overlay>
  );
};

export default FulfillmentDetailModal;
