import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { message } from 'antd';
import {
  GoldenFormContainer,
  GoldenFormHeader,
  GoldenFormTitleGroup,
  GoldenFormTitle,
  GoldenFormSubtitle,
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
  GoldenCancelButton,
  GoldenSubmitButton,
} from '@/components/Forms/GoldenFormShell';
import { Factory, MapPin, Phone, Settings, ArrowLeft } from 'lucide-react';

import type { Plant } from '@/services/apiService';
import { businessApi } from '@/services/businessApi';

// ============================================================================
// Types
// ============================================================================

type HardcodedPlantSeed = Partial<Plant> & {
  export_approved?: boolean;
};

type HardcodedPlantFormProps = {
  plantId: string;
  initialValues: HardcodedPlantSeed | null;
  onCancel: () => void;
  onSaved?: (plant: Plant) => void;
};

type HardcodedPlantFormValues = {
  name: string;
  plant_est_num: string;
  plant_type: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  booking_contact_email: string;
  booking_contact_phone: string;
  booking_contact_phone_type: 'mobile' | 'office';
  capacity: string;
  export_approved: boolean;
  is_active: boolean;
  fcfs: boolean;
};

// ============================================================================
// Constants
// ============================================================================

const PLANT_TYPE_OPTIONS = [
  { label: 'Vertical (Kill to Fabrication)', value: 'vertical' },
  { label: 'Processing Plant', value: 'processing' },
  { label: 'Distribution Center', value: 'distribution' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Retail Location', value: 'retail' },
  { label: 'Other', value: 'other' },
];

const PHONE_TYPE_OPTIONS = [
  { label: 'Office', value: 'office' },
  { label: 'Mobile', value: 'mobile' },
];

// ============================================================================
// Toggle styled-component (matches CarrierCreateForm pattern)
// ============================================================================

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

const BackButton = styled.button`
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border: none;
  padding: 0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s;

  &:hover {
    color: rgb(var(--color-text-primary));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

// ============================================================================
// Helpers
// ============================================================================

const normalizeInitialValues = (plant: HardcodedPlantSeed | null): HardcodedPlantFormValues => ({
  name: String(plant?.name || ''),
  plant_est_num: String(plant?.plant_est_num || ''),
  plant_type: String(plant?.plant_type || 'processing'),
  address: String(plant?.address || ''),
  city: String(plant?.city || ''),
  state: String(plant?.state || ''),
  zip_code: String(plant?.zip_code || ''),
  country: String(plant?.country || 'USA'),
  booking_contact_email: String(plant?.booking_contact_email || ''),
  booking_contact_phone: String(plant?.booking_contact_phone || ''),
  booking_contact_phone_type:
    plant?.booking_contact_phone_type === 'mobile' ? 'mobile' : 'office',
  capacity:
    typeof plant?.capacity === 'number' && Number.isFinite(plant.capacity)
      ? String(plant.capacity)
      : '',
  export_approved: Boolean(plant?.export_approved),
  is_active: plant?.is_active ?? true,
  fcfs: Boolean(plant?.fcfs),
});

// ============================================================================
// Component
// ============================================================================

export const HardcodedPlantForm: React.FC<HardcodedPlantFormProps> = ({
  plantId,
  initialValues,
  onCancel,
  onSaved,
}) => {
  const [formValues, setFormValues] = useState<HardcodedPlantFormValues>(() =>
    normalizeInitialValues(initialValues),
  );
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const toggleBoolean = useCallback((field: keyof HardcodedPlantFormValues) => {
    setFormValues((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!formValues.name.trim()) {
        message.warning('Plant name is required.');
        return;
      }

      if (!plantId) {
        message.error('Plant ID is missing.');
        return;
      }

      const numericPlantId = Number(plantId);
      if (!Number.isFinite(numericPlantId)) {
        message.error('Plant ID is invalid.');
        return;
      }

      setSaving(true);
      try {
        const capacityNum = formValues.capacity !== '' ? Number(formValues.capacity) : undefined;
        const payload: HardcodedPlantSeed = {
          name: formValues.name,
          plant_est_num: formValues.plant_est_num || undefined,
          plant_type: formValues.plant_type || undefined,
          address: formValues.address || undefined,
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          zip_code: formValues.zip_code || undefined,
          country: formValues.country || undefined,
          booking_contact_email: formValues.booking_contact_email || undefined,
          booking_contact_phone: formValues.booking_contact_phone || undefined,
          booking_contact_phone_type: formValues.booking_contact_phone_type || undefined,
          capacity: capacityNum != null && Number.isFinite(capacityNum) ? capacityNum : undefined,
          export_approved: formValues.export_approved,
          is_active: formValues.is_active,
          fcfs: formValues.fcfs,
        };
        const resp = await businessApi.patch(`plants/${numericPlantId}/`, payload);
        const updated = resp.data as Plant;
        message.success('Plant updated.');
        onSaved?.(updated);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : 'Unable to save the plant right now.',
        );
      } finally {
        setSaving(false);
      }
    },
    [formValues, plantId, onSaved],
  );

  return (
    <div style={{ padding: 16 }}>
      <GoldenFormContainer>
        {/* Header */}
        <GoldenFormHeader>
          <div>
            <BackButton type="button" onClick={onCancel} aria-label="Back to Details">
              <ArrowLeft size={16} />
              Back to Details
            </BackButton>
            <GoldenFormTitleGroup style={{ marginTop: 8 }}>
              <Factory size={24} color="rgb(var(--color-primary))" />
              <div>
                <GoldenFormTitle>Edit Plant</GoldenFormTitle>
                <GoldenFormSubtitle>
                  Static business-continuity form. Bypasses the dynamic schema engine for plant
                  edits.
                </GoldenFormSubtitle>
              </div>
            </GoldenFormTitleGroup>
          </div>
        </GoldenFormHeader>

        {/* Body */}
        <GoldenFormBody onSubmit={handleSubmit}>
          {/* Section 1: Plant Details */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>
                <Factory size={18} />
              </GoldenSectionIcon>
              <GoldenSectionTitle>Plant Details</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel $required>Plant Name</GoldenLabel>
                <GoldenInput
                  name="name"
                  value={formValues.name}
                  onChange={handleChange}
                  placeholder="Enter plant name"
                  required
                  aria-label="Plant Name"
                />
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>Plant EST #</GoldenLabel>
                <GoldenInput
                  name="plant_est_num"
                  value={formValues.plant_est_num}
                  onChange={handleChange}
                  placeholder="Optional establishment number"
                  aria-label="Plant EST Number"
                />
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>Plant Type</GoldenLabel>
                <GoldenSelect
                  name="plant_type"
                  value={formValues.plant_type}
                  onChange={handleChange}
                  aria-label="Plant Type"
                >
                  <option value="">Select type…</option>
                  {PLANT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>Capacity</GoldenLabel>
                <GoldenInput
                  name="capacity"
                  type="number"
                  min={0}
                  value={formValues.capacity}
                  onChange={handleChange}
                  placeholder="Optional capacity"
                  aria-label="Capacity"
                />
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 2: Address */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>
                <MapPin size={18} />
              </GoldenSectionIcon>
              <GoldenSectionTitle>Address</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup $span={2}>
                <GoldenLabel>Address</GoldenLabel>
                <GoldenTextArea
                  name="address"
                  value={formValues.address}
                  onChange={handleChange}
                  rows={3}
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
                <GoldenLabel>ZIP Code</GoldenLabel>
                <GoldenInput
                  name="zip_code"
                  value={formValues.zip_code}
                  onChange={handleChange}
                  placeholder="ZIP code"
                  aria-label="ZIP Code"
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
          </GoldenSectionCard>

          {/* Section 3: Booking Contact */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>
                <Phone size={18} />
              </GoldenSectionIcon>
              <GoldenSectionTitle>Booking Contact</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid>
              <GoldenFormGroup>
                <GoldenLabel>Email</GoldenLabel>
                <GoldenInput
                  name="booking_contact_email"
                  type="email"
                  value={formValues.booking_contact_email}
                  onChange={handleChange}
                  placeholder="contact@example.com"
                  aria-label="Booking Contact Email"
                />
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>Phone</GoldenLabel>
                <GoldenInput
                  name="booking_contact_phone"
                  value={formValues.booking_contact_phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  aria-label="Booking Contact Phone"
                />
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>Phone Type</GoldenLabel>
                <GoldenSelect
                  name="booking_contact_phone_type"
                  value={formValues.booking_contact_phone_type}
                  onChange={handleChange}
                  aria-label="Phone Type"
                >
                  {PHONE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </GoldenSelect>
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>

          {/* Section 4: Options */}
          <GoldenSectionCard>
            <GoldenSectionHeader>
              <GoldenSectionIcon>
                <Settings size={18} />
              </GoldenSectionIcon>
              <GoldenSectionTitle>Options</GoldenSectionTitle>
            </GoldenSectionHeader>
            <GoldenFieldGrid $cols={3}>
              <GoldenFormGroup>
                <GoldenLabel>Export Approved</GoldenLabel>
                <ToggleRow>
                  <ToggleSwitch
                    $active={formValues.export_approved}
                    onClick={() => toggleBoolean('export_approved')}
                    role="switch"
                    aria-checked={formValues.export_approved}
                    aria-label="Export Approved"
                  />
                  {formValues.export_approved ? 'Yes' : 'No'}
                </ToggleRow>
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>Active</GoldenLabel>
                <ToggleRow>
                  <ToggleSwitch
                    $active={formValues.is_active}
                    onClick={() => toggleBoolean('is_active')}
                    role="switch"
                    aria-checked={formValues.is_active}
                    aria-label="Active"
                  />
                  {formValues.is_active ? 'Active' : 'Inactive'}
                </ToggleRow>
              </GoldenFormGroup>
              <GoldenFormGroup>
                <GoldenLabel>FCFS</GoldenLabel>
                <ToggleRow>
                  <ToggleSwitch
                    $active={formValues.fcfs}
                    onClick={() => toggleBoolean('fcfs')}
                    role="switch"
                    aria-checked={formValues.fcfs}
                    aria-label="First Come First Served"
                  />
                  {formValues.fcfs ? 'Yes' : 'No'}
                </ToggleRow>
              </GoldenFormGroup>
            </GoldenFieldGrid>
          </GoldenSectionCard>
        </GoldenFormBody>

        {/* Footer */}
        <GoldenFormFooter>
          <GoldenCancelButton type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </GoldenCancelButton>
          <GoldenSubmitButton
            type="submit"
            $loading={saving}
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? 'Saving…' : 'Save Plant'}
          </GoldenSubmitButton>
        </GoldenFormFooter>
      </GoldenFormContainer>
    </div>
  );
};

export default HardcodedPlantForm;
