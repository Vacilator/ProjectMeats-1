import { describe, it, expect } from 'vitest';

import { schemaRegistry } from '../schemaRegistry';

// Side-effect: registers all schemas into the singleton registry.
import '../nodeConfigSchemas';

describe('schemaRegistry action schemas', () => {
  it('registers actionHTTP schema (no fallback)', () => {
    const schema = schemaRegistry.getSchema('actionHTTP');

    const fieldIds = new Set(
      schema.sections.flatMap((s) => (s.fields ?? []).map((f) => f.id)),
    );

    // Fallback schemas only include name/description/notes.
    expect(fieldIds.has('url')).toBe(true);
    expect(fieldIds.has('method')).toBe(true);
  });

  it('registers CRUD action schemas with entity + mapping fields', () => {
    const createSchema = schemaRegistry.getSchema('actionCreateRecord');
    const updateSchema = schemaRegistry.getSchema('actionUpdateRecord');

    const createFieldIds = new Set(createSchema.sections.flatMap((s) => s.fields.map((f) => f.id)));
    const updateFieldIds = new Set(updateSchema.sections.flatMap((s) => s.fields.map((f) => f.id)));

    expect(createFieldIds.has('entityType')).toBe(true);
    expect(createFieldIds.has('fieldMappings')).toBe(true);

    expect(updateFieldIds.has('entityType')).toBe(true);
    expect(updateFieldIds.has('recordId')).toBe(true);
    expect(updateFieldIds.has('fieldMappings')).toBe(true);
  });

  it('keeps documentGenerate template field usable (no stuck loading select)', () => {
    const schema = schemaRegistry.getSchema('documentGenerate');
    const templateField = schema.sections
      .flatMap((s) => s.fields ?? [])
      .find((f) => f.id === 'templateId');

    expect(templateField).toBeDefined();
    expect((templateField as any).type).toBe('text');
  });
});
