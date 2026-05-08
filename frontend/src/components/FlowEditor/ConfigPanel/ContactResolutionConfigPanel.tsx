/**
 * Contact Resolution Config Panel (PI-05 / editor-conditional-ui)
 *
 * Config panel for the resolve_contacts node that shows conditional field
 * toggles (certifications, shipping preferences) and multi-select chips
 * for document attachments.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Select, Switch, Tag } from 'antd';
import { UserCheck, FileText, Shield, Truck } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ContactResolutionConfig {
  plantContactType: string;
  fallbackContactType: string;
  enableCertificationsFilter: boolean;
  certifications: string[];
  enableShippingPreferences: boolean;
  shippingPreferences: string[];
  documentAttachments: string[];
  useProductContext: boolean;
}

export interface ContactResolutionConfigPanelProps {
  value: ContactResolutionConfig;
  onChange: (config: ContactResolutionConfig) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CONTACT_TYPES = [
  'Sales',
  'Accounting',
  'Operations',
  'Logistics',
  'Quality',
  'General',
];

const CERTIFICATION_OPTIONS = [
  'USDA',
  'FDA',
  'HACCP',
  'SQF',
  'BRC',
  'Organic',
  'Halal',
  'Kosher',
  'Non-GMO',
];

const SHIPPING_PREFERENCE_OPTIONS = [
  'Refrigerated',
  'Frozen',
  'Ambient',
  'Next Day',
  'LTL',
  'Full Truckload',
  'Ocean Freight',
  'Air Freight',
];

const DOCUMENT_ATTACHMENT_OPTIONS = [
  'RFQ Document',
  'Specification Sheet',
  'Certificate of Analysis',
  'MSDS',
  'Purchase Terms',
  'Quality Requirements',
  'Shipping Instructions',
  'Packaging Standards',
];

// ============================================================================
// Styled Components
// ============================================================================

const PanelContainer = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 0;
`;

const Section = styled.div`
  display: grid;
  gap: 8px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FieldRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const FieldLabel = styled.span`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

const ConditionalSection = styled.div<{ $visible: boolean }>`
  display: ${(p) => (p.$visible ? 'grid' : 'none')};
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: rgba(var(--color-border), 0.15);
  border: 1px solid rgb(var(--color-border));
`;

// ============================================================================
// Component
// ============================================================================

export const ContactResolutionConfigPanel: React.FC<ContactResolutionConfigPanelProps> = ({
  value,
  onChange,
}) => {
  const update = useCallback(
    (patch: Partial<ContactResolutionConfig>) => {
      onChange({ ...value, ...patch });
    },
    [value, onChange]
  );

  return (
    <PanelContainer>
      {/* Primary Contact Type */}
      <Section>
        <SectionHeader>
          <UserCheck size={14} />
          Contact Resolution
        </SectionHeader>
        <FieldRow>
          <FieldLabel>Preferred Type</FieldLabel>
          <Select
            size="small"
            value={value.plantContactType}
            onChange={(v) => update({ plantContactType: v })}
            options={CONTACT_TYPES.map((t) => ({ value: t, label: t }))}
            style={{ width: 140 }}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel>Fallback Type</FieldLabel>
          <Select
            size="small"
            value={value.fallbackContactType}
            onChange={(v) => update({ fallbackContactType: v })}
            options={CONTACT_TYPES.map((t) => ({ value: t, label: t }))}
            style={{ width: 140 }}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel>Use Product Context</FieldLabel>
          <Switch
            size="small"
            checked={value.useProductContext}
            onChange={(v) => update({ useProductContext: v })}
          />
        </FieldRow>
      </Section>

      {/* Certifications Filter (conditional) */}
      <Section>
        <SectionHeader>
          <Shield size={14} />
          Certifications Filter
        </SectionHeader>
        <FieldRow>
          <FieldLabel>Enable filter</FieldLabel>
          <Switch
            size="small"
            checked={value.enableCertificationsFilter}
            onChange={(v) => update({ enableCertificationsFilter: v })}
          />
        </FieldRow>
        <ConditionalSection $visible={value.enableCertificationsFilter}>
          <Select
            mode="multiple"
            size="small"
            value={value.certifications}
            onChange={(v) => update({ certifications: v })}
            options={CERTIFICATION_OPTIONS.map((c) => ({ value: c, label: c }))}
            placeholder="Select required certifications"
            tagRender={(props) => (
              <Tag closable onClose={props.onClose} style={{ marginRight: 3 }}>
                {props.label}
              </Tag>
            )}
          />
        </ConditionalSection>
      </Section>

      {/* Shipping Preferences (conditional) */}
      <Section>
        <SectionHeader>
          <Truck size={14} />
          Shipping Preferences
        </SectionHeader>
        <FieldRow>
          <FieldLabel>Enable filter</FieldLabel>
          <Switch
            size="small"
            checked={value.enableShippingPreferences}
            onChange={(v) => update({ enableShippingPreferences: v })}
          />
        </FieldRow>
        <ConditionalSection $visible={value.enableShippingPreferences}>
          <Select
            mode="multiple"
            size="small"
            value={value.shippingPreferences}
            onChange={(v) => update({ shippingPreferences: v })}
            options={SHIPPING_PREFERENCE_OPTIONS.map((s) => ({ value: s, label: s }))}
            placeholder="Select shipping preferences"
          />
        </ConditionalSection>
      </Section>

      {/* Document Attachments (always visible multi-select) */}
      <Section>
        <SectionHeader>
          <FileText size={14} />
          Document Attachments
        </SectionHeader>
        <Select
          mode="multiple"
          size="small"
          value={value.documentAttachments}
          onChange={(v) => update({ documentAttachments: v })}
          options={DOCUMENT_ATTACHMENT_OPTIONS.map((d) => ({ value: d, label: d }))}
          placeholder="Select documents to attach to RFQ"
        />
      </Section>
    </PanelContainer>
  );
};

export default ContactResolutionConfigPanel;
