import { describe, expect, it } from 'vitest';

import {
  getDocumentEntityConfig,
  supportsAuditHistory,
  supportsOperationalActions,
} from './documentOperations';

describe('documentOperations', () => {
  it('maps freight-order aliases to the carrier-po endpoint', () => {
    const config = getDocumentEntityConfig('freight-orders');

    expect(config).not.toBeNull();
    expect(config?.entityType).toBe('carrier_purchase_order');
    expect(config?.endpoint).toBe('carrier-pos');
    expect(config?.auditEntityType).toBe('CarrierPurchaseOrder');
  });

  it('exposes operational actions for transactional documents only', () => {
    expect(supportsOperationalActions('purchase_order')).toBe(true);
    expect(supportsOperationalActions('invoice')).toBe(true);
    expect(supportsOperationalActions('carrier')).toBe(false);
  });

  it('exposes audit history for tracked carrier and document entities', () => {
    expect(supportsAuditHistory('carrier')).toBe(true);
    expect(supportsAuditHistory('sales-orders')).toBe(true);
    expect(supportsAuditHistory('unknown')).toBe(false);
  });
});
