import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message, Tooltip, Spin } from 'antd';
import {
  Package,
  Truck,
  Users,
  FileText,
  DollarSign,
  ClipboardList,
  Plus,
  X,
  Info,
  Zap,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import { LocationSelector } from '@/components/Shared';
import { SmartProductAutocomplete } from '@/components/Inquiry/SmartProductAutocomplete';
import { getChoices, type ChoiceOption } from '@/services/choicesService';
import { useApprovalGate } from '@/hooks/useApprovalGate';
import ApprovalPreviewModal from '@/components/AIAssistant/ApprovalPreviewModal';
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
  GoldenFormFooter,
  GoldenDraftButton,
  GoldenSubmitButton,
  GoldenCheckboxRow,
  GoldenCheckbox,
  GoldenAutoFilledBadge,
  GoldenDateTimeStamp,
  GoldenConditionalSection,
} from '@/components/Forms/GoldenFormShell';

// ============================================================================
// Types
// ============================================================================

type LogisticsScenario = 'customer_pickup' | 'supplier_delivery' | 'we_pickup';

interface ShippingContact {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface SalesOrderFormValues {
  logistics_scenario: LogisticsScenario;
  our_sales_order_num: string;
  our_sales_order_number_for_customer: string;
  supplier: string;
  customer: string;
  carrier: string;
  product: string;
  plant: string;
  pick_up_location: string | null;
  delivery_location: string | null;
  delivery_po_num: string;
  delivery_po_number: string;
  carrier_release_num: string;
  carrier_release_format: string;
  pick_up_date: string;
  delivery_date: string;
  how_to_make_appointment: string;
  quantity: string;
  type_of_protein: string;
  description_of_product_item: string;
  fresh_or_frozen: string;
  package_type: string;
  uom: string;
  net_or_catch: string;
  weight_unit: string;
  total_weight: string;
  total_net_weight: string;
  edible_or_inedible: string;
  tested_product: boolean;
  payment_terms: string;
  billing_contact_name: string;
  billing_contact_phone: string;
  billing_contact_email: string;
  shipping_contact_name: string;
  shipping_contact_phone: string;
  shipping_contact_email: string;
  billing_address_street: string;
  billing_address_city: string;
  billing_address_state_zip: string;
  shipping_address_street: string;
  shipping_address_city: string;
  shipping_address_state_zip: string;
  receiving_contact_name: string;
  receiving_contact_phone: string;
  receiving_contact_email: string;
  receiving_contact_title: string;
  total_amount: string;
  status: string;
  payment_status: string;
  notes: string;
  plant_est_number: string;
  contact: string;
}

export interface SalesOrderFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<SalesOrderFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
  entityId?: number | string;
}

// ============================================================================
// Constants
// ============================================================================

const SCENARIO_OPTIONS: { value: LogisticsScenario; label: string; icon: string; desc: string }[] = [
  { value: 'customer_pickup', label: 'Customer Picking Up', icon: '🚗', desc: 'Customer picks up from our location' },
  { value: 'supplier_delivery', label: 'Supplier Delivering', icon: '🚚', desc: 'Supplier delivers to customer location' },
  { value: 'we_pickup', label: 'We Are Picking Up', icon: '🚛', desc: 'Our logistics handle the transport' },
];

const SCENARIO_VISIBILITY: Record<LogisticsScenario, Record<string, boolean>> = {
  customer_pickup: {
    pickupDate: true,
    deliveryDate: true,
    shippingContacts: true,
    pickupAddress: true,
    deliveryAddress: true,
    howMakeAppointment: true,
    receivingContact: false,
  },
  supplier_delivery: {
    pickupDate: false,
    deliveryDate: true,
    shippingContacts: false,
    pickupAddress: false,
    deliveryAddress: true,
    howMakeAppointment: false,
    receivingContact: false,
  },
  we_pickup: {
    pickupDate: true,
    deliveryDate: true,
    shippingContacts: true,
    pickupAddress: true,
    deliveryAddress: true,
    howMakeAppointment: true,
    receivingContact: true,
  },
};

const PROTEIN_TYPES = [
  'Beef', 'Chicken', 'Fowl', 'Turkey', 'Lamb', 'Veal', 'Seafood',
  'Venison', 'Bison', 'Duck', 'Rabbit', 'Goat', 'Mutton', 'Pork',
  'Fish', 'Horse', 'Other',
];

const PACKAGE_TYPES = [
  'Boxed wax lined', 'Boxed Poly', 'Combos', 'Nude Block', 'Boxed COV',
  'Boxed CO2', 'Combo bins', 'Totes', 'Bags', 'Bulk', 'Poly-Multiple', 'Nude',
];

const PAYMENT_TERMS = [
  'Wire', 'ACH', 'Check 7', 'Check 14', 'Check 21', 'Check 30',
  'Check 45', 'Check 60', 'Check 90', 'COD', 'Credit Card',
];

const APPOINTMENT_METHODS = [
  'Email', 'Phone', 'Website', 'FCFS', 'Fax', 'First Come First Serve',
];

const CARRIER_RELEASE_FORMATS = [
  'Supplier Confirmation Order Number', 'Carrier Release Number', 'Both',
];

// ============================================================================
// Helpers
// ============================================================================

const generateNumber = (prefix: string): string => {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
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

const addDays = (date: Date, days: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const getDefaultFormValues = (): SalesOrderFormValues => ({
  logistics_scenario: 'supplier_delivery',
  our_sales_order_num: '',
  our_sales_order_number_for_customer: '',
  supplier: '',
  customer: '',
  carrier: '',
  product: '',
  plant: '',
  pick_up_location: null,
  delivery_location: null,
  delivery_po_num: '',
  delivery_po_number: '',
  carrier_release_num: '',
  carrier_release_format: '',
  pick_up_date: addDays(new Date(), 2),
  delivery_date: addDays(new Date(), 7),
  how_to_make_appointment: '',
  quantity: '',
  type_of_protein: '',
  description_of_product_item: '',
  fresh_or_frozen: '',
  package_type: '',
  uom: 'LBS',
  net_or_catch: 'Net',
  weight_unit: 'LBS',
  total_weight: '',
  total_net_weight: '',
  edible_or_inedible: 'Edible',
  tested_product: false,
  payment_terms: '',
  billing_contact_name: '',
  billing_contact_phone: '',
  billing_contact_email: '',
  shipping_contact_name: '',
  shipping_contact_phone: '',
  shipping_contact_email: '',
  billing_address_street: '',
  billing_address_city: '',
  billing_address_state_zip: '',
  shipping_address_street: '',
  shipping_address_city: '',
  shipping_address_state_zip: '',
  receiving_contact_name: '',
  receiving_contact_phone: '',
  receiving_contact_email: '',
  receiving_contact_title: '',
  total_amount: '',
  status: 'draft',
  payment_status: 'Pending',
  notes: '',
  plant_est_number: '',
  contact: '',
});

// ============================================================================
// Styled Components
// ============================================================================

const ScenarioCard = styled.div`
  background: rgba(var(--color-primary), 0.04);
  border: 2px solid rgba(var(--color-primary), 0.15);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 28px;
`;

const ScenarioLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-primary));
  margin-bottom: 12px;
`;

const ScenarioSelect = styled.select`
  width: 100%;
  padding: 14px 16px;
  border: 2px solid rgba(var(--color-primary), 0.3);
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  appearance: none;
  cursor: pointer;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const ScenarioSelectWrapper = styled.div`
  position: relative;

  & > svg {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: rgb(var(--color-text-secondary));
  }
`;

const ScenarioHint = styled.div`
  margin-top: 10px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ContactRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
  padding: 12px 0;
  border-bottom: 1px solid rgb(var(--color-border));

  &:last-of-type {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const RemoveContactBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-error));
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(var(--color-error), 0.08);
  }
`;

const AddContactBtn = styled.button`
  background: none;
  border: 1.5px dashed rgb(var(--color-border));
  border-radius: 8px;
  padding: 10px 16px;
  color: rgb(var(--color-primary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  margin-top: 12px;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.04);
  }
`;

const CalculatedValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--color-primary));
  padding: 12px 16px;
  background: rgba(var(--color-primary), 0.06);
  border-radius: 8px;
  border: 1px solid rgba(var(--color-primary), 0.15);
`;

// ============================================================================
// Component
// ============================================================================

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({
  mode,
  initialValues,
  onSuccess,
  onCancel,
  entityId,
}) => {
  const [formValues, setFormValues] = useState<SalesOrderFormValues>(() => ({
    ...getDefaultFormValues(),
    ...initialValues,
  }));
  const [shippingContacts, setShippingContacts] = useState<ShippingContact[]>([
    { id: Date.now().toString(), name: '', phone: '', email: '' },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customers, setCustomers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suppliers, setSuppliers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [carriers, setCarriers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contacts, setContacts] = useState<any[]>([]);
  const [customerAutoFilled, setCustomerAutoFilled] = useState(false);
  const [supplierAutoFilled, setSupplierAutoFilled] = useState(false);
  const approvalGate = useApprovalGate();
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [createdAt] = useState(() => new Date());

  // Choice options from backend
  const [proteinOptions, setProteinOptions] = useState<ChoiceOption[]>([]);
  const [freshFrozenOptions, setFreshFrozenOptions] = useState<ChoiceOption[]>([]);
  const [packageTypeOptions, setPackageTypeOptions] = useState<ChoiceOption[]>([]);
  const [weightUnitOptions, setWeightUnitOptions] = useState<ChoiceOption[]>([]);
  const [netCatchOptions, setNetCatchOptions] = useState<ChoiceOption[]>([]);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<ChoiceOption[]>([]);
  const [appointmentOptions, setAppointmentOptions] = useState<ChoiceOption[]>([]);

  const scenario = formValues.logistics_scenario;
  const visibility = SCENARIO_VISIBILITY[scenario];

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [customersRes, suppliersRes, carriersRes, contactsRes] = await Promise.all([
          businessApi.get('customers/'),
          businessApi.get('suppliers/'),
          businessApi.get('carriers/'),
          businessApi.get('contacts/'),
        ]);
        const custData = customersRes.data?.results || customersRes.data || [];
        const suppData = suppliersRes.data?.results || suppliersRes.data || [];
        const carrData = carriersRes.data?.results || carriersRes.data || [];
        const contData = contactsRes.data?.results || contactsRes.data || [];
        setCustomers(Array.isArray(custData) ? custData : []);
        setSuppliers(Array.isArray(suppData) ? suppData : []);
        setCarriers(Array.isArray(carrData) ? carrData : []);
        setContacts(Array.isArray(contData) ? contData : []);
      } catch {
        // Silently handle — empty lists will show in UI
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  // Load choice options
  useEffect(() => {
    const loadChoices = async () => {
      try {
        const [protein, ff, pkg, wu, nc, pt, appt] = await Promise.all([
          getChoices('protein_type'),
          getChoices('fresh_or_frozen'),
          getChoices('package_type'),
          getChoices('weight_unit'),
          getChoices('net_or_catch'),
          getChoices('accounting_payment_terms'),
          getChoices('appointment_method'),
        ]);
        setProteinOptions(protein);
        setFreshFrozenOptions(ff);
        setPackageTypeOptions(pkg);
        setWeightUnitOptions(wu);
        setNetCatchOptions(nc);
        setPaymentTermsOptions(pt);
        setAppointmentOptions(appt);
      } catch {
        // Fallback to hardcoded values handled in render
      }
    };
    loadChoices();
  }, []);

  // Effective option arrays (backend choices or fallback)
  const effectiveProteinOptions = useMemo(
    () => proteinOptions.length ? proteinOptions : PROTEIN_TYPES.map((v) => ({ value: v, label: v })),
    [proteinOptions],
  );
  const effectiveFreshFrozen = useMemo(
    () => freshFrozenOptions.length ? freshFrozenOptions : [{ value: 'Fresh', label: 'Fresh' }, { value: 'Frozen', label: 'Frozen' }],
    [freshFrozenOptions],
  );
  const effectivePackageTypes = useMemo(
    () => packageTypeOptions.length ? packageTypeOptions : PACKAGE_TYPES.map((v) => ({ value: v, label: v })),
    [packageTypeOptions],
  );
  const effectiveWeightUnits = useMemo(
    () => weightUnitOptions.length ? weightUnitOptions : [{ value: 'LBS', label: 'LBS' }, { value: 'KG', label: 'KG' }],
    [weightUnitOptions],
  );
  const effectiveNetCatch = useMemo(
    () => netCatchOptions.length ? netCatchOptions : [{ value: 'Net', label: 'Net' }, { value: 'Catch', label: 'Catch' }],
    [netCatchOptions],
  );
  const effectivePaymentTerms = useMemo(
    () => paymentTermsOptions.length ? paymentTermsOptions : PAYMENT_TERMS.map((v) => ({ value: v, label: v })),
    [paymentTermsOptions],
  );
  const effectiveAppointmentMethods = useMemo(
    () => appointmentOptions.length ? appointmentOptions : APPOINTMENT_METHODS.map((v) => ({ value: v, label: v })),
    [appointmentOptions],
  );

  // Auto-calculate total amount
  const calculatedTotal = useMemo(() => {
    const qty = Number(formValues.quantity);
    const tw = Number(formValues.total_weight);
    if (Number.isFinite(tw) && tw > 0) {
      return tw.toFixed(2);
    }
    if (Number.isFinite(qty) && qty > 0) {
      return qty.toFixed(2);
    }
    return '0.00';
  }, [formValues.quantity, formValues.total_weight]);

  // Generic field change handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setFormValues((prev) => ({ ...prev, [name]: checked }));
    },
    [],
  );

  // Customer auto-populate (billing info)
  const handleCustomerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const customerId = e.target.value;
      setFormValues((prev) => ({ ...prev, customer: customerId }));
      setCustomerAutoFilled(false);

      if (!customerId) return;

      const customer = customers.find((c) => String(c.id) === customerId);
      if (customer) {
        setFormValues((prev) => ({
          ...prev,
          customer: customerId,
          billing_address_street: customer.address || customer.billing_address || '',
          billing_address_city: customer.city || customer.billing_city || '',
          billing_address_state_zip: customer.state_zip || `${customer.state || ''} ${customer.zip_code || ''}`.trim(),
          billing_contact_name: customer.contact_person || customer.contact_name || '',
          billing_contact_phone: customer.phone || customer.phone_mobile || customer.phone_office || '',
          billing_contact_email: customer.email || '',
        }));
        setCustomerAutoFilled(true);
      }
    },
    [customers],
  );

  // Supplier auto-populate (shipping info)
  const handleSupplierChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const supplierId = e.target.value;
      setFormValues((prev) => ({ ...prev, supplier: supplierId }));
      setSupplierAutoFilled(false);

      if (!supplierId) return;

      const supplier = suppliers.find((s) => String(s.id) === supplierId);
      if (supplier) {
        setFormValues((prev) => ({
          ...prev,
          supplier: supplierId,
          shipping_address_street: supplier.address || supplier.corporate_address || '',
          shipping_address_city: supplier.city || '',
          shipping_address_state_zip: supplier.state_zip || `${supplier.state || ''} ${supplier.zip_code || ''}`.trim(),
        }));
        setSupplierAutoFilled(true);
      }
    },
    [suppliers],
  );

  // SO number auto-gen on blur
  const handleNumberBlur = useCallback(
    (field: 'our_sales_order_num' | 'our_sales_order_number_for_customer' | 'delivery_po_num' | 'carrier_release_num') => {
      setFormValues((prev) => {
        if (!prev[field]) {
          return { ...prev, [field]: generateNumber('SO') };
        }
        return prev;
      });
    },
    [],
  );

  // Shipping contacts
  const addShippingContact = useCallback(() => {
    setShippingContacts((prev) => [...prev, { id: Date.now().toString(), name: '', phone: '', email: '' }]);
  }, []);

  const removeShippingContact = useCallback((index: number) => {
    setShippingContacts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateShippingContact = useCallback(
    (index: number, field: keyof ShippingContact, value: string) => {
      setShippingContacts((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    [],
  );

  // Build payload
  const buildPayload = useCallback(
    (status: 'draft' | 'pending') => {
      return {
        logistics_scenario: formValues.logistics_scenario,
        our_sales_order_num: formValues.our_sales_order_num || undefined,
        our_sales_order_number_for_customer: formValues.our_sales_order_number_for_customer || undefined,
        customer: formValues.customer ? parseInt(formValues.customer) : undefined,
        supplier: formValues.supplier ? parseInt(formValues.supplier) : undefined,
        carrier: formValues.carrier ? parseInt(formValues.carrier) : undefined,
        contact: formValues.contact ? parseInt(formValues.contact) : undefined,
        product: formValues.product || undefined,
        plant: formValues.plant || undefined,
        plant_est_number: formValues.plant_est_number || undefined,
        pick_up_location: formValues.pick_up_location || undefined,
        delivery_location: formValues.delivery_location || undefined,
        delivery_po_num: formValues.delivery_po_num || undefined,
        delivery_po_number: formValues.delivery_po_number || undefined,
        carrier_release_num: formValues.carrier_release_num || undefined,
        carrier_release_format: formValues.carrier_release_format || undefined,
        pick_up_date: formValues.pick_up_date || undefined,
        delivery_date: formValues.delivery_date || undefined,
        how_to_make_appointment: formValues.how_to_make_appointment || undefined,
        quantity: formValues.quantity ? parseInt(formValues.quantity) : undefined,
        type_of_protein: formValues.type_of_protein || undefined,
        description_of_product_item: formValues.description_of_product_item || undefined,
        fresh_or_frozen: formValues.fresh_or_frozen || undefined,
        package_type: formValues.package_type || undefined,
        uom: formValues.uom || undefined,
        net_or_catch: formValues.net_or_catch || undefined,
        weight_unit: formValues.weight_unit || undefined,
        total_weight: formValues.total_weight ? parseFloat(formValues.total_weight) : undefined,
        total_net_weight: formValues.total_net_weight ? parseFloat(formValues.total_net_weight) : undefined,
        edible_or_inedible: formValues.edible_or_inedible || undefined,
        tested_product: formValues.tested_product,
        payment_terms: formValues.payment_terms || undefined,
        payment_status: formValues.payment_status || undefined,
        billing_contact_name: formValues.billing_contact_name || undefined,
        billing_contact_phone: formValues.billing_contact_phone || undefined,
        billing_contact_email: formValues.billing_contact_email || undefined,
        shipping_contact_name: formValues.shipping_contact_name || undefined,
        shipping_contact_phone: formValues.shipping_contact_phone || undefined,
        shipping_contact_email: formValues.shipping_contact_email || undefined,
        billing_address_street: formValues.billing_address_street || undefined,
        billing_address_city: formValues.billing_address_city || undefined,
        billing_address_state_zip: formValues.billing_address_state_zip || undefined,
        shipping_address_street: formValues.shipping_address_street || undefined,
        shipping_address_city: formValues.shipping_address_city || undefined,
        shipping_address_state_zip: formValues.shipping_address_state_zip || undefined,
        receiving_contact_name: formValues.receiving_contact_name || undefined,
        receiving_contact_phone: formValues.receiving_contact_phone || undefined,
        receiving_contact_email: formValues.receiving_contact_email || undefined,
        receiving_contact_title: formValues.receiving_contact_title || undefined,
        total_amount: parseFloat(calculatedTotal) || 0,
        notes: formValues.notes || undefined,
        order_date: new Date().toISOString().split('T')[0],
        status,
      };
    },
    [formValues, calculatedTotal],
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (status: 'draft' | 'pending') => {
      if (!formValues.customer) {
        message.warning('Please select a customer');
        return;
      }

      setSubmitting(true);
      try {
        const payload = buildPayload(status);

        // Approval gate: intercept before external send (skip drafts)
        if (status !== 'draft') {
          const gateResult = await approvalGate.intercept({
            requestType: 'sales_order',
            subject: `SO ${formValues.our_sales_order_num || 'New'}`,
            recipientType: 'customer',
            contentPreview: `Sales Order for ${formValues.description_of_product_item || 'product'}`,
            sourceEntityType: 'sales_order',
          });
          if (!gateResult.approved) {
            setSubmitting(false);
            return;
          }
        }

        if (mode === 'edit' && entityId) {
          await businessApi.put(`sales-orders/${entityId}/`, payload);
        } else {
          await businessApi.post('sales-orders/', payload);
        }
        message.success(
          `Sales Order ${status === 'draft' ? 'saved as draft' : 'created'} successfully!`,
        );
        onSuccess();
      } catch (err) {
        const error = err as Error;
        message.error(error.message || 'Failed to save sales order');
      } finally {
        setSubmitting(false);
      }
    },
    [formValues, mode, entityId, buildPayload, onSuccess],
  );

  // Selected scenario info
  const scenarioInfo = SCENARIO_OPTIONS.find((s) => s.value === scenario);

  return (
    <GoldenFormOverlay onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <GoldenFormContainer>
        {/* Header */}
        <GoldenFormHeader>
          <GoldenFormTitleGroup>
            <ClipboardList size={24} color="rgb(var(--color-primary))" />
            <GoldenFormTitle>
              {mode === 'edit' ? 'Edit Sales Order' : 'New Sales Order'}
            </GoldenFormTitle>
          </GoldenFormTitleGroup>
          <GoldenCloseButton onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </GoldenCloseButton>
        </GoldenFormHeader>

        <GoldenFormBody as="div">
          {/* Section 1: Scenario Selector */}
          <ScenarioCard>
            <ScenarioLabel>
              <Zap size={16} />
              Sales Order Delivery Type
              <Tooltip title="This controls which fields appear below. Choose the logistics scenario that matches how goods will be transported.">
                <Info size={14} style={{ cursor: 'help', opacity: 0.6 }} />
              </Tooltip>
            </ScenarioLabel>
            <ScenarioSelectWrapper>
              <ScenarioSelect
                name="logistics_scenario"
                value={scenario}
                onChange={handleChange}
                aria-label="Sales Order Delivery Type"
              >
                {SCENARIO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </ScenarioSelect>
              <ChevronDown size={18} />
            </ScenarioSelectWrapper>
            {scenarioInfo && (
              <ScenarioHint>
                {scenarioInfo.icon} {scenarioInfo.desc}
              </ScenarioHint>
            )}
          </ScenarioCard>

          {/* Section 2: Customer & Supplier Information */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Users size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Customer &amp; Supplier Information</GoldenSectionTitle>
              {loadingData && <Spin size="small" />}
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup $span={2}>
                <GoldenLabel $required>Customer</GoldenLabel>
                <GoldenSelect
                  name="customer"
                  value={formValues.customer}
                  onChange={handleCustomerChange}
                  required
                  aria-label="Customer"
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.company_name || `Customer ${c.id}`}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Supplier</GoldenLabel>
                <GoldenSelect
                  name="supplier"
                  value={formValues.supplier}
                  onChange={handleSupplierChange}
                  aria-label="Supplier"
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || `Supplier ${s.id}`}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Carrier</GoldenLabel>
                <GoldenSelect
                  name="carrier"
                  value={formValues.carrier}
                  onChange={handleChange}
                  aria-label="Carrier"
                >
                  <option value="">Select a carrier…</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.company_name || `Carrier ${c.id}`}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Contact</GoldenLabel>
                <GoldenSelect
                  name="contact"
                  value={formValues.contact}
                  onChange={handleChange}
                  aria-label="Contact"
                >
                  <option value="">Select a contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.full_name || `Contact ${c.id}`}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <LocationSelector
                  value={formValues.plant}
                  onChange={(id) => setFormValues((prev) => ({
                    ...prev,
                    plant: id || '',
                  }))}
                  type="plant"
                  label="Plant"
                  placeholder="Select plant…"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Plant EST Number</GoldenLabel>
                <GoldenInput
                  name="plant_est_number"
                  value={formValues.plant_est_number}
                  onChange={handleChange}
                  placeholder="EST #"
                />
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 3: Order & Reference Numbers */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><FileText size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Order &amp; Reference Numbers</GoldenSectionTitle>
            </GoldenSectionHeader>

            <GoldenDateTimeStamp>
              📅 Created: {formatDateTime(createdAt)}
            </GoldenDateTimeStamp>

            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel>Our Sales Order #</GoldenLabel>
                <GoldenInput
                  name="our_sales_order_num"
                  value={formValues.our_sales_order_num}
                  onChange={handleChange}
                  onBlur={() => handleNumberBlur('our_sales_order_num')}
                  placeholder="Leave blank to auto-generate"
                />
                <GoldenFieldHint>e.g. SO-20260513-847291</GoldenFieldHint>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Our SO # For Customer</GoldenLabel>
                <GoldenInput
                  name="our_sales_order_number_for_customer"
                  value={formValues.our_sales_order_number_for_customer}
                  onChange={handleChange}
                  onBlur={() => handleNumberBlur('our_sales_order_number_for_customer')}
                  placeholder="Leave blank to auto-generate"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Delivery PO #</GoldenLabel>
                <GoldenInput
                  name="delivery_po_num"
                  value={formValues.delivery_po_num}
                  onChange={handleChange}
                  onBlur={() => handleNumberBlur('delivery_po_num')}
                  placeholder="Leave blank to auto-generate"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Delivery PO Number</GoldenLabel>
                <GoldenInput
                  name="delivery_po_number"
                  value={formValues.delivery_po_number}
                  onChange={handleChange}
                  placeholder="Optional"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Carrier Release #</GoldenLabel>
                <GoldenInput
                  name="carrier_release_num"
                  value={formValues.carrier_release_num}
                  onChange={handleChange}
                  onBlur={() => handleNumberBlur('carrier_release_num')}
                  placeholder="Leave blank to auto-generate"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Carrier Release Format</GoldenLabel>
                <GoldenSelect
                  name="carrier_release_format"
                  value={formValues.carrier_release_format}
                  onChange={handleChange}
                >
                  <option value="">Select format…</option>
                  {CARRIER_RELEASE_FORMATS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 4: Product Details */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Package size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Product Details</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel>Type of Protein</GoldenLabel>
                <GoldenSelect
                  name="type_of_protein"
                  value={formValues.type_of_protein}
                  onChange={handleChange}
                >
                  <option value="">Select protein…</option>
                  {effectiveProteinOptions.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Fresh / Frozen</GoldenLabel>
                <GoldenSelect
                  name="fresh_or_frozen"
                  value={formValues.fresh_or_frozen}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {effectiveFreshFrozen.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
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

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Description of Product Item</GoldenLabel>
                <GoldenTextArea
                  name="description_of_product_item"
                  value={formValues.description_of_product_item}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Detailed product description"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Package Type</GoldenLabel>
                <GoldenSelect
                  name="package_type"
                  value={formValues.package_type}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {effectivePackageTypes.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Quantity</GoldenLabel>
                <GoldenInput
                  type="number"
                  name="quantity"
                  value={formValues.quantity}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Total Weight</GoldenLabel>
                <GoldenInput
                  type="number"
                  step="0.01"
                  name="total_weight"
                  value={formValues.total_weight}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Weight Unit</GoldenLabel>
                <GoldenSelect
                  name="weight_unit"
                  value={formValues.weight_unit}
                  onChange={handleChange}
                >
                  {effectiveWeightUnits.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>UOM</GoldenLabel>
                <GoldenSelect
                  name="uom"
                  value={formValues.uom}
                  onChange={handleChange}
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
                >
                  {effectiveNetCatch.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Total Net Weight</GoldenLabel>
                <GoldenInput
                  type="number"
                  step="0.01"
                  name="total_net_weight"
                  value={formValues.total_net_weight}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Edible / Inedible</GoldenLabel>
                <GoldenSelect
                  name="edible_or_inedible"
                  value={formValues.edible_or_inedible}
                  onChange={handleChange}
                >
                  <option value="Edible">Edible</option>
                  <option value="Inedible">Inedible</option>
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenCheckboxRow>
                  <GoldenCheckbox
                    type="checkbox"
                    name="tested_product"
                    checked={formValues.tested_product}
                    onChange={handleCheckboxChange}
                  />
                  Tested Product
                </GoldenCheckboxRow>
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 5: Logistics & Delivery */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Truck size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Logistics &amp; Delivery</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenConditionalSection $visible={visibility.pickupDate}>
                <GoldenLabel>Pick Up Date</GoldenLabel>
                <GoldenInput
                  type="date"
                  name="pick_up_date"
                  value={formValues.pick_up_date}
                  onChange={handleChange}
                />
              </GoldenConditionalSection>

              <GoldenFormGroup>
                <GoldenLabel>Delivery Date</GoldenLabel>
                <GoldenInput
                  type="date"
                  name="delivery_date"
                  value={formValues.delivery_date}
                  onChange={handleChange}
                />
              </GoldenFormGroup>

              <GoldenConditionalSection $visible={visibility.pickupAddress}>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>Pickup Location</GoldenLabel>
                  <LocationSelector
                    value={formValues.pick_up_location}
                    onChange={(id) => setFormValues((prev) => ({
                      ...prev,
                      pick_up_location: id,
                    }))}
                    label="Pickup Location"
                    placeholder="Select pickup location…"
                  />
                </GoldenFormGroup>
              </GoldenConditionalSection>

              <GoldenConditionalSection $visible={visibility.deliveryAddress}>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>Delivery Location</GoldenLabel>
                  <LocationSelector
                    value={formValues.delivery_location}
                    onChange={(id) => setFormValues((prev) => ({
                      ...prev,
                      delivery_location: id,
                    }))}
                    label="Delivery Location"
                    placeholder="Select delivery location…"
                  />
                </GoldenFormGroup>
              </GoldenConditionalSection>

              {/* Billing Address (auto-filled from customer) */}
              <GoldenFormGroup $span={2}>
                <GoldenLabel>
                  Billing Address
                  {customerAutoFilled && <GoldenAutoFilledBadge>Auto-filled from customer</GoldenAutoFilledBadge>}
                </GoldenLabel>
                <GoldenInput
                  name="billing_address_street"
                  value={formValues.billing_address_street}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="Street address"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Billing City</GoldenLabel>
                <GoldenInput
                  name="billing_address_city"
                  value={formValues.billing_address_city}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="City"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Billing State / Zip</GoldenLabel>
                <GoldenInput
                  name="billing_address_state_zip"
                  value={formValues.billing_address_state_zip}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="State, Zip"
                />
              </GoldenFormGroup>

              {/* Shipping Address (auto-filled from supplier) */}
              <GoldenConditionalSection $visible={visibility.pickupAddress || visibility.deliveryAddress}>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>
                    Shipping Address
                    {supplierAutoFilled && <GoldenAutoFilledBadge>Auto-filled from supplier</GoldenAutoFilledBadge>}
                  </GoldenLabel>
                  <GoldenInput
                    name="shipping_address_street"
                    value={formValues.shipping_address_street}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Street address"
                  />
                </GoldenFormGroup>
                <GoldenFieldGrid>
                  <GoldenFormGroup>
                    <GoldenLabel>Shipping City</GoldenLabel>
                    <GoldenInput
                      name="shipping_address_city"
                      value={formValues.shipping_address_city}
                      onChange={handleChange}
                      $autoFilled={supplierAutoFilled}
                      placeholder="City"
                    />
                  </GoldenFormGroup>
                  <GoldenFormGroup>
                    <GoldenLabel>Shipping State / Zip</GoldenLabel>
                    <GoldenInput
                      name="shipping_address_state_zip"
                      value={formValues.shipping_address_state_zip}
                      onChange={handleChange}
                      $autoFilled={supplierAutoFilled}
                      placeholder="State, Zip"
                    />
                  </GoldenFormGroup>
                </GoldenFieldGrid>
              </GoldenConditionalSection>

              <GoldenConditionalSection $visible={visibility.howMakeAppointment}>
                <GoldenLabel>How to Make Appointment</GoldenLabel>
                <GoldenSelect
                  name="how_to_make_appointment"
                  value={formValues.how_to_make_appointment}
                  onChange={handleChange}
                >
                  <option value="">Select method…</option>
                  {effectiveAppointmentMethods.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenConditionalSection>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 6: Contacts */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Users size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Contacts</GoldenSectionTitle>
            </GoldenSectionHeader>

            {/* Billing Contact (auto-filled from customer) */}
            <div style={{ marginBottom: '20px' }}>
              <GoldenLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                Billing Contact
                {customerAutoFilled && <GoldenAutoFilledBadge>Auto-filled from customer</GoldenAutoFilledBadge>}
              </GoldenLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Name</GoldenLabel>
                  <GoldenInput
                    name="billing_contact_name"
                    value={formValues.billing_contact_name}
                    onChange={handleChange}
                    $autoFilled={customerAutoFilled}
                    placeholder="Contact name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Phone</GoldenLabel>
                  <GoldenInput
                    name="billing_contact_phone"
                    value={formValues.billing_contact_phone}
                    onChange={handleChange}
                    $autoFilled={customerAutoFilled}
                    placeholder="Phone number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>Email</GoldenLabel>
                  <GoldenInput
                    type="email"
                    name="billing_contact_email"
                    value={formValues.billing_contact_email}
                    onChange={handleChange}
                    $autoFilled={customerAutoFilled}
                    placeholder="Email address"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </div>

            {/* Dynamic Shipping Contacts */}
            <GoldenConditionalSection $visible={visibility.shippingContacts}>
              <div style={{ marginBottom: '20px' }}>
                <GoldenLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                  Shipping Contacts
                </GoldenLabel>
                {shippingContacts.map((contact, idx) => (
                  <ContactRow key={contact.id}>
                    <div>
                      <GoldenLabel>Name</GoldenLabel>
                      <GoldenInput
                        value={contact.name}
                        onChange={(e) => updateShippingContact(idx, 'name', e.target.value)}
                        placeholder={`Contact ${idx + 1} name`}
                      />
                    </div>
                    <div>
                      <GoldenLabel>Phone</GoldenLabel>
                      <GoldenInput
                        value={contact.phone}
                        onChange={(e) => updateShippingContact(idx, 'phone', e.target.value)}
                        placeholder="Phone"
                      />
                    </div>
                    <div>
                      <GoldenLabel>Email</GoldenLabel>
                      <GoldenInput
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateShippingContact(idx, 'email', e.target.value)}
                        placeholder="Email"
                      />
                    </div>
                    {shippingContacts.length > 1 && (
                      <RemoveContactBtn
                        type="button"
                        onClick={() => removeShippingContact(idx)}
                        aria-label={`Remove shipping contact ${idx + 1}`}
                      >
                        <X size={16} />
                      </RemoveContactBtn>
                    )}
                  </ContactRow>
                ))}
                <AddContactBtn type="button" onClick={addShippingContact}>
                  <Plus size={14} /> Add Shipping Contact
                </AddContactBtn>
              </div>
            </GoldenConditionalSection>

            {/* Receiving Contact */}
            <GoldenConditionalSection $visible={visibility.receivingContact || false}>
              <div>
                <GoldenLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                  Receiving Contact
                </GoldenLabel>
                <GoldenFieldGrid>
                  <GoldenFormGroup>
                    <GoldenLabel>Name</GoldenLabel>
                    <GoldenInput
                      name="receiving_contact_name"
                      value={formValues.receiving_contact_name}
                      onChange={handleChange}
                      placeholder="Receiving contact name"
                    />
                  </GoldenFormGroup>
                  <GoldenFormGroup>
                    <GoldenLabel>Phone</GoldenLabel>
                    <GoldenInput
                      name="receiving_contact_phone"
                      value={formValues.receiving_contact_phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                    />
                  </GoldenFormGroup>
                  <GoldenFormGroup>
                    <GoldenLabel>Email</GoldenLabel>
                    <GoldenInput
                      type="email"
                      name="receiving_contact_email"
                      value={formValues.receiving_contact_email}
                      onChange={handleChange}
                      placeholder="Email address"
                    />
                  </GoldenFormGroup>
                  <GoldenFormGroup>
                    <GoldenLabel>Title</GoldenLabel>
                    <GoldenInput
                      name="receiving_contact_title"
                      value={formValues.receiving_contact_title}
                      onChange={handleChange}
                      placeholder="Title / Role"
                    />
                  </GoldenFormGroup>
                </GoldenFieldGrid>
              </div>
            </GoldenConditionalSection>
          </GoldenSectionCard>

          {/* Section 7: Payment & Totals */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><DollarSign size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Payment &amp; Totals</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel>Payment Terms</GoldenLabel>
                <GoldenSelect
                  name="payment_terms"
                  value={formValues.payment_terms}
                  onChange={handleChange}
                >
                  <option value="">Select terms…</option>
                  {effectivePaymentTerms.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Payment Status</GoldenLabel>
                <GoldenSelect
                  name="payment_status"
                  value={formValues.payment_status}
                  onChange={handleChange}
                >
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Notes</GoldenLabel>
                <GoldenTextArea
                  name="notes"
                  value={formValues.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Additional notes…"
                />
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Total Amount (auto-calculated)</GoldenLabel>
                <CalculatedValue>
                  ${calculatedTotal}
                </CalculatedValue>
                <GoldenFieldHint>
                  Calculated from total weight or quantity
                </GoldenFieldHint>
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>
        </GoldenFormBody>

        {/* Footer */}
        <GoldenFormFooter>
          <GoldenDraftButton
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save as Draft'}
          </GoldenDraftButton>
          <GoldenSubmitButton
            type="button"
            onClick={() => handleSubmit('pending')}
            disabled={submitting}
          >
            {submitting ? (
              <Spin size="small" />
            ) : (
              <>
                {mode === 'edit' ? 'Update Sales Order' : 'Create Sales Order'} ✓
              </>
            )}
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

export default SalesOrderForm;
