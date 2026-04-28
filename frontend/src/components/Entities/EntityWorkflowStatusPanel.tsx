import React from 'react';
import { Alert, Card, Collapse, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  workformExecutionService,
  type WorkFormExecution,
  type WorkFormExecutionAuditEvent,
} from '@/services/workformExecutionService';
import { useRealTimeEntity } from '@/hooks/useRealTimeEntity';

export interface EntityWorkflowStatusPanelProps {
  entityType: string;
  entityId: string;
}

const formatTimestamp = (raw?: string | null) => {
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
};

const getErrorMessage = (error: unknown) => {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (responseData && typeof responseData === 'object') {
    const detail = (responseData as Record<string, unknown>).detail;
    const errorMessage = (responseData as Record<string, unknown>).error;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof errorMessage === 'string' && errorMessage.trim()) return errorMessage;
  }

  const message = (error as { message?: string })?.message;
  return typeof message === 'string' && message.trim() ? message : 'Failed to load automation status.';
};

export const EntityWorkflowStatusPanel: React.FC<EntityWorkflowStatusPanelProps> = ({ entityType, entityId }) => {
  const navigate = useNavigate();

  useRealTimeEntity(entityType, entityId, {
    queryKeys: [['entity-workflow-status', entityType, entityId]],
    enabled: Boolean(entityType) && Boolean(entityId),
  });

  const query = useQuery({
    queryKey: ['entity-workflow-status', entityType, entityId],
    queryFn: async () =>
      workformExecutionService.getExecutions({
        entity_type: entityType,
        entity_id: entityId,
        page_size: 10,
      }),
    enabled: Boolean(entityType) && Boolean(entityId),
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 5000),
  });

  const executions = query.data?.results ?? [];

  const renderNodeStatuses = (execution: WorkFormExecution) => {
    const map = execution.node_statuses;
    if (!map || typeof map !== 'object') return null;

    const entries = Object.entries(map).filter(([k, v]) => Boolean(k) && Boolean(v));
    if (entries.length === 0) return null;

    const labels = execution.node_labels ?? {};

    entries.sort(([a], [b]) => {
      const la = labels[a] ?? a;
      const lb = labels[b] ?? b;
      return la.localeCompare(lb);
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 600 }}>Step status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {entries.map(([nodeId, status]) => {
            const label = labels[nodeId];
            return (
              <span
                key={`${execution.id}:node:${nodeId}`}
                style={{
                  border: '1px solid rgb(var(--color-border))',
                  background: 'rgb(var(--color-surface))',
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 12,
                  color: 'rgb(var(--color-text-secondary))',
                }}
              >
                {label ? (
                  <>
                    {label}{' '}
                    <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>({nodeId})</span>
                  </>
                ) : (
                  nodeId
                )}
                : <span style={{ fontWeight: 600 }}>{String(status)}</span>
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAudit = (execution: WorkFormExecution) => {
    const trail: WorkFormExecutionAuditEvent[] = Array.isArray(execution.audit_trail) ? execution.audit_trail : [];

    if (trail.length === 0) {
      return <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No step events recorded yet.</div>;
    }

    return (
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {trail.map((raw: WorkFormExecutionAuditEvent, idx: number) => {
          const event = typeof raw?.event === 'string' ? raw.event : 'event';
          const nodeId = typeof raw?.node_id === 'string' ? raw.node_id : null;
          const ts = typeof raw?.ts === 'string' ? raw.ts : null;

          return (
            <li key={`${execution.id}:${idx}`}>
              <span style={{ fontWeight: 600 }}>{event}</span>
              {nodeId ? <span> • node {nodeId}</span> : null}
              {ts ? <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> • {formatTimestamp(ts)}</span> : null}
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card size="small" title="WorkForm runs">
        {query.isLoading ? (
          <div style={{ padding: 12 }}>
            <Spin />
          </div>
        ) : query.isError ? (
          <Alert
            type="error"
            showIcon
            title={getErrorMessage(query.error)}
          />
        ) : executions.length === 0 ? (
          <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No WorkForm runs found for this record.</div>
        ) : (
          <Collapse
            items={executions.map((ex) => ({
              key: ex.id,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>{ex.workform_name}</span>
                  <span style={{ color: 'rgb(var(--color-text-secondary))' }}>{ex.status}</span>
                </div>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: 'rgb(var(--color-text-secondary))' }}>
                    {ex.started_at ? <span>Started: {formatTimestamp(ex.started_at)}</span> : null}
                    {ex.completed_at ? <span>Completed: {formatTimestamp(ex.completed_at)}</span> : null}
                    {ex.started_by_name ? <span>By: {ex.started_by_name}</span> : null}
                  </div>

                  {ex.error_message ? (
                    <div style={{ color: 'rgb(var(--color-error))' }}>{ex.error_message}</div>
                  ) : null}

                  <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Current step:{' '}
                    <span style={{ fontWeight: 600 }}>{ex.current_node_label ?? ex.current_node_id ?? '—'}</span>
                    {ex.current_node_label && ex.current_node_id ? (
                      <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> ({ex.current_node_id})</span>
                    ) : null}
                    {ex.current_node_type ? <span> • {ex.current_node_type}</span> : null}
                  </div>

                  {ex.errors && ex.errors.length > 0 ? (
                    <div style={{ color: 'rgb(var(--color-error))' }}>
                      {ex.errors.length} error{ex.errors.length === 1 ? '' : 's'}
                    </div>
                  ) : null}

                  {renderNodeStatuses(ex)}

                  <div>{renderAudit(ex)}</div>

                  <div>
                    <button
                      type="button"
                      onClick={() => navigate(`/workforms/executions/${ex.id}`)}
                      style={{
                        border: '1px solid rgb(var(--color-border))',
                        background: 'rgb(var(--color-surface))',
                        padding: '6px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      View execution details
                    </button>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
};

export default EntityWorkflowStatusPanel;
