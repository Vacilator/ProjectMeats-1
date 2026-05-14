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

  it('does not duplicate Suppliers or Customers as "All X" children', () => {
    const suppliers = navigation.find((item) => item.label === 'Suppliers');
    const customers = navigation.find((item) => item.label === 'Customers');

    const supplierChildLabels = suppliers?.children?.map((c) => c.label) ?? [];
    const customerChildLabels = customers?.children?.map((c) => c.label) ?? [];

    expect(supplierChildLabels).not.toContain('All Suppliers');
    expect(customerChildLabels).not.toContain('All Customers');
  });

  it('groups supplier sub-pages under Suppliers', () => {
    const suppliers = navigation.find((item) => item.label === 'Suppliers');
    const childPaths = suppliers?.children?.map((item) => item.path);

    expect(childPaths).toContain('/suppliers/plants');
    expect(childPaths).toContain('/suppliers/contacts');
  });

  it('groups customer sub-pages under Customers', () => {
    const customers = navigation.find((item) => item.label === 'Customers');
    const childPaths = customers?.children?.map((item) => item.path);

    expect(childPaths).toContain('/customers/locations');
    expect(childPaths).toContain('/customers/contacts');
  });
});
