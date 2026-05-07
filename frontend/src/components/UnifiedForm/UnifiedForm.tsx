import React, { useCallback, useMemo } from 'react';

import {
  EntityFormSurface,
  type EntityFormContext,
  type EntityFormSurfaceVariant,
} from '@/components/Shared/EntityFormSurface';
import { getStableSignature, normalizeEntityKey } from '@/components/Shared/UniversalEntityForm';
import { useLocalStorageDraft } from '@/hooks/useLocalStorageDraft';
import { getValidTenantId } from '@/utils/tenantId';

export type UnifiedFormMode = 'create' | 'edit' | 'view' | 'clone' | 'draft';

export interface UnifiedFormProps {
  entityType: string;
  mode: UnifiedFormMode;
  variant?: EntityFormSurfaceVariant;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: unknown) => void;
  entityId?: string | number;
  initialValues?: Record<string, unknown>;
  context?: EntityFormContext;
  draftKey?: string;
  autosave?: boolean;
}

const AUTOSAVE_ENTITY_KEYS = new Set(['inquiries.inquiry', 'purchase_order']);
const DRAFT_ELIGIBLE_MODES = new Set<UnifiedFormMode>(['create', 'edit', 'clone', 'draft']);

export const UnifiedForm: React.FC<UnifiedFormProps> = ({
  entityType,
  mode,
  variant = 'modal',
  isOpen,
  onClose,
  onSuccess,
  entityId,
  initialValues,
  context,
  draftKey,
  autosave,
}) => {
  const normalizedEntityKey = useMemo(() => normalizeEntityKey(entityType), [entityType]);
  const baseInitialValues = useMemo(() => initialValues ?? {}, [initialValues]);
  const shouldAutosave = useMemo(() => {
    if (typeof autosave === 'boolean') {
      return autosave;
    }

    return isOpen && DRAFT_ELIGIBLE_MODES.has(mode) && AUTOSAVE_ENTITY_KEYS.has(normalizedEntityKey);
  }, [autosave, isOpen, mode, normalizedEntityKey]);

  const storageKey = useMemo(() => {
    const tenantId = getValidTenantId() ?? 'global';
    const keySuffix =
      draftKey ||
      getStableSignature({
        entityId: entityId == null ? 'new' : String(entityId),
        context: context ?? null,
        seed: baseInitialValues,
      });

    return [
      'unified-form-draft',
      tenantId,
      normalizedEntityKey,
      entityId == null ? 'new' : String(entityId),
      keySuffix,
    ].join('::');
  }, [baseInitialValues, context, draftKey, entityId, normalizedEntityKey]);

  const { hydratedInitialValues, persistDraft, clearDraft } = useLocalStorageDraft({
    storageKey,
    baseValues: baseInitialValues,
    enabled: shouldAutosave,
    delay: 30000,
  });

  const surfaceMode = mode === 'draft' ? 'create' : mode;
  const forceUniversal = mode === 'draft';

  const handleSuccess = useCallback(
    (result: unknown) => {
      clearDraft();
      onSuccess?.(result);
    },
    [clearDraft, onSuccess],
  );

  return (
    <EntityFormSurface
      entityType={entityType}
      mode={surfaceMode}
      variant={variant}
      forceUniversal={forceUniversal}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={handleSuccess}
      entityId={entityId}
      initialValues={hydratedInitialValues}
      context={context}
      onValuesChange={shouldAutosave ? persistDraft : undefined}
    />
  );
};

export default UnifiedForm;
