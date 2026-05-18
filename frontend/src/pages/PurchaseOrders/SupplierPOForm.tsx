import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { message, Tooltip, Spin } from 'antd';
import {
  Package,
  Truck,
  Users,
  FileText,
  DollarSign,
  Building2,
  ClipboardList,
  Plus,
  X,
  Info,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import type { Supplier, Customer } from '@/services/apiService';
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
import { logger } from '@/utils/logger';
// ============================================================================

type LogisticsScenario = 'customer_pickup' | 'supplier_delivery' | 'we_pickup';

interface ShippingContact {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface SupplierPOFormValues {
  logistics_scenario: LogisticsScenario;
  supplier: string;
  supplier_corporate_address: string;
  supplier_city: string;
  supplier_state: string;
  supplier_zip: string;
  plant: string;
  // Customer section
  customer: string;
  customer_name: string;
  customer_contact_name: string;
  customer_contact_phone: string;
  customer_contact_email: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_zip: string;
  our_purchase_order_number_to_supplier: string;
  my_customer_number_from_supplier: string;
  supplier_confirmation_order_num: string;
  supplier_confirmation_order_number: string;
  carrier_release_num: string;
  carrier_release_format: string;
  product: string;
  item_description: string;
  type_of_protein: string;
  fresh_or_frozen: string;
  package_type: string;
  quantity: string;
  total_weight: string;
  weight_unit: string;
  net_or_catch: string;
  edible_or_inedible: string;
  price_per_unit: string;
  tested_product: boolean;
  item_production_date: string;
  pick_up_date: string;
  delivery_date: string;
  pick_up_location: string | null;
  delivery_location: string | null;
  pickup_location_name: string;
  pickup_address: string;
  pickup_city_state: string;
  how_carrier_make_appointment: string;
  supplier_contact_name: string;
  supplier_contact_phone: string;
  supplier_contact_email: string;
  receiving_contact_name: string;
  receiving_contact_phone: string;
  receiving_contact_email: string;
  payment_terms: string;
  bill_of_lading_comments: string;
  invoicing_comments: string;
  special_instructions: string;
  total_net_weight: string;
  total_amount: string;
  notes: string;
}

export interface SupplierPOFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<SupplierPOFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
  entityId?: number | string;
}

// ============================================================================
// Constants
// ============================================================================

const SCENARIO_OPTIONS: { value: LogisticsScenario; label: string; icon: string; desc: string }[] = [
  { value: 'customer_pickup', label: 'Customer Picking Up', icon: '🚗', desc: 'Customer picks up from supplier location' },
  { value: 'supplier_delivery', label: 'Supplier Delivering', icon: '🚚', desc: 'Supplier delivers to our location' },
  { value: 'we_pickup', label: 'We Are Picking Up', icon: '🚛', desc: 'Our logistics handle the pickup' },
];

const SCENARIO_VISIBILITY: Record<LogisticsScenario, Record<string, boolean>> = {
  customer_pickup: {
    pickupDate: true,
    deliveryDate: true,
    shippingContacts: true,
    pickupAddress: true,
    deliveryAddress: true,
    howCarrierAppt: true,
    receivingContact: false,
  },
  supplier_delivery: {
    pickupDate: false,
    deliveryDate: true,
    shippingContacts: false,
    pickupAddress: false,
    deliveryAddress: true,
    howCarrierAppt: false,
    receivingContact: false,
  },
  we_pickup: {
    pickupDate: true,
    deliveryDate: true,
    shippingContacts: true,
    pickupAddress: true,
    deliveryAddress: true,
    howCarrierAppt: true,
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

const PRODUCTION_DATE_OPTIONS = [
  '5 day newer', '10 day newer', '15 day newer', '30 day newer',
  '2 month newer', '3 month newer', '6 month newer', '12 month newer',
];

const CARRIER_RELEASE_FORMATS = ['PDF', 'Excel', 'Email', 'Fax', 'EDI'];

// ============================================================================
// Helpers
// ============================================================================

const generatePONumber = (): string => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `PO-${dateStr}-${rand}`;
};

const formatDateTime = (date: Date): string => {
  return dayjs(date).format('MMM D, YYYY h:mm A');
};

const addDays = (date: Date, days: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const getDefaultFormValues = (): SupplierPOFormValues => ({
  logistics_scenario: 'supplier_delivery',
  supplier: '',
  supplier_corporate_address: '',
  supplier_city: '',
  supplier_state: '',
  supplier_zip: '',
  plant: '',
  // Customer defaults
  customer: '',
  customer_name: '',
  customer_contact_name: '',
  customer_contact_phone: '',
  customer_contact_email: '',
  customer_address: '',
  customer_city: '',
  customer_state: '',
  customer_zip: '',
  our_purchase_order_number_to_supplier: '',
  my_customer_number_from_supplier: '',
  supplier_confirmation_order_num: '',
  supplier_confirmation_order_number: '',
  carrier_release_num: '',
  carrier_release_format: '',
  product: '',
  item_description: '',
  type_of_protein: '',
  fresh_or_frozen: '',
  package_type: '',
  quantity: '',
  total_weight: '',
  weight_unit: 'LBS',
  net_or_catch: 'Net',
  edible_or_inedible: 'Edible',
  price_per_unit: '',
  tested_product: false,
  item_production_date: '',
  pick_up_date: addDays(new Date(), 2),
  delivery_date: addDays(new Date(), 7),
  pick_up_location: null,
  delivery_location: null,
  pickup_location_name: '',
  pickup_address: '',
  pickup_city_state: '',
  how_carrier_make_appointment: '',
  supplier_contact_name: '',
  supplier_contact_phone: '',
  supplier_contact_email: '',
  receiving_contact_name: '',
  receiving_contact_phone: '',
  receiving_contact_email: '',
  payment_terms: '',
  bill_of_lading_comments: '',
  invoicing_comments: '',
  special_instructions: '',
  total_net_weight: '',
  total_amount: '',
  notes: '',
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

export const SupplierPOForm: React.FC<SupplierPOFormProps> = ({
  mode,
  initialValues,
  onSuccess,
  onCancel,
  entityId,
}) => {
  const [formValues, setFormValues] = useState<SupplierPOFormValues>(() => ({
    ...getDefaultFormValues(),
    ...initialValues,
  }));
  const [shippingContacts, setShippingContacts] = useState<ShippingContact[]>([
    { id: Date.now().toString(), name: '', phone: '', email: '' },
  ]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [supplierAutoFilled, setSupplierAutoFilled] = useState(false);
  const [customerAutoFilled, setCustomerAutoFilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [createdAt] = useState(() => new Date());
  const approvalGate = useApprovalGate();

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
    let cancelled = false;
    const loadData = async () => {
      try {
        const [suppResp, custResp] = await Promise.all([
          businessApi.get('suppliers/'),
          businessApi.get('customers/'),
        ]);
        if (!cancelled) {
          setSuppliers((suppResp.data?.results || suppResp.data) as Supplier[]);
          setCustomers((custResp.data?.results || custResp.data) as Customer[]);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Failed to fetch suppliers/customers list', { err });
        }
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, []);

  // Load choice options
  useEffect(() => {
    let cancelled = false;
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
        if (!cancelled) {
          setProteinOptions(protein);
          setFreshFrozenOptions(ff);
          setPackageTypeOptions(pkg);
          setWeightUnitOptions(wu);
          setNetCatchOptions(nc);
          setPaymentTermsOptions(pt);
          setAppointmentOptions(appt);
        }
      } catch (err) {
        if (!cancelled) {
          logger.warn('Failed to fetch payment terms and appointment options', { err });
        }
      }
    };
    void loadChoices();
    return () => { cancelled = true; };
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
    const ppu = Number(formValues.price_per_unit);
    if (Number.isFinite(tw) && tw > 0 && Number.isFinite(ppu) && ppu > 0) {
      return (tw * ppu).toFixed(2);
    }
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(ppu) && ppu > 0) {
      return (qty * ppu).toFixed(2);
    }
    return '0.00';
  }, [formValues.quantity, formValues.total_weight, formValues.price_per_unit]);

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

  // Supplier auto-populate
  const handleSupplierChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const supplierId = e.target.value;
      setFormValues((prev) => ({ ...prev, supplier: supplierId }));
      setSupplierAutoFilled(false);

      if (!supplierId) return;

      try {
        setLoadingSupplier(true);
        const supplier = suppliers.find((s) => String(s.id) === supplierId);
        if (supplier) {
          setFormValues((prev) => ({
            ...prev,
            supplier: supplierId,
            supplier_corporate_address: supplier.address || '',
            supplier_city: supplier.city || '',
            supplier_state: supplier.state || '',
            supplier_zip: supplier.zip_code || '',
            supplier_contact_name: supplier.contact_person || '',
            supplier_contact_phone: supplier.phone || supplier.phone_mobile || supplier.phone_office || '',
            supplier_contact_email: supplier.email || '',
          }));
          setSupplierAutoFilled(true);
        }
      } catch (err) {
        logger.warn('Failed to auto-populate supplier details', { err });
      } finally {
        setLoadingSupplier(false);
      }
    },
    [suppliers],
  );

  // Customer auto-populate
  const handleCustomerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const customerId = e.target.value;
      setFormValues((prev) => ({ ...prev, customer: customerId }));
      setCustomerAutoFilled(false);

      if (!customerId) return;

      try {
        setLoadingCustomer(true);
        const customer = customers.find((c) => String(c.id) === customerId);
        if (customer) {
          setFormValues((prev) => ({
            ...prev,
            customer: customerId,
            customer_name: customer.name || '',
            customer_contact_name: customer.contact_person || '',
            customer_contact_phone: customer.phone || customer.phone_mobile || customer.phone_office || '',
            customer_contact_email: customer.email || '',
            customer_address: customer.address || '',
            customer_city: customer.city || '',
            customer_state: customer.state || '',
            customer_zip: customer.zip_code || '',
          }));
          setCustomerAutoFilled(true);
        }
      } catch (err) {
        logger.warn('Failed to auto-populate customer details', { err });
      } finally {
        setLoadingCustomer(false);
      }
    },
    [customers],
  );

  // PO number auto-gen on blur
  const handlePONumberBlur = useCallback(
    (field: 'our_purchase_order_number_to_supplier' | 'my_customer_number_from_supplier' | 'supplier_confirmation_order_num' | 'carrier_release_num') => {
      setFormValues((prev) => {
        if (!prev[field]) {
          return { ...prev, [field]: generatePONumber() };
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
        supplier: formValues.supplier ? parseInt(formValues.supplier) : undefined,
        product: formValues.product || undefined,
        item_description: formValues.item_description || undefined,
        type_of_protein: formValues.type_of_protein || undefined,
        fresh_or_frozen: formValues.fresh_or_frozen || undefined,
        package_type: formValues.package_type || undefined,
        quantity: formValues.quantity ? parseInt(formValues.quantity) : undefined,
        total_weight: formValues.total_weight ? parseFloat(formValues.total_weight) : undefined,
        weight_unit: formValues.weight_unit || undefined,
        net_or_catch: formValues.net_or_catch || undefined,
        edible_or_inedible: formValues.edible_or_inedible || undefined,
        price_per_unit: formValues.price_per_unit ? parseFloat(formValues.price_per_unit) : undefined,
        tested_product: formValues.tested_product,
        item_production_date: formValues.item_production_date || undefined,
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: formValues.delivery_date || undefined,
        pick_up_location: formValues.pick_up_location || undefined,
        delivery_location: formValues.delivery_location || undefined,
        how_carrier_make_appointment: formValues.how_carrier_make_appointment || undefined,
        our_purchase_order_number_to_supplier: formValues.our_purchase_order_number_to_supplier || undefined,
        my_customer_number_from_supplier: formValues.my_customer_number_from_supplier || undefined,
        supplier_confirmation_order_num: formValues.supplier_confirmation_order_num || undefined,
        supplier_confirmation_order_number: formValues.supplier_confirmation_order_number || undefined,
        carrier_release_num: formValues.carrier_release_num || undefined,
        supplier_corporate_address: formValues.supplier_corporate_address || undefined,
        supplier_contact_name: formValues.supplier_contact_name || undefined,
        supplier_contact_phone: formValues.supplier_contact_phone || undefined,
        supplier_contact_email: formValues.supplier_contact_email || undefined,
        receiving_contact_name: formValues.receiving_contact_name || undefined,
        receiving_contact_phone: formValues.receiving_contact_phone || undefined,
        receiving_contact_email: formValues.receiving_contact_email || undefined,
        payment_terms: formValues.payment_terms || undefined,
        bill_of_lading_comments: formValues.bill_of_lading_comments || undefined,
        invoicing_comments: formValues.invoicing_comments || undefined,
        special_instructions: formValues.special_instructions || undefined,
        total_net_weight: formValues.total_net_weight ? parseFloat(formValues.total_net_weight) : undefined,
        total_amount: parseFloat(calculatedTotal) || 0,
        notes: formValues.notes || undefined,
        status,
        custom_data: {
          customer_id: formValues.customer ? parseInt(formValues.customer) : null,
          customer_name: formValues.customer_name || null,
          customer_contact_name: formValues.customer_contact_name || null,
          customer_contact_phone: formValues.customer_contact_phone || null,
          customer_contact_email: formValues.customer_contact_email || null,
          customer_address: formValues.customer_address || null,
          customer_city: formValues.customer_city || null,
          customer_state: formValues.customer_state || null,
          customer_zip: formValues.customer_zip || null,
        },
      };
    },
    [formValues, calculatedTotal],
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (status: 'draft' | 'pending') => {
      if (!formValues.supplier) {
        message.warning('Please select a supplier');
        return;
      }

      setSubmitting(true);
      try {
        const payload = buildPayload(status);

        // Approval gate: intercept before external send (skip drafts)
        if (status !== 'draft') {
          const gateResult = await approvalGate.intercept({
            requestType: 'purchase_order',
            subject: `PO ${formValues.our_purchase_order_number_to_supplier || 'New'}`,
            recipientType: 'supplier',
            contentPreview: `Purchase Order for ${formValues.item_description || 'product'}`,
            sourceEntityType: 'purchase_order',
          });
          if (!gateResult.approved) {
            setSubmitting(false);
            return;
          }
        }

        if (mode === 'edit' && entityId) {
          await businessApi.patch(`purchase-orders/${entityId}/`, payload);
        } else {
          await businessApi.post('purchase-orders/', payload);
        }
        message.success(
          `Purchase Order ${status === 'draft' ? 'saved as draft' : 'created'} successfully!`,
        );
        onSuccess();
      } catch (err) {
        const error = err as Error;
        message.error(error.message || 'Failed to save purchase order');
      } finally {
        setSubmitting(false);
      }
    },
    [formValues, mode, entityId, buildPayload, onSuccess, approvalGate],
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
              {mode === 'edit' ? 'Edit Purchase Order' : 'New Purchase Order'}
            </GoldenFormTitle>
          </GoldenFormTitleGroup>
          <GoldenCloseButton onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </GoldenCloseButton>
        </GoldenFormHeader>

        <GoldenFormBody as="div">
          {/* Scenario Selector */}
          <ScenarioCard>
            <ScenarioLabel>
              <Zap size={16} />
              Purchase Order Delivery Type
              <Tooltip title="This controls which fields appear below. Choose the logistics scenario that matches how goods will be transported.">
                <Info size={14} style={{ cursor: 'help', opacity: 0.6 }} />
              </Tooltip>
            </ScenarioLabel>
            <ScenarioSelectWrapper>
              <ScenarioSelect
                name="logistics_scenario"
                value={scenario}
                onChange={handleChange}
                aria-label="Purchase Order Delivery Type"
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

          {/* Section 1: Supplier & Plant Information */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Building2 size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Supplier &amp; Plant Information</GoldenSectionTitle>
              {loadingSupplier && <Spin size="small" />}
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup $span={2}>
                <GoldenLabel $required>Supplier Name</GoldenLabel>
                <GoldenSelect
                  name="supplier"
                  value={formValues.supplier}
                  onChange={handleSupplierChange}
                  required
                  aria-label="Supplier"
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>
                  Corporate Address
                  {supplierAutoFilled && (
                    <GoldenAutoFilledBadge>
                      Auto-filled from supplier
                    </GoldenAutoFilledBadge>
                  )}
                </GoldenLabel>
                <GoldenInput
                  name="supplier_corporate_address"
                  value={formValues.supplier_corporate_address}
                  onChange={handleChange}
                  $autoFilled={supplierAutoFilled}
                  placeholder="Street address"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>City</GoldenLabel>
                <GoldenInput
                  name="supplier_city"
                  value={formValues.supplier_city}
                  onChange={handleChange}
                  $autoFilled={supplierAutoFilled}
                  placeholder="City"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>State / Zip</GoldenLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <GoldenInput
                    name="supplier_state"
                    value={formValues.supplier_state}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="State"
                    style={{ flex: 1 }}
                  />
                  <GoldenInput
                    name="supplier_zip"
                    value={formValues.supplier_zip}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Zip"
                    style={{ flex: 1 }}
                  />
                </div>
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <LocationSelector
                  value={formValues.plant}
                  onChange={(id) => setFormValues((prev) => ({
                    ...prev,
                    plant: id || '',
                    pickup_location_name: '',
                    pickup_address: '',
                    pickup_city_state: '',
                  }))}
                  type="plant"
                  label="Plant Location"
                  placeholder="Select plant…"
                />
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 2: Customer Information */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Users size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Customer Information</GoldenSectionTitle>
              {loadingCustomer && <Spin size="small" />}
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup $span={2}>
                <GoldenLabel>Customer</GoldenLabel>
                <GoldenSelect
                  name="customer"
                  value={formValues.customer}
                  onChange={handleCustomerChange}
                  aria-label="Customer"
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </GoldenSelect>
                <GoldenFieldHint>The customer this purchase order is for</GoldenFieldHint>
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>
                  Address
                  {customerAutoFilled && (
                    <GoldenAutoFilledBadge>
                      Auto-filled from customer
                    </GoldenAutoFilledBadge>
                  )}
                </GoldenLabel>
                <GoldenInput
                  name="customer_address"
                  value={formValues.customer_address}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="Street address"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>City</GoldenLabel>
                <GoldenInput
                  name="customer_city"
                  value={formValues.customer_city}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="City"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>State / Zip</GoldenLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <GoldenInput
                    name="customer_state"
                    value={formValues.customer_state}
                    onChange={handleChange}
                    $autoFilled={customerAutoFilled}
                    placeholder="State"
                    style={{ flex: 1 }}
                  />
                  <GoldenInput
                    name="customer_zip"
                    value={formValues.customer_zip}
                    onChange={handleChange}
                    $autoFilled={customerAutoFilled}
                    placeholder="Zip"
                    style={{ flex: 1 }}
                  />
                </div>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Contact Name</GoldenLabel>
                <GoldenInput
                  name="customer_contact_name"
                  value={formValues.customer_contact_name}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="Primary contact"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Contact Phone</GoldenLabel>
                <GoldenInput
                  name="customer_contact_phone"
                  value={formValues.customer_contact_phone}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="Phone number"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Contact Email</GoldenLabel>
                <GoldenInput
                  name="customer_contact_email"
                  value={formValues.customer_contact_email}
                  onChange={handleChange}
                  $autoFilled={customerAutoFilled}
                  placeholder="Email address"
                  type="email"
                />
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 3: Order & Confirmation Numbers */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><FileText size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Order &amp; Confirmation Numbers</GoldenSectionTitle>
            </GoldenSectionHeader>

            <GoldenDateTimeStamp>
              📅 Created: {formatDateTime(createdAt)}
            </GoldenDateTimeStamp>

            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel>Our PO # To Supplier</GoldenLabel>
                <GoldenInput
                  name="our_purchase_order_number_to_supplier"
                  value={formValues.our_purchase_order_number_to_supplier}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('our_purchase_order_number_to_supplier')}
                  placeholder="Leave blank to auto-generate"
                />
                <GoldenFieldHint>e.g. PO-20260513-847291</GoldenFieldHint>
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>My Customer # From Supplier</GoldenLabel>
                <GoldenInput
                  name="my_customer_number_from_supplier"
                  value={formValues.my_customer_number_from_supplier}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('my_customer_number_from_supplier')}
                  placeholder="Leave blank to auto-generate"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Supplier Confirmation #</GoldenLabel>
                <GoldenInput
                  name="supplier_confirmation_order_num"
                  value={formValues.supplier_confirmation_order_num}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('supplier_confirmation_order_num')}
                  placeholder="Leave blank to auto-generate"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Supplier Confirmation Order #</GoldenLabel>
                <GoldenInput
                  name="supplier_confirmation_order_number"
                  value={formValues.supplier_confirmation_order_number}
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
                  onBlur={() => handlePONumberBlur('carrier_release_num')}
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

          {/* Section 3: Product Details */}
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
                <GoldenLabel>Product / Description</GoldenLabel>
                <SmartProductAutocomplete
                  value={formValues.product}
                  onChange={(productId, product) => {
                    setFormValues((prev) => ({
                      ...prev,
                      product: productId,
                      item_description:
                        prev.item_description
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
                <GoldenLabel>Item Description</GoldenLabel>
                <GoldenTextArea
                  name="item_description"
                  value={formValues.item_description}
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
                <GoldenLabel>Price Per Unit</GoldenLabel>
                <GoldenInput
                  type="number"
                  step="0.01"
                  name="price_per_unit"
                  value={formValues.price_per_unit}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </GoldenFormGroup>

              <GoldenFormGroup>
                <GoldenLabel>Item Production Date</GoldenLabel>
                <GoldenSelect
                  name="item_production_date"
                  value={formValues.item_production_date}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {PRODUCTION_DATE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
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

          {/* Section 4: Logistics & Pickup/Delivery */}
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
                <GoldenFormGroup>
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

              <GoldenConditionalSection $visible={visibility.howCarrierAppt}>
                <GoldenLabel>How Carrier Makes Appointment</GoldenLabel>
                <GoldenSelect
                  name="how_carrier_make_appointment"
                  value={formValues.how_carrier_make_appointment}
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

          {/* Section 5: Contacts */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><Users size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Contacts</GoldenSectionTitle>
            </GoldenSectionHeader>

            {/* Supplier / Accounting Contact */}
            <div style={{ marginBottom: '20px' }}>
              <GoldenLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                Supplier Contact
                {supplierAutoFilled && <GoldenAutoFilledBadge>Auto-filled from supplier</GoldenAutoFilledBadge>}
              </GoldenLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Name</GoldenLabel>
                  <GoldenInput
                    name="supplier_contact_name"
                    value={formValues.supplier_contact_name}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Contact name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Phone</GoldenLabel>
                  <GoldenInput
                    name="supplier_contact_phone"
                    value={formValues.supplier_contact_phone}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Phone number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>Email</GoldenLabel>
                  <GoldenInput
                    type="email"
                    name="supplier_contact_email"
                    value={formValues.supplier_contact_email}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
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
                  <GoldenFormGroup $span={2}>
                    <GoldenLabel>Email</GoldenLabel>
                    <GoldenInput
                      type="email"
                      name="receiving_contact_email"
                      value={formValues.receiving_contact_email}
                      onChange={handleChange}
                      placeholder="Email address"
                    />
                  </GoldenFormGroup>
                </GoldenFieldGrid>
              </div>
            </GoldenConditionalSection>
          </GoldenSectionCard>

          {/* Section 6: Comments & Totals */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon><DollarSign size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>Accounting, Comments &amp; Totals</GoldenSectionTitle>
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

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Bill of Lading Comments</GoldenLabel>
                <GoldenTextArea
                  name="bill_of_lading_comments"
                  value={formValues.bill_of_lading_comments}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Comments for the bill of lading…"
                />
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Invoicing Comments</GoldenLabel>
                <GoldenTextArea
                  name="invoicing_comments"
                  value={formValues.invoicing_comments}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Comments for invoicing…"
                />
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Special Instructions</GoldenLabel>
                <GoldenTextArea
                  name="special_instructions"
                  value={formValues.special_instructions}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any special instructions…"
                />
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Notes</GoldenLabel>
                <GoldenTextArea
                  name="notes"
                  value={formValues.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Additional notes…"
                />
              </GoldenFormGroup>

              <GoldenFormGroup $span={2}>
                <GoldenLabel>Total Amount (auto-calculated)</GoldenLabel>
                <CalculatedValue>
                  ${calculatedTotal}
                </CalculatedValue>
                <GoldenFieldHint>
                  Calculated from total weight × price per unit (or qty × price per unit)
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
                {mode === 'edit' ? 'Update PO' : 'Create PO'} ✓
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

export default SupplierPOForm;
