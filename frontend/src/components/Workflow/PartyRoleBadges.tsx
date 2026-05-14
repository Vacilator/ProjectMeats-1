/**
 * PartyRoleBadges — Compact inline badges showing party roles (Supplier,
 * Customer, Carrier) and contact info for trade entities.
 *
 * Self-fetches record data via businessApi.  Renders nothing when no party
 * data is available.
 *
 * Theme Compliance: CSS custom properties only.
 */

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Tooltip } from 'antd';
import { Mail, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { getDocumentEntityConfig } from '@/components/Operations/documentOperations';

// ============================================================================
// Types
// ============================================================================

export interface PartyRoleBadgesProps {
  entityType: string;
  entityId: string | number;
}

type PartyRole = 'supplier' | 'customer' | 'carrier';

interface PartyFieldDef {
  role: PartyRole;
  nameField: string;
  label: string;
  optional?: boolean;
}

interface ContactFieldDef {
  nameField: string;
  emailField?: string;
  phoneField?: string;
}

interface EntityPartyConfig {
  parties: PartyFieldDef[];
  contact?: ContactFieldDef;
}

// ============================================================================
// Party field configuration per entity type
// ============================================================================

const PARTY_FIELDS: Record<string, EntityPartyConfig> = {
  inquiry: {
    parties: [
      { role: 'customer', nameField: 'customer_name', label: 'Customer' },
    ],
    contact: {
      nameField: 'contact_name',
      emailField: 'contact_email',
      phoneField: 'contact_phone',
    },
  },
  purchase_order: {
    parties: [
      { role: 'supplier', nameField: 'supplier_name', label: 'Supplier' },
      { role: 'carrier', nameField: 'carrier_name', label: 'Carrier', optional: true },
    ],
    contact: {
      nameField: 'contact_name',
      emailField: 'contact_email',
      phoneField: 'contact_phone',
    },
  },
  sales_order: {
    parties: [
      { role: 'customer', nameField: 'customer_name', label: 'Customer' },
      { role: 'carrier', nameField: 'carrier_name', label: 'Carrier', optional: true },
    ],
    contact: {
      nameField: 'contact_name',
      emailField: 'contact_email',
      phoneField: 'contact_phone',
    },
  },
  invoice: {
    parties: [
      { role: 'customer', nameField: 'customer_name', label: 'Customer' },
    ],
    contact: {
      nameField: 'contact_name',
      emailField: 'contact_email',
      phoneField: 'contact_phone',
    },
  },
  carrier_purchase_order: {
    parties: [
      { role: 'carrier', nameField: 'carrier_name', label: 'Carrier' },
    ],
    contact: {
      nameField: 'contact_name',
      emailField: 'contact_email',
      phoneField: 'contact_phone',
    },
  },
  freight_order: {
    parties: [
      { role: 'carrier', nameField: 'carrier_name', label: 'Carrier' },
    ],
    contact: {
      nameField: 'contact_name',
      emailField: 'contact_email',
      phoneField: 'contact_phone',
    },
  },
  fulfillment: {
    parties: [
      { role: 'customer', nameField: 'customer_name', label: 'Customer' },
      { role: 'supplier', nameField: 'supplier_name', label: 'Supplier' },
      { role: 'carrier', nameField: 'carrier_name', label: 'Carrier', optional: true },
    ],
  },
};

// ============================================================================
// Styled Components
// ============================================================================

const ROLE_COLORS: Record<PartyRole, { bg: string; text: string }> = {
  supplier: {
    bg: 'rgba(var(--color-info), 0.12)',
    text: 'rgb(var(--color-info))',
  },
  customer: {
    bg: 'rgba(var(--color-success), 0.12)',
    text: 'rgb(var(--color-success))',
  },
  carrier: {
    bg: 'rgba(var(--color-warning), 0.12)',
    text: 'rgb(var(--color-warning))',
  },
};

const BadgesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0;
`;

const RoleBadge = styled.span<{ $role: PartyRole }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  background: ${({ $role }) => ROLE_COLORS[$role].bg};
  color: ${({ $role }) => ROLE_COLORS[$role].text};
`;

const RoleLabel = styled.span`
  opacity: 0.8;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.625rem;
  letter-spacing: 0.03em;
`;

const ContactChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 400;
  white-space: nowrap;
  color: rgb(var(--color-text-secondary));
  background: rgba(var(--color-text-secondary), 0.08);
`;

const ContactIcon = styled.span`
  display: inline-flex;
  align-items: center;
  color: rgb(var(--color-text-tertiary));
`;

// ============================================================================
// Helpers
// ============================================================================

const getStr = (record: Record<string, unknown>, field: string): string | null => {
  const val = record[field];
  if (typeof val === 'string' && val.trim()) return val.trim();
  return null;
};

const normalizeEntityType = (raw: string): string =>
  String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');

// ============================================================================
// Component
// ============================================================================

export const PartyRoleBadges: React.FC<PartyRoleBadgesProps> = ({
  entityType,
  entityId,
}) => {
  const normalized = useMemo(() => normalizeEntityType(entityType), [entityType]);
  const config = useMemo(() => getDocumentEntityConfig(normalized), [normalized]);
  const partyConfig = useMemo(() => PARTY_FIELDS[normalized] ?? null, [normalized]);

  const queryKey = useMemo(
    () => withTenantQueryKey('party-role-badges', normalized, String(entityId)),
    [normalized, entityId],
  );

  const { data: record } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await businessApi.get<Record<string, unknown>>(
        `/${config!.endpoint}/${encodeURIComponent(String(entityId))}/`,
      );
      return response.data;
    },
    enabled: Boolean(config) && Boolean(entityId) && Boolean(partyConfig),
    staleTime: 30_000,
  });

  const badges = useMemo(() => {
    if (!record || !partyConfig) return [];
    return partyConfig.parties
      .map((p) => {
        const name = getStr(record, p.nameField);
        if (!name && p.optional) return null;
        return { role: p.role, label: p.label, name: name ?? '—' };
      })
      .filter(Boolean) as { role: PartyRole; label: string; name: string }[];
  }, [record, partyConfig]);

  const contactInfo = useMemo(() => {
    if (!record || !partyConfig?.contact) return null;
    const name = getStr(record, partyConfig.contact.nameField);
    if (!name) return null;
    const email = partyConfig.contact.emailField
      ? getStr(record, partyConfig.contact.emailField)
      : null;
    const phone = partyConfig.contact.phoneField
      ? getStr(record, partyConfig.contact.phoneField)
      : null;
    return { name, email, phone };
  }, [record, partyConfig]);

  if (badges.length === 0 && !contactInfo) return null;

  const contactTooltip = contactInfo
    ? [contactInfo.email, contactInfo.phone].filter(Boolean).join(' · ') || undefined
    : undefined;

  return (
    <BadgesRow>
      {badges.map((b) => (
        <RoleBadge key={b.role} $role={b.role}>
          <RoleLabel>{b.label}</RoleLabel>
          {b.name}
        </RoleBadge>
      ))}
      {contactInfo && (
        <Tooltip title={contactTooltip}>
          <ContactChip>
            {contactInfo.email && (
              <ContactIcon>
                <Mail size={12} aria-hidden="true" />
              </ContactIcon>
            )}
            {contactInfo.phone && !contactInfo.email && (
              <ContactIcon>
                <Phone size={12} aria-hidden="true" />
              </ContactIcon>
            )}
            {contactInfo.name}
          </ContactChip>
        </Tooltip>
      )}
    </BadgesRow>
  );
};

export default PartyRoleBadges;
