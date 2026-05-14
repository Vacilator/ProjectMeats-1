import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message } from 'antd';
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
  GoldenCheckboxRow,
  GoldenCheckbox,
  GoldenFormFooter,
  GoldenCancelButton,
  GoldenSubmitButton,
  GoldenAutoFilledBadge,
} from '@/components/Forms/GoldenFormShell';
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
// Form-specific Styled Components (not in GoldenFormShell)
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
    <GoldenFormOverlay onClick={handleBackdropClick}>
      <GoldenFormContainer>
        {/* Header */}
        <GoldenFormHeader>
          <GoldenFormTitleGroup>
            <Truck size={24} color="rgb(var(--color-primary))" />
            <GoldenFormTitle>{mode === 'edit' ? 'Edit Carrier' : 'New Carrier'}</GoldenFormTitle>
          </GoldenFormTitleGroup>
          <GoldenCloseButton onClick={onCancel} aria-label="Close form">
            <X size={20} />
          </GoldenCloseButton>
        </GoldenFormHeader>

        <GoldenFormBody as="div">
          {/* Section 1: Carrier Details */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('details')}>
              <GoldenSectionIcon><Truck size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>🚚 Carrier Details</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.details}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.details}>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel $required>
                    Carrier Name
                  </GoldenLabel>
                  <GoldenInput
                    name="name"
                    value={formValues.name}
                    onChange={handleChange}
                    placeholder="Enter carrier name"
                    required
                    aria-label="Carrier Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Code</GoldenLabel>
                  <GoldenInput
                    name="code"
                    value={formValues.code}
                    onChange={handleChange}
                    placeholder="Carrier code"
                    aria-label="Carrier Code"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Carrier Type</GoldenLabel>
                  <GoldenSelect
                    name="carrier_type"
                    value={formValues.carrier_type}
                    onChange={handleChange}
                    aria-label="Carrier Type"
                  >
                    <option value="">Select type…</option>
                    {CARRIER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>MC Number</GoldenLabel>
                  <GoldenInput
                    name="mc_number"
                    value={formValues.mc_number}
                    onChange={handleChange}
                    placeholder="MC-XXXXXX"
                    aria-label="MC Number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>DOT Number</GoldenLabel>
                  <GoldenInput
                    name="dot_number"
                    value={formValues.dot_number}
                    onChange={handleChange}
                    placeholder="DOT-XXXXXXX"
                    aria-label="DOT Number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Active</GoldenLabel>
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
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>

          {/* Section 2: Address */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('address')}>
              <GoldenSectionIcon><Building2 size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>📍 Address</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.address}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.address}>
              <GoldenFieldGrid>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>Corporate Address</GoldenLabel>
                  <GoldenInput
                    name="address"
                    value={formValues.address}
                    onChange={handleChange}
                    placeholder="Street address"
                    aria-label="Address"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>City</GoldenLabel>
                  <GoldenInput
                    name="city"
                    value={formValues.city}
                    onChange={handleChange}
                    placeholder="City"
                    aria-label="City"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>State</GoldenLabel>
                  <GoldenInput
                    name="state"
                    value={formValues.state}
                    onChange={handleChange}
                    placeholder="State"
                    aria-label="State"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Zip Code</GoldenLabel>
                  <GoldenInput
                    name="zip_code"
                    value={formValues.zip_code}
                    onChange={handleChange}
                    placeholder="Zip code"
                    aria-label="Zip Code"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Country</GoldenLabel>
                  <GoldenInput
                    name="country"
                    value={formValues.country}
                    onChange={handleChange}
                    placeholder="Country"
                    aria-label="Country"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>

          {/* Section 3: Contacts */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('contacts')}>
              <GoldenSectionIcon><Users size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>👤 Contacts</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.contacts}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.contacts}>
              {/* AP Contact */}
              <GoldenLabel style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                Accounting Payable Contact
              </GoldenLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>AP Contact Name</GoldenLabel>
                  <GoldenInput
                    name="accounting_payable_contact_name"
                    value={formValues.accounting_payable_contact_name}
                    onChange={handleChange}
                    placeholder="Name"
                    aria-label="AP Contact Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>AP Contact Phone</GoldenLabel>
                  <GoldenInput
                    name="accounting_payable_contact_phone"
                    value={formValues.accounting_payable_contact_phone}
                    onChange={handleChange}
                    placeholder="Phone"
                    aria-label="AP Contact Phone"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>AP Contact Email</GoldenLabel>
                  <GoldenInput
                    name="accounting_payable_contact_email"
                    value={formValues.accounting_payable_contact_email}
                    onChange={handleChange}
                    placeholder="Email"
                    type="email"
                    aria-label="AP Contact Email"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>

              {/* Sales Contact */}
              <GoldenLabel
                style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, marginTop: 24 }}
              >
                Sales Contact
              </GoldenLabel>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Sales Contact Name</GoldenLabel>
                  <GoldenInput
                    name="sales_contact_name"
                    value={formValues.sales_contact_name}
                    onChange={handleChange}
                    placeholder="Name"
                    aria-label="Sales Contact Name"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Contact Title</GoldenLabel>
                  <GoldenInput
                    name="contact_title"
                    value={formValues.contact_title}
                    onChange={handleChange}
                    placeholder="Title"
                    aria-label="Contact Title"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Sales Email</GoldenLabel>
                  <GoldenInput
                    name="sales_contact_email"
                    value={formValues.sales_contact_email}
                    onChange={handleChange}
                    placeholder="Email"
                    type="email"
                    aria-label="Sales Contact Email"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Sales Main Phone</GoldenLabel>
                  <GoldenInput
                    name="sales_contact_main_phone"
                    value={formValues.sales_contact_main_phone}
                    onChange={handleChange}
                    placeholder="Main phone"
                    aria-label="Sales Main Phone"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Sales Direct Phone</GoldenLabel>
                  <GoldenInput
                    name="sales_contact_direct_phone"
                    value={formValues.sales_contact_direct_phone}
                    onChange={handleChange}
                    placeholder="Direct phone"
                    aria-label="Sales Direct Phone"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Sales Cell Phone</GoldenLabel>
                  <GoldenInput
                    name="sales_contact_cell_phone"
                    value={formValues.sales_contact_cell_phone}
                    onChange={handleChange}
                    placeholder="Cell phone"
                    aria-label="Sales Cell Phone"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>

              {/* My Customer Num */}
              <GoldenFieldGrid style={{ marginTop: 20 }}>
                <GoldenFormGroup $span={2}>
                  <GoldenLabel>My Customer # From Carrier</GoldenLabel>
                  <GoldenInput
                    name="my_customer_num_from_carrier"
                    value={formValues.my_customer_num_from_carrier}
                    onChange={handleChange}
                    placeholder="Customer number assigned by carrier"
                    aria-label="My Customer Number From Carrier"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>

          {/* Section 4: Payment & Credit */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('payment')}>
              <GoldenSectionIcon><DollarSign size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>💰 Payment &amp; Credit</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.payment}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.payment}>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Payment Terms</GoldenLabel>
                  <GoldenSelect
                    name="accounting_payment_terms"
                    value={formValues.accounting_payment_terms}
                    onChange={handleChange}
                    aria-label="Payment Terms"
                  >
                    <option value="">Select terms…</option>
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Credit Limits</GoldenLabel>
                  <GoldenSelect
                    name="credit_limits"
                    value={formValues.credit_limits}
                    onChange={handleChange}
                    aria-label="Credit Limits"
                  >
                    <option value="">Select credit limit…</option>
                    {CREDIT_LIMITS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Appointment Method</GoldenLabel>
                  <GoldenSelect
                    name="how_carrier_make_appointment"
                    value={formValues.how_carrier_make_appointment}
                    onChange={handleChange}
                    aria-label="Appointment Method"
                  >
                    <option value="">Select method…</option>
                    {APPOINTMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </GoldenSelect>
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Departments</GoldenLabel>
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
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>

          {/* Section 5: Insurance */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('insurance')}>
              <GoldenSectionIcon><FileText size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>🛡️ Insurance</GoldenSectionTitle>
              <CollapseChevron $expanded={!!expandedSections.insurance}>
                <ChevronDown size={18} />
              </CollapseChevron>
            </GoldenSectionHeader>
            <SectionContent $expanded={!!expandedSections.insurance}>
              <GoldenFieldGrid>
                <GoldenFormGroup>
                  <GoldenLabel>Insurance Provider</GoldenLabel>
                  <GoldenInput
                    name="insurance_provider"
                    value={formValues.insurance_provider}
                    onChange={handleChange}
                    placeholder="Provider name"
                    aria-label="Insurance Provider"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Policy Number</GoldenLabel>
                  <GoldenInput
                    name="insurance_policy_number"
                    value={formValues.insurance_policy_number}
                    onChange={handleChange}
                    placeholder="Policy #"
                    aria-label="Insurance Policy Number"
                  />
                </GoldenFormGroup>
                <GoldenFormGroup>
                  <GoldenLabel>Expiry Date</GoldenLabel>
                  <GoldenInput
                    name="insurance_expiry"
                    type="date"
                    value={formValues.insurance_expiry}
                    onChange={handleChange}
                    aria-label="Insurance Expiry"
                  />
                </GoldenFormGroup>
              </GoldenFieldGrid>
            </SectionContent>
          </GoldenSectionCard>

          {/* Section 6: Notes */}
          <GoldenSectionCard>
            <GoldenSectionHeader $clickable onClick={() => toggleSection('notes')}>
              <GoldenSectionIcon><FileText size={18} /></GoldenSectionIcon>
              <GoldenSectionTitle>📝 Notes</GoldenSectionTitle>
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
                  placeholder="Additional notes about this carrier…"
                  rows={4}
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
                ? 'Update Carrier'
                : 'Create Carrier'}
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

export default CarrierCreateForm;
