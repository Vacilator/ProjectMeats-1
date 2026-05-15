import React, { useMemo } from 'react';
import { Alert, Empty, Spin, Timeline, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

import { getDocumentEntityConfig } from './documentOperations';

const { Text } = Typography;

type AuditEvent = {
  id: string;
  action: string;
  entity_name?: string | null;
  changed_fields?: string[] | null;
  snapshot_before?: Record<string, unknown> | null;
  snapshot_after?: Record<string, unknown> | null;
  actor_email?: string | null;
  created_at?: string | null;
};

interface AuditHistoryTimelineProps {
  entityType: string;
  entityId: string | number;
  maxItems?: number;
}

const formatTimestamp = (raw?: string | null): string => {
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString();
};

const describeChange = (event: AuditEvent): string => {
  const fields = Array.isArray(event.changed_fields) ? event.changed_fields.filter(Boolean) : [];
  if (!fields.length) {
    return event.action === 'created'
      ? 'Created record'
      : event.action === 'deleted'
        ? 'Deleted record'
        : 'Updated record';
  }
  return `${event.action === 'updated' ? 'Updated' : 'Changed'} ${fields.join(', ')}`;
};

export const AuditHistoryTimeline: React.FC<AuditHistoryTimelineProps> = ({
  entityType,
  entityId,
  maxItems = 20,
}) => {
  const config = useMemo(() => getDocumentEntityConfig(entityType), [entityType]);

  const query = useQuery({
    queryKey: withTenantQueryKey('audit-history', config?.auditEntityType ?? entityType, String(entityId), maxItems),
    queryFn: async () => {
      try {
        const response = await businessApi.get('/audit-events/', {
          params: {
            entity_type: config?.auditEntityType,
            object_id: entityId,
            page_size: maxItems,
          },
        });
        const payload = response.data;
        if (Array.isArray(payload)) {
          return payload as AuditEvent[];
        }
        const results = (payload as { results?: AuditEvent[] } | null)?.results;
        return Array.isArray(results) ? results : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(config?.auditEntityType) && Boolean(entityId),
    staleTime: 30 * 1000,
  });

  if (!config) {
    return (
      <Alert
        type="info"
        showIcon
        message="Audit history is not available for this record type yet."
      />
    );
  }

  if (query.isLoading) {
    return (
      <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load audit history."
      />
    );
  }

  const events = query.data ?? [];
  if (!events.length) {
    return <Empty description="No audit history recorded yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Timeline
      items={events.map((event) => ({
        key: event.id,
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text strong>{describeChange(event)}</Text>
            <Text type="secondary">
              {(event.actor_email || 'System')} {formatTimestamp(event.created_at)}
            </Text>
            {event.entity_name ? (
              <Text type="secondary">{event.entity_name}</Text>
            ) : null}
          </div>
        ),
      }))}
    />
  );
};

export default AuditHistoryTimeline;
