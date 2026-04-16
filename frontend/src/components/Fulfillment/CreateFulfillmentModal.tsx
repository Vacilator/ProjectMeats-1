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
import { z } from 'zod';

import { useZodForm } from '@/hooks/useZodForm';
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
  onSuccess: (fulfillment: Fulfillment | Fulfillment[]) => void;
  /** Optional: when provided, the modal acts as “Create fulfillment from this inquiry” */
  inquiry?: Inquiry;
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
// FORM (RHF + Zod)
// ============================================================================

const createFulfillmentFormSchema = z.object({
  shippingType: z.enum(['tenant', 'customer_pickup', 'supplier_delivering']),
  supplierId: z.string().trim().min(1, 'Please select a supplier'),
  carrierId: z.string().optional().default(''),
  trackingNumbers: z.string().optional().default(''),
  estimatedDelivery: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

type CreateFulfillmentFormValues = z.infer<typeof createFulfillmentFormSchema>;

const createFulfillmentFormDefaults: CreateFulfillmentFormValues = {
  shippingType: 'tenant',
  supplierId: '',
  carrierId: '',
  trackingNumbers: '',
  estimatedDelivery: '',
  notes: '',
};

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
  box-shadow: var(--shadow-float);
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

const FieldError = styled.div`
  color: rgb(var(--color-error));
  font-size: 0.75rem;
  margin-top: 0.25rem;
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
      case 'accepted': return 'rgb(34, 197, 94)';
      case 'pending': return 'rgb(234, 179, 8)';
      case 'quoted': return 'rgb(59, 130, 246)';
      default: return 'rgb(107, 114, 128)';
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
  const [resolvedInquiry, setResolvedInquiry] = useState<Inquiry | null>(inquiry ?? null);

  // Guided selection (when inquiry is not provided)
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [inquiryOptions, setInquiryOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingInquiries, setLoadingInquiries] = useState(false);

  const form = useZodForm<CreateFulfillmentFormValues>(createFulfillmentFormSchema, {
    defaultValues: createFulfillmentFormDefaults,
  });

  const submitting = form.formState.isSubmitting;

  // Product lines
  const [lineItems, setLineItems] = useState<FulfillmentLineItem[]>([]);

  // Options
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([]);

  // Loading states
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guided selection: load customers ordered by most recent inquiry
  const loadRecentCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const resp = await apiClient.get('inquiries/', {
        params: {
          entity_type: 'customer',
          ordering: '-inquiry_date',
          page_size: 200,
        },
      });

      const rows = (resp.data?.results ?? resp.data ?? []) as any[];
      const seen = new Set<string>();
      const customers: Array<{ id: string; name: string }> = [];

      for (const r of rows) {
        const id = r.customer != null ? String(r.customer) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const name = String(r.customer_name || r.entity_name || '').trim();
        customers.push({ id, name: name || `Customer #${id}` });
      }

      setCustomerOptions(customers);
    } catch (err) {
      setCustomerOptions([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const loadCustomerInquiries = useCallback(async (customerId: string) => {
    if (!customerId) {
      setInquiryOptions([]);
      return;
    }

    setLoadingInquiries(true);
    try {
      const resp = await apiClient.get('inquiries/', {
        params: {
          entity_type: 'customer',
          customer: customerId,
          ordering: '-inquiry_date',
          page_size: 100,
        },
      });

      const rows = (resp.data?.results ?? resp.data ?? []) as any[];
      setInquiryOptions(
        rows.map((r) => {
          const id = String(r.id ?? '').trim();
          const num = String(r.inquiry_number ?? '').trim();
          const when = r.inquiry_date ? new Date(r.inquiry_date).toLocaleString() : '';
          return { id, label: `${num || `Inquiry #${id}`}${when ? ` — ${when}` : ''}` };
        }).filter((r) => r.id)
      );
    } catch (err) {
      setInquiryOptions([]);
    } finally {
      setLoadingInquiries(false);
    }
  }, []);

  const loadInquiryDetail = useCallback(async (inquiryId: string) => {
    if (!inquiryId) {
      setResolvedInquiry(null);
      return;
    }

    try {
      const resp = await apiClient.get(`inquiries/${inquiryId}/`);
      setResolvedInquiry(resp.data as Inquiry);
    } catch (err) {
      setResolvedInquiry(null);
    }
  }, []);

  // When opening: either use provided inquiry, or run guided selection.
  useEffect(() => {
    if (!isOpen) return;

    if (inquiry) {
      setResolvedInquiry(inquiry);
      setSelectedCustomerId(inquiry.customer ? String(inquiry.customer) : '');
      setSelectedInquiryId(inquiry.id);
      return;
    }

    setResolvedInquiry(null);
    setSelectedInquiryId('');
    setSelectedCustomerId('');
    setInquiryOptions([]);
    void loadRecentCustomers();
  }, [inquiry, isOpen, loadRecentCustomers]);

  // Load inquiry options when customer changes (guided mode)
  useEffect(() => {
    if (!isOpen) return;
    if (inquiry) return; // locked

    setSelectedInquiryId('');
    setResolvedInquiry(null);
    void loadCustomerInquiries(selectedCustomerId);
  }, [inquiry, isOpen, loadCustomerInquiries, selectedCustomerId]);

  // Load inquiry detail when selected (guided mode)
  useEffect(() => {
    if (!isOpen) return;
    if (inquiry) return;
    void loadInquiryDetail(selectedInquiryId);
  }, [inquiry, isOpen, loadInquiryDetail, selectedInquiryId]);

  const resetFulfillmentFields = useCallback((next?: Partial<CreateFulfillmentFormValues>) => {
    form.reset({ ...createFulfillmentFormDefaults, ...(next || {}) });
    setLineItems([]);
    setError(null);
  }, [form]);

  // Initialize line items from inquiry products
  useEffect(() => {
    if (isOpen && resolvedInquiry?.products) {
      // When the inquiry changes, reset fulfillment-specific fields.
      resetFulfillmentFields({ shippingType: resolvedInquiry.shipping_type || 'tenant' });

      const items: FulfillmentLineItem[] = resolvedInquiry.products.map((p: InquiryProduct) => ({
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

      const productIds = resolvedInquiry.products.map((p: InquiryProduct) => p.product);
      fetchSuppliers(productIds);
    }
  }, [isOpen, resetFulfillmentFields, resolvedInquiry]);

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
        form.setValue('supplierId', options[0].id, { shouldValidate: true, shouldDirty: true });
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

  function resetForm(): void {
    resetFulfillmentFields();

    if (!inquiry) {
      setResolvedInquiry(null);
      setSelectedCustomerId('');
      setSelectedInquiryId('');
      setInquiryOptions([]);
    }
  }

  function handleClose(): void {
    if (!submitting) {
      resetForm();
      onClose();
    }
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    setError(null);

    if (!resolvedInquiry) {
      setError('Please select a customer and inquiry');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please select at least one product to fulfill');
      return;
    }

    try {
      const payload = {
        inquiry: resolvedInquiry.id,
        supplier: values.supplierId,
        customer: resolvedInquiry.customer || undefined,
        carrier: values.carrierId || undefined,
        shipping_type: values.shippingType,
        tracking_numbers: values.trackingNumbers
          ? values.trackingNumbers.split(',').map(t => t.trim()).filter(Boolean)
          : undefined,
        expected_delivery: values.estimatedDelivery || undefined,
        notes: values.notes || undefined,
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
    }
  });

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

            {/* Selection (guided mode) */}
            {!inquiry && (
              <Section>
                <SectionTitle>Select Customer & Inquiry</SectionTitle>
                <FormRow>
                  <FormGroup>
                    <Label>Customer *</Label>
                    <Select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      disabled={submitting || loadingCustomers}
                    >
                      <option value="">{loadingCustomers ? 'Loading…' : 'Select customer'}</option>
                      {customerOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    <HelpText>Customers are ordered by most recent inquiry created.</HelpText>
                  </FormGroup>

                  <FormGroup>
                    <Label>Inquiry *</Label>
                    <Select
                      value={selectedInquiryId}
                      onChange={(e) => setSelectedInquiryId(e.target.value)}
                      disabled={submitting || !selectedCustomerId || loadingInquiries}
                    >
                      <option value="">{loadingInquiries ? 'Loading…' : 'Select inquiry'}</option>
                      {inquiryOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </Select>
                    <HelpText>Inquiries are ordered most recent first.</HelpText>
                  </FormGroup>
                </FormRow>
              </Section>
            )}

            {/* Inquiry Info */}
            {resolvedInquiry && (
              <Section>
                <SectionTitle>Inquiry Information</SectionTitle>
                <InquiryInfoCard>
                  <InquiryInfoRow>
                    <InquiryInfoItem>
                      <span className="label">Inquiry #</span>
                      <span className="value">{resolvedInquiry.inquiry_number}</span>
                    </InquiryInfoItem>
                    <InquiryInfoItem>
                      <span className="label">Status</span>
                      <StatusBadge status={resolvedInquiry.status}>{resolvedInquiry.status}</StatusBadge>
                    </InquiryInfoItem>
                    <InquiryInfoItem>
                      <span className="label">Customer</span>
                      <span className="value">{resolvedInquiry.customer_name || resolvedInquiry.supplier_name}</span>
                    </InquiryInfoItem>
                    {(resolvedInquiry.contact_snapshot_name || resolvedInquiry.contact_name) && (
                      <InquiryInfoItem>
                        <span className="label">Contact</span>
                        <span className="value">{resolvedInquiry.contact_snapshot_name || resolvedInquiry.contact_name}</span>
                      </InquiryInfoItem>
                    )}
                    <InquiryInfoItem>
                      <span className="label">Total Value</span>
                      <span className="value">${resolvedInquiry.total_actual?.toLocaleString() || resolvedInquiry.total_desired?.toLocaleString() || '0'}</span>
                    </InquiryInfoItem>
                  </InquiryInfoRow>
                </InquiryInfoCard>
              </Section>
            )}

            {/* Supplier & Carrier Selection */}
            <Section>
              <SectionTitle>Shipping Information</SectionTitle>
              <FormRow>
                <FormGroup>
                  <Label>Shipping Type</Label>
                  <Select
                    {...form.register('shippingType')}
                    disabled={submitting}
                  >
                    <option value="tenant">Tenant</option>
                    <option value="customer_pickup">Customer Pick-Up</option>
                    <option value="supplier_delivering">Supplier Delivering</option>
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>Supplier *</Label>
                  <Select
                    {...form.register('supplierId')}
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
                  {form.formState.errors.supplierId?.message && (
                    <FieldError role="alert">{String(form.formState.errors.supplierId.message)}</FieldError>
                  )}
                  <HelpText>Only suppliers with selected products are shown</HelpText>
                </FormGroup>

                <FormGroup>
                  <Label>Carrier</Label>
                  <Select
                    {...form.register('carrierId')}
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
                    placeholder="Comma-separated tracking numbers"
                    disabled={submitting}
                    {...form.register('trackingNumbers')}
                  />
                  <HelpText>Enter multiple tracking numbers separated by commas</HelpText>
                </FormGroup>

                <FormGroup>
                  <Label>Estimated Delivery</Label>
                  <Input
                    type="date"
                    disabled={submitting}
                    {...form.register('estimatedDelivery')}
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
                  <span />
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
                  placeholder="Add any notes about this fulfillment..."
                  disabled={submitting}
                  {...form.register('notes')}
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
