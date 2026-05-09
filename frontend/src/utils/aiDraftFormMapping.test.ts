import { describe, it, expect } from 'vitest';
import {
  resolveDraftEntityType,
  mapDraftToInitialValues,
  HIDDEN_FORM_FIELDS,
} from './aiDraftFormMapping';

describe('resolveDraftEntityType', () => {
  it('returns inquiry for inquiry document_type', () => {
    expect(resolveDraftEntityType({ document_type: 'inquiry' })).toBe('inquiry');
  });

  it('resolves purchase_order aliases', () => {
    expect(resolveDraftEntityType({ document_type: 'PO' })).toBe('purchase_order');
    expect(resolveDraftEntityType({ document_type: 'purchase_order' })).toBe('purchase_order');
  });

  it('resolves sales_order aliases', () => {
    expect(resolveDraftEntityType({ document_type: 'SO' })).toBe('sales_order');
    expect(resolveDraftEntityType({ document_type: 'sales_order' })).toBe('sales_order');
    expect(resolveDraftEntityType({ document_type: 'sales order' })).toBe('sales_order');
  });

  it('resolves contact', () => {
    expect(resolveDraftEntityType({ document_type: 'contact' })).toBe('contact');
  });

  it('resolves carrier-pos', () => {
    expect(resolveDraftEntityType({ document_type: 'carrier-pos' })).toBe('carrier-pos');
  });

  it('infers entity type from payload when document_type is missing', () => {
    expect(
      resolveDraftEntityType({
        original_extracted_data: { supplier_name: 'Acme' },
      } as any),
    ).toBe('');
    // payload-based inference checks specific keys
    expect(
      resolveDraftEntityType({
        original_extracted_data: { order_number: 'PO-123' },
      } as any),
    ).toBe('purchase_order');
    expect(
      resolveDraftEntityType({
        original_extracted_data: { first_name: 'John', last_name: 'Doe' },
      } as any),
    ).toBe('contact');
  });

  it('returns empty string for completely unknown payloads', () => {
    expect(resolveDraftEntityType({})).toBe('');
  });
});

describe('mapDraftToInitialValues', () => {
  const makeItem = (docType: string, data: Record<string, unknown> = {}) =>
    ({ document_type: docType, original_extracted_data: data } as any);

  it('sets status=draft for inquiry', () => {
    const result = mapDraftToInitialValues(makeItem('inquiry', { entity_type: 'customer' }));
    expect(result.status).toBe('draft');
    expect(result.entity_type).toBe('customer');
  });

  it('defaults inquiry entity_type to customer when missing', () => {
    const result = mapDraftToInitialValues(makeItem('inquiry', {}));
    expect(result.entity_type).toBe('customer');
  });

  it('sets status=draft for purchase_order', () => {
    const result = mapDraftToInitialValues(makeItem('PO', { order_date: '2025-01-01' }));
    expect(result.status).toBe('draft');
    expect(result.order_date).toBe('2025-01-01');
  });

  it('defaults order_date to today for purchase_order when missing', () => {
    const result = mapDraftToInitialValues(makeItem('PO', {}));
    expect(result.order_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sets status=draft for sales_order', () => {
    const result = mapDraftToInitialValues(makeItem('SO', {}));
    expect(result.status).toBe('draft');
  });

  it('sets status=draft for carrier-pos', () => {
    const result = mapDraftToInitialValues(makeItem('carrier-pos', {}));
    expect(result.status).toBe('draft');
  });

  it('defaults contact first_name and last_name when missing', () => {
    const result = mapDraftToInitialValues(makeItem('contact', {}));
    expect(result.first_name).toBe('Unknown');
    expect(result.last_name).toBe('Contact');
  });

  it('uses provided contact name when available', () => {
    const result = mapDraftToInitialValues(
      makeItem('contact', { first_name: 'Jane', last_name: 'Doe' }),
    );
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Doe');
  });

  it('defaults customer name when missing', () => {
    const result = mapDraftToInitialValues(makeItem('customer', {}));
    expect(result.name).toBe('New Customer');
  });

  it('sets status=active for customer', () => {
    const result = mapDraftToInitialValues(makeItem('customer', {}));
    expect(result.status).toBe('active');
  });

  it('defaults supplier name when missing', () => {
    const result = mapDraftToInitialValues(makeItem('supplier', {}));
    expect(result.name).toBe('New Supplier');
  });

  it('sets status=active for supplier', () => {
    const result = mapDraftToInitialValues(makeItem('supplier', {}));
    expect(result.status).toBe('active');
  });

  it('sets status=active for contact', () => {
    const result = mapDraftToInitialValues(makeItem('contact', {}));
    expect(result.status).toBe('active');
  });

  it('sets status=draft as fallback for unknown entity types', () => {
    const result = mapDraftToInitialValues(makeItem('', { some: 'data' }));
    expect(result.status).toBe('draft');
    expect(result.some).toBe('data');
  });
});

describe('HIDDEN_FORM_FIELDS', () => {
  it('includes status', () => {
    expect(HIDDEN_FORM_FIELDS.has('status')).toBe(true);
  });

  it('includes tenant fields', () => {
    expect(HIDDEN_FORM_FIELDS.has('tenant')).toBe(true);
    expect(HIDDEN_FORM_FIELDS.has('tenant_id')).toBe(true);
  });

  it('includes timestamp fields', () => {
    expect(HIDDEN_FORM_FIELDS.has('created_at')).toBe(true);
    expect(HIDDEN_FORM_FIELDS.has('updated_at')).toBe(true);
  });
});
