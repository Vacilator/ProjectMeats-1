/**
 * Create Inquiry Modal
 * 
 * Modal for creating new product inquiries from calls or manually.
 * Features:
 * - Multi-product selection with dual-column (desired/actual) values
 * - Contact information auto-populated from call data
 * - Source tracking (scheduled_call, inbound_call, email, etc.)
 * - Quote expiration date
 * - Competitor tracking fields
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService';
import { 
  Inquiry, 
  InquirySource, 
  InquiryEntityType,
  Product 
} from '../../types';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface CreateInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (inquiry: Inquiry) => void;
  // Pre-populate from scheduled call
  scheduledCallId?: string;
  // Pre-populate entity
  entityType?: InquiryEntityType;
  entityId?: string;
  contactId?: string;
}

interface EntityOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  company?: string;
}

interface ProductLineItem {
  tempId: string;
  product: string;
  productCode?: string;
  productDescription?: string;
  quantity: number;
  desired_price_per_unit?: number;
  desired_total?: number;
  desired_uom: string;
  desired_uom_value?: number;
  desired_shipping_date?: string;
  desired_delivery_date?: string;
  actual_price_per_unit?: number;
  actual_total?: number;
  actual_uom: string;
  actual_uom_value?: number;
  actual_shipping_date?: string;
  actual_delivery_date?: string;
  notes?: string;
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

const ProductsTable = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const ProductsHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 40px;
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
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 40px;
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

const ProductInput = styled(Input)`
  padding: 0.5rem;
  font-size: 0.8125rem;
`;

const ProductSelect = styled(Select)`
  padding: 0.5rem;
  font-size: 0.8125rem;
`;

const RemoveButton = styled.button`
  background: transparent;
  border: none;
  color: rgb(var(--color-error, 220, 38, 38));
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(220, 38, 38, 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AddProductButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  border: 2px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-primary));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
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

const FooterInfo = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
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
  color: #dc2626;
  font-size: 0.875rem;
  padding: 0.75rem;
  background: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
`;

const ContactInfoCard = styled.div`
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-bottom: 1rem;
`;

const ContactInfoRow = styled.div`
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
`;

const ContactInfoItem = styled.div`
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

const DualColumnHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const ColumnLabel = styled.div<{ variant?: 'desired' | 'actual' }>`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  text-align: center;
  background: ${props => props.variant === 'actual' 
    ? 'rgba(34, 197, 94, 0.1)' 
    : 'rgba(59, 130, 246, 0.1)'};
  color: ${props => props.variant === 'actual' 
    ? 'rgb(22, 163, 74)' 
    : 'rgb(37, 99, 235)'};
`;

// ============================================================================
// Component
// ============================================================================

export const CreateInquiryModal: React.FC<CreateInquiryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  scheduledCallId,
  entityType: initialEntityType,
  entityId: initialEntityId,
  contactId: initialContactId,
}) => {
  // Form state
  const [entityType, setEntityType] = useState<InquiryEntityType>('customer');
  const [entityId, setEntityId] = useState('');
  const [contactId, setContactId] = useState('');
  const [source, setSource] = useState<InquirySource>('scheduled_call');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [competitorNames, setCompetitorNames] = useState('');
  const [competitorPricingNotes, setCompetitorPricingNotes] = useState('');
  
  // Product lines
  const [productLines, setProductLines] = useState<ProductLineItem[]>([]);
  
  // Options
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  
  // Loading states
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from props
  useEffect(() => {
    if (isOpen) {
      if (initialEntityType) setEntityType(initialEntityType);
      if (initialEntityId) setEntityId(initialEntityId);
      if (initialContactId) setContactId(initialContactId);
      if (scheduledCallId) {
        setSource('scheduled_call');
        loadCallData(scheduledCallId);
      }
      
      // Set default valid_until to 30 days from now
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);
      setValidUntil(defaultExpiry.toISOString().split('T')[0]);
    }
  }, [isOpen, initialEntityType, initialEntityId, initialContactId, scheduledCallId]);

  // Load entity options when type changes
  useEffect(() => {
    if (isOpen && entityType) {
      fetchEntityOptions(entityType);
    }
  }, [entityType, isOpen]);

  // Load contacts when entity changes
  useEffect(() => {
    if (isOpen && entityId) {
      fetchContacts(entityType, entityId);
    }
  }, [entityId, entityType, isOpen]);

  // Load products
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  // Update selected contact info
  useEffect(() => {
    if (contactId && contactOptions.length > 0) {
      const contact = contactOptions.find(c => c.id === contactId);
      setSelectedContact(contact || null);
    } else {
      setSelectedContact(null);
    }
  }, [contactId, contactOptions]);

  const loadCallData = async (callId: string) => {
    try {
      const response = await apiClient.get(`inquiries/from-call/${callId}/`);
      const data = response.data;
      
      if (data.entity_type) setEntityType(data.entity_type);
      if (data.entity_id) setEntityId(data.entity_id);
      if (data.contact_id) setContactId(data.contact_id);
      if (data.contact_snapshot) {
        setSelectedContact({
          id: data.contact_id || '',
          name: data.contact_snapshot.name || '',
          email: data.contact_snapshot.email || '',
          phone: data.contact_snapshot.phone || '',
          position: data.contact_snapshot.position || '',
          company: data.contact_snapshot.company || '',
        });
      }
    } catch (err) {
      console.error('Failed to load call data:', err);
    }
  };

  const fetchEntityOptions = async (type: InquiryEntityType) => {
    setLoadingEntities(true);
    try {
      const endpoint = type === 'supplier' ? 'suppliers/' : 'customers/';
      const response = await apiClient.get(endpoint);
      const data = response.data.results || response.data;
      
      setEntityOptions(data.map((item: any) => ({
        id: item.id,
        name: item.name || item.company_name || `${type} #${item.id}`,
      })));
    } catch (err) {
      console.error(`Failed to fetch ${type} options:`, err);
      setEntityOptions([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  const fetchContacts = async (type: InquiryEntityType, id: string) => {
    setLoadingContacts(true);
    try {
      const response = await apiClient.get(`contacts/?entity_type=${type}&entity_id=${id}`);
      const data = response.data.results || response.data;
      
      setContactOptions(data.map((item: any) => ({
        id: item.id,
        name: `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email || `Contact #${item.id}`,
        email: item.email,
        phone: item.phone,
        position: item.title || item.position,
        company: item.company_name,
      })));
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setContactOptions([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await apiClient.get('products/?is_active=true&page_size=500');
      const data = response.data.results || response.data;
      setProductOptions(data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setProductOptions([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const addProductLine = useCallback(() => {
    const newLine: ProductLineItem = {
      tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      product: '',
      quantity: 1,
      desired_uom: 'LBS',
      actual_uom: 'LBS',
    };
    setProductLines(prev => [...prev, newLine]);
  }, []);

  const updateProductLine = useCallback((tempId: string, updates: Partial<ProductLineItem>) => {
    setProductLines(prev => prev.map(line => 
      line.tempId === tempId ? { ...line, ...updates } : line
    ));
  }, []);

  const removeProductLine = useCallback((tempId: string) => {
    setProductLines(prev => prev.filter(line => line.tempId !== tempId));
  }, []);

  const handleProductChange = (tempId: string, productId: string) => {
    const product = productOptions.find(p => p.id === productId);
    updateProductLine(tempId, {
      product: productId,
      productCode: product?.product_code,
      productDescription: product?.description_of_product_item,
    });
  };

  const resetForm = () => {
    setEntityType('customer');
    setEntityId('');
    setContactId('');
    setSource('scheduled_call');
    setValidUntil('');
    setNotes('');
    setCompetitorNames('');
    setCompetitorPricingNotes('');
    setProductLines([]);
    setSelectedContact(null);
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
    if (!entityId) {
      setError('Please select a customer or supplier');
      return;
    }

    if (productLines.length === 0) {
      setError('Please add at least one product');
      return;
    }

    const invalidProducts = productLines.filter(line => !line.product);
    if (invalidProducts.length > 0) {
      setError('Please select a product for all line items');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        entity_type: entityType,
        [entityType === 'supplier' ? 'supplier' : 'customer']: entityId,
        contact: contactId || undefined,
        source,
        scheduled_call: scheduledCallId || undefined,
        valid_until: validUntil || undefined,
        notes: notes || undefined,
        competitor_names: competitorNames || undefined,
        competitor_pricing_notes: competitorPricingNotes || undefined,
        products: productLines.map(line => ({
          product: line.product,
          quantity: line.quantity,
          desired_price_per_unit: line.desired_price_per_unit || undefined,
          desired_total: line.desired_total || undefined,
          desired_uom: line.desired_uom,
          desired_uom_value: line.desired_uom_value || undefined,
          desired_shipping_date: line.desired_shipping_date || undefined,
          desired_delivery_date: line.desired_delivery_date || undefined,
          actual_price_per_unit: line.actual_price_per_unit || undefined,
          actual_total: line.actual_total || undefined,
          actual_uom: line.actual_uom,
          actual_uom_value: line.actual_uom_value || undefined,
          actual_shipping_date: line.actual_shipping_date || undefined,
          actual_delivery_date: line.actual_delivery_date || undefined,
          notes: line.notes || undefined,
        })),
      };

      const response = await apiClient.post('inquiries/', payload);
      
      resetForm();
      onSuccess(response.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to create inquiry:', err);
      const errorDetail = err.response?.data?.detail 
        || err.response?.data?.message 
        || JSON.stringify(err.response?.data) 
        || 'Failed to create inquiry. Please try again.';
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
              📋 New Inquiry
            </ModalTitle>
            <CloseButton type="button" onClick={handleClose}>×</CloseButton>
          </ModalHeader>

          <ModalBody>
            {error && <ErrorMessage>{error}</ErrorMessage>}

            {/* Entity Selection */}
            <Section>
              <SectionTitle>Customer/Supplier Information</SectionTitle>
              <FormRow>
                <FormGroup>
                  <Label>Entity Type *</Label>
                  <Select
                    value={entityType}
                    onChange={(e) => {
                      setEntityType(e.target.value as InquiryEntityType);
                      setEntityId('');
                      setContactId('');
                    }}
                    disabled={submitting}
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>{entityType === 'supplier' ? 'Supplier' : 'Customer'} *</Label>
                  <Select
                    value={entityId}
                    onChange={(e) => {
                      setEntityId(e.target.value);
                      setContactId('');
                    }}
                    disabled={submitting || loadingEntities}
                  >
                    <option value="">
                      {loadingEntities ? 'Loading...' : `Select ${entityType}`}
                    </option>
                    {entityOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>Contact</Label>
                  <Select
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    disabled={submitting || loadingContacts || !entityId}
                  >
                    <option value="">
                      {loadingContacts ? 'Loading...' : 'Select contact (optional)'}
                    </option>
                    {contactOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
              </FormRow>

              {selectedContact && (
                <ContactInfoCard>
                  <ContactInfoRow>
                    <ContactInfoItem>
                      <span className="label">Name</span>
                      <span className="value">{selectedContact.name}</span>
                    </ContactInfoItem>
                    {selectedContact.email && (
                      <ContactInfoItem>
                        <span className="label">Email</span>
                        <span className="value">{selectedContact.email}</span>
                      </ContactInfoItem>
                    )}
                    {selectedContact.phone && (
                      <ContactInfoItem>
                        <span className="label">Phone</span>
                        <span className="value">{selectedContact.phone}</span>
                      </ContactInfoItem>
                    )}
                    {selectedContact.position && (
                      <ContactInfoItem>
                        <span className="label">Position</span>
                        <span className="value">{selectedContact.position}</span>
                      </ContactInfoItem>
                    )}
                  </ContactInfoRow>
                </ContactInfoCard>
              )}
            </Section>

            {/* Source & Quote Details */}
            <Section>
              <SectionTitle>Inquiry Details</SectionTitle>
              <FormRow>
                <FormGroup>
                  <Label>Source</Label>
                  <Select
                    value={source}
                    onChange={(e) => setSource(e.target.value as InquirySource)}
                    disabled={submitting}
                  >
                    <option value="scheduled_call">Scheduled Call</option>
                    <option value="inbound_call">Inbound Call</option>
                    <option value="email">Email</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="trade_show">Trade Show</option>
                    <option value="other">Other</option>
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>Quote Valid Until</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    disabled={submitting}
                  />
                </FormGroup>
              </FormRow>

              <FormGroup>
                <Label>Notes</Label>
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this inquiry..."
                  disabled={submitting}
                />
              </FormGroup>
            </Section>

            {/* Products Section */}
            <Section>
              <SectionTitle>Products</SectionTitle>
              
              <DualColumnHeader>
                <ColumnLabel variant="desired">Desired (Customer Request)</ColumnLabel>
                <ColumnLabel variant="actual">Actual (Your Quote)</ColumnLabel>
              </DualColumnHeader>

              {productLines.length > 0 && (
                <ProductsTable>
                  <ProductsHeader>
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Desired $/unit</span>
                    <span>Actual $/unit</span>
                    <span>Delivery</span>
                    <span></span>
                  </ProductsHeader>
                  
                  {productLines.map((line) => (
                    <ProductRow key={line.tempId}>
                      <ProductSelect
                        value={line.product}
                        onChange={(e) => handleProductChange(line.tempId, e.target.value)}
                        disabled={submitting || loadingProducts}
                      >
                        <option value="">Select product...</option>
                        {productOptions.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.product_code} - {product.description_of_product_item}
                          </option>
                        ))}
                      </ProductSelect>
                      
                      <ProductInput
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateProductLine(line.tempId, { quantity: parseInt(e.target.value) || 1 })}
                        disabled={submitting}
                      />
                      
                      <ProductInput
                        type="number"
                        step="0.01"
                        placeholder="$0.00"
                        value={line.desired_price_per_unit || ''}
                        onChange={(e) => updateProductLine(line.tempId, { desired_price_per_unit: parseFloat(e.target.value) || undefined })}
                        disabled={submitting}
                      />
                      
                      <ProductInput
                        type="number"
                        step="0.01"
                        placeholder="$0.00"
                        value={line.actual_price_per_unit || ''}
                        onChange={(e) => updateProductLine(line.tempId, { actual_price_per_unit: parseFloat(e.target.value) || undefined })}
                        disabled={submitting}
                      />
                      
                      <ProductInput
                        type="date"
                        value={line.desired_delivery_date || ''}
                        onChange={(e) => updateProductLine(line.tempId, { desired_delivery_date: e.target.value })}
                        disabled={submitting}
                      />
                      
                      <RemoveButton
                        type="button"
                        onClick={() => removeProductLine(line.tempId)}
                        disabled={submitting}
                        title="Remove product"
                      >
                        ✕
                      </RemoveButton>
                    </ProductRow>
                  ))}
                </ProductsTable>
              )}

              <AddProductButton type="button" onClick={addProductLine} disabled={submitting}>
                + Add Product
              </AddProductButton>
            </Section>

            {/* Competitor Tracking */}
            <Section>
              <SectionTitle>Competitor Information (Optional)</SectionTitle>
              <FormRow>
                <FormGroup>
                  <Label>Competitor Names</Label>
                  <Input
                    type="text"
                    value={competitorNames}
                    onChange={(e) => setCompetitorNames(e.target.value)}
                    placeholder="e.g., Acme Corp, Beta Inc"
                    disabled={submitting}
                  />
                </FormGroup>
              </FormRow>
              <FormGroup>
                <Label>Competitor Pricing Notes</Label>
                <TextArea
                  value={competitorPricingNotes}
                  onChange={(e) => setCompetitorPricingNotes(e.target.value)}
                  placeholder="Notes about competitor pricing or offers..."
                  disabled={submitting}
                />
              </FormGroup>
            </Section>
          </ModalBody>

          <ModalFooter>
            <FooterInfo>
              {productLines.length} product{productLines.length !== 1 ? 's' : ''} added
            </FooterInfo>
            <FooterActions>
              <CancelButton type="button" onClick={handleClose} disabled={submitting}>
                Cancel
              </CancelButton>
              <SubmitButton type="submit" disabled={submitting || productLines.length === 0}>
                {submitting ? 'Creating...' : 'Create Inquiry'}
              </SubmitButton>
            </FooterActions>
          </ModalFooter>
        </form>
      </Modal>
    </Overlay>
  );
};

export default CreateInquiryModal;
