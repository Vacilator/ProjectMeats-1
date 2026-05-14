import { describe, expect, it } from 'vitest';

import { navigation } from './navigation';

describe('navigation', () => {
  it('exposes Workspace as the top-level entry with no legacy hubs', () => {
    const topLevelLabels = navigation.map((item) => item.label);

    expect(topLevelLabels).toContain('Workspace');
    expect(topLevelLabels).not.toContain('Command Center');
    expect(topLevelLabels).not.toContain('Cockpit');
  });

  it('groups order-related pages under Orders', () => {
    const orders = navigation.find((item) => item.label === 'Orders');
    const childPaths = orders?.children?.map((item) => item.path);

    expect(childPaths).toContain('/inquiries');
    expect(childPaths).toContain('/fulfillments');
    expect(childPaths).toContain('/purchase-orders');
    expect(childPaths).toContain('/sales-orders');
  });
});
