/**
 * Create Fulfillment Modal
 * 
 * Modal for creating fulfillments from accepted inquiries.
 * Features:
 * - Smart supplier filtering (only suppliers with selected products)
 * - Partial fulfillment support (select quantities per line)
 * - Shipping carrier selection
 * - Tracking number input
 * - Estimated delivery date
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService';
import { 
  Fulfillment,
  Inquiry,
  InquiryProduct,
} from '../../types';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface CreateFulfillmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (fulfillment: Fulfillment) => void;
  inquiry: Inquiry;
}

interface SupplierOption {
  id: string;
  name: string;
  productIds: string[];
}

interface CarrierOption {
  id: string;
  name: string;
  code?: string;
}

interface FulfillmentLineItem {
  inquiryProductId: string;
  productId: string;
  productCode?: string;
  productDescription?: string;
  quantityOrdered: number;
  quantityToFulfill: number;
  unitPrice?: number;
  selected: boolean;
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
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
`;

const ModalHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: rgb(var(--color-surface));
  z-index: 10;
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

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.375rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    background: rgba(var(--color-text-secondary), 0.1);
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    background: rgba(var(--color-text-secondary), 0.1);
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const InquiryInfoCard = styled.div`
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-bottom: 1rem;
`;

const InquiryInfoRow = styled.div`
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
`;

const InquiryInfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  
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
  grid-template-columns: 40px 2fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(var(--color-primary), 0.1);
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const ProductRow = styled.div<{ selected?: boolean }>`
  display: grid;
  grid-template-columns: 40px 2fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgb(var(--color-border));
  align-items: center;
  background: ${props => props.selected ? 'rgba(var(--color-primary), 0.05)' : 'transparent'};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: rgba(var(--color-primary), 0.02);
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: rgb(var(--color-primary));
`;

const ProductInput = styled(Input)`
  padding: 0.5rem;
  font-size: 0.8125rem;
`;

const QuantityWarning = styled.span`
  color: rgb(var(--color-warning));
  font-size: 0.75rem;
  margin-left: 0.25rem;
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

const FooterInfo = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  
  .highlight {
    color: rgb(var(--color-primary));
    font-weight: 600;
  }
`;

const FooterActions = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const CancelButton = styled.button`
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

const SubmitButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary));
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
  font-size: 0.875rem;
  padding: 0.75rem;
  background: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
`;

const HelpText = styled.p`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  margin-top: 0.25rem;
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgba(34, 197, 94, 0.1)';
      case 'pending': return 'rgba(234, 179, 8, 0.1)';
      case 'quoted': return 'rgba(59, 130, 246, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgb(22, 163, 74)';
      case 'pending': return 'rgb(202, 138, 4)';
      case 'quoted': return 'rgb(37, 99, 235)';
      default: return 'rgb(75, 85, 99)';
    }
  }};
`;

// ============================================================================
// Component
// ============================================================================

export const CreateFulfillmentModal: React.FC<CreateFulfillmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  inquiry,
}) => {
  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [trackingNumbers, setTrackingNumbers] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  
  // Product lines
  const [lineItems, setLineItems] = useState<FulfillmentLineItem[]>([]);
  
  // Options
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([]);
  
  // Loading states
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize line items from inquiry products
  useEffect(() => {
    if (isOpen && inquiry.products) {
      const items: FulfillmentLineItem[] = inquiry.products.map((p: InquiryProduct) => ({
        inquiryProductId: p.id,
        productId: p.product,
        productCode: p.product_code,
        productDescription: p.product_description,
        quantityOrdered: p.quantity,
        quantityToFulfill: p.quantity, // Default to full quantity
        unitPrice: p.actual_price_per_unit || p.desired_price_per_unit,
        selected: true, // Select all by default
      }));
      setLineItems(items);
      
      // Load suppliers that have these products
      const productIds = inquiry.products.map((p: InquiryProduct) => p.product);
      fetchSuppliers(productIds);
    }
  }, [isOpen, inquiry]);

  // Load carriers
  useEffect(() => {
    if (isOpen) {
      fetchCarriers();
    }
  }, [isOpen]);

  const fetchSuppliers = async (productIds: string[]) => {
    setLoadingSuppliers(true);
    try {
      // Fetch suppliers that have any of the selected products
      const response = await apiClient.get('suppliers/', {
        params: { products__id__in: productIds.join(','), page_size: 100 }
      });
      const data = response.data.results || response.data;
      
      const options: SupplierOption[] = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        productIds: s.products || [],
      }));
      
      setSupplierOptions(options);
      
      // Auto-select if only one supplier
      if (options.length === 1) {
        setSupplierId(options[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
      setSupplierOptions([]);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchCarriers = async () => {
    setLoadingCarriers(true);
    try {
      const response = await apiClient.get('carriers/', { params: { is_active: true, page_size: 100 } });
      const data = response.data.results || response.data;
      
      setCarrierOptions(data.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })));
    } catch (err) {
      console.error('Failed to fetch carriers:', err);
      setCarrierOptions([]);
    } finally {
      setLoadingCarriers(false);
    }
  };

  const toggleLineItem = useCallback((inquiryProductId: string) => {
    setLineItems(prev => prev.map(item => 
      item.inquiryProductId === inquiryProductId 
        ? { ...item, selected: !item.selected }
        : item
    ));
  }, []);

  const updateQuantity = useCallback((inquiryProductId: string, quantity: number) => {
    setLineItems(prev => prev.map(item => 
      item.inquiryProductId === inquiryProductId 
        ? { ...item, quantityToFulfill: Math.min(quantity, item.quantityOrdered) }
        : item
    ));
  }, []);

  const selectedItems = useMemo(() => 
    lineItems.filter(item => item.selected && item.quantityToFulfill > 0),
    [lineItems]
  );

  const isPartialFulfillment = useMemo(() => 
    selectedItems.length < lineItems.length || 
    selectedItems.some(item => item.quantityToFulfill < item.quantityOrdered),
    [selectedItems, lineItems]
  );

  const totalValue = useMemo(() => 
    selectedItems.reduce((sum, item) => 
      sum + (item.unitPrice || 0) * item.quantityToFulfill, 0
    ),
    [selectedItems]
  );

  const resetForm = () => {
    setSupplierId('');
    setCarrierId('');
    setTrackingNumbers('');
    setEstimatedDelivery('');
    setNotes('');
    setLineItems([]);
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please select at least one product to fulfill');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        inquiry: inquiry.id,
        supplier: supplierId,
        shipped_by: carrierId || undefined,
        tracking_numbers: trackingNumbers ? trackingNumbers.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        estimated_delivery: estimatedDelivery || undefined,
        notes: notes || undefined,
        products: selectedItems.map(item => ({
          inquiry_product: item.inquiryProductId,
          quantity_fulfilled: item.quantityToFulfill,
          unit_price: item.unitPrice,
        })),
      };

      const response = await apiClient.post('fulfillments/', payload);
      
      resetForm();
      onSuccess(response.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to create fulfillment:', err);
      const errorDetail = err.response?.data?.detail 
        || err.response?.data?.message 
        || JSON.stringify(err.response?.data) 
        || 'Failed to create fulfillment. Please try again.';
      setError(errorDetail);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay isOpen={isOpen} onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>
              📦 Create Fulfillment
            </ModalTitle>
            <CloseButton type="button" onClick={handleClose}>×</CloseButton>
          </ModalHeader>

          <ModalBody>
            {error && <ErrorMessage>{error}</ErrorMessage>}

            {/* Inquiry Info */}
            <Section>
              <SectionTitle>Inquiry Information</SectionTitle>
              <InquiryInfoCard>
                <InquiryInfoRow>
                  <InquiryInfoItem>
                    <span className="label">Inquiry #</span>
                    <span className="value">{inquiry.inquiry_number}</span>
                  </InquiryInfoItem>
                  <InquiryInfoItem>
                    <span className="label">Status</span>
                    <StatusBadge status={inquiry.status}>{inquiry.status}</StatusBadge>
                  </InquiryInfoItem>
                  <InquiryInfoItem>
                    <span className="label">{inquiry.entity_type === 'customer' ? 'Customer' : 'Supplier'}</span>
                    <span className="value">{inquiry.customer_name || inquiry.supplier_name}</span>
                  </InquiryInfoItem>
                  {inquiry.contact_name && (
                    <InquiryInfoItem>
                      <span className="label">Contact</span>
                      <span className="value">{inquiry.contact_name}</span>
                    </InquiryInfoItem>
                  )}
                  <InquiryInfoItem>
                    <span className="label">Total Value</span>
                    <span className="value">${inquiry.total_actual?.toLocaleString() || inquiry.total_desired?.toLocaleString() || '0'}</span>
                  </InquiryInfoItem>
                </InquiryInfoRow>
              </InquiryInfoCard>
            </Section>

            {/* Supplier & Carrier Selection */}
            <Section>
              <SectionTitle>Shipping Information</SectionTitle>
              <FormRow>
                <FormGroup>
                  <Label>Supplier *</Label>
                  <Select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    disabled={submitting || loadingSuppliers}
                  >
                    <option value="">
                      {loadingSuppliers ? 'Loading...' : 'Select supplier'}
                    </option>
                    {supplierOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                  <HelpText>Only suppliers with selected products are shown</HelpText>
                </FormGroup>

                <FormGroup>
                  <Label>Carrier</Label>
                  <Select
                    value={carrierId}
                    onChange={(e) => setCarrierId(e.target.value)}
                    disabled={submitting || loadingCarriers}
                  >
                    <option value="">
                      {loadingCarriers ? 'Loading...' : 'Select carrier (optional)'}
                    </option>
                    {carrierOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name} {option.code ? `(${option.code})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup>
                  <Label>Tracking Numbers</Label>
                  <Input
                    type="text"
                    value={trackingNumbers}
                    onChange={(e) => setTrackingNumbers(e.target.value)}
                    placeholder="Comma-separated tracking numbers"
                    disabled={submitting}
                  />
                  <HelpText>Enter multiple tracking numbers separated by commas</HelpText>
                </FormGroup>

                <FormGroup>
                  <Label>Estimated Delivery</Label>
                  <Input
                    type="date"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    disabled={submitting}
                  />
                </FormGroup>
              </FormRow>
            </Section>

            {/* Products to Fulfill */}
            <Section>
              <SectionTitle>
                Products to Fulfill
                {isPartialFulfillment && (
                  <QuantityWarning> (Partial Fulfillment)</QuantityWarning>
                )}
              </SectionTitle>

              <ProductsTable>
                <ProductsHeader>
                  <span></span>
                  <span>Product</span>
                  <span>Ordered</span>
                  <span>To Fulfill</span>
                  <span>Unit Price</span>
                  <span>Line Total</span>
                </ProductsHeader>
                
                {lineItems.map((item) => (
                  <ProductRow key={item.inquiryProductId} selected={item.selected}>
                    <Checkbox
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleLineItem(item.inquiryProductId)}
                      disabled={submitting}
                    />
                    
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.productCode}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))' }}>
                        {item.productDescription}
                      </div>
                    </div>
                    
                    <div>{item.quantityOrdered}</div>
                    
                    <ProductInput
                      type="number"
                      min="0"
                      max={item.quantityOrdered}
                      value={item.quantityToFulfill}
                      onChange={(e) => updateQuantity(item.inquiryProductId, parseInt(e.target.value) || 0)}
                      disabled={submitting || !item.selected}
                    />
                    
                    <div>${item.unitPrice?.toFixed(2) || '0.00'}</div>
                    
                    <div style={{ fontWeight: 500 }}>
                      ${((item.unitPrice || 0) * (item.selected ? item.quantityToFulfill : 0)).toFixed(2)}
                    </div>
                  </ProductRow>
                ))}
              </ProductsTable>
            </Section>

            {/* Notes */}
            <Section>
              <FormGroup>
                <Label>Notes</Label>
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this fulfillment..."
                  disabled={submitting}
                />
              </FormGroup>
            </Section>
          </ModalBody>

          <ModalFooter>
            <FooterInfo>
              <span className="highlight">{selectedItems.length}</span> of {lineItems.length} products selected
              {' • '}
              Total: <span className="highlight">${totalValue.toFixed(2)}</span>
              {isPartialFulfillment && ' (Partial)'}
            </FooterInfo>
            <FooterActions>
              <CancelButton type="button" onClick={handleClose} disabled={submitting}>
                Cancel
              </CancelButton>
              <SubmitButton type="submit" disabled={submitting || selectedItems.length === 0}>
                {submitting ? 'Creating...' : 'Create Fulfillment'}
              </SubmitButton>
            </FooterActions>
          </ModalFooter>
        </form>
      </Modal>
    </Overlay>
  );
};

export default CreateFulfillmentModal;
