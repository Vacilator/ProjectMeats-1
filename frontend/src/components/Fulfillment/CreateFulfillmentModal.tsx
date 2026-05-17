/**
 * Create Fulfillment Modal
 *
 * Modal for creating fulfillments from accepted inquiries.
 * Uses GoldenFormShell for consistent form layout.
 *
 * Features:
 * - Smart supplier filtering (only suppliers with selected products)
 * - Partial fulfillment support (select quantities per line)
 * - Shipping carrier selection
 * - Tracking number input
 * - Estimated delivery date
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';

import { useZodForm } from '@/hooks/useZodForm';
import styled from 'styled-components';
import { businessApi } from '@/services/businessApi';
import { logger } from '@/utils/logger';
import {
  Fulfillment,
  Inquiry,
  InquiryProduct,
} from '../../types';
import {
  GoldenFormOverlay,
  GoldenFormContainer,
  GoldenFormHeader,
  GoldenFormTitleGroup,
  GoldenFormTitle,
  GoldenCloseButton,
  GoldenFormBody,
  GoldenSectionCard,
  GoldenSectionHeader,
  GoldenSectionIcon,
  GoldenSectionTitle,
  GoldenFieldGrid,
  GoldenFormGroup,
  GoldenLabel,
  GoldenInput,
  GoldenSelect,
  GoldenTextArea,
  GoldenFieldHint,
  GoldenFieldError,
  GoldenFormFooter,
  GoldenCancelButton,
  GoldenSubmitButton,
  GoldenCheckbox,
} from '@/components/Forms/GoldenFormShell';

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
// Styled Components (fulfillment-specific — no Golden equivalent)
// ============================================================================

const InquiryInfoCard = styled.div`
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: 8px;
  padding: 1rem;
`;

const InquiryInfoRow = styled.div`
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
`;

const InquiryInfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  .label {
    font-size: 12px;
    color: rgb(var(--color-text-secondary));
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .value {
    font-size: 14px;
    color: rgb(var(--color-text-primary));
    font-weight: 500;
  }
`;

const ProductsTable = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  overflow: hidden;
`;

const ProductsHeader = styled.div`
  display: grid;
  grid-template-columns: 40px 2fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(var(--color-primary), 0.1);
  font-size: 12px;
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

const ProductInput = styled(GoldenInput)`
  padding: 8px;
  font-size: 13px;
  min-height: 32px;
`;

const QuantityWarning = styled.span`
  color: rgb(var(--color-warning));
  font-size: 12px;
  margin-left: 4px;
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgba(var(--color-success), 0.1)';
      case 'pending': return 'rgba(var(--color-warning), 0.1)';
      case 'quoted': return 'rgba(var(--color-info), 0.1)';
      default: return 'rgba(var(--color-neutral), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgb(var(--color-success))';
      case 'pending': return 'rgb(var(--color-warning))';
      case 'quoted': return 'rgb(var(--color-info))';
      default: return 'rgb(var(--color-neutral))';
    }
  }};
`;

const ErrorBanner = styled.div`
  color: rgb(var(--color-error));
  font-size: 14px;
  padding: 12px;
  background: rgba(var(--color-error), 0.1);
  border-radius: 8px;
  margin-bottom: 16px;
`;

const FulfillmentFooterLayout = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const FooterInfo = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));

  .highlight {
    color: rgb(var(--color-primary));
    font-weight: 600;
  }
`;

const FooterActions = styled.div`
  display: flex;
  gap: 12px;
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
      const resp = await businessApi.get('inquiries/', {
        params: {
          entity_type: 'customer',
          ordering: '-inquiry_date',
          page_size: 200,
        },
      });

      const rows = (resp.data?.results ?? resp.data ?? []) as Record<string, unknown>[];
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
    } catch (_err) {
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
      const resp = await businessApi.get('inquiries/', {
        params: {
          entity_type: 'customer',
          customer: customerId,
          ordering: '-inquiry_date',
          page_size: 100,
        },
      });

      const rows = (resp.data?.results ?? resp.data ?? []) as Record<string, unknown>[];
      setInquiryOptions(
        rows.map((r) => {
          const id = String(r.id ?? '').trim();
          const num = String(r.inquiry_number ?? '').trim();
          const when = r.inquiry_date ? dayjs(String(r.inquiry_date)).format('MMM D, YYYY') : '';
          return { id, label: `${num || `Inquiry #${id}`}${when ? ` — ${when}` : ''}` };
        }).filter((r) => r.id)
      );
    } catch (_err) {
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
      const resp = await businessApi.get(`inquiries/${inquiryId}/`);
      setResolvedInquiry(resp.data as Inquiry);
    } catch (_err) {
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
  const fetchSuppliers = useCallback(async (productIds: string[]) => {
    setLoadingSuppliers(true);
    try {
      // Fetch suppliers that have any of the selected products
      const response = await businessApi.get('suppliers/', {
        params: { products__id__in: productIds.join(','), page_size: 100 }
      });
      const data = response.data.results || response.data;

      const options: SupplierOption[] = data.map((s: Record<string, unknown>) => ({
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
      logger.error('Failed to fetch suppliers:', err);
      setSupplierOptions([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [form]);

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
  }, [isOpen, resetFulfillmentFields, resolvedInquiry, fetchSuppliers]);

  // Load carriers
  useEffect(() => {
    if (isOpen) {
      fetchCarriers();
    }
  }, [isOpen]);


  const fetchCarriers = async () => {
    setLoadingCarriers(true);
    try {
      const response = await businessApi.get('carriers/', { params: { is_active: true, page_size: 100 } });
      const data = response.data.results || response.data;

      setCarrierOptions(data.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })));
    } catch (err) {
      logger.error('Failed to fetch carriers:', err);
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

      const response = await businessApi.post('fulfillments/', payload);

      resetForm();
      onSuccess(response.data);
      onClose();
    } catch (err: unknown) {
      logger.error('Failed to create fulfillment:', err);
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const respData = resp.data;
      let errorDetail: string;
      if (respData && typeof respData === 'object') {
        const d = respData as Record<string, unknown>;
        errorDetail = (typeof d.detail === 'string' ? d.detail : null)
          || (typeof d.message === 'string' ? d.message : null)
          || JSON.stringify(respData);
      } else {
        errorDetail = 'Failed to create fulfillment. Please try again.';
      }
      setError(errorDetail);
    }
  });

  if (!isOpen) return null;

  return (
    <GoldenFormOverlay onClick={handleClose}>
      <GoldenFormContainer $maxWidth="800px" onClick={(e) => e.stopPropagation()}>
        <GoldenFormHeader>
          <GoldenFormTitleGroup>
            <GoldenFormTitle>📦 Create Fulfillment</GoldenFormTitle>
          </GoldenFormTitleGroup>
          <GoldenCloseButton type="button" onClick={handleClose} aria-label="Close">
            ×
          </GoldenCloseButton>
        </GoldenFormHeader>

        <GoldenFormBody as="div">
          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Guided selection (when inquiry is not provided) */}
          {!inquiry && (
            <GoldenSectionCard>
              <GoldenSectionHeader>
                <GoldenSectionIcon>👤</GoldenSectionIcon>
                <GoldenSectionTitle>Select Customer &amp; Inquiry</GoldenSectionTitle>
              </GoldenSectionHeader>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel $required>Customer</GoldenLabel>
                  <GoldenSelect
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    disabled={submitting || loadingCustomers}
                  >
                    <option value="">{loadingCustomers ? 'Loading…' : 'Select customer'}</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </GoldenSelect>
                  <GoldenFieldHint>Customers are ordered by most recent inquiry created.</GoldenFieldHint>
                </GoldenFormGroup>

                <GoldenFormGroup>
                  <GoldenLabel $required>Inquiry</GoldenLabel>
                  <GoldenSelect
                    value={selectedInquiryId}
                    onChange={(e) => setSelectedInquiryId(e.target.value)}
                    disabled={submitting || !selectedCustomerId || loadingInquiries}
                  >
                    <option value="">{loadingInquiries ? 'Loading…' : 'Select inquiry'}</option>
                    {inquiryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </GoldenSelect>
                  <GoldenFieldHint>Inquiries are ordered most recent first.</GoldenFieldHint>
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </GoldenSectionCard>
          )}

          {/* Inquiry Info */}
          {resolvedInquiry && (
            <GoldenSectionCard>
              <GoldenSectionHeader>
                <GoldenSectionIcon>📋</GoldenSectionIcon>
                <GoldenSectionTitle>Inquiry Information</GoldenSectionTitle>
              </GoldenSectionHeader>
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
            </GoldenSectionCard>
          )}

          {/* Shipping Information */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>🚚</GoldenSectionIcon>
              <GoldenSectionTitle>Shipping Information</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel>Shipping Type</GoldenLabel>
                <GoldenSelect
                  {...form.register('shippingType')}
                  disabled={submitting}
                >
                  <option value="tenant">Tenant</option>
                  <option value="customer_pickup">Customer Pick-Up</option>
                  <option value="supplier_delivering">Supplier Delivering</option>
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel $required>Supplier</GoldenLabel>
                <GoldenSelect
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
                </GoldenSelect>
                {form.formState.errors.supplierId?.message && (
                  <GoldenFieldError role="alert">{String(form.formState.errors.supplierId.message)}</GoldenFieldError>
                )}
                <GoldenFieldHint>Only suppliers with selected products are shown</GoldenFieldHint>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Carrier</GoldenLabel>
                <GoldenSelect
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
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Estimated Delivery</GoldenLabel>
                <GoldenInput
                  type="date"
                  disabled={submitting}
                  {...form.register('estimatedDelivery')}
                />
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Tracking Numbers</GoldenLabel>
                <GoldenInput
                  type="text"
                  placeholder="Comma-separated tracking numbers"
                  disabled={submitting}
                  {...form.register('trackingNumbers')}
                />
                <GoldenFieldHint>Enter multiple tracking numbers separated by commas</GoldenFieldHint>
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Products to Fulfill */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>📦</GoldenSectionIcon>
              <GoldenSectionTitle>
                Products to Fulfill
                {isPartialFulfillment && (
                  <QuantityWarning> (Partial Fulfillment)</QuantityWarning>
                )}
              </GoldenSectionTitle>
            </GoldenSectionHeader>

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
                  <GoldenCheckbox
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleLineItem(item.inquiryProductId)}
                    disabled={submitting}
                  />

                  <div>
                    <div style={{ fontWeight: 500 }}>{item.productCode}</div>
                    <div style={{ fontSize: '12px', color: 'rgb(var(--color-text-secondary))' }}>
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
          </GoldenSectionCard>

          {/* Notes */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>📝</GoldenSectionIcon>
              <GoldenSectionTitle>Notes</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFormGroup>
              <GoldenTextArea
                placeholder="Add any notes about this fulfillment..."
                disabled={submitting}
                {...form.register('notes')}
              />
            </GoldenFormGroup>
          </GoldenSectionCard>
        </GoldenFormBody>

        <GoldenFormFooter>
          <FulfillmentFooterLayout>
            <FooterInfo>
              <span className="highlight">{selectedItems.length}</span> of {lineItems.length} products selected
              {' • '}
              Total: <span className="highlight">${totalValue.toFixed(2)}</span>
              {isPartialFulfillment && ' (Partial)'}
            </FooterInfo>
            <FooterActions>
              <GoldenCancelButton type="button" onClick={handleClose} disabled={submitting}>
                Cancel
              </GoldenCancelButton>
              <GoldenSubmitButton
                type="button"
                onClick={handleSubmit}
                disabled={submitting || selectedItems.length === 0}
                $loading={submitting}
              >
                {submitting ? 'Creating...' : 'Create Fulfillment'}
              </GoldenSubmitButton>
            </FooterActions>
          </FulfillmentFooterLayout>
        </GoldenFormFooter>
      </GoldenFormContainer>
    </GoldenFormOverlay>
  );
};

export default CreateFulfillmentModal;
