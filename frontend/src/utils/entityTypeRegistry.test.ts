import { describe, it, expect } from 'vitest';
import {
  normalizeEntityType,
  entityTypeDisplayName,
  entityListPath,
  entityRecordPath,
} from './entityTypeRegistry';

describe('entityTypeRegistry', () => {
  describe('normalizeEntityType', () => {
    it('normalizes plural to singular', () => {
      expect(normalizeEntityType('inquiries')).toBe('inquiry');
      expect(normalizeEntityType('customers')).toBe('customer');
      expect(normalizeEntityType('suppliers')).toBe('supplier');
    });

    it('normalizes carrier variants', () => {
      expect(normalizeEntityType('carrier_purchase_order')).toBe('carrier-pos');
      expect(normalizeEntityType('carrier-purchase-order')).toBe('carrier-pos');
      expect(normalizeEntityType('carrier-pos')).toBe('carrier-pos');
    });

    it('handles purchase order variants', () => {
      expect(normalizeEntityType('purchase_order')).toBe('purchase_order');
      expect(normalizeEntityType('purchase-orders')).toBe('purchase_order');
      expect(normalizeEntityType('purchase_orders')).toBe('purchase_order');
    });

    it('returns unknown types lowercased', () => {
      expect(normalizeEntityType('UnknownEntity')).toBe('unknownentity');
    });
  });

  describe('entityTypeDisplayName', () => {
    it('returns human-friendly names', () => {
      expect(entityTypeDisplayName('inquiry')).toBe('Inquiry');
      expect(entityTypeDisplayName('purchase_order')).toBe('Purchase Order');
      expect(entityTypeDisplayName('carrier-pos')).toBe('Carrier PO');
      expect(entityTypeDisplayName('sales_order')).toBe('Sales Order');
    });

    it('capitalizes unknown types', () => {
      expect(entityTypeDisplayName('custom_thing')).toBe('Custom Thing');
    });
  });

  describe('entityListPath', () => {
    it('resolves all known entity types to list routes', () => {
      expect(entityListPath('inquiry')).toBe('/inquiries');
      expect(entityListPath('supplier')).toBe('/suppliers');
      expect(entityListPath('customer')).toBe('/customers');
      expect(entityListPath('contact')).toBe('/contacts');
      expect(entityListPath('plant')).toBe('/suppliers/plants');
      expect(entityListPath('location')).toBe('/customers/locations');
      expect(entityListPath('purchase_order')).toBe('/purchase-orders');
      expect(entityListPath('sales_order')).toBe('/sales-orders');
      expect(entityListPath('carrier-pos')).toBe('/purchase-orders');
      expect(entityListPath('invoice')).toBe('/accounting/receivables/invoices');
      expect(entityListPath('carrier')).toBe('/carriers');
    });

    it('handles raw aliases (unnormalized input)', () => {
      expect(entityListPath('supplier_purchase_order')).toBe('/purchase-orders');
      expect(entityListPath('carrier_purchase_order')).toBe('/purchase-orders');
    });

    it('returns null for unknown types', () => {
      expect(entityListPath('unknown_thing')).toBeNull();
      expect(entityListPath('')).toBeNull();
    });
  });

  describe('entityRecordPath', () => {
    it('builds universal record path', () => {
      expect(entityRecordPath('inquiry', '42')).toBe('/records/inquiry/42');
      expect(entityRecordPath('Suppliers', '7')).toBe('/records/supplier/7');
    });
  });
});
