import { getDocumentEntityConfig, supportsOptimisticOperationalStatus } from './documentOperations';

export interface OperationalStatusQueueItem {
  tenantId: string;
  entityType: string;
  entityId: string;
  nextStatus: string;
  queuedAt: string;
}

export interface FlushOperationalStatusQueueOptions {
  tenantId: string;
  processItem: (item: OperationalStatusQueueItem) => Promise<void>;
  isRetriableError: (error: unknown) => boolean;
}

const QUEUE_STORAGE_PREFIX = 'projectmeats.operational-status-queue.v1';
export const OPERATIONAL_STATUS_QUEUE_EVENT = 'pm:operational-status-queue';

const activeFlushes = new Map<string, Promise<void>>();

const getQueueStorageKey = (tenantId: string) => `${QUEUE_STORAGE_PREFIX}:${tenantId}`;

const isOperationalStatusQueueItem = (value: unknown): value is OperationalStatusQueueItem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tenantId === 'string' &&
    typeof candidate.entityType === 'string' &&
    typeof candidate.entityId === 'string' &&
    typeof candidate.nextStatus === 'string' &&
    typeof candidate.queuedAt === 'string'
  );
};

const emitQueueChange = (tenantId: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(OPERATIONAL_STATUS_QUEUE_EVENT, {
      detail: { tenantId },
    }),
  );
};

export const readOperationalStatusQueue = (tenantId: string): OperationalStatusQueueItem[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getQueueStorageKey(tenantId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isOperationalStatusQueueItem);
  } catch {
    return [];
  }
};

const writeOperationalStatusQueue = (tenantId: string, items: OperationalStatusQueueItem[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getQueueStorageKey(tenantId);

  if (items.length === 0) {
    window.localStorage.removeItem(storageKey);
  } else {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }

  emitQueueChange(tenantId);
};

export const getQueuedOperationalStatus = (
  tenantId: string,
  entityType: string,
  entityId: string | number,
): OperationalStatusQueueItem | null => {
  const normalizedEntityId = String(entityId);
  const normalizedEntityType = getDocumentEntityConfig(entityType)?.entityType ?? entityType;

  return (
    readOperationalStatusQueue(tenantId).find(
      (item) => item.entityType === normalizedEntityType && item.entityId === normalizedEntityId,
    ) ?? null
  );
};

export const upsertOperationalStatusQueueItem = (item: OperationalStatusQueueItem) => {
  const queue = readOperationalStatusQueue(item.tenantId);
  const nextQueue = queue.filter(
    (queued) => !(queued.entityType === item.entityType && queued.entityId === item.entityId),
  );

  nextQueue.push(item);
  writeOperationalStatusQueue(item.tenantId, nextQueue);
};

export const removeOperationalStatusQueueItem = (
  tenantId: string,
  entityType: string,
  entityId: string,
) => {
  const queue = readOperationalStatusQueue(tenantId);
  const nextQueue = queue.filter(
    (item) => !(item.entityType === entityType && item.entityId === entityId),
  );

  writeOperationalStatusQueue(tenantId, nextQueue);
};

export const flushOperationalStatusQueue = async ({
  tenantId,
  processItem,
  isRetriableError,
}: FlushOperationalStatusQueueOptions): Promise<void> => {
  const activeFlush = activeFlushes.get(tenantId);
  if (activeFlush) {
    return activeFlush;
  }

  const flushPromise = (async () => {
    const queue = readOperationalStatusQueue(tenantId);

    for (const item of queue) {
      if (!supportsOptimisticOperationalStatus(item.entityType)) {
        removeOperationalStatusQueueItem(tenantId, item.entityType, item.entityId);
        continue;
      }

      try {
        await processItem(item);
        removeOperationalStatusQueueItem(tenantId, item.entityType, item.entityId);
      } catch (error) {
        if (isRetriableError(error)) {
          continue;
        }

        // Hard failures should not loop forever; drop the queued item and let the live surface refetch.
        removeOperationalStatusQueueItem(tenantId, item.entityType, item.entityId);
      }
    }
  })();

  activeFlushes.set(tenantId, flushPromise);

  try {
    await flushPromise;
  } finally {
    activeFlushes.delete(tenantId);
  }
};
