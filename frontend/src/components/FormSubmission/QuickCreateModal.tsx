/**
 * QuickCreateModal
 *
 * Consolidated creation surface for records spawned from within form submissions.
 *
 * IMPORTANT:
 * - Uses EntityFormSurface → UniversalEntityForm so creation stays schema-driven and consistent.
 * - Keeps the existing QuickCreateModal prop contract so callers don’t need refactors.
 */

import React, { useMemo } from 'react';

import { EntityFormSurface } from '../Shared/EntityFormSurface';
import type { EntityFormContext } from '../Shared/EntityFormSurface';

interface QuickCreateModalProps {
  entityType: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (entity: { value: string; label: string }) => void;
  /** Render as inline panel content (no modal shell). */
  inline?: boolean;
  /** Optional initial values for context-aware prefill (e.g., customer/supplier FK). */
  initialValues?: Record<string, unknown>;
  /** Context data used to pre-populate and hide fields (e.g., raw UUIDs from Cockpit). */
  contextData?: Record<string, unknown>;
}

const coerceEntityOption = (entityType: string, result: unknown): { value: string; label: string } | null => {
  if (!result || typeof result !== 'object') return null;

  const rec = result as Record<string, unknown>;
  const id = rec.id ?? rec.pk;
  if (id == null) return null;

  const label = String(
    rec.display_name ??
      rec.effective_name ??
      rec.name ??
      rec.title ??
      rec.label ??
      `${entityType} ${String(id)}`
  );

  return { value: String(id), label };
};

const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  entityType,
  isOpen,
  onClose,
  onCreated,
  inline = false,
  initialValues,
  contextData,
}) => {
  const mergedContext = useMemo(
    () => ({ ...(initialValues || {}), ...(contextData || {}) }),
    [initialValues, contextData]
  );

  const surfaceContext: EntityFormContext | undefined = useMemo(() => {
    const asId = (value: unknown): string | number | undefined =>
      typeof value === 'string' || typeof value === 'number' ? value : undefined;

    const customerId = asId(mergedContext.customerId ?? mergedContext.customer);
    const supplierId = asId(mergedContext.supplierId ?? mergedContext.supplier);
    const contactId = asId(mergedContext.contactId ?? mergedContext.contact);
    const sourceCallId = asId(mergedContext.sourceCallId);

    const ctx: EntityFormContext = {
      ...(customerId != null ? { customerId } : {}),
      ...(supplierId != null ? { supplierId } : {}),
      ...(contactId != null ? { contactId } : {}),
      ...(sourceCallId != null ? { sourceCallId } : {}),
    };

    return Object.keys(ctx).length ? ctx : undefined;
  }, [mergedContext]);

  if (!isOpen || !entityType) return null;

  return (
    <EntityFormSurface
      entityType={entityType}
      mode="create"
      variant={inline ? 'inline' : 'modal'}
      isOpen={isOpen}
      onClose={onClose}
      context={surfaceContext}
      initialValues={mergedContext}
      onSuccess={(created) => {
        const option = coerceEntityOption(entityType, created);
        if (!option) {
          onClose();
          return;
        }

        onClose();
        onCreated(option);
      }}
    />
  );
};

export default QuickCreateModal;
