import { describe, expect, it } from 'vitest';

import { schemaRegistry } from '../schemaRegistry';

describe('schemaRegistry server metadata overlay', () => {
  it('normalizes node types via server aliases', () => {
    schemaRegistry.setServerRegistry({
      aliases: {
        actionNotification: 'actionNotify',
      },
      nodes: {
        actionNotify: { label: 'Notify', category: 'action' },
      },
    });

    expect(schemaRegistry.normalizeNodeType('actionNotification')).toBe('actionNotify');
    const schema = schemaRegistry.getSchema('actionNotification');
    expect(schema.nodeType).toBe('actionNotify');

    // cleanup
    schemaRegistry.setServerRegistry(null);
  });
});
