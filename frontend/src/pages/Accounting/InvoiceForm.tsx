import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message, Tooltip, Spin } from 'antd';
import {
  Package,
  Users,
  FileText,
  DollarSign,
  ClipboardList,
  X,
  Info,
  Zap,
  MessageSquare,
} from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import { SmartProductAutocomplete } from '@/components/Inquiry/SmartProductAutocomplete';
import { getChoices, type ChoiceOption } from '@/services/choicesService';
import { useApprovalGate } from '@/hooks/useApprovalGate';
import ApprovalPreviewModal from '@/components/AIAssistant/ApprovalPreviewModal';

// ============================================================================
// Types
// ============================================================================

interface InvoiceFormValues {
  invoice_number: string;
  customer: string;
  sales_order: string;
  product: string;
  our_sales_order_num: string;
  our_sales_order_number_for_customer: string;
  delivery_po_num: string;
  delivery_po_number: string;
  payment_terms: string;
  due_date: string;
  pick_up_date: string;
  delivery_date: string;
  type_of_protein: string;
  description_of_product_item: string;
  fresh_or_frozen: string;
  package_type: string;
  quantity: string;
  net_or_catch: string;
  total_net_weight: string;
  total_weight: string;
  weight_unit: string;
  edible_or_inedible: string;
  tested_product: boolean;
  unit_price: string;
  total_amount: string;
  tax_amount: string;
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
  accounting_payable_contact_name: string;
  accounting_payable_contact_phone: string;
  accounting_payable_contact_email: string;
  carrier_release_format: string;
  carrier_release_number: string;
  how_to_make_appointment: string;
  status: string;
  payment_status: string;
  outstanding_amount: string;
  notes: string;
}

export interface InvoiceFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<InvoiceFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
  entityId?: number | string;
}

interface CustomerRecord {
  id: number;
  name?: string;
  company_name?: string;
  address?: string;
  city?: string;
  state_zip?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  ap_contact_name?: string;
  ap_contact_phone?: string;
  ap_contact_email?: string;
}

interface SalesOrderRecord {
  id: number;
  order_number?: string;
  customer_name?: string;
  our_sales_order_num?: string;
  our_sales_order_number_for_customer?: string;
  delivery_po_num?: string;
  delivery_po_number?: string;
  type_of_protein?: string;
  description_of_product_item?: string;
  fresh_or_frozen?: string;
  package_type?: string;
  quantity?: string | number;
  total_weight?: string | number;
  total_net_weight?: string | number;
  weight_unit?: string;
  net_or_catch?: string;
  edible_or_inedible?: string;
  pick_up_date?: string;
  delivery_date?: string;
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

const PAYMENT_TERMS = ['Wire', 'ACH', 'Check', 'Credit Card'];

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

const getDefaultFormValues = (): InvoiceFormValues => ({
  invoice_number: '',
  customer: '',
  sales_order: '',
  product: '',
  our_sales_order_num: '',
  our_sales_order_number_for_customer: '',
  delivery_po_num: '',
  delivery_po_number: '',
  payment_terms: '',
  due_date: addDays(new Date(), 30),
  pick_up_date: '',
  delivery_date: '',
  type_of_protein: '',
  description_of_product_item: '',
  fresh_or_frozen: '',
  package_type: '',
  quantity: '',
  net_or_catch: 'Net',
  total_net_weight: '',
  total_weight: '',
  weight_unit: 'LBS',
  edible_or_inedible: 'Edible',
  tested_product: false,
  unit_price: '',
  total_amount: '',
  tax_amount: '',
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
  accounting_payable_contact_name: '',
  accounting_payable_contact_phone: '',
  accounting_payable_contact_email: '',
  carrier_release_format: '',
  carrier_release_number: '',
  how_to_make_appointment: '',
  status: 'draft',
  payment_status: 'Pending',
  outstanding_amount: '',
  notes: '',
});

// ============================================================================
// Styled Components
// ============================================================================

const FormWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  overflow-y: auto;
  backdrop-filter: blur(4px);

  @media (max-width: 768px) {
    align-items: flex-start;
    padding: 8px;
  }
`;

const FormShell = styled.div`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-surface-foreground));
  border-radius: 16px;
  width: 100%;
  max-width: 960px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.12);

  @media (max-width: 768px) {
    max-height: calc(100vh - 16px);
    border-radius: 12px;
  }
`;

const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid rgb(var(--color-border));
  position: sticky;
  top: 0;
  background: rgb(var(--color-surface));
  z-index: 10;
  border-radius: 16px 16px 0 0;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const FormTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }
`;

const FormBody = styled.div`
  padding: 24px 32px 32px;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const SectionCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SectionIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FieldGroup = styled.div<{ $span?: number }>`
  grid-column: ${({ $span }) => ($span === 2 ? 'span 2' : 'auto')};

  @media (max-width: 768px) {
    grid-column: auto;
  }
`;

const FieldLabel = styled.label`
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
`;

const RequiredMark = styled.span`
  color: rgb(var(--color-error));
  margin-left: 2px;
`;

const StyledInput = styled.input<{ $autoFilled?: boolean; $readOnly?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 42px;
  box-sizing: border-box;

  ${({ $autoFilled }) => $autoFilled && `
    background: rgba(var(--color-primary), 0.04);
    border-color: rgba(var(--color-primary), 0.2);
  `}

  ${({ $readOnly }) => $readOnly && `
    background: rgb(var(--color-surface-hover));
    cursor: default;
  `}

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.08);
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
    opacity: 0.6;
  }

  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  &[type='number'] {
    -moz-appearance: textfield;
  }

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const StyledSelect = styled.select<{ $autoFilled?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  transition: border-color 0.2s;
  min-height: 42px;
  box-sizing: border-box;

  ${({ $autoFilled }) => $autoFilled && `
    background: rgba(var(--color-primary), 0.04);
    border-color: rgba(var(--color-primary), 0.2);
  `}

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.08);
  }

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.08);
  }

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  padding: 8px 0;
`;

const StyledCheckbox = styled.input`
  width: 18px;
  height: 18px;
  accent-color: rgb(var(--color-primary));
  cursor: pointer;
`;

const AutoFilledBadge = styled.span`
  font-size: 11px;
  color: rgb(var(--color-primary));
  opacity: 0.7;
  margin-left: 8px;
  font-weight: 400;
`;

const FieldHint = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  opacity: 0.8;
`;

const DateTimeStamp = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  padding: 8px 12px;
  background: rgb(var(--color-surface-hover));
  border-radius: 8px;
  display: inline-block;
  margin-bottom: 16px;
`;

const FormFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 32px;
  border-top: 1px solid rgb(var(--color-border));
  position: sticky;
  bottom: 0;
  background: rgb(var(--color-surface));
  border-radius: 0 0 16px 16px;

  @media (max-width: 768px) {
    padding: 16px;
    flex-wrap: wrap;

    & > button {
      flex: 1 1 100%;
    }
  }
`;

const DraftButton = styled.button`
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1.5px solid rgb(var(--color-border));
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-text-secondary));
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
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

const PullFromBOLBtn = styled.button`
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
  border: 1.5px solid rgba(var(--color-primary), 0.2);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  margin-top: 8px;

  &:hover {
    background: rgba(var(--color-primary), 0.15);
    border-color: rgb(var(--color-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  mode,
  initialValues,
  onSuccess,
  onCancel,
  entityId,
}) => {
  const [formValues, setFormValues] = useState<InvoiceFormValues>(() => ({
    ...getDefaultFormValues(),
    ...initialValues,
  }));
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderRecord[]>([]);
  const [customerAutoFilled, setCustomerAutoFilled] = useState(false);
  const [soAutoFilled, setSoAutoFilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [pullingBOL, setPullingBOL] = useState(false);
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

  // Load customers and sales orders
  useEffect(() => {
    const loadData = async () => {
      try {
        const [custResp, soResp] = await Promise.all([
          businessApi.get('customers/'),
          businessApi.get('sales-orders/'),
        ]);
        setCustomers((custResp.data.results || custResp.data) as CustomerRecord[]);
        setSalesOrders((soResp.data.results || soResp.data) as SalesOrderRecord[]);
      } catch {
        console.error('Failed to load customers or sales orders');
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
    const up = Number(formValues.unit_price);
    const tax = Number(formValues.tax_amount) || 0;
    if (Number.isFinite(tw) && tw > 0 && Number.isFinite(up) && up > 0) {
      return (tw * up + tax).toFixed(2);
    }
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(up) && up > 0) {
      return (qty * up + tax).toFixed(2);
    }
    return '0.00';
  }, [formValues.quantity, formValues.total_weight, formValues.unit_price, formValues.tax_amount]);

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

  // Customer auto-populate
  const handleCustomerChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
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
            billing_address_street: customer.address || '',
            billing_address_city: customer.city || '',
            billing_address_state_zip: customer.state_zip || '',
            billing_contact_name: customer.contact_name || '',
            billing_contact_phone: customer.contact_phone || '',
            billing_contact_email: customer.contact_email || '',
            accounting_payable_contact_name: customer.ap_contact_name || customer.contact_name || '',
            accounting_payable_contact_phone: customer.ap_contact_phone || customer.contact_phone || '',
            accounting_payable_contact_email: customer.ap_contact_email || customer.contact_email || '',
          }));
          setCustomerAutoFilled(true);
        }
      } catch {
        message.error('Failed to load customer details');
      } finally {
        setLoadingCustomer(false);
      }
    },
    [customers],
  );

  // Sales Order auto-populate
  const handleSalesOrderChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const soId = e.target.value;
      setFormValues((prev) => ({ ...prev, sales_order: soId }));
      setSoAutoFilled(false);

      if (!soId) return;

      try {
        const so = salesOrders.find((s) => String(s.id) === soId);
        if (so) {
          setFormValues((prev) => ({
            ...prev,
            sales_order: soId,
            our_sales_order_num: so.our_sales_order_num || '',
            our_sales_order_number_for_customer: so.our_sales_order_number_for_customer || '',
            delivery_po_num: so.delivery_po_num || '',
            delivery_po_number: so.delivery_po_number || '',
            type_of_protein: so.type_of_protein || prev.type_of_protein,
            description_of_product_item: so.description_of_product_item || prev.description_of_product_item,
            fresh_or_frozen: so.fresh_or_frozen || prev.fresh_or_frozen,
            package_type: so.package_type || prev.package_type,
            quantity: so.quantity?.toString() || prev.quantity,
            total_weight: so.total_weight?.toString() || prev.total_weight,
            total_net_weight: so.total_net_weight?.toString() || prev.total_net_weight,
            weight_unit: so.weight_unit || prev.weight_unit,
            net_or_catch: so.net_or_catch || prev.net_or_catch,
            edible_or_inedible: so.edible_or_inedible || prev.edible_or_inedible,
            pick_up_date: so.pick_up_date || prev.pick_up_date,
            delivery_date: so.delivery_date || prev.delivery_date,
          }));
          setSoAutoFilled(true);
        }
      } catch {
        message.error('Failed to load sales order details');
      }
    },
    [salesOrders],
  );

  // Pull from BOL
  const handlePullFromBOL = useCallback(async () => {
    if (!formValues.sales_order) {
      message.warning('Link a Sales Order first');
      return;
    }
    try {
      setPullingBOL(true);
      const resp = await businessApi.get(`sales-orders/${formValues.sales_order}/`);
      setFormValues((prev) => ({
        ...prev,
        total_net_weight: resp.data?.total_net_weight?.toString() || prev.total_net_weight,
      }));
      message.success('Pulled weight from linked Sales Order');
    } catch {
      message.error('Failed to pull from Sales Order');
    } finally {
      setPullingBOL(false);
    }
  }, [formValues.sales_order]);

  // Build payload
  const buildPayload = useCallback(
    (status: 'draft' | 'sent') => ({
      ...formValues,
      invoice_number: formValues.invoice_number || generateNumber('INV'),
      status,
      total_amount: calculatedTotal,
    }),
    [formValues, calculatedTotal],
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (status: 'draft' | 'sent') => {
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
            requestType: 'invoice',
            subject: `Invoice ${formValues.invoice_number || 'New'}`,
            recipientType: 'customer',
            contentPreview: `Invoice for ${formValues.description_of_product_item || 'product'}`,
            sourceEntityType: 'invoice',
          });
          if (!gateResult.approved) {
            setSubmitting(false);
            return;
          }
        }

        if (mode === 'edit' && entityId) {
          await businessApi.put(`invoices/${entityId}/`, payload);
        } else {
          await businessApi.post('invoices/', payload);
        }
        message.success(
          `Invoice ${status === 'draft' ? 'saved as draft' : 'created'} successfully!`,
        );
        onSuccess();
      } catch (err) {
        const error = err as Error;
        message.error(error.message || 'Failed to save invoice');
      } finally {
        setSubmitting(false);
      }
    },
    [formValues, mode, entityId, buildPayload, onSuccess],
  );

  const handleDraft = useCallback(() => handleSubmit('draft'), [handleSubmit]);
  const handleSend = useCallback(() => handleSubmit('sent'), [handleSubmit]);

  return (
    <FormWrapper onClick={onCancel}>
      <FormShell onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <FormHeader>
          <FormTitleGroup>
            <FileText size={24} color="rgb(var(--color-primary))" />
            <FormTitle>{mode === 'edit' ? 'Edit Invoice' : 'Create Invoice'}</FormTitle>
          </FormTitleGroup>
          <CloseBtn onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </CloseBtn>
        </FormHeader>

        <FormBody>
          {/* Section 1: Customer Information */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><Users size={18} /></SectionIcon>
              <SectionTitle>Customer Information</SectionTitle>
              {loadingCustomer && <Spin size="small" />}
            </SectionHeader>
            <FieldGrid>
              <FieldGroup $span={2}>
                <FieldLabel>
                  Customer<RequiredMark>*</RequiredMark>
                  {customerAutoFilled && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledSelect
                  name="customer"
                  value={formValues.customer}
                  onChange={handleCustomerChange}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.name || `Customer #${c.id}`}
                    </option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>
                  Sales Order (optional link)
                  {soAutoFilled && <AutoFilledBadge>Auto-filled from SO</AutoFilledBadge>}
                </FieldLabel>
                <StyledSelect
                  name="sales_order"
                  value={formValues.sales_order}
                  onChange={handleSalesOrderChange}
                  $autoFilled={soAutoFilled}
                >
                  <option value="">No linked Sales Order</option>
                  {salesOrders.map((so) => (
                    <option key={so.id} value={so.id}>
                      {so.order_number || `SO #${so.id}`}
                      {so.customer_name ? ` — ${so.customer_name}` : ''}
                    </option>
                  ))}
                </StyledSelect>
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 2: Order & Reference Numbers */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><FileText size={18} /></SectionIcon>
              <SectionTitle>Order & Reference Numbers</SectionTitle>
            </SectionHeader>
            <DateTimeStamp>
              Created: {formatDateTime(createdAt)}
            </DateTimeStamp>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Invoice Number</FieldLabel>
                <StyledInput
                  name="invoice_number"
                  value={formValues.invoice_number}
                  onChange={handleChange}
                  placeholder="Leave blank to auto-generate (e.g. INV-20260513-847291)"
                />
                <FieldHint>Auto-generated if left blank</FieldHint>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>
                  Our Sales Order #
                  {soAutoFilled && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledInput
                  name="our_sales_order_num"
                  value={formValues.our_sales_order_num}
                  onChange={handleChange}
                  placeholder="SO number"
                  $autoFilled={soAutoFilled && !!formValues.our_sales_order_num}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>
                  Our SO # for Customer
                  {soAutoFilled && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledInput
                  name="our_sales_order_number_for_customer"
                  value={formValues.our_sales_order_number_for_customer}
                  onChange={handleChange}
                  placeholder="Customer-facing SO #"
                  $autoFilled={soAutoFilled && !!formValues.our_sales_order_number_for_customer}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>
                  Delivery PO #
                  {soAutoFilled && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledInput
                  name="delivery_po_num"
                  value={formValues.delivery_po_num}
                  onChange={handleChange}
                  placeholder="Delivery PO number"
                  $autoFilled={soAutoFilled && !!formValues.delivery_po_num}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Delivery PO Number</FieldLabel>
                <StyledInput
                  name="delivery_po_number"
                  value={formValues.delivery_po_number}
                  onChange={handleChange}
                  placeholder="Full PO reference"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Carrier Release Number</FieldLabel>
                <StyledInput
                  name="carrier_release_number"
                  value={formValues.carrier_release_number}
                  onChange={handleChange}
                  placeholder="Release #"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Carrier Release Format</FieldLabel>
                <StyledSelect
                  name="carrier_release_format"
                  value={formValues.carrier_release_format}
                  onChange={handleChange}
                >
                  <option value="">Select format...</option>
                  {CARRIER_RELEASE_FORMATS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 3: Product Details */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><Package size={18} /></SectionIcon>
              <SectionTitle>Product Details</SectionTitle>
            </SectionHeader>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>
                  Type of Protein
                  {soAutoFilled && formValues.type_of_protein && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledSelect
                  name="type_of_protein"
                  value={formValues.type_of_protein}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.type_of_protein}
                >
                  <option value="">Select protein...</option>
                  {effectiveProteinOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>
                  Fresh or Frozen
                  {soAutoFilled && formValues.fresh_or_frozen && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledSelect
                  name="fresh_or_frozen"
                  value={formValues.fresh_or_frozen}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.fresh_or_frozen}
                >
                  <option value="">Select...</option>
                  {effectiveFreshFrozen.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Product</FieldLabel>
                <SmartProductAutocomplete
                  value={formValues.product}
                  onChange={(val: string) =>
                    setFormValues((prev) => ({ ...prev, product: val }))
                  }
                />
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>
                  Description of Product / Item
                  {soAutoFilled && formValues.description_of_product_item && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledTextArea
                  name="description_of_product_item"
                  value={formValues.description_of_product_item}
                  onChange={handleChange}
                  placeholder="Product description..."
                  rows={3}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>
                  Package Type
                  {soAutoFilled && formValues.package_type && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledSelect
                  name="package_type"
                  value={formValues.package_type}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.package_type}
                >
                  <option value="">Select package type...</option>
                  {effectivePackageTypes.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Quantity</FieldLabel>
                <StyledInput
                  name="quantity"
                  type="number"
                  value={formValues.quantity}
                  onChange={handleChange}
                  placeholder="0"
                  $autoFilled={soAutoFilled && !!formValues.quantity}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Total Weight</FieldLabel>
                <StyledInput
                  name="total_weight"
                  type="number"
                  value={formValues.total_weight}
                  onChange={handleChange}
                  placeholder="0"
                  $autoFilled={soAutoFilled && !!formValues.total_weight}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Weight Unit</FieldLabel>
                <StyledSelect
                  name="weight_unit"
                  value={formValues.weight_unit}
                  onChange={handleChange}
                >
                  {effectiveWeightUnits.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Net or Catch</FieldLabel>
                <StyledSelect
                  name="net_or_catch"
                  value={formValues.net_or_catch}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.net_or_catch}
                >
                  {effectiveNetCatch.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>
                  Total Net Weight
                  {soAutoFilled && formValues.total_net_weight && <AutoFilledBadge>Auto-filled</AutoFilledBadge>}
                </FieldLabel>
                <StyledInput
                  name="total_net_weight"
                  type="number"
                  value={formValues.total_net_weight}
                  onChange={handleChange}
                  placeholder="0"
                  $autoFilled={soAutoFilled && !!formValues.total_net_weight}
                />
                <PullFromBOLBtn
                  type="button"
                  onClick={handlePullFromBOL}
                  disabled={!formValues.sales_order || pullingBOL}
                >
                  {pullingBOL ? <Spin size="small" /> : <Zap size={14} />}
                  Pull from BOL
                </PullFromBOLBtn>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Edible or Inedible</FieldLabel>
                <StyledSelect
                  name="edible_or_inedible"
                  value={formValues.edible_or_inedible}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.edible_or_inedible}
                >
                  <option value="Edible">Edible</option>
                  <option value="Inedible">Inedible</option>
                </StyledSelect>
              </FieldGroup>

              <FieldGroup $span={2}>
                <CheckboxRow>
                  <StyledCheckbox
                    type="checkbox"
                    name="tested_product"
                    checked={formValues.tested_product}
                    onChange={handleCheckboxChange}
                  />
                  Tested Product
                  <Tooltip title="Product has been tested and verified">
                    <Info size={14} color="rgb(var(--color-text-secondary))" />
                  </Tooltip>
                </CheckboxRow>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>How to Make Appointment</FieldLabel>
                <StyledSelect
                  name="how_to_make_appointment"
                  value={formValues.how_to_make_appointment}
                  onChange={handleChange}
                >
                  <option value="">Select method...</option>
                  {effectiveAppointmentMethods.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Pick Up Date</FieldLabel>
                <StyledInput
                  name="pick_up_date"
                  type="date"
                  value={formValues.pick_up_date}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.pick_up_date}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Delivery Date</FieldLabel>
                <StyledInput
                  name="delivery_date"
                  type="date"
                  value={formValues.delivery_date}
                  onChange={handleChange}
                  $autoFilled={soAutoFilled && !!formValues.delivery_date}
                />
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 4: Financial Details */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><DollarSign size={18} /></SectionIcon>
              <SectionTitle>Financial Details</SectionTitle>
            </SectionHeader>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Unit Price</FieldLabel>
                <StyledInput
                  name="unit_price"
                  type="number"
                  value={formValues.unit_price}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Tax Amount</FieldLabel>
                <StyledInput
                  name="tax_amount"
                  type="number"
                  value={formValues.tax_amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Payment Terms</FieldLabel>
                <StyledSelect
                  name="payment_terms"
                  value={formValues.payment_terms}
                  onChange={handleChange}
                >
                  <option value="">Select terms...</option>
                  {effectivePaymentTerms.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Due Date</FieldLabel>
                <StyledInput
                  name="due_date"
                  type="date"
                  value={formValues.due_date}
                  onChange={handleChange}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Payment Status</FieldLabel>
                <StyledSelect
                  name="payment_status"
                  value={formValues.payment_status}
                  onChange={handleChange}
                >
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Outstanding Amount</FieldLabel>
                <StyledInput
                  name="outstanding_amount"
                  type="number"
                  value={formValues.outstanding_amount}
                  readOnly
                  $readOnly
                  placeholder="0.00"
                />
                <FieldHint>Calculated from total - paid</FieldHint>
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Total Amount</FieldLabel>
                <CalculatedValue>
                  ${calculatedTotal}
                </CalculatedValue>
                <FieldHint>Calculated from weight × unit price + tax</FieldHint>
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 5: Contacts */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><Users size={18} /></SectionIcon>
              <SectionTitle>Contacts</SectionTitle>
            </SectionHeader>

            {/* Billing Contact */}
            <FieldLabel style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
              Billing Contact
              {customerAutoFilled && <AutoFilledBadge>Auto-filled from customer</AutoFilledBadge>}
            </FieldLabel>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Name</FieldLabel>
                <StyledInput
                  name="billing_contact_name"
                  value={formValues.billing_contact_name}
                  onChange={handleChange}
                  placeholder="Contact name"
                  $autoFilled={customerAutoFilled && !!formValues.billing_contact_name}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Phone</FieldLabel>
                <StyledInput
                  name="billing_contact_phone"
                  value={formValues.billing_contact_phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  $autoFilled={customerAutoFilled && !!formValues.billing_contact_phone}
                />
              </FieldGroup>
              <FieldGroup $span={2}>
                <FieldLabel>Email</FieldLabel>
                <StyledInput
                  name="billing_contact_email"
                  type="email"
                  value={formValues.billing_contact_email}
                  onChange={handleChange}
                  placeholder="Email address"
                  $autoFilled={customerAutoFilled && !!formValues.billing_contact_email}
                />
              </FieldGroup>
            </FieldGrid>

            {/* Shipping Contact */}
            <FieldLabel style={{ fontWeight: 600, fontSize: '14px', marginTop: '20px', marginBottom: '12px' }}>
              Shipping Contact
            </FieldLabel>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Name</FieldLabel>
                <StyledInput
                  name="shipping_contact_name"
                  value={formValues.shipping_contact_name}
                  onChange={handleChange}
                  placeholder="Contact name"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Phone</FieldLabel>
                <StyledInput
                  name="shipping_contact_phone"
                  value={formValues.shipping_contact_phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </FieldGroup>
              <FieldGroup $span={2}>
                <FieldLabel>Email</FieldLabel>
                <StyledInput
                  name="shipping_contact_email"
                  type="email"
                  value={formValues.shipping_contact_email}
                  onChange={handleChange}
                  placeholder="Email address"
                />
              </FieldGroup>
            </FieldGrid>

            {/* Billing Address */}
            <FieldLabel style={{ fontWeight: 600, fontSize: '14px', marginTop: '20px', marginBottom: '12px' }}>
              Billing Address
              {customerAutoFilled && <AutoFilledBadge>Auto-filled from customer</AutoFilledBadge>}
            </FieldLabel>
            <FieldGrid>
              <FieldGroup $span={2}>
                <FieldLabel>Street</FieldLabel>
                <StyledInput
                  name="billing_address_street"
                  value={formValues.billing_address_street}
                  onChange={handleChange}
                  placeholder="Street address"
                  $autoFilled={customerAutoFilled && !!formValues.billing_address_street}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>City</FieldLabel>
                <StyledInput
                  name="billing_address_city"
                  value={formValues.billing_address_city}
                  onChange={handleChange}
                  placeholder="City"
                  $autoFilled={customerAutoFilled && !!formValues.billing_address_city}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>State / Zip</FieldLabel>
                <StyledInput
                  name="billing_address_state_zip"
                  value={formValues.billing_address_state_zip}
                  onChange={handleChange}
                  placeholder="State, ZIP"
                  $autoFilled={customerAutoFilled && !!formValues.billing_address_state_zip}
                />
              </FieldGroup>
            </FieldGrid>

            {/* Shipping Address */}
            <FieldLabel style={{ fontWeight: 600, fontSize: '14px', marginTop: '20px', marginBottom: '12px' }}>
              Shipping Address
            </FieldLabel>
            <FieldGrid>
              <FieldGroup $span={2}>
                <FieldLabel>Street</FieldLabel>
                <StyledInput
                  name="shipping_address_street"
                  value={formValues.shipping_address_street}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>City</FieldLabel>
                <StyledInput
                  name="shipping_address_city"
                  value={formValues.shipping_address_city}
                  onChange={handleChange}
                  placeholder="City"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>State / Zip</FieldLabel>
                <StyledInput
                  name="shipping_address_state_zip"
                  value={formValues.shipping_address_state_zip}
                  onChange={handleChange}
                  placeholder="State, ZIP"
                />
              </FieldGroup>
            </FieldGrid>

            {/* Accounts Payable Contact */}
            <FieldLabel style={{ fontWeight: 600, fontSize: '14px', marginTop: '20px', marginBottom: '12px' }}>
              Accounts Payable Contact
              {customerAutoFilled && <AutoFilledBadge>Auto-filled from customer</AutoFilledBadge>}
            </FieldLabel>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Name</FieldLabel>
                <StyledInput
                  name="accounting_payable_contact_name"
                  value={formValues.accounting_payable_contact_name}
                  onChange={handleChange}
                  placeholder="AP contact name"
                  $autoFilled={customerAutoFilled && !!formValues.accounting_payable_contact_name}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Phone</FieldLabel>
                <StyledInput
                  name="accounting_payable_contact_phone"
                  value={formValues.accounting_payable_contact_phone}
                  onChange={handleChange}
                  placeholder="AP phone"
                  $autoFilled={customerAutoFilled && !!formValues.accounting_payable_contact_phone}
                />
              </FieldGroup>
              <FieldGroup $span={2}>
                <FieldLabel>Email</FieldLabel>
                <StyledInput
                  name="accounting_payable_contact_email"
                  type="email"
                  value={formValues.accounting_payable_contact_email}
                  onChange={handleChange}
                  placeholder="AP email"
                  $autoFilled={customerAutoFilled && !!formValues.accounting_payable_contact_email}
                />
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 6: Notes & Comments */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><MessageSquare size={18} /></SectionIcon>
              <SectionTitle>Notes & Comments</SectionTitle>
            </SectionHeader>
            <FieldGrid>
              <FieldGroup $span={2}>
                <FieldLabel>Notes</FieldLabel>
                <StyledTextArea
                  name="notes"
                  value={formValues.notes}
                  onChange={handleChange}
                  placeholder="Additional notes or comments..."
                  rows={4}
                />
              </FieldGroup>
            </FieldGrid>
          </SectionCard>
        </FormBody>

        {/* Footer */}
        <FormFooter>
          <DraftButton
            type="button"
            onClick={handleDraft}
            disabled={submitting}
          >
            Save as Draft
          </DraftButton>
          <SubmitButton
            type="button"
            onClick={handleSend}
            disabled={submitting || !formValues.customer}
          >
            {submitting ? <Spin size="small" /> : <ClipboardList size={16} />}
            {mode === 'edit' ? 'Update Invoice' : 'Create Invoice'}
          </SubmitButton>
        </FormFooter>
      </FormShell>
      <ApprovalPreviewModal
        open={approvalGate.showModal}
        request={approvalGate.currentRequest}
        onApprove={approvalGate.handleApprove}
        onReject={approvalGate.handleReject}
        onEditApprove={approvalGate.handleEditApprove}
        onCancel={approvalGate.handleCancel}
      />
    </FormWrapper>
  );
};

export default InvoiceForm;
