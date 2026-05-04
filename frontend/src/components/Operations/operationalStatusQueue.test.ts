import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  flushOperationalStatusQueue,
  getQueuedOperationalStatus,
  readOperationalStatusQueue,
  upsertOperationalStatusQueueItem,
} from './operationalStatusQueue';

describe('operationalStatusQueue', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('deduplicates queued transitions per entity', () => {
    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '42',
      nextStatus: 'in_transit',
      queuedAt: '2026-05-04T00:00:00.000Z',
    });

    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '42',
      nextStatus: 'delivered',
      queuedAt: '2026-05-04T00:01:00.000Z',
    });

    expect(readOperationalStatusQueue(tenantId)).toEqual([
      expect.objectContaining({
        entityType: 'carrier_purchase_order',
        entityId: '42',
        nextStatus: 'delivered',
      }),
    ]);
  });

  it('replays successful queued transitions and clears them', async () => {
    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '42',
      nextStatus: 'delivered',
      queuedAt: '2026-05-04T00:00:00.000Z',
    });

    const processItem = vi.fn().mockResolvedValue(undefined);

    await flushOperationalStatusQueue({
      tenantId,
      processItem,
      isRetriableError: () => false,
    });

    expect(processItem).toHaveBeenCalledOnce();
    expect(readOperationalStatusQueue(tenantId)).toEqual([]);
  });

  it('preserves queued transitions for retriable replay failures', async () => {
    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '42',
      nextStatus: 'delivered',
      queuedAt: '2026-05-04T00:00:00.000Z',
    });

    const retryableError = new Error('Network error');
    const processItem = vi.fn().mockRejectedValue(retryableError);

    await flushOperationalStatusQueue({
      tenantId,
      processItem,
      isRetriableError: (error) => error === retryableError,
    });

    expect(getQueuedOperationalStatus(tenantId, 'carrier_purchase_order', '42')).toEqual(
      expect.objectContaining({
        nextStatus: 'delivered',
      }),
    );
  });

  it('continues replaying later items after a retriable failure', async () => {
    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '41',
      nextStatus: 'picked_up',
      queuedAt: '2026-05-04T00:00:00.000Z',
    });
    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '42',
      nextStatus: 'in_transit',
      queuedAt: '2026-05-04T00:01:00.000Z',
    });
    upsertOperationalStatusQueueItem({
      tenantId,
      entityType: 'carrier_purchase_order',
      entityId: '43',
      nextStatus: 'delivered',
      queuedAt: '2026-05-04T00:02:00.000Z',
    });

    const retryableError = new Error('Network timeout');
    const processItem = vi.fn(async (item) => {
      if (item.entityId === '42') {
        throw retryableError;
      }
    });

    await flushOperationalStatusQueue({
      tenantId,
      processItem,
      isRetriableError: (error) => error === retryableError,
    });

    expect(processItem).toHaveBeenCalledTimes(3);
    expect(getQueuedOperationalStatus(tenantId, 'carrier_purchase_order', '41')).toBeNull();
    expect(getQueuedOperationalStatus(tenantId, 'carrier_purchase_order', '42')).toEqual(
      expect.objectContaining({ nextStatus: 'in_transit' })
    );
    expect(getQueuedOperationalStatus(tenantId, 'carrier_purchase_order', '43')).toBeNull();
  });
});
