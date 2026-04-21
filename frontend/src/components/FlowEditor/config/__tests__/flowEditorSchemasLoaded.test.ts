import { describe, expect, it, vi } from 'vitest';

// This test ensures FlowEditor imports always bootstrap schemaRegistry deterministically.
// Without this, the config panel can render fallback schemas on first interaction and never recover.

describe('FlowEditor schema bootstrap', () => {
  it(
    'registers nodeConfigSchemas when FlowEditor is imported',
    { timeout: 20_000 },
    async () => {
      vi.resetModules();

      const { schemaRegistry } = await import('../schemaRegistry');
      schemaRegistry.clear();

      await import('../../index');

      const httpSchema = schemaRegistry.getSchema('actionHTTP');
      expect(String(httpSchema.version)).not.toContain('fallback');
      expect(httpSchema.nodeType).toBe('actionHTTP');
    }
  );
});
