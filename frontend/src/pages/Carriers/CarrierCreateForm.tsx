import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message } from 'antd';
import {
  Truck,
  Users,
  DollarSign,
  FileText,
  Building2,
  X,
  ChevronDown,
} from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import { useApprovalGate } from '@/hooks/useApprovalGate';
import ApprovalPreviewModal from '@/components/AIAssistant/ApprovalPreviewModal';

// ============================================================================
// Types
// ============================================================================

interface CarrierFormValues {
  name: string;
  code: string;
  carrier_type: string;
  contact_person: string;
  phone: string;
  phone_type: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  mc_number: string;
  dot_number: string;
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_expiry: string;
  is_active: boolean;
  my_customer_num_from_carrier: string;
  accounting_payable_contact_name: string;
  accounting_payable_contact_phone: string;
  accounting_payable_contact_email: string;
  sales_contact_name: string;
  sales_contact_phone: string;
  sales_contact_email: string;
  sales_contact_main_phone: string;
  sales_contact_direct_phone: string;
  sales_contact_cell_phone: string;
  contact_title: string;
  accounting_payment_terms: string;
  credit_limits: string;
  departments_array: string[];
  how_carrier_make_appointment: string;
  notes: string;
}

export interface CarrierCreateFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<CarrierFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
  entityId?: number | string;
}

// ============================================================================
// Constants
// ============================================================================

const CARRIER_TYPES = ['Truck', 'Rail', 'Ocean', 'Air'];

const PAYMENT_TERMS = ['Wire', 'ACH', 'Check', 'Credit Card'];

const CREDIT_LIMITS = [
  'Wire 1 day prior', 'Wire 2 day prior', 'Wire 3 day prior',
  'Wire 4 day prior', 'Wire 5 day prior',
  'ACH 1 day prior', 'ACH 2 day prior', 'ACH 3 day prior', 'ACH 4 day prior',
  'Net 5 days', 'Net 7 days', 'Net 10 days', 'Net 14 days', 'Net 30 days',
];

const DEPARTMENTS = ['BOL', 'COA', 'POD'];

const APPOINTMENT_METHODS = ['Email', 'Phone', 'Website', 'FCFS'];

// ============================================================================
// Helpers
// ============================================================================

const getDefaultFormValues = (initial?: Partial<CarrierFormValues>): CarrierFormValues => ({
  name: '',
  code: '',
  carrier_type: '',
  contact_person: '',
  phone: '',
  phone_type: 'office',
  email: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  country: 'USA',
  mc_number: '',
  dot_number: '',
  insurance_provider: '',
  insurance_policy_number: '',
  insurance_expiry: '',
  is_active: true,
  my_customer_num_from_carrier: '',
  accounting_payable_contact_name: '',
  accounting_payable_contact_phone: '',
  accounting_payable_contact_email: '',
  sales_contact_name: '',
  sales_contact_phone: '',
  sales_contact_email: '',
  sales_contact_main_phone: '',
  sales_contact_direct_phone: '',
  sales_contact_cell_phone: '',
  contact_title: '',
  accounting_payment_terms: '',
  credit_limits: '',
  departments_array: [],
  how_carrier_make_appointment: '',
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

const StyledInput = styled.input<{ $readOnly?: boolean }>`
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

const StyledSelect = styled.select`
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

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  padding: 4px 0;
`;

const ToggleSwitch = styled.div<{ $active: boolean }>`
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: ${({ $active }) =>
    $active ? 'rgb(var(--color-success))' : 'rgb(var(--color-border))'};
  position: relative;
  transition: background 0.2s;
  cursor: pointer;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${({ $active }) => ($active ? '22px' : '2px')};
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    transition: left 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
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

const AutoFilledBadge = styled.span`
  font-size: 11px;
  color: rgb(var(--color-primary));
  opacity: 0.7;
  margin-left: 8px;
  font-weight: 400;
`;

// ============================================================================
// Component
// ============================================================================

export const CarrierCreateForm: React.FC<CarrierCreateFormProps> = ({
  mode,
  initialValues,
  onSuccess,
  onCancel,
  entityId,
}) => {
  const [formValues, setFormValues] = useState<CarrierFormValues>(() =>
    getDefaultFormValues(initialValues),
  );
  const [submitting, setSubmitting] = useState(false);
  const approvalGate = useApprovalGate();

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true,
    address: true,
    contacts: true,
    payment: true,
    insurance: false,
    notes: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Generic field change handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

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
    const vals = { ...formValues };
    return {
      name: vals.name,
      code: vals.code || undefined,
      carrier_type: vals.carrier_type || undefined,
      contact_person: vals.contact_person || undefined,
      phone: vals.phone || undefined,
      phone_type: vals.phone_type || undefined,
      email: vals.email || undefined,
      address: vals.address || undefined,
      city: vals.city || undefined,
      state: vals.state || undefined,
      zip_code: vals.zip_code || undefined,
      country: vals.country || undefined,
      mc_number: vals.mc_number || undefined,
      dot_number: vals.dot_number || undefined,
      insurance_provider: vals.insurance_provider || undefined,
      insurance_policy_number: vals.insurance_policy_number || undefined,
      insurance_expiry: vals.insurance_expiry || undefined,
      is_active: vals.is_active,
      my_customer_num_from_carrier: vals.my_customer_num_from_carrier || undefined,
      accounting_payable_contact_name: vals.accounting_payable_contact_name || undefined,
      accounting_payable_contact_phone: vals.accounting_payable_contact_phone || undefined,
      accounting_payable_contact_email: vals.accounting_payable_contact_email || undefined,
      sales_contact_name: vals.sales_contact_name || undefined,
      sales_contact_phone: vals.sales_contact_phone || undefined,
      sales_contact_email: vals.sales_contact_email || undefined,
      sales_contact_main_phone: vals.sales_contact_main_phone || undefined,
      sales_contact_direct_phone: vals.sales_contact_direct_phone || undefined,
      sales_contact_cell_phone: vals.sales_contact_cell_phone || undefined,
      contact_title: vals.contact_title || undefined,
      accounting_payment_terms: vals.accounting_payment_terms || undefined,
      credit_limits: vals.credit_limits || undefined,
      departments_array: vals.departments_array.length > 0 ? vals.departments_array : undefined,
      how_carrier_make_appointment: vals.how_carrier_make_appointment || undefined,
      notes: vals.notes || undefined,
    };
  }, [formValues]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!formValues.name.trim()) {
      message.warning('Carrier name is required');
      return;
    }

    setSubmitting(true);
    try {
      const gateResult = await approvalGate.intercept({
        requestType: 'create_carrier',
        subject: `New carrier: ${formValues.name}`,
        recipientType: 'carrier',
        contentPreview: `New carrier: ${formValues.name}`,
        sourceEntityType: 'carrier',
      });
      if (!gateResult.approved) {
        setSubmitting(false);
        return;
      }

      const payload = buildPayload();
      if (mode === 'edit' && entityId) {
        await businessApi.patch(`carriers/${entityId}/`, payload);
      } else {
        await businessApi.post('carriers/', payload);
      }
      message.success(
        mode === 'edit' ? 'Carrier updated successfully!' : 'Carrier created successfully!',
      );
      onSuccess();
    } catch (err) {
      const error = err as Error;
      message.error(error.message || 'Failed to save carrier');
    } finally {
      setSubmitting(false);
    }
  }, [formValues.name, buildPayload, mode, entityId, onSuccess, approvalGate]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  return (
    <FormWrapper onClick={handleBackdropClick}>
      <FormShell>
        {/* Header */}
        <FormHeader>
          <FormTitleGroup>
            <Truck size={24} color="rgb(var(--color-primary))" />
            <FormTitle>{mode === 'edit' ? 'Edit Carrier' : 'New Carrier'}</FormTitle>
          </FormTitleGroup>
          <CloseBtn onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </CloseBtn>
        </FormHeader>

        <FormBody>
          {/* Section 1: Carrier Details */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('details')}>
              <SectionIcon><Truck size={18} /></SectionIcon>
              <SectionTitle>🚚 Carrier Details</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.details}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.details}>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>
                    Carrier Name <RequiredMark>*</RequiredMark>
                  </FieldLabel>
                  <StyledInput
                    name="name"
                    value={formValues.name}
                    onChange={handleChange}
                    placeholder="Enter carrier name"
                    required
                    aria-label="Carrier Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Code</FieldLabel>
                  <StyledInput
                    name="code"
                    value={formValues.code}
                    onChange={handleChange}
                    placeholder="Carrier code"
                    aria-label="Carrier Code"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Carrier Type</FieldLabel>
                  <StyledSelect
                    name="carrier_type"
                    value={formValues.carrier_type}
                    onChange={handleChange}
                    aria-label="Carrier Type"
                  >
                    <option value="">Select type…</option>
                    {CARRIER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>MC Number</FieldLabel>
                  <StyledInput
                    name="mc_number"
                    value={formValues.mc_number}
                    onChange={handleChange}
                    placeholder="MC-XXXXXX"
                    aria-label="MC Number"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>DOT Number</FieldLabel>
                  <StyledInput
                    name="dot_number"
                    value={formValues.dot_number}
                    onChange={handleChange}
                    placeholder="DOT-XXXXXXX"
                    aria-label="DOT Number"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Active</FieldLabel>
                  <ToggleRow>
                    <ToggleSwitch
                      $active={formValues.is_active}
                      onClick={() =>
                        setFormValues((prev) => ({ ...prev, is_active: !prev.is_active }))
                      }
                      role="switch"
                      aria-checked={formValues.is_active}
                      aria-label="Carrier active toggle"
                    />
                    {formValues.is_active ? 'Active' : 'Inactive'}
                  </ToggleRow>
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 2: Address */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('address')}>
              <SectionIcon><Building2 size={18} /></SectionIcon>
              <SectionTitle>📍 Address</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.address}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.address}>
              <FieldGrid>
                <FieldGroup $span={2}>
                  <FieldLabel>Corporate Address</FieldLabel>
                  <StyledInput
                    name="address"
                    value={formValues.address}
                    onChange={handleChange}
                    placeholder="Street address"
                    aria-label="Address"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>City</FieldLabel>
                  <StyledInput
                    name="city"
                    value={formValues.city}
                    onChange={handleChange}
                    placeholder="City"
                    aria-label="City"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>State</FieldLabel>
                  <StyledInput
                    name="state"
                    value={formValues.state}
                    onChange={handleChange}
                    placeholder="State"
                    aria-label="State"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Zip Code</FieldLabel>
                  <StyledInput
                    name="zip_code"
                    value={formValues.zip_code}
                    onChange={handleChange}
                    placeholder="Zip code"
                    aria-label="Zip Code"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Country</FieldLabel>
                  <StyledInput
                    name="country"
                    value={formValues.country}
                    onChange={handleChange}
                    placeholder="Country"
                    aria-label="Country"
                  />
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 3: Contacts */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('contacts')}>
              <SectionIcon><Users size={18} /></SectionIcon>
              <SectionTitle>👤 Contacts</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.contacts}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.contacts}>
              {/* AP Contact */}
              <FieldLabel style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                Accounting Payable Contact
              </FieldLabel>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>AP Contact Name</FieldLabel>
                  <StyledInput
                    name="accounting_payable_contact_name"
                    value={formValues.accounting_payable_contact_name}
                    onChange={handleChange}
                    placeholder="Name"
                    aria-label="AP Contact Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>AP Contact Phone</FieldLabel>
                  <StyledInput
                    name="accounting_payable_contact_phone"
                    value={formValues.accounting_payable_contact_phone}
                    onChange={handleChange}
                    placeholder="Phone"
                    aria-label="AP Contact Phone"
                  />
                </FieldGroup>
                <FieldGroup $span={2}>
                  <FieldLabel>AP Contact Email</FieldLabel>
                  <StyledInput
                    name="accounting_payable_contact_email"
                    value={formValues.accounting_payable_contact_email}
                    onChange={handleChange}
                    placeholder="Email"
                    type="email"
                    aria-label="AP Contact Email"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* Sales Contact */}
              <FieldLabel
                style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, marginTop: 24 }}
              >
                Sales Contact
              </FieldLabel>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Sales Contact Name</FieldLabel>
                  <StyledInput
                    name="sales_contact_name"
                    value={formValues.sales_contact_name}
                    onChange={handleChange}
                    placeholder="Name"
                    aria-label="Sales Contact Name"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Contact Title</FieldLabel>
                  <StyledInput
                    name="contact_title"
                    value={formValues.contact_title}
                    onChange={handleChange}
                    placeholder="Title"
                    aria-label="Contact Title"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Sales Email</FieldLabel>
                  <StyledInput
                    name="sales_contact_email"
                    value={formValues.sales_contact_email}
                    onChange={handleChange}
                    placeholder="Email"
                    type="email"
                    aria-label="Sales Contact Email"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Sales Main Phone</FieldLabel>
                  <StyledInput
                    name="sales_contact_main_phone"
                    value={formValues.sales_contact_main_phone}
                    onChange={handleChange}
                    placeholder="Main phone"
                    aria-label="Sales Main Phone"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Sales Direct Phone</FieldLabel>
                  <StyledInput
                    name="sales_contact_direct_phone"
                    value={formValues.sales_contact_direct_phone}
                    onChange={handleChange}
                    placeholder="Direct phone"
                    aria-label="Sales Direct Phone"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Sales Cell Phone</FieldLabel>
                  <StyledInput
                    name="sales_contact_cell_phone"
                    value={formValues.sales_contact_cell_phone}
                    onChange={handleChange}
                    placeholder="Cell phone"
                    aria-label="Sales Cell Phone"
                  />
                </FieldGroup>
              </FieldGrid>

              {/* My Customer Num */}
              <FieldGrid style={{ marginTop: 20 }}>
                <FieldGroup $span={2}>
                  <FieldLabel>My Customer # From Carrier</FieldLabel>
                  <StyledInput
                    name="my_customer_num_from_carrier"
                    value={formValues.my_customer_num_from_carrier}
                    onChange={handleChange}
                    placeholder="Customer number assigned by carrier"
                    aria-label="My Customer Number From Carrier"
                  />
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 4: Payment & Credit */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('payment')}>
              <SectionIcon><DollarSign size={18} /></SectionIcon>
              <SectionTitle>💰 Payment &amp; Credit</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.payment}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.payment}>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Payment Terms</FieldLabel>
                  <StyledSelect
                    name="accounting_payment_terms"
                    value={formValues.accounting_payment_terms}
                    onChange={handleChange}
                    aria-label="Payment Terms"
                  >
                    <option value="">Select terms…</option>
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Credit Limits</FieldLabel>
                  <StyledSelect
                    name="credit_limits"
                    value={formValues.credit_limits}
                    onChange={handleChange}
                    aria-label="Credit Limits"
                  >
                    <option value="">Select credit limit…</option>
                    {CREDIT_LIMITS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Appointment Method</FieldLabel>
                  <StyledSelect
                    name="how_carrier_make_appointment"
                    value={formValues.how_carrier_make_appointment}
                    onChange={handleChange}
                    aria-label="Appointment Method"
                  >
                    <option value="">Select method…</option>
                    {APPOINTMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </StyledSelect>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Departments</FieldLabel>
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
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 5: Insurance */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('insurance')}>
              <SectionIcon><FileText size={18} /></SectionIcon>
              <SectionTitle>🛡️ Insurance</SectionTitle>
              <CollapseChevron $expanded={!!expandedSections.insurance}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </SectionHeader>
            <SectionContent $expanded={!!expandedSections.insurance}>
              <FieldGrid>
                <FieldGroup>
                  <FieldLabel>Insurance Provider</FieldLabel>
                  <StyledInput
                    name="insurance_provider"
                    value={formValues.insurance_provider}
                    onChange={handleChange}
                    placeholder="Provider name"
                    aria-label="Insurance Provider"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Policy Number</FieldLabel>
                  <StyledInput
                    name="insurance_policy_number"
                    value={formValues.insurance_policy_number}
                    onChange={handleChange}
                    placeholder="Policy #"
                    aria-label="Insurance Policy Number"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Expiry Date</FieldLabel>
                  <StyledInput
                    name="insurance_expiry"
                    type="date"
                    value={formValues.insurance_expiry}
                    onChange={handleChange}
                    aria-label="Insurance Expiry"
                  />
                </FieldGroup>
              </FieldGrid>
            </SectionContent>
          </SectionCard>

          {/* Section 6: Notes */}
          <SectionCard>
            <SectionHeader $clickable onClick={() => toggleSection('notes')}>
              <SectionIcon><FileText size={18} /></SectionIcon>
              <SectionTitle>📝 Notes</SectionTitle>
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
                  placeholder="Additional notes about this carrier…"
                  rows={4}
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
                ? 'Update Carrier'
                : 'Create Carrier'}
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

export default CarrierCreateForm;
