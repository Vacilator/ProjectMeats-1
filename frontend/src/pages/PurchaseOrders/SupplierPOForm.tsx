import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { Supplier, PurchaseOrder } from '@/services/apiService';
import { LocationSelector } from '@/components/Shared';
import { SmartProductAutocomplete } from '@/components/Inquiry/SmartProductAutocomplete';
import { getChoices, type ChoiceOption } from '@/services/choicesService';
import { useApprovalGate } from '@/hooks/useApprovalGate';
import ApprovalPreviewModal from '@/components/AIAssistant/ApprovalPreviewModal';

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

interface SupplierPOFormValues {
  logistics_scenario: LogisticsScenario;
  supplier: string;
  supplier_corporate_address: string;
  supplier_city: string;
  supplier_state: string;
  supplier_zip: string;
  plant: string;
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

const getDefaultFormValues = (): SupplierPOFormValues => ({
  logistics_scenario: 'supplier_delivery',
  supplier: '',
  supplier_corporate_address: '',
  supplier_city: '',
  supplier_state: '',
  supplier_zip: '',
  plant: '',
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

const DateTimeStamp = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  padding: 8px 12px;
  background: rgb(var(--color-surface-hover));
  border-radius: 8px;
  display: inline-block;
  margin-bottom: 16px;
`;

const ConditionalSection = styled.div<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
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
  const [supplierAutoFilled, setSupplierAutoFilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
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
    const loadData = async () => {
      try {
        const resp = await businessApi.get('suppliers/');
        setSuppliers((resp.data.results || resp.data) as Supplier[]);
      } catch {
        // Silently handle — empty suppliers list will show in UI
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
      } catch {
        // Silently handle — auto-populate skipped
      } finally {
        setLoadingSupplier(false);
      }
    },
    [suppliers],
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
    [formValues, mode, entityId, buildPayload, onSuccess],
  );

  // Selected scenario info
  const scenarioInfo = SCENARIO_OPTIONS.find((s) => s.value === scenario);

  return (
    <FormWrapper onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <FormShell>
        {/* Header */}
        <FormHeader>
          <FormTitleGroup>
            <ClipboardList size={24} color="rgb(var(--color-primary))" />
            <FormTitle>
              {mode === 'edit' ? 'Edit Purchase Order' : 'New Purchase Order'}
            </FormTitle>
          </FormTitleGroup>
          <CloseBtn onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </CloseBtn>
        </FormHeader>

        <FormBody>
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
          <SectionCard>
            <SectionHeader>
              <SectionIcon><Building2 size={18} /></SectionIcon>
              <SectionTitle>Supplier &amp; Plant Information</SectionTitle>
              {loadingSupplier && <Spin size="small" />}
            </SectionHeader>
            <FieldGrid>
              <FieldGroup $span={2}>
                <FieldLabel>
                  Supplier Name <RequiredMark>*</RequiredMark>
                </FieldLabel>
                <StyledSelect
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
                </StyledSelect>
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>
                  Corporate Address
                  {supplierAutoFilled && (
                    <AutoFilledBadge>
                      Auto-filled from supplier
                    </AutoFilledBadge>
                  )}
                </FieldLabel>
                <StyledInput
                  name="supplier_corporate_address"
                  value={formValues.supplier_corporate_address}
                  onChange={handleChange}
                  $autoFilled={supplierAutoFilled}
                  placeholder="Street address"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>City</FieldLabel>
                <StyledInput
                  name="supplier_city"
                  value={formValues.supplier_city}
                  onChange={handleChange}
                  $autoFilled={supplierAutoFilled}
                  placeholder="City"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>State / Zip</FieldLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <StyledInput
                    name="supplier_state"
                    value={formValues.supplier_state}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="State"
                    style={{ flex: 1 }}
                  />
                  <StyledInput
                    name="supplier_zip"
                    value={formValues.supplier_zip}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Zip"
                    style={{ flex: 1 }}
                  />
                </div>
              </FieldGroup>

              <FieldGroup $span={2}>
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
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 2: Order & Confirmation Numbers */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><FileText size={18} /></SectionIcon>
              <SectionTitle>Order &amp; Confirmation Numbers</SectionTitle>
            </SectionHeader>

            <DateTimeStamp>
              📅 Created: {formatDateTime(createdAt)}
            </DateTimeStamp>

            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Our PO # To Supplier</FieldLabel>
                <StyledInput
                  name="our_purchase_order_number_to_supplier"
                  value={formValues.our_purchase_order_number_to_supplier}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('our_purchase_order_number_to_supplier')}
                  placeholder="Leave blank to auto-generate"
                />
                <FieldHint>e.g. PO-20260513-847291</FieldHint>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>My Customer # From Supplier</FieldLabel>
                <StyledInput
                  name="my_customer_number_from_supplier"
                  value={formValues.my_customer_number_from_supplier}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('my_customer_number_from_supplier')}
                  placeholder="Leave blank to auto-generate"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Supplier Confirmation #</FieldLabel>
                <StyledInput
                  name="supplier_confirmation_order_num"
                  value={formValues.supplier_confirmation_order_num}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('supplier_confirmation_order_num')}
                  placeholder="Leave blank to auto-generate"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Supplier Confirmation Order #</FieldLabel>
                <StyledInput
                  name="supplier_confirmation_order_number"
                  value={formValues.supplier_confirmation_order_number}
                  onChange={handleChange}
                  placeholder="Optional"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Carrier Release #</FieldLabel>
                <StyledInput
                  name="carrier_release_num"
                  value={formValues.carrier_release_num}
                  onChange={handleChange}
                  onBlur={() => handlePONumberBlur('carrier_release_num')}
                  placeholder="Leave blank to auto-generate"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Carrier Release Format</FieldLabel>
                <StyledSelect
                  name="carrier_release_format"
                  value={formValues.carrier_release_format}
                  onChange={handleChange}
                >
                  <option value="">Select format…</option>
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
                <FieldLabel>Type of Protein</FieldLabel>
                <StyledSelect
                  name="type_of_protein"
                  value={formValues.type_of_protein}
                  onChange={handleChange}
                >
                  <option value="">Select protein…</option>
                  {effectiveProteinOptions.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Fresh / Frozen</FieldLabel>
                <StyledSelect
                  name="fresh_or_frozen"
                  value={formValues.fresh_or_frozen}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {effectiveFreshFrozen.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Product / Description</FieldLabel>
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
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Item Description</FieldLabel>
                <StyledTextArea
                  name="item_description"
                  value={formValues.item_description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Detailed product description"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Package Type</FieldLabel>
                <StyledSelect
                  name="package_type"
                  value={formValues.package_type}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {effectivePackageTypes.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Quantity</FieldLabel>
                <StyledInput
                  type="number"
                  name="quantity"
                  value={formValues.quantity}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Total Weight</FieldLabel>
                <StyledInput
                  type="number"
                  step="0.01"
                  name="total_weight"
                  value={formValues.total_weight}
                  onChange={handleChange}
                  placeholder="0.00"
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
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Net or Catch</FieldLabel>
                <StyledSelect
                  name="net_or_catch"
                  value={formValues.net_or_catch}
                  onChange={handleChange}
                >
                  {effectiveNetCatch.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Edible / Inedible</FieldLabel>
                <StyledSelect
                  name="edible_or_inedible"
                  value={formValues.edible_or_inedible}
                  onChange={handleChange}
                >
                  <option value="Edible">Edible</option>
                  <option value="Inedible">Inedible</option>
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Price Per Unit</FieldLabel>
                <StyledInput
                  type="number"
                  step="0.01"
                  name="price_per_unit"
                  value={formValues.price_per_unit}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Item Production Date</FieldLabel>
                <StyledSelect
                  name="item_production_date"
                  value={formValues.item_production_date}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {PRODUCTION_DATE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <CheckboxRow>
                  <StyledCheckbox
                    type="checkbox"
                    name="tested_product"
                    checked={formValues.tested_product}
                    onChange={handleCheckboxChange}
                  />
                  Tested Product
                </CheckboxRow>
              </FieldGroup>
            </FieldGrid>
          </SectionCard>

          {/* Section 4: Logistics & Pickup/Delivery */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><Truck size={18} /></SectionIcon>
              <SectionTitle>Logistics &amp; Delivery</SectionTitle>
            </SectionHeader>
            <FieldGrid>
              <ConditionalSection $visible={visibility.pickupDate}>
                <FieldLabel>Pick Up Date</FieldLabel>
                <StyledInput
                  type="date"
                  name="pick_up_date"
                  value={formValues.pick_up_date}
                  onChange={handleChange}
                />
              </ConditionalSection>

              <FieldGroup>
                <FieldLabel>Delivery Date</FieldLabel>
                <StyledInput
                  type="date"
                  name="delivery_date"
                  value={formValues.delivery_date}
                  onChange={handleChange}
                />
              </FieldGroup>

              <ConditionalSection $visible={visibility.pickupAddress}>
                <FieldGroup $span={2}>
                  <FieldLabel>Pickup Location</FieldLabel>
                  <LocationSelector
                    value={formValues.pick_up_location}
                    onChange={(id) => setFormValues((prev) => ({
                      ...prev,
                      pick_up_location: id,
                    }))}
                    label="Pickup Location"
                    placeholder="Select pickup location…"
                  />
                </FieldGroup>
              </ConditionalSection>

              <ConditionalSection $visible={visibility.deliveryAddress}>
                <FieldGroup>
                  <FieldLabel>Delivery Location</FieldLabel>
                  <LocationSelector
                    value={formValues.delivery_location}
                    onChange={(id) => setFormValues((prev) => ({
                      ...prev,
                      delivery_location: id,
                    }))}
                    label="Delivery Location"
                    placeholder="Select delivery location…"
                  />
                </FieldGroup>
              </ConditionalSection>

              <ConditionalSection $visible={visibility.howCarrierAppt}>
                <FieldLabel>How Carrier Makes Appointment</FieldLabel>
                <StyledSelect
                  name="how_carrier_make_appointment"
                  value={formValues.how_carrier_make_appointment}
                  onChange={handleChange}
                >
                  <option value="">Select method…</option>
                  {effectiveAppointmentMethods.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </ConditionalSection>
            </FieldGrid>
          </SectionCard>

          {/* Section 5: Contacts */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><Users size={18} /></SectionIcon>
              <SectionTitle>Contacts</SectionTitle>
            </SectionHeader>

            {/* Supplier / Accounting Contact */}
            <div style={{ marginBottom: '20px' }}>
              <FieldLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                Supplier Contact
                {supplierAutoFilled && <AutoFilledBadge>Auto-filled from supplier</AutoFilledBadge>}
              </FieldLabel>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Name</FieldLabel>
                  <StyledInput
                    name="supplier_contact_name"
                    value={formValues.supplier_contact_name}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Contact name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Phone</FieldLabel>
                  <StyledInput
                    name="supplier_contact_phone"
                    value={formValues.supplier_contact_phone}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Phone number"
                  />
                </FieldGroup>
                <FieldGroup $span={2}>
                  <FieldLabel>Email</FieldLabel>
                  <StyledInput
                    type="email"
                    name="supplier_contact_email"
                    value={formValues.supplier_contact_email}
                    onChange={handleChange}
                    $autoFilled={supplierAutoFilled}
                    placeholder="Email address"
                  />
                </FieldGroup>
              </FieldGrid>
            </div>

            {/* Dynamic Shipping Contacts */}
            <ConditionalSection $visible={visibility.shippingContacts}>
              <div style={{ marginBottom: '20px' }}>
                <FieldLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                  Shipping Contacts
                </FieldLabel>
                {shippingContacts.map((contact, idx) => (
                  <ContactRow key={contact.id}>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <StyledInput
                        value={contact.name}
                        onChange={(e) => updateShippingContact(idx, 'name', e.target.value)}
                        placeholder={`Contact ${idx + 1} name`}
                      />
                    </div>
                    <div>
                      <FieldLabel>Phone</FieldLabel>
                      <StyledInput
                        value={contact.phone}
                        onChange={(e) => updateShippingContact(idx, 'phone', e.target.value)}
                        placeholder="Phone"
                      />
                    </div>
                    <div>
                      <FieldLabel>Email</FieldLabel>
                      <StyledInput
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
            </ConditionalSection>

            {/* Receiving Contact */}
            <ConditionalSection $visible={visibility.receivingContact || false}>
              <div>
                <FieldLabel style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'rgb(var(--color-text-primary))' }}>
                  Receiving Contact
                </FieldLabel>
                <FieldGrid>
                  <FieldGroup>
                    <FieldLabel>Name</FieldLabel>
                    <StyledInput
                      name="receiving_contact_name"
                      value={formValues.receiving_contact_name}
                      onChange={handleChange}
                      placeholder="Receiving contact name"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <FieldLabel>Phone</FieldLabel>
                    <StyledInput
                      name="receiving_contact_phone"
                      value={formValues.receiving_contact_phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                    />
                  </FieldGroup>
                  <FieldGroup $span={2}>
                    <FieldLabel>Email</FieldLabel>
                    <StyledInput
                      type="email"
                      name="receiving_contact_email"
                      value={formValues.receiving_contact_email}
                      onChange={handleChange}
                      placeholder="Email address"
                    />
                  </FieldGroup>
                </FieldGrid>
              </div>
            </ConditionalSection>
          </SectionCard>

          {/* Section 6: Comments & Totals */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon><DollarSign size={18} /></SectionIcon>
              <SectionTitle>Accounting, Comments &amp; Totals</SectionTitle>
            </SectionHeader>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Payment Terms</FieldLabel>
                <StyledSelect
                  name="payment_terms"
                  value={formValues.payment_terms}
                  onChange={handleChange}
                >
                  <option value="">Select terms…</option>
                  {effectivePaymentTerms.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </StyledSelect>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Total Net Weight</FieldLabel>
                <StyledInput
                  type="number"
                  step="0.01"
                  name="total_net_weight"
                  value={formValues.total_net_weight}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Bill of Lading Comments</FieldLabel>
                <StyledTextArea
                  name="bill_of_lading_comments"
                  value={formValues.bill_of_lading_comments}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Comments for the bill of lading…"
                />
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Invoicing Comments</FieldLabel>
                <StyledTextArea
                  name="invoicing_comments"
                  value={formValues.invoicing_comments}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Comments for invoicing…"
                />
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Special Instructions</FieldLabel>
                <StyledTextArea
                  name="special_instructions"
                  value={formValues.special_instructions}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any special instructions…"
                />
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Notes</FieldLabel>
                <StyledTextArea
                  name="notes"
                  value={formValues.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Additional notes…"
                />
              </FieldGroup>

              <FieldGroup $span={2}>
                <FieldLabel>Total Amount (auto-calculated)</FieldLabel>
                <CalculatedValue>
                  ${calculatedTotal}
                </CalculatedValue>
                <FieldHint>
                  Calculated from total weight × price per unit (or qty × price per unit)
                </FieldHint>
              </FieldGroup>
            </FieldGrid>
          </SectionCard>
        </FormBody>

        {/* Footer */}
        <FormFooter>
          <DraftButton
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save as Draft'}
          </DraftButton>
          <SubmitButton
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

export default SupplierPOForm;
