/**
 * Tests for sequentialEntityCreation utility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEntitiesSequentially,
  getEntityRoute,
  type EntityDraft,
} from './sequentialEntityCreation';

// Mock apiClient
vi.mock('@/services/apiService', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '@/services/apiService';

const mockPost = vi.mocked(apiClient.post);

function makeDraft(overrides: Partial<EntityDraft> = {}): EntityDraft {
  return {
    entity_type: 'contact',
    status: 'proposed',
    existing_id: null,
    proposed_data: { first_name: 'John', last_name: 'Doe' },
    confidence: 0.9,
    source: 'email_parsing',
    originalIndex: 0,
    ...overrides,
  };
}

describe('sequentialEntityCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEntitiesSequentially', () => {
    it('creates a single entity via correct endpoint', async () => {
      mockPost.mockResolvedValueOnce({
        data: { id: 42, first_name: 'John', last_name: 'Doe' },
      });

      const result = await createEntitiesSequentially([
        makeDraft({ entity_type: 'contact', originalIndex: 0 }),
      ]);

      expect(mockPost).toHaveBeenCalledWith('/contacts/', expect.objectContaining({
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
      }));
      expect(result.allSucceeded).toBe(true);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].id).toBe(42);
      expect(result.created[0].label).toBe('John Doe');
    });

    it('skips existing entities and records their ID for FK propagation', async () => {
      const result = await createEntitiesSequentially([
        makeDraft({
          entity_type: 'supplier',
          status: 'exists',
          existing_id: '99',
          originalIndex: 0,
        }),
      ]);

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.allSucceeded).toBe(true);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].id).toBe('99');
    });

    it('propagates foreign keys from earlier entities to later ones', async () => {
      // Contact created first → its ID should propagate to inquiry.contact_id
      mockPost
        .mockResolvedValueOnce({ data: { id: 10, first_name: 'Jane', last_name: 'Smith' } })
        .mockResolvedValueOnce({ data: { id: 55, inquiry_number: 'INQ-2025-00001' } });

      const drafts: EntityDraft[] = [
        makeDraft({
          entity_type: 'contact',
          proposed_data: { first_name: 'Jane', last_name: 'Smith' },
          originalIndex: 0,
        }),
        makeDraft({
          entity_type: 'inquiry',
          proposed_data: { entity_type: 'customer', notes: 'test' },
          originalIndex: 1,
        }),
      ];

      const result = await createEntitiesSequentially(drafts);

      expect(result.allSucceeded).toBe(true);
      expect(result.created).toHaveLength(2);

      // Second call (inquiry) should have contact_id propagated
      const inquiryPayload = mockPost.mock.calls[1][1] as Record<string, unknown>;
      expect(inquiryPayload.contact).toBe(10);
    });

    it('applies default status when not provided', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 1, po_number: 'PO-001' } });

      await createEntitiesSequentially([
        makeDraft({
          entity_type: 'purchase_order',
          proposed_data: { supplier: 5 },
          originalIndex: 0,
        }),
      ]);

      const payload = mockPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.status).toBe('pending');
      expect(payload.order_date).toBeDefined(); // auto-populated
    });

    it('reports errors without stopping other entities', async () => {
      mockPost
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockResolvedValueOnce({ data: { id: 77, name: 'Acme Corp' } });

      const drafts: EntityDraft[] = [
        makeDraft({ entity_type: 'contact', originalIndex: 0 }),
        makeDraft({
          entity_type: 'customer',
          proposed_data: { name: 'Acme Corp' },
          originalIndex: 1,
        }),
      ];

      const result = await createEntitiesSequentially(drafts);

      expect(result.allSucceeded).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].entity_type).toBe('contact');
      expect(result.created).toHaveLength(1);
      expect(result.created[0].entity_type).toBe('customer');
    });

    it('calls progress callback for each step', async () => {
      mockPost
        .mockResolvedValueOnce({ data: { id: 1 } })
        .mockResolvedValueOnce({ data: { id: 2 } });

      const onProgress = vi.fn();

      await createEntitiesSequentially([
        makeDraft({ entity_type: 'contact', originalIndex: 0 }),
        makeDraft({
          entity_type: 'supplier',
          proposed_data: { name: 'Test' },
          originalIndex: 1,
        }),
      ], onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        current: 1,
        total: 2,
        entity_type: 'contact',
      }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        current: 2,
        total: 2,
        entity_type: 'supplier',
      }));
    });

    it('handles unknown entity types gracefully', async () => {
      const result = await createEntitiesSequentially([
        makeDraft({ entity_type: 'unknown_thing', originalIndex: 0 }),
      ]);

      expect(result.allSucceeded).toBe(false);
      expect(result.errors[0].error).toContain('No API endpoint configured');
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('getEntityRoute', () => {
    it('returns correct routes for all entity types', () => {
      expect(getEntityRoute('contact', 1)).toBe('/contacts/1');
      expect(getEntityRoute('supplier', 2)).toBe('/suppliers/2');
      expect(getEntityRoute('customer', 3)).toBe('/customers/3');
      expect(getEntityRoute('plant', 4)).toBe('/plants/4');
      expect(getEntityRoute('inquiry', 5)).toBe('/inquiries/5');
      expect(getEntityRoute('purchase_order', 6)).toBe('/purchase-orders/6');
      expect(getEntityRoute('sales_order', 7)).toBe('/sales-orders/7');
      expect(getEntityRoute('carrier-pos', 8)).toBe('/purchase-orders/8');
      expect(getEntityRoute('invoice', 9)).toBe('/invoices/9');
    });

    it('handles unknown types with a reasonable fallback', () => {
      expect(getEntityRoute('widget', 10)).toBe('/widgets/10');
    });
  });
});
