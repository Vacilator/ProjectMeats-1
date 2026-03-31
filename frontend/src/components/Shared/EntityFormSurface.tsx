/**
 * EntityFormSurface
 *
 * Single entry point for record create/edit forms.
 *
 * - Default renderer: UniversalEntityForm (schema-driven)
 * - Enhanced renderer(s): entity-specific modules (e.g., InquiryCreateModal)
 *
 * This is the consolidation layer that lets the same form be embedded
 * in a modal today, and later embedded inline/panels/workforms without
 * duplicating per-entry-point logic.
 */

import React, { useMemo } from 'react';

import { getRuntimeConfigBoolean } from '@/config/runtime';

import UniversalEntityForm from './UniversalEntityForm';
import { InquiryCreateModal } from '../Inquiry/InquiryCreateModal';

export type EntityFormMode = 'create' | 'edit' | 'view';

export type EntityFormSurfaceVariant = 'modal' | 'inline';

export type EntityFormContext = {
  customerId?: string | number;
  supplierId?: string | number;
  contactId?: string | number;
  sourceCallId?: string | number;
};

export interface EntityFormSurfaceProps {
  entityType: string;
  mode: EntityFormMode;

  /**
   * Render surface.
   * - modal: wraps form in a modal (default)
   * - inline: renders directly (embeddable into pages/panels)
   */
  variant?: EntityFormSurfaceVariant;

  /**
   * When true, forces the UniversalEntityForm even if an enhanced renderer exists.
   * Useful for embedded Cockpit panes where modals would break the UX.
   */
  forceUniversal?: boolean;

  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;

  /** For edit/view mode */
  entityId?: string | number;

  /** Seed values for universal schema-driven form */
  initialValues?: Record<string, unknown>;

  /** Context entity for cascade-prefill across Cockpit etc. */
  context?: EntityFormContext;
}

const normalizeEntityType = (raw: string): string => {
  const t = String(raw || '')
    .trim()
    .toLowerCase();

  if (t === 'inquiry' || t === 'inquiries') return 'inquiry';
  if (t === 'customer' || t === 'customers') return 'customer';
  if (t === 'supplier' || t === 'suppliers') return 'supplier';

  return t;
};

export const EntityFormSurface: React.FC<EntityFormSurfaceProps> = ({
  entityType,
  mode,
  variant = 'modal',
  forceUniversal = false,
  isOpen,
  onClose,
  onSuccess,
  entityId,
  initialValues,
  context,
}) => {
  const normalized = useMemo(() => normalizeEntityType(entityType), [entityType]);

  const useUniversalInquiryCreate = getRuntimeConfigBoolean('USE_UNIVERSAL_INQUIRY_CREATE', false);

  // Enhanced form: Inquiry (create) — can be swapped to UniversalEntityForm via runtime flag.
  if (normalized === 'inquiry' && mode === 'create' && !useUniversalInquiryCreate && !forceUniversal) {
    const initialEntityType = context?.customerId
      ? 'customer'
      : context?.supplierId
        ? 'supplier'
        : undefined;
    const initialEntityId = context?.customerId ?? context?.supplierId;

    return (
      <InquiryCreateModal
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={(created) => onSuccess?.(created)}
        initialEntityType={initialEntityType}
        initialEntityId={initialEntityId}
        sourceCallId={context?.sourceCallId}
      />
    );
  }

  // Default: Universal schema-driven form.
  const derivedInitialValues: Record<string, unknown> = {
    ...(initialValues || {}),
    ...(context?.customerId != null ? { customer: String(context.customerId) } : {}),
    ...(context?.supplierId != null ? { supplier: String(context.supplierId) } : {}),
    ...(context?.contactId != null ? { contact: String(context.contactId) } : {}),
  };

  return (
    <UniversalEntityForm
      entityType={entityType}
      mode={mode}
      variant={variant}
      entityId={mode === 'edit' || mode === 'view' ? entityId : undefined}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={(result) => onSuccess?.(result)}
      initialValues={derivedInitialValues}
    />
  );
};

export default EntityFormSurface;
