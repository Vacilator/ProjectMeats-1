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
  color: rgb(var(--color-text-primary));
  border-radius: 16px;
  width: 100%;
  max-width: 1020px;
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

const DateTimeStamp = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  padding: 8px 12px;
  background: rgb(var(--color-surface-hover));
  border-radius: 8px;
  display: inline-block;
  margin-bottom: 16px;
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

const SectionHeader = styled.div<{ $clickable?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  user-select: none;
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
  flex: 1;
`;

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

  ${({ $autoFilled }) =>
    $autoFilled &&
    `
    background: rgba(var(--color-primary), 0.04);
    border-color: rgba(var(--color-primary), 0.2);
  `}

  ${({ $readOnly }) =>
    $readOnly &&
    `
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

  ${({ $autoFilled }) =>
    $autoFilled &&
    `
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

const CancelButton = styled.button`
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

  // Lookups
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [suppliers, setSuppliers] = useState<EntityOption[]>([]);
  const [customers, setCustomers] = useState<EntityOption[]>([]);
  const [loadingCarrier, setLoadingCarrier] = useState(false);

  // Auto-filled tracking
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // Carrier search
  const [carrierSearch, setCarrierSearch] = useState('');

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
    <FormWrapper onClick={handleBackdropClick}>
      <FormShell>
        {/* Header */}
        <FormHeader>
          <FormTitleGroup>
            <ClipboardList size={24} color="rgb(var(--color-primary))" />
            <FormTitle>
              {mode === 'edit' ? 'Edit Carrier PO' : 'New Carrier PO (Freight Order)'}
            </FormTitle>
          </FormTitleGroup>
          <CloseBtn onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </CloseBtn>
        </FormHeader>

        <FormBody>
          <DateTimeStamp>
            📅 Created: {formatDateTime(createdAt)}
          </DateTimeStamp>

          {/* Section 1: Carrier Information */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('carrier')}>
              <SectionIcon><Truck size={18} /></SectionIcon>
              <SectionTitle>🚚 Carrier Information</SectionTitle>
              {loadingCarrier && <Spin size="small" />}
              <CollapseChevron $expanded={!!expandedSections.carrier}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.carrier}>
              <FieldGroup $span={2}>
                <FieldLabel>
                  Carrier <RequiredMark>*</RequiredMark>
                </FieldLabel>
                <SearchSelectWrapper>
                  <StyledSelect
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
                  </StyledSelect>
                  <CreateNewBtn
                    type="button"
                    onClick={() => setShowInlineCarrier(!showInlineCarrier)}
                    aria-label="Create New Carrier"
                  >
                    <Plus size={14} /> New
                  </CreateNewBtn>
                </SearchSelectWrapper>
              </FieldGroup>

              {/* Inline carrier create */}
              {showInlineCarrier && (
                <InlineCarrierForm>
                  <InlineFormTitle>
                    <Plus size={16} /> Quick Create Carrier
                  </InlineFormTitle>
                  <FieldGrid>
                    <FieldGroup>
                      <FieldLabel>
                        Carrier Name <RequiredMark>*</RequiredMark>
                      </FieldLabel>
                      <StyledInput
                        value={inlineCarrierName}
                        onChange={(e) => setInlineCarrierName(e.target.value)}
                        placeholder="Enter carrier name"
                        aria-label="New Carrier Name"
                      />
                    </FieldGroup>
                    <FieldGroup>
                      <FieldLabel>Carrier Type</FieldLabel>
                      <StyledSelect
                        value={inlineCarrierType}
                        onChange={(e) => setInlineCarrierType(e.target.value)}
                        aria-label="New Carrier Type"
                      >
                        <option value="">Select type…</option>
                        <option value="Truck">Truck</option>
                        <option value="Rail">Rail</option>
                        <option value="Ocean">Ocean</option>
                        <option value="Air">Air</option>
                      </StyledSelect>
                    </FieldGroup>
                  </FieldGrid>
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
                <FieldGrid style={{ marginTop: 16 }}>
                  <FieldGroup $span={2}>
                    <FieldLabel>
                      Carrier Address
                      {isAutoFilled('carrier_address') && (
                        <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                      )}
                    </FieldLabel>
                    <StyledInput
                      name="carrier_address"
                      value={formValues.carrier_address}
                      onChange={handleChange}
                      $autoFilled={isAutoFilled('carrier_address')}
                      placeholder="Carrier address"
                      aria-label="Carrier Address"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <FieldLabel>
                      City
                      {isAutoFilled('carrier_city') && (
                        <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                      )}
                    </FieldLabel>
                    <StyledInput
                      name="carrier_city"
                      value={formValues.carrier_city}
                      onChange={handleChange}
                      $autoFilled={isAutoFilled('carrier_city')}
                      placeholder="City"
                      aria-label="Carrier City"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <FieldLabel>
                      State / Zip
                      {isAutoFilled('carrier_state_zip') && (
                        <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                      )}
                    </FieldLabel>
                    <StyledInput
                      name="carrier_state_zip"
                      value={formValues.carrier_state_zip}
                      onChange={handleChange}
                      $autoFilled={isAutoFilled('carrier_state_zip')}
                      placeholder="State Zip"
                      aria-label="Carrier State Zip"
                    />
                  </FieldGroup>
                </FieldGrid>
              )}
            </SectionContent>
          </SectionCard>

          {/* Section 2: Order & Release Numbers */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('orders')}>
              <SectionIcon><FileText size={18} /></SectionIcon>
              <SectionTitle>📋 Order &amp; Release Numbers</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.orders}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.orders}>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Order Number</FieldLabel>
                  <StyledInput
                    name="order_number"
                    value={formValues.order_number}
                    onChange={handleChange}
                    onBlur={() => handleAutoGenBlur('order_number', 'PO')}
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Order Number"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Carrier Release #</FieldLabel>
                  <StyledInput
                    name="carrier_release_num"
                    value={formValues.carrier_release_num}
                    onChange={handleChange}
                    onBlur={() => handleAutoGenBlur('carrier_release_num', 'CR')}
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Carrier Release Number"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Supplier Confirmation Order #</FieldLabel>
                  <StyledInput
                    name="supplier_confirmation_order_number"
                    value={formValues.supplier_confirmation_order_number}
                    onChange={handleChange}
                    onBlur={() =>
                      handleAutoGenBlur('supplier_confirmation_order_number', 'SC')
                    }
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Supplier Confirmation Order Number"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Delivery PO Number</FieldLabel>
                  <StyledInput
                    name="delivery_po_number"
                    value={formValues.delivery_po_number}
                    onChange={handleChange}
                    onBlur={() => handleAutoGenBlur('delivery_po_number', 'DPO')}
                    placeholder="Auto-generates on blur if empty"
                    aria-label="Delivery PO Number"
                  />
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 3: Product & Logistics */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('product')}>
              <SectionIcon><Package size={18} /></SectionIcon>
              <SectionTitle>📦 Product &amp; Logistics</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.product}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.product}>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Type of Protein</FieldLabel>
                  <StyledSelect
                    name="type_of_protein"
                    value={formValues.type_of_protein}
                    onChange={handleChange}
                    aria-label="Type of Protein"
                  >
                    <option value="">Select protein…</option>
                    {PROTEIN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Description of Product/Item</FieldLabel>
                  <StyledInput
                    name="description_of_product_item"
                    value={formValues.description_of_product_item}
                    onChange={handleChange}
                    placeholder="Product description"
                    aria-label="Product Description"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Fresh or Frozen</FieldLabel>
                  <StyledSelect
                    name="fresh_or_frozen"
                    value={formValues.fresh_or_frozen}
                    onChange={handleChange}
                    aria-label="Fresh or Frozen"
                  >
                    <option value="">Select…</option>
                    <option value="Fresh">Fresh</option>
                    <option value="Frozen">Frozen</option>
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Package Type</FieldLabel>
                  <StyledSelect
                    name="package_type"
                    value={formValues.package_type}
                    onChange={handleChange}
                    aria-label="Package Type"
                  >
                    <option value="">Select package…</option>
                    {PACKAGE_TYPES.map((p) => (
                      <option key={p} value={p}>{p}</option>
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
                    min="0"
                    aria-label="Quantity"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Total Weight</FieldLabel>
                  <StyledInput
                    name="total_weight"
                    type="number"
                    value={formValues.total_weight}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    aria-label="Total Weight"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Weight Unit</FieldLabel>
                  <StyledSelect
                    name="weight_unit"
                    value={formValues.weight_unit}
                    onChange={handleChange}
                    aria-label="Weight Unit"
                  >
                    <option value="LBS">LBS</option>
                    <option value="KG">KG</option>
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Net or Catch</FieldLabel>
                  <StyledSelect
                    name="net_or_catch"
                    value={formValues.net_or_catch}
                    onChange={handleChange}
                    aria-label="Net or Catch"
                  >
                    <option value="Net">Net</option>
                    <option value="Catch">Catch</option>
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Edible or Inedible</FieldLabel>
                  <StyledSelect
                    name="edible_or_inedible"
                    value={formValues.edible_or_inedible}
                    onChange={handleChange}
                    aria-label="Edible or Inedible"
                  >
                    <option value="Edible">Edible</option>
                    <option value="Inedible">Inedible</option>
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Tested Product</FieldLabel>
                  <CheckboxRow>
                    <StyledCheckbox
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
                  </CheckboxRow>
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 4: Pickup & Delivery */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('logistics')}>
              <SectionIcon><Building2 size={18} /></SectionIcon>
              <SectionTitle>📍 Pickup &amp; Delivery</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.logistics}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.logistics}>
              {/* Dates */}
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Pick Up Date</FieldLabel>
                  <StyledInput
                    name="pick_up_date"
                    type="date"
                    value={formValues.pick_up_date}
                    onChange={handleChange}
                    aria-label="Pick Up Date"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Delivery Date</FieldLabel>
                  <StyledInput
                    name="delivery_date"
                    type="date"
                    value={formValues.delivery_date}
                    onChange={handleChange}
                    aria-label="Delivery Date"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Pickup - Supplier */}
              <SubSectionLabel>
                Pickup Location (from Supplier)
              </SubSectionLabel>
              <FieldGrid>
                <FieldGroup $span={2}>
                  <FieldLabel>
                    Supplier <RequiredMark>*</RequiredMark>
                  </FieldLabel>
                  <StyledSelect
                    name="supplier"
                    value={formValues.supplier}
                    onChange={(e) => handleSupplierSelect(e.target.value)}
                    aria-label="Supplier"
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Pickup Building
                    {isAutoFilled('pickup_building_name') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="pickup_building_name"
                    value={formValues.pickup_building_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_building_name')}
                    placeholder="Building name"
                    aria-label="Pickup Building Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Pickup Address
                    {isAutoFilled('pickup_address') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="pickup_address"
                    value={formValues.pickup_address}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_address')}
                    placeholder="Address"
                    aria-label="Pickup Address"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Pickup City
                    {isAutoFilled('pickup_city') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="pickup_city"
                    value={formValues.pickup_city}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_city')}
                    placeholder="City"
                    aria-label="Pickup City"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Pickup State/Zip
                    {isAutoFilled('pickup_state_zip') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="pickup_state_zip"
                    value={formValues.pickup_state_zip}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('pickup_state_zip')}
                    placeholder="State Zip"
                    aria-label="Pickup State Zip"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Delivery - Customer */}
              <SubSectionLabel>
                Delivery Location (from Customer)
              </SubSectionLabel>
              <FieldGrid>
                <FieldGroup $span={2}>
                  <FieldLabel>Customer</FieldLabel>
                  <StyledSelect
                    name="customer"
                    value={formValues.customer}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    aria-label="Customer"
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Delivery Building
                    {isAutoFilled('delivery_building_name') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="delivery_building_name"
                    value={formValues.delivery_building_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_building_name')}
                    placeholder="Building name"
                    aria-label="Delivery Building Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Delivery Address
                    {isAutoFilled('delivery_address') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="delivery_address"
                    value={formValues.delivery_address}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_address')}
                    placeholder="Address"
                    aria-label="Delivery Address"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Delivery City
                    {isAutoFilled('delivery_city') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="delivery_city"
                    value={formValues.delivery_city}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_city')}
                    placeholder="City"
                    aria-label="Delivery City"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Delivery State/Zip
                    {isAutoFilled('delivery_state_zip') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="delivery_state_zip"
                    value={formValues.delivery_state_zip}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('delivery_state_zip')}
                    placeholder="State Zip"
                    aria-label="Delivery State Zip"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Appointment */}
              <FieldGrid style={{ marginTop: 16 }}>
                <FieldGroup>
                  <FieldLabel>
                    Appointment Method
                    {isAutoFilled('how_carrier_make_appointment') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledSelect
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
                  </StyledSelect>
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 5: Contacts */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('contacts')}>
              <SectionIcon><Users size={18} /></SectionIcon>
              <SectionTitle>👤 Contacts</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.contacts}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.contacts}>
              {/* AP Contact (from carrier) */}
              <SubSectionLabel>
                Accounting Payable (from Carrier)
              </SubSectionLabel>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>
                    AP Contact Name
                    {isAutoFilled('accounting_payable_contact_name') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="accounting_payable_contact_name"
                    value={formValues.accounting_payable_contact_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('accounting_payable_contact_name')}
                    placeholder="Name"
                    aria-label="AP Contact Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    AP Contact Phone
                    {isAutoFilled('accounting_payable_contact_phone') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="accounting_payable_contact_phone"
                    value={formValues.accounting_payable_contact_phone}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('accounting_payable_contact_phone')}
                    placeholder="Phone"
                    aria-label="AP Contact Phone"
                  />
                </FieldGroup>
                <FieldGroup $span={2}>
                  <FieldLabel>
                    AP Contact Email
                    {isAutoFilled('accounting_payable_contact_email') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="accounting_payable_contact_email"
                    value={formValues.accounting_payable_contact_email}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('accounting_payable_contact_email')}
                    placeholder="Email"
                    type="email"
                    aria-label="AP Contact Email"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Shipping Contact (from supplier) */}
              <SubSectionLabel>
                Shipping Contact (from Supplier)
              </SubSectionLabel>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>
                    Shipping Contact Name
                    {isAutoFilled('shipping_contact_name') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="shipping_contact_name"
                    value={formValues.shipping_contact_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('shipping_contact_name')}
                    placeholder="Name"
                    aria-label="Shipping Contact Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Shipping Contact Phone
                    {isAutoFilled('shipping_contact_phone') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="shipping_contact_phone"
                    value={formValues.shipping_contact_phone}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('shipping_contact_phone')}
                    placeholder="Phone"
                    aria-label="Shipping Contact Phone"
                  />
                </FieldGroup>
                <FieldGroup $span={2}>
                  <FieldLabel>
                    Shipping Contact Email
                    {isAutoFilled('shipping_contact_email') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="shipping_contact_email"
                    value={formValues.shipping_contact_email}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('shipping_contact_email')}
                    placeholder="Email"
                    type="email"
                    aria-label="Shipping Contact Email"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Receiving Contact (from customer) */}
              <SubSectionLabel>
                Receiving Contact (from Customer)
              </SubSectionLabel>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>
                    Receiving Contact Name
                    {isAutoFilled('receiving_contact_name') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="receiving_contact_name"
                    value={formValues.receiving_contact_name}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('receiving_contact_name')}
                    placeholder="Name"
                    aria-label="Receiving Contact Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>
                    Receiving Contact Phone
                    {isAutoFilled('receiving_contact_phone') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="receiving_contact_phone"
                    value={formValues.receiving_contact_phone}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('receiving_contact_phone')}
                    placeholder="Phone"
                    aria-label="Receiving Contact Phone"
                  />
                </FieldGroup>
                <FieldGroup $span={2}>
                  <FieldLabel>
                    Receiving Contact Email
                    {isAutoFilled('receiving_contact_email') && (
                      <AutoFilledBadge>● auto-filled</AutoFilledBadge>
                    )}
                  </FieldLabel>
                  <StyledInput
                    name="receiving_contact_email"
                    value={formValues.receiving_contact_email}
                    onChange={handleChange}
                    $autoFilled={isAutoFilled('receiving_contact_email')}
                    placeholder="Email"
                    type="email"
                    aria-label="Receiving Contact Email"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Departments */}
              <SubSectionLabel>Departments</SubSectionLabel>
              <div style={{ display: 'flex', gap: 24 }}>
                {DEPARTMENTS.map((dept) => (
                  <CheckboxRow key={dept}>
                    <StyledCheckbox
                      type="checkbox"
                      checked={formValues.departments_array.includes(dept)}
                      onChange={() => handleDepartmentToggle(dept)}
                      aria-label={`Department ${dept}`}
                    />
                    {dept}
                  </CheckboxRow>
                ))}
              </div>
            </SectionContent>
          </SectionCard>

          {/* Section 6: Comments & Notes */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('notes')}>
              <SectionIcon><FileText size={18} /></SectionIcon>
              <SectionTitle>📝 Comments &amp; Notes</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.notes}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.notes}>
              <FieldGroup $span={2}>
                <StyledTextArea
                  name="notes"
                  value={formValues.notes}
                  onChange={handleChange}
                  placeholder="Additional notes, special instructions, or comments…"
                  rows={5}
                  aria-label="Notes"
                />
              </FieldGroup>
            </SectionContent>
          </SectionCard>
        </FormBody>

        {/* Footer */}
        <FormFooter>
          <CancelButton onClick={onCancel} disabled={submitting} type="button">
            Cancel
          </CancelButton>
          <SubmitButton onClick={handleSubmit} disabled={submitting} type="button">
            {submitting
              ? 'Saving…'
              : mode === 'edit'
                ? 'Update Carrier PO'
                : 'Create Carrier PO'}
          </SubmitButton>
        </FormFooter>
      </FormShell>
    </FormWrapper>
  );
};

export default CarrierPOForm;
