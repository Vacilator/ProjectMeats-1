import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message, Spin } from 'antd';
import {
  Truck,
  Users,
  FileText,
  Building2,
  Package,
  ClipboardList,
  X,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import { useApprovalGate } from '@/hooks/useApprovalGate';
import ApprovalPreviewModal from '@/components/AIAssistant/ApprovalPreviewModal';
import { SmartProductAutocomplete } from '@/components/Inquiry/SmartProductAutocomplete';
import {
  GoldenFormOverlay,
  GoldenFormContainer,
  GoldenFormHeader,
  GoldenFormTitleGroup,
  GoldenFormTitle,
  GoldenCloseButton,
  GoldenFormBody,
  GoldenFormFooter,
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
  GoldenCheckboxRow,
  GoldenCheckbox,
  GoldenAutoFilledBadge,
  GoldenDateTimeStamp,
  GoldenSubmitButton,
  GoldenCancelButton,
} from '@/components/Forms/GoldenFormShell';
// ============================================================================
// Types
// ============================================================================
interface CarrierOption {
  id: number | string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  accounting_payable_contact_name?: string;
  accounting_payable_contact_phone?: string;
  accounting_payable_contact_email?: string;
  how_carrier_make_appointment?: string;
}
interface EntityOption {
  id: number | string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}
interface CarrierPOFormValues {
  date_time_stamp: string;
  carrier: string;
  carrier_address: string;
  carrier_city: string;
  carrier_state_zip: string;
  supplier: string;
  customer: string;
  pick_up_date: string;
  delivery_date: string;
  order_number: string;
  carrier_release_num: string;
  supplier_confirmation_order_number: string;
  delivery_po_number: string;
  type_of_protein: string;
  product: string;
  description_of_product_item: string;
  fresh_or_frozen: string;
  package_type: string;
  quantity: string;
  total_weight: string;
  weight_unit: string;
  net_or_catch: string;
  pickup_building_name: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state_zip: string;
  delivery_building_name: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state_zip: string;
  how_carrier_make_appointment: string;
  shipping_contact_name: string;
  shipping_contact_phone: string;
  shipping_contact_email: string;
  receiving_contact_name: string;
  receiving_contact_phone: string;
  receiving_contact_email: string;
  accounting_payable_contact_name: string;
  accounting_payable_contact_phone: string;
  accounting_payable_contact_email: string;
  edible_or_inedible: string;
  tested_product: boolean;
  departments_array: string[];
  notes: string;
}
export interface CarrierPOFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<CarrierPOFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
  entityId?: number | string;
}
// ============================================================================
// Constants
// ============================================================================
const PROTEIN_TYPES = [
  'Beef', 'Chicken', 'Fowl', 'Turkey', 'Lamb', 'Veal', 'Seafood',
  'Venison', 'Bison', 'Duck', 'Rabbit', 'Goat', 'Mutton', 'Pork',
  'Fish', 'Horse', 'Other',
];
const PACKAGE_TYPES = [
  'Boxed wax lined', 'Boxed Poly', 'Combos', 'Nude Block', 'Boxed COV',
  'Boxed CO2', 'Combo bins', 'Totes', 'Bags', 'Bulk', 'Poly-Multiple', 'Nude',
];
const APPOINTMENT_METHODS = ['Email', 'Phone', 'Website', 'FCFS', 'First Come First Serve'];
const DEPARTMENTS = ['BOL', 'COA', 'POD'];
// ============================================================================
// Helpers
// ============================================================================
const genNum = (pfx: string) => {
  const d = new Date();
  return `${pfx}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
};
const addDays = (date: Date, days: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};
const formatDateTime = (date: Date): string => {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
const getDefaultFormValues = (initial?: Partial<CarrierPOFormValues>): CarrierPOFormValues => ({
  date_time_stamp: new Date().toISOString(),
  carrier: '',
  carrier_address: '',
  carrier_city: '',
  carrier_state_zip: '',
  supplier: '',
  customer: '',
  pick_up_date: addDays(new Date(), 2),
  delivery_date: addDays(new Date(), 7),
  order_number: '',
  carrier_release_num: '',
  supplier_confirmation_order_number: '',
  delivery_po_number: '',
  type_of_protein: '',
  product: '',
  description_of_product_item: '',
  fresh_or_frozen: '',
  package_type: '',
  quantity: '',
  total_weight: '',
  weight_unit: 'LBS',
  net_or_catch: 'Net',
  pickup_building_name: '',
  pickup_address: '',
  pickup_city: '',
  pickup_state_zip: '',
  delivery_building_name: '',
  delivery_address: '',
  delivery_city: '',
  delivery_state_zip: '',
  how_carrier_make_appointment: '',
  shipping_contact_name: '',
  shipping_contact_phone: '',
  shipping_contact_email: '',
  receiving_contact_name: '',
  receiving_contact_phone: '',
  receiving_contact_email: '',
  accounting_payable_contact_name: '',
  accounting_payable_contact_phone: '',
  accounting_payable_contact_email: '',
  edible_or_inedible: 'Edible',
  tested_product: false,
  departments_array: [],
  notes: '',
  ...initial,
});
// ============================================================================
// Styled Components (form-specific; shared primitives come from GoldenFormShell)
// ============================================================================
const CollapseChevron = styled.span<{ $expanded: boolean }>`
  display: flex;
  align-items: center;
  transition: transform 0.2s;
  color: rgb(var(--color-text-secondary));
  transform: rotate(${({ $expanded }) => ($expanded ? '0deg' : '-90deg')});
`;
const SectionContent = styled.div<{ $expanded: boolean }>`
  display: ${({ $expanded }) => ($expanded ? 'block' : 'none')};
`;
const SearchSelectWrapper = styled.div`
  position: relative;
  display: flex;
  gap: 8px;
`;
const CreateNewBtn = styled.button`
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
  border: 1.5px solid rgba(var(--color-primary), 0.2);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  transition: all 0.2s;
  min-height: 42px;
  &:hover {
    background: rgba(var(--color-primary), 0.12);
    border-color: rgb(var(--color-primary));
  }
`;
const InlineCarrierForm = styled.div`
  background: rgba(var(--color-primary), 0.03);
  border: 1px solid rgba(var(--color-primary), 0.15);
  border-radius: 10px;
  padding: 20px;
  margin-top: 12px;
`;
const InlineFormTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-primary));
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const InlineFormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
`;
const SmallBtn = styled.button<{ $primary?: boolean }>`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: ${({ $primary }) =>
    $primary ? 'none' : '1.5px solid rgb(var(--color-border))'};
  background: ${({ $primary }) =>
    $primary ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${({ $primary }) =>
    $primary ? 'white' : 'rgb(var(--color-text-primary))'};
  &:hover {
    opacity: 0.9;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const SubSectionLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 12px;
  margin-top: 20px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgb(var(--color-border));
  &:first-child {
    margin-top: 0;
  }
`;
// ============================================================================
// Component
// ============================================================================
export const CarrierPOForm: React.FC<CarrierPOFormProps> = ({
  mode,
  initialValues,
  onSuccess,
  onCancel,
  entityId,
}) => {
  const [formValues, setFormValues] = useState<CarrierPOFormValues>(() =>
    getDefaultFormValues(initialValues),
  );
  const [submitting, setSubmitting] = useState(false);
  const [createdAt] = useState(() => new Date());
  const approvalGate = useApprovalGate();
  // Lookups
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [suppliers, setSuppliers] = useState<EntityOption[]>([]);
  const [customers, setCustomers] = useState<EntityOption[]>([]);
  const [loadingCarrier, setLoadingCarrier] = useState(false);
  // Auto-filled tracking
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  // Carrier search
  const [carrierSearch, _setCarrierSearch] = useState('');
  // Inline carrier creation
  const [showInlineCarrier, setShowInlineCarrier] = useState(false);
  const [inlineCarrierName, setInlineCarrierName] = useState('');
  const [inlineCarrierType, setInlineCarrierType] = useState('');
  const [creatingCarrier, setCreatingCarrier] = useState(false);
  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    carrier: true,
    orders: true,
    product: true,
    logistics: true,
    contacts: true,
    notes: false,
  });
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);
  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [carrierResp, supplierResp, customerResp] = await Promise.all([
          businessApi.get('carriers/'),
          businessApi.get('suppliers/'),
          businessApi.get('customers/'),
        ]);
        const carrierData = carrierResp.data?.results ?? carrierResp.data ?? [];
        const supplierData = supplierResp.data?.results ?? supplierResp.data ?? [];
        const customerData = customerResp.data?.results ?? customerResp.data ?? [];
        setCarriers(Array.isArray(carrierData) ? carrierData : []);
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
        setCustomers(Array.isArray(customerData) ? customerData : []);
      } catch {
        message.error('Failed to load reference data');
      }
    };
    loadData();
  }, []);
  // Filtered carriers for search
  const filteredCarriers = useMemo(() => {
    if (!carrierSearch.trim()) return carriers;
    const q = carrierSearch.toLowerCase();
    return carriers.filter((c) => c.name.toLowerCase().includes(q));
  }, [carriers, carrierSearch]);
  // Generic field change handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );
  // Auto-generate number on blur if empty
  const handleAutoGenBlur = useCallback(
    (field: keyof CarrierPOFormValues, prefix: string) => {
      setFormValues((prev) => {
        if (!prev[field]) {
          const num = genNum(prefix);
          return { ...prev, [field]: num };
        }
        return prev;
      });
    },
    [],
  );
  // Carrier auto-populate
  const handleCarrierSelect = useCallback(
    async (carrierId: string) => {
      setFormValues((prev) => ({ ...prev, carrier: carrierId }));
      setAutoFilledFields(new Set());
      if (!carrierId) return;
      try {
        setLoadingCarrier(true);
        const resp = await businessApi.get(`carriers/${carrierId}/`);
        const c = resp.data;
        const newAutoFields = new Set<string>();
        setFormValues((prev) => {
          const updates: Partial<CarrierPOFormValues> = {
            carrier: carrierId,
          };
          if (c.address) {
            updates.carrier_address = c.address;
            newAutoFields.add('carrier_address');
          }
          if (c.city) {
            updates.carrier_city = c.city;
            newAutoFields.add('carrier_city');
          }
          if (c.state || c.zip_code) {
            updates.carrier_state_zip = `${c.state || ''} ${c.zip_code || ''}`.trim();
            newAutoFields.add('carrier_state_zip');
          }
          if (c.accounting_payable_contact_name) {
            updates.accounting_payable_contact_name = c.accounting_payable_contact_name;
            newAutoFields.add('accounting_payable_contact_name');
          }
          if (c.accounting_payable_contact_phone) {
            updates.accounting_payable_contact_phone = c.accounting_payable_contact_phone;
            newAutoFields.add('accounting_payable_contact_phone');
          }
          if (c.accounting_payable_contact_email) {
            updates.accounting_payable_contact_email = c.accounting_payable_contact_email;
            newAutoFields.add('accounting_payable_contact_email');
          }
          if (c.how_carrier_make_appointment) {
            updates.how_carrier_make_appointment = c.how_carrier_make_appointment;
            newAutoFields.add('how_carrier_make_appointment');
          }
          return { ...prev, ...updates };
        });
        setAutoFilledFields(newAutoFields);
      } catch {
        message.error('Failed to load carrier details');
      } finally {
        setLoadingCarrier(false);
      }
    },
    [],
  );
  // Supplier auto-populate (pickup info)
  const handleSupplierSelect = useCallback(
    async (supplierId: string) => {
      setFormValues((prev) => ({ ...prev, supplier: supplierId }));
      if (!supplierId) return;
      try {
        const resp = await businessApi.get(`suppliers/${supplierId}/`);
        const s = resp.data;
        setFormValues((prev) => ({
          ...prev,
          pickup_building_name: s.name || '',
          pickup_address: s.address || '',
          pickup_city: s.city || '',
          pickup_state_zip: `${s.state || ''} ${s.zip_code || ''}`.trim(),
          shipping_contact_name: s.contact_person || '',
          shipping_contact_phone: s.phone || '',
          shipping_contact_email: s.email || '',
        }));
        setAutoFilledFields((prev) => new Set([
          ...prev,
          'pickup_building_name', 'pickup_address', 'pickup_city', 'pickup_state_zip',
          'shipping_contact_name', 'shipping_contact_phone', 'shipping_contact_email',
        ]));
      } catch {
        message.error('Failed to load supplier details');
      }
    },
    [],
  );
  // Customer auto-populate (delivery info)
  const handleCustomerSelect = useCallback(
    async (customerId: string) => {
      setFormValues((prev) => ({ ...prev, customer: customerId }));
      if (!customerId) return;
      try {
        const resp = await businessApi.get(`customers/${customerId}/`);
        const c = resp.data;
        setFormValues((prev) => ({
          ...prev,
          delivery_building_name: c.name || '',
          delivery_address: c.address || '',
          delivery_city: c.city || '',
          delivery_state_zip: `${c.state || ''} ${c.zip_code || ''}`.trim(),
          receiving_contact_name: c.contact_person || '',
          receiving_contact_phone: c.phone || '',
          receiving_contact_email: c.email || '',
        }));
        setAutoFilledFields((prev) => new Set([
          ...prev,
          'delivery_building_name', 'delivery_address', 'delivery_city', 'delivery_state_zip',
          'receiving_contact_name', 'receiving_contact_phone', 'receiving_contact_email',
        ]));
      } catch {
        message.error('Failed to load customer details');
      }
    },
    [],
  );
  // Inline carrier creation
  const handleCreateInlineCarrier = useCallback(async () => {
    if (!inlineCarrierName.trim()) {
      message.warning('Carrier name is required');
      return;
    }
    setCreatingCarrier(true);
    try {
      const resp = await businessApi.post('carriers/', {
        name: inlineCarrierName.trim(),
        carrier_type: inlineCarrierType || undefined,
        is_active: true,
      });
      const newCarrier = resp.data;
      setCarriers((prev) => [...prev, newCarrier]);
      setShowInlineCarrier(false);
      setInlineCarrierName('');
      setInlineCarrierType('');
      message.success(`Carrier "${newCarrier.name}" created`);
      // Auto-select the new carrier
      await handleCarrierSelect(String(newCarrier.id));
    } catch {
      message.error('Failed to create carrier');
    } finally {
      setCreatingCarrier(false);
    }
  }, [inlineCarrierName, inlineCarrierType, handleCarrierSelect]);
  // Department checkbox handler
  const handleDepartmentToggle = useCallback((dept: string) => {
    setFormValues((prev) => {
      const arr = prev.departments_array;
      const next = arr.includes(dept) ? arr.filter((d) => d !== dept) : [...arr, dept];
      return { ...prev, departments_array: next };
    });
  }, []);
  // Build payload
  const buildPayload = useCallback(() => {
    return {
      carrier: formValues.carrier ? parseInt(String(formValues.carrier)) : undefined,
      supplier: formValues.supplier ? parseInt(String(formValues.supplier)) : undefined,
      customer: formValues.customer ? parseInt(String(formValues.customer)) : undefined,
      pick_up_date: formValues.pick_up_date || undefined,
      delivery_date: formValues.delivery_date || undefined,
      order_number: formValues.order_number || undefined,
      carrier_release_num: formValues.carrier_release_num || undefined,
      supplier_confirmation_order_number: formValues.supplier_confirmation_order_number || undefined,
      delivery_po_number: formValues.delivery_po_number || undefined,
      type_of_protein: formValues.type_of_protein || undefined,
      product: formValues.product || undefined,
      description_of_product_item: formValues.description_of_product_item || undefined,
      fresh_or_frozen: formValues.fresh_or_frozen || undefined,
      package_type: formValues.package_type || undefined,
      quantity: formValues.quantity ? parseInt(formValues.quantity) : undefined,
      total_weight: formValues.total_weight ? parseFloat(formValues.total_weight) : undefined,
      weight_unit: formValues.weight_unit || undefined,
      net_or_catch: formValues.net_or_catch || undefined,
      pickup_building_name: formValues.pickup_building_name || undefined,
      pickup_address: formValues.pickup_address || undefined,
      pickup_city: formValues.pickup_city || undefined,
      pickup_state_zip: formValues.pickup_state_zip || undefined,
      delivery_building_name: formValues.delivery_building_name || undefined,
      delivery_address: formValues.delivery_address || undefined,
      delivery_city: formValues.delivery_city || undefined,
      delivery_state_zip: formValues.delivery_state_zip || undefined,
      how_carrier_make_appointment: formValues.how_carrier_make_appointment || undefined,
      shipping_contact_name: formValues.shipping_contact_name || undefined,
      shipping_contact_phone: formValues.shipping_contact_phone || undefined,
      shipping_contact_email: formValues.shipping_contact_email || undefined,
      receiving_contact_name: formValues.receiving_contact_name || undefined,
      receiving_contact_phone: formValues.receiving_contact_phone || undefined,
      receiving_contact_email: formValues.receiving_contact_email || undefined,
      accounting_payable_contact_name: formValues.accounting_payable_contact_name || undefined,
      accounting_payable_contact_phone: formValues.accounting_payable_contact_phone || undefined,
      accounting_payable_contact_email: formValues.accounting_payable_contact_email || undefined,
      edible_or_inedible: formValues.edible_or_inedible || undefined,
      tested_product: formValues.tested_product,
      departments_array: formValues.departments_array.length > 0 ? formValues.departments_array : undefined,
      notes: formValues.notes || undefined,
    };
  }, [formValues]);
  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!formValues.carrier) {
      message.warning('Please select a carrier');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      // Approval gate: intercept before external send
      const gateResult = await approvalGate.intercept({
        requestType: 'carrier_release',
        subject: `Carrier PO ${formValues.carrier_release_num || 'New'}`,
        recipientType: 'carrier',
        contentPreview: `Carrier PO for freight order`,
        sourceEntityType: 'carrier_release',
      });
      if (!gateResult.approved) {
        setSubmitting(false);
        return;
      }
      if (mode === 'edit' && entityId) {
        await businessApi.patch(`freight-orders/${entityId}/`, payload);
      } else {
        await businessApi.post('freight-orders/', payload);
      }
      message.success(
        mode === 'edit'
          ? 'Carrier PO updated successfully!'
          : 'Carrier PO created successfully!',
      );
      onSuccess();
    } catch (err) {
      const error = err as Error;
      message.error(error.message || 'Failed to save carrier PO');
    } finally {
      setSubmitting(false);
    }
  }, [formValues.carrier, buildPayload, mode, entityId, onSuccess]);
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );
  const isAutoFilled = useCallback(
    (field: string) => autoFilledFields.has(field),
    [autoFilledFields],
  );
  return (
    <GoldenFormOverlay onClick={handleBackdropClick}>
      <GoldenFormContainer $maxWidth="1020px">
        {/* Header */}
        <GoldenFormHeader>
          <GoldenFormTitleGroup>
            <ClipboardList size={24} color="rgb(var(--color-primary))" />
            <GoldenFormTitle>
              {mode === 'edit' ? 'Edit Carrier PO' : 'New Carrier PO (Freight Order)'}
            </GoldenFormTitle>
          </GoldenFormTitleGroup>
          <GoldenCloseButton onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </GoldenCloseButton>
        </GoldenFormHeader>
        <GoldenFormBody as="div">
          <GoldenDateTimeStamp>
            📅 Created: {formatDateTime(createdAt)}
          </GoldenDateTimeStamp>
          {/* Section 1: Carrier Information */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('carrier')}>
              <GoldenSectionIcon><Truck size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>🚚 Carrier Information</GoldenSectionTitle>
              {loadingCarrier && <Spin size="small" />}
              <CollapseChevron $expanded={!!expandedSections.carrier}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.carrier}>
              <GoldenFormGroup $span={2}>
                <GoldenLabel $required>Carrier</GoldenLabel>
                <SearchSelectWrapper>
                  
<GoldenSelect
                    name="carrier"
                    value={formValues.carrier}
                    onChange={(e) => handleCarrierSelect(e.target.value)}
                    style={{ flex: 1 }}
                    aria-label="Select Carrier"
                  >
                    <option value="">Search or select a carrier…</option>
                    {filteredCarriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </GoldenSelect>
                  <CreateNewBtn
                    type="button"
                    onClick={() => setShowInlineCarrier(!showInlineCarrier)}
                    aria-label="Create New Carrier"
                  >
                    <Plus size={14} /> New
                  </CreateNewBtn>
                </SearchSelectWrapper>
              </GoldenFormGroup>
              {/* Inline carrier create */}
              {showInlineCarrier && (
                <InlineCarrierForm>
                  <InlineFormTitle>
                    <Plus size={16} /> Quick Create Carrier
                  </InlineFormTitle>
                  <GoldenFieldGrid>
                    <GoldenFormGroup>
                      <GoldenLabel $required>Carrier Name</GoldenLabel>
                      
<GoldenInput
                        value={inlineCarrierName}
                        onChange={(e) => setInlineCarrierName(e.target.value)}
                        placeholder="Enter carrier name"
                        aria-label="New Carrier Name"
                      />
                    </GoldenFormGroup>
                    <GoldenFormGroup>
                      <GoldenLabel>Carrier Type</GoldenLabel>
                      
<GoldenSelect
                        value={inlineCarrierType}
                        onChange={(e) => setInlineCarrierType(e.target.value)}
                        aria-label="New Carrier Type"
                      >
                        <option value="">Select type…</option>
                        <option value="Truck">Truck</option>
                        <option value="Rail">Rail</option>
                        <option value="Ocean">Ocean</option>
                        <option value="Air">Air</option>
                      </GoldenSelect>
                    </GoldenFormGroup>
                  </GoldenFieldGrid>
                  <InlineFormActions>
                    <SmallBtn
                      type="button"
                      onClick={() => {
                        setShowInlineCarrier(false);
                        setInlineCarrierName('');
                        setInlineCarrierType('');
                      }}
                    >
                      Cancel
                    </SmallBtn>
                    <SmallBtn
                      $primary
                      type="button"
                      onClick={handleCreateInlineCarrier}
                      disabled={creatingCarrier}
                    >
                      {creatingCarrier ? 'Creating…' : 'Create & Select'}
                    </SmallBtn>
                  </InlineFormActions>
                </InlineCarrierForm>
              )}
              {/* Auto-populated carrier fields */}
              {formValues.carrier && (
                <GoldenFieldGrid style={{ marginTop: 16 }}>
                  <GoldenFormGroup $span={2}>
                    <GoldenLabel>
                      Carrier Address
                      {isAutoFilled('carrier_address') && (
                        <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                      )}
                    </GoldenLabel>
                    
<GoldenInput
                      name="carrier_address"
                      value={formValues.carrier_address}
                      onChange={handleChange}
                      $autoFilled={isAutoFilled('carrier_address')}
                      placeholder="Carrier address"
                      aria-label="Carrier Address"
                    />
                  </GoldenFormGroup>
                  <GoldenFormGroup>
                    <GoldenLabel>
                      City
                      {isAutoFilled('carrier_city') && (
                        <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                      )}
                    </GoldenLabel>
                    
<GoldenInput
                      name="carrier_city"
                      value={formValues.carrier_city}
                      onChange={handleChange}
                      $autoFilled={isAutoFilled('carrier_city')}
                      placeholder="City"
                      aria-label="Carrier City"
                    />
                  </GoldenFormGroup>
                  <GoldenFormGroup>
                    <GoldenLabel>
                      State / Zip
                      {isAutoFilled('carrier_state_zip') && (
                        <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                      )}
                    </GoldenLabel>
                    
<GoldenInput
                      name="carrier_state_zip"
                      value={formValues.carrier_state_zip}
                      onChange={handleChange}
                      $autoFilled={isAutoFilled('carrier_state_zip')}
                      placeholder="State Zip"
                      aria-label="Carrier State Zip"
                    />
                  </GoldenFormGroup>
                </GoldenFieldGrid>
              )}
            </SectionContent>
          </GoldenSectionCard>
          {/* Section 2: Order & Release Numbers */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('orders')}>
              <GoldenSectionIcon><FileText size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>📋 Order &amp; Release Numbers</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.orders}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.orders}>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Order Number</GoldenLabel>
                  
<GoldenInput
                    name="order_number"
                    value={formValues.order_number}
                    onChange={handleChange}
                    onBlur={() => handleAutoGenBlur('order_number', 'PO')}
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Order Number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Carrier Release #</GoldenLabel>
                  
<GoldenInput
                    name="carrier_release_num"
                    value={formValues.carrier_release_num}
                    onChange={handleChange}
                    onBlur={() => handleAutoGenBlur('carrier_release_num', 'CR')}
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Carrier Release Number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Supplier Confirmation Order #</GoldenLabel>
                  
<GoldenInput
                    name="supplier_confirmation_order_number"
                    value={formValues.supplier_confirmation_order_number}
                    onChange={handleChange}
                    onBlur={() =>
                      handleAutoGenBlur('supplier_confirmation_order_number', 'SC')
                    }
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Supplier Confirmation Order Number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Delivery PO Number</GoldenLabel>
                  
<GoldenInput
                    name="delivery_po_number"
                    value={formValues.delivery_po_number}
                    onChange={handleChange}
                    onBlur={() => handleAutoGenBlur('delivery_po_number', 'DPO')}
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Delivery PO Number"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>
          {/* Section 3: Product & Logistics */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('product')}>
              <GoldenSectionIcon><Package size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>📦 Product &amp; Logistics</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.product}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.product}>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Type of Protein</GoldenLabel>
                  <GoldenSelect
                    name="type_of_protein"
                    value={formValues.type_of_protein}
                    onChange={handleChange}
                    aria-label="Type of Protein"
                  >
                    <option value="">Select protein…</option>
                    {PROTEIN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Product</GoldenLabel>
                  <SmartProductAutocomplete
                    value={formValues.product}
                    onChange={(productId, product) => {
                      setFormValues((prev) => ({
                        ...prev,
                        product: productId,
                        description_of_product_item:
                          prev.description_of_product_item
                          || product?.name
                          || product?.description
                          || product?.description_of_product_item
                          || '',
                        fresh_or_frozen: prev.fresh_or_frozen || product?.fresh_or_frozen || '',
                        package_type: prev.package_type || product?.package_type || '',
                      }));
                    }}
                    proteinTypeFilter={formValues.type_of_protein || undefined}
                    placeholder="Search products…"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Description of Product/Item</GoldenLabel>
                  <GoldenInput
                    name="description_of_product_item"
                    value={formValues.description_of_product_item}
                    onChange={handleChange}
                    placeholder="Product description"
                    aria-label="Product Description"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Fresh or Frozen</GoldenLabel>
                  
<GoldenSelect
                    name="fresh_or_frozen"
                    value={formValues.fresh_or_frozen}
                    onChange={handleChange}
                    aria-label="Fresh or Frozen"
                  >
                    <option value="">Select…</option>
                    <option value="Fresh">Fresh</option>
                    <option value="Frozen">Frozen</option>
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Package Type</GoldenLabel>
                  
<GoldenSelect
                    name="package_type"
                    value={formValues.package_type}
                    onChange={handleChange}
                    aria-label="Package Type"
                  >
                    <option value="">Select package…</option>
                    {PACKAGE_TYPES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Quantity</GoldenLabel>
                  
<GoldenInput
                    name="quantity"
                    type="number"
                    value={formValues.quantity}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    aria-label="Quantity"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Total Weight</GoldenLabel>
                  
<GoldenInput
                    name="total_weight"
                    type="number"
                    value={formValues.total_weight}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    aria-label="Total Weight"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Weight Unit</GoldenLabel>
                  
<GoldenSelect
                    name="weight_unit"
                    value={formValues.weight_unit}
                    onChange={handleChange}
                    aria-label="Weight Unit"
                  >
                    <option value="LBS">LBS</option>
                    <option value="KG">KG</option>
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Net or Catch</GoldenLabel>
                  
<GoldenSelect
                    name="net_or_catch"
                    value={formValues.net_or_catch}
                    onChange={handleChange}
                    aria-label="Net or Catch"
                  >
                    <option value="Net">Net</option>
                    <option value="Catch">Catch</option>
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Edible or Inedible</GoldenLabel>
                  
<GoldenSelect
                    name="edible_or_inedible"
                    value={formValues.edible_or_inedible}
                    onChange={handleChange}
                    aria-label="Edible or Inedible"
                  >
                    <option value="Edible">Edible</option>
                    <option value="Inedible">Inedible</option>
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Tested Product</GoldenLabel>
                  <GoldenCheckboxRow>
                    <GoldenCheckbox
                      type="checkbox"
                      checked={formValues.tested_product}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          tested_product: e.target.checked,
                        }))
                      }
                      aria-label="Tested Product"
                    />
                    Product has been tested
                  </GoldenCheckboxRow>
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>
          {/* Section 4: Pickup & Delivery */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('logistics')}>
              <GoldenSectionIcon><Building2 size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>📍 Pickup &amp; Delivery</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.logistics}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.logistics}>
              {/* Dates */}
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Pick Up Date</GoldenLabel>
                  
<GoldenInput
                    name="pick_up_date"
                    type="date"
                    value={formValues.pick_up_date}
                    onChange={handleChange}
                    aria-label="Pick Up Date"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Delivery Date</GoldenLabel>
                  
<GoldenInput
                    name="delivery_date"
                    type="date"
                    value={formValues.delivery_date}
                    onChange={handleChange}
                    aria-label="Delivery Date"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
              {/* Pickup - Supplier */}
              <SubSectionLabel>
                Pickup Location (from Supplier)
              </SubSectionLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel $required>Supplier</GoldenLabel>
                  
<GoldenSelect
                    name="supplier"
                    value={formValues.supplier}
                    onChange={(e) => handleSupplierSelect(e.target.value)}
                    aria-label="Supplier"
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Pickup Building
                    {isAutoFilled('pickup_building_name') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="pickup_building_name"
                    value={formValues.pickup_building_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_building_name')}
                    placeholder="Building name"
                    aria-label="Pickup Building Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Pickup Address
                    {isAutoFilled('pickup_address') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="pickup_address"
                    value={formValues.pickup_address}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_address')}
                    placeholder="Address"
                    aria-label="Pickup Address"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Pickup City
                    {isAutoFilled('pickup_city') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="pickup_city"
                    value={formValues.pickup_city}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_city')}
                    placeholder="City"
                    aria-label="Pickup City"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Pickup State/Zip
                    {isAutoFilled('pickup_state_zip') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="pickup_state_zip"
                    value={formValues.pickup_state_zip}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_state_zip')}
                    placeholder="State Zip"
                    aria-label="Pickup State Zip"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
              {/* Delivery - Customer */}
              <SubSectionLabel>
                Delivery Location (from Customer)
              </SubSectionLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>Customer</GoldenLabel>
                  
<GoldenSelect
                    name="customer"
                    value={formValues.customer}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    aria-label="Customer"
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Delivery Building
                    {isAutoFilled('delivery_building_name') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="delivery_building_name"
                    value={formValues.delivery_building_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_building_name')}
                    placeholder="Building name"
                    aria-label="Delivery Building Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Delivery Address
                    {isAutoFilled('delivery_address') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="delivery_address"
                    value={formValues.delivery_address}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_address')}
                    placeholder="Address"
                    aria-label="Delivery Address"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Delivery City
                    {isAutoFilled('delivery_city') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="delivery_city"
                    value={formValues.delivery_city}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_city')}
                    placeholder="City"
                    aria-label="Delivery City"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Delivery State/Zip
                    {isAutoFilled('delivery_state_zip') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="delivery_state_zip"
                    value={formValues.delivery_state_zip}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_state_zip')}
                    placeholder="State Zip"
                    aria-label="Delivery State Zip"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
              {/* Appointment */}
              <GoldenFieldGrid style={{ marginTop: 16 }}>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Appointment Method
                    {isAutoFilled('how_carrier_make_appointment') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenSelect
                    name="how_carrier_make_appointment"
                    value={formValues.how_carrier_make_appointment}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('how_carrier_make_appointment')}
                    aria-label="Appointment Method"
                  >
                    <option value="">Select method…</option>
                    {APPOINTMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>
          {/* Section 5: Contacts */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('contacts')}>
              <GoldenSectionIcon><Users size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>👤 Contacts</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.contacts}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.contacts}>
              {/* AP Contact (from carrier) */}
              <SubSectionLabel>
                Accounting Payable (from Carrier)
              </SubSectionLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>
                    AP Contact Name
                    {isAutoFilled('accounting_payable_contact_name') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="accounting_payable_contact_name"
                    value={formValues.accounting_payable_contact_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('accounting_payable_contact_name')}
                    placeholder="Name"
                    aria-label="AP Contact Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    AP Contact Phone
                    {isAutoFilled('accounting_payable_contact_phone') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="accounting_payable_contact_phone"
                    value={formValues.accounting_payable_contact_phone}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('accounting_payable_contact_phone')}
                    placeholder="Phone"
                    aria-label="AP Contact Phone"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>
                    AP Contact Email
                    {isAutoFilled('accounting_payable_contact_email') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="accounting_payable_contact_email"
                    value={formValues.accounting_payable_contact_email}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('accounting_payable_contact_email')}
                    placeholder="Email"
                    type="email"
                    aria-label="AP Contact Email"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
              {/* Shipping Contact (from supplier) */}
              <SubSectionLabel>
                Shipping Contact (from Supplier)
              </SubSectionLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Shipping Contact Name
                    {isAutoFilled('shipping_contact_name') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="shipping_contact_name"
                    value={formValues.shipping_contact_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('shipping_contact_name')}
                    placeholder="Name"
                    aria-label="Shipping Contact Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Shipping Contact Phone
                    {isAutoFilled('shipping_contact_phone') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="shipping_contact_phone"
                    value={formValues.shipping_contact_phone}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('shipping_contact_phone')}
                    placeholder="Phone"
                    aria-label="Shipping Contact Phone"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>
                    Shipping Contact Email
                    {isAutoFilled('shipping_contact_email') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="shipping_contact_email"
                    value={formValues.shipping_contact_email}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('shipping_contact_email')}
                    placeholder="Email"
                    type="email"
                    aria-label="Shipping Contact Email"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
              {/* Receiving Contact (from customer) */}
              <SubSectionLabel>
                Receiving Contact (from Customer)
              </SubSectionLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Receiving Contact Name
                    {isAutoFilled('receiving_contact_name') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="receiving_contact_name"
                    value={formValues.receiving_contact_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('receiving_contact_name')}
                    placeholder="Name"
                    aria-label="Receiving Contact Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>
                    Receiving Contact Phone
                    {isAutoFilled('receiving_contact_phone') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="receiving_contact_phone"
                    value={formValues.receiving_contact_phone}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('receiving_contact_phone')}
                    placeholder="Phone"
                    aria-label="Receiving Contact Phone"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>
                    Receiving Contact Email
                    {isAutoFilled('receiving_contact_email') && (
                      <GoldenAutoFilledBadge>● auto-filled</GoldenAutoFilledBadge>
                    )}
                  </GoldenLabel>
                  
<GoldenInput
                    name="receiving_contact_email"
                    value={formValues.receiving_contact_email}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('receiving_contact_email')}
                    placeholder="Email"
                    type="email"
                    aria-label="Receiving Contact Email"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
              {/* Departments */}
              <SubSectionLabel>Departments</SubSectionLabel>
              <div style={{ display: 'flex', gap: 24 }}>
                {DEPARTMENTS.map((dept) => (
                  <GoldenCheckboxRow key={dept}>
                    <GoldenCheckbox
                      type="checkbox"
                      checked={formValues.departments_array.includes(dept)}
                      onChange={() => handleDepartmentToggle(dept)}
                      aria-label={`Department ${dept}`}
                    />
                    {dept}
                  </GoldenCheckboxRow>
                ))}
              </div>
            </SectionContent>
          </GoldenSectionCard>
          {/* Section 6: Comments & Notes */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('notes')}>
              <GoldenSectionIcon><FileText size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>📝 Comments &amp; Notes</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.notes}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.notes}>
              <GoldenFormGroup $span={2}>
                
<GoldenTextArea
                  name="notes"
                  value={formValues.notes}
                  onChange={handleChange}
                  placeholder="Additional notes, special instructions, or comments…"
                  rows={5}
                  aria-label="Notes"
                />
              </GoldenFormGroup>
            </SectionContent>
          </GoldenSectionCard>
        </GoldenFormBody>
        {/* Footer */}
        <GoldenFormFooter>
          <GoldenCancelButton onClick={onCancel} disabled={submitting} type="button">
            Cancel
          </GoldenCancelButton>
          <GoldenSubmitButton onClick={handleSubmit} disabled={submitting} type="button">
            {submitting
              ? 'Saving…'
              : mode === 'edit'
                ? 'Update Carrier PO'
                : 'Create Carrier PO'}
          </GoldenSubmitButton>
        </GoldenFormFooter>
      </GoldenFormContainer>
      <ApprovalPreviewModal
        open={approvalGate.showModal}
        request={approvalGate.currentRequest}
        onApprove={approvalGate.handleApprove}
        onReject={approvalGate.handleReject}
        onEditApprove={approvalGate.handleEditApprove}
        onCancel={approvalGate.handleCancel}
      />
    </GoldenFormOverlay>
  );
};
export default CarrierPOForm;
