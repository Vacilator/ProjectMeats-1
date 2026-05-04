import React, { useEffect, useState } from 'react';

import { Typography } from 'antd';

import {
  isOperationalOfflineQueueEnabled,
  OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY,
} from '@/components/Operations/operationalOfflineMode';
import { OperationalDocumentActions } from '@/components/Operations/OperationalDocumentActions';
import {
  OPERATIONAL_STATUS_QUEUE_EVENT,
  readOperationalStatusQueue,
} from '@/components/Operations/operationalStatusQueue';
import { ConnectivityProvider } from '@/contexts/ConnectivityContext';
import { businessApi } from '@/services/businessApi';

const { Paragraph, Text, Title } = Typography;
const SMOKE_TENANT_ID = 'operational-smoke-tenant';

type OperationalStatusSmokeState = {
  currentStatus: string;
  failNextTransition: boolean;
};

declare global {
  interface Window {
    __PM_OPERATIONAL_SMOKE__?: OperationalStatusSmokeState;
  }
}

const getSmokeState = (): OperationalStatusSmokeState => {
  if (!window.__PM_OPERATIONAL_SMOKE__) {
    window.__PM_OPERATIONAL_SMOKE__ = {
      currentStatus: 'processing',
      failNextTransition: false,
    };
  }

  return window.__PM_OPERATIONAL_SMOKE__;
};

const buildWorkflowPayload = (currentStatus: string) => ({
  current_status: currentStatus,
  allowed_transitions: currentStatus === 'processing' ? ['delivered'] : [],
  statuses: [
    { value: 'processing', label: 'Processing' },
    { value: 'delivered', label: 'Delivered' },
  ],
});

export const OperationalStatusReplaySmoke: React.FC = () => {
  const [tenantId] = useState<string>(() => {
    const existingTenantId = window.localStorage.getItem('tenantId') || SMOKE_TENANT_ID;
    if (!window.localStorage.getItem('tenantId')) {
      window.localStorage.setItem('tenantId', existingTenantId);
    }
    return existingTenantId;
  });
  const [optimisticStatus, setOptimisticStatus] = useState<string>('processing');
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const refreshQueueCount = () => {
      setQueuedCount(readOperationalStatusQueue(tenantId).length);
    };

    refreshQueueCount();

    const handleQueueEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ tenantId?: string }>).detail;
      if (detail?.tenantId && detail.tenantId !== tenantId) {
        return;
      }
      refreshQueueCount();
    };

    window.addEventListener(OPERATIONAL_STATUS_QUEUE_EVENT, handleQueueEvent);
    window.addEventListener('storage', handleQueueEvent);

    return () => {
      window.removeEventListener(OPERATIONAL_STATUS_QUEUE_EVENT, handleQueueEvent);
      window.removeEventListener('storage', handleQueueEvent);
    };
  }, [tenantId]);

  useEffect(() => {
    const smokeState = getSmokeState();
    smokeState.currentStatus = 'processing';
    smokeState.failNextTransition = false;

    const originalGet = businessApi.get.bind(businessApi);
    const originalPost = businessApi.post.bind(businessApi);
    type BusinessApiGetConfig = Parameters<typeof businessApi.get>[1];
    type BusinessApiPostPayload = Parameters<typeof businessApi.post>[1];
    type BusinessApiPostConfig = Parameters<typeof businessApi.post>[2];

    businessApi.get = (async (url: string, config?: BusinessApiGetConfig) => {
      if (typeof url === 'string' && url.includes('/status-workflow/')) {
        return {
          data: buildWorkflowPayload(getSmokeState().currentStatus),
          headers: {},
        };
      }

      return originalGet(url, config);
    }) as typeof businessApi.get;

    businessApi.post = (async (
      url: string,
      payload?: BusinessApiPostPayload,
      config?: BusinessApiPostConfig,
    ) => {
      if (typeof url === 'string' && url.includes('/transition-status/')) {
        const nextSmokeState = getSmokeState();
        if (nextSmokeState.failNextTransition) {
          nextSmokeState.failNextTransition = false;
          throw new Error('Network error');
        }

        const nextStatus =
          typeof (payload as { status?: unknown } | undefined)?.status === 'string'
            ? String((payload as { status: string }).status)
            : nextSmokeState.currentStatus;

        nextSmokeState.currentStatus = nextStatus;

        return {
          data: { status: nextStatus },
          headers: {},
        };
      }

      return originalPost(url, payload, config);
    }) as typeof businessApi.post;

    return () => {
      businessApi.get = originalGet;
      businessApi.post = originalPost;
    };
  }, []);

  return (
    <ConnectivityProvider>
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '24px 16px 48px',
        }}
      >
        <Title level={2} data-testid="operational-status-smoke-title">
          Operational status replay smoke
        </Title>
        <Paragraph style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Browser-level harness for freight-status optimistic queueing, reconnect replay, and the
          emergency offline-mode guard.
        </Paragraph>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <Text data-testid="operational-status-smoke-tenant">Tenant: {tenantId}</Text>
          <Text data-testid="operational-status-smoke-offline-enabled">
            Offline queue enabled: {isOperationalOfflineQueueEnabled() ? 'yes' : 'no'}
          </Text>
          <Text data-testid="operational-status-smoke-disable-key">
            Local guard key: {OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY}
          </Text>
          <Text data-testid="operational-status-smoke-optimistic-status">
            Last optimistic status: {optimisticStatus}
          </Text>
          <Text data-testid="operational-status-smoke-queue-count">
            Queued transitions: {queuedCount}
          </Text>
        </div>

        <OperationalDocumentActions
          entityType="carrier_purchase_order"
          entityId="42"
          recordLabel="Carrier PO #42"
          onOptimisticStatusChange={setOptimisticStatus}
        />
      </div>
    </ConnectivityProvider>
  );
};

export default OperationalStatusReplaySmoke;
