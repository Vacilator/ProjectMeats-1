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

import UniversalEntityForm from './UniversalEntityForm';
import { InquiryCreateModal } from '../Inquiry';

export type EntityFormMode = 'create' | 'edit';

export type EntityFormContext = {
  customerId?: string | number;
  supplierId?: string | number;
  contactId?: string | number;
  sourceCallId?: string | number;
};

export interface EntityFormSurfaceProps {
  entityType: string;
  mode: EntityFormMode;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;

  /** For edit mode */
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
  isOpen,
  onClose,
  onSuccess,
  entityId,
  initialValues,
  context,
}) => {
  const normalized = useMemo(() => normalizeEntityType(entityType), [entityType]);

  // Enhanced form: Inquiry (create).
  if (normalized === 'inquiry' && mode === 'create') {
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
      entityId={mode === 'edit' ? entityId : undefined}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={(result) => onSuccess?.(result)}
      initialValues={derivedInitialValues}
    />
  );
};

export default EntityFormSurface;
