import type { FieldMapping } from '../ConfigPanel/FieldMappingPanel';

export type LegacyAutoMapping = {
  id?: string;
  targetFieldName?: string;
  sourceNodeId?: string;
  sourceFieldName?: string;
  mode?: string;
  autoPopulate?: boolean;
};

function isLegacyAutoMapping(
  value: any
): value is LegacyAutoMapping & {
  targetFieldName: string;
  sourceNodeId: string;
  sourceFieldName: string;
} {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.targetFieldName === 'string' &&
    typeof value.sourceNodeId === 'string' &&
    typeof value.sourceFieldName === 'string'
  );
}

/**
 * Normalize various stored mapping shapes into the canonical FieldMappingPanel shape.
 *
 * This is intentionally additive/backwards compatible: older workflows might store
 * AutoMappingService suggestions directly under `fieldMappings`.
 */
export function normalizeFieldMappings(input: unknown): FieldMapping[] {
  if (!Array.isArray(input)) return [];

  return (input as any[]).map((m) => {
    if (isLegacyAutoMapping(m)) {
      const formFieldId = String((m as any).formFieldId ?? `${m.sourceNodeId}.${m.sourceFieldName}`);
      return {
        id: String(m.id ?? `${m.sourceNodeId}_${m.sourceFieldName}_${m.targetFieldName}`),
        formFieldId,
        entityField: String(m.targetFieldName),
        transformation: { type: 'direct' },
        autoPopulate: {
          sourceStep: String(m.sourceNodeId),
          sourceField: String(m.sourceFieldName),
          mode: 'copy',
        },
      } satisfies FieldMapping;
    }

    // Assume already canonical; callers still need to validate at runtime.
    return m as FieldMapping;
  });
}
