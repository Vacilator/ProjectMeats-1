import React from 'react';
import { Card, Collapse, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { workformExecutionService, type WorkFormExecution } from '@/services/workformExecutionService';

export interface EntityWorkflowStatusPanelProps {
  entityType: string;
  entityId: string;
}

const formatTimestamp = (raw?: string | null) => {
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
};

export const EntityWorkflowStatusPanel: React.FC<EntityWorkflowStatusPanelProps> = ({ entityType, entityId }) => {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['entity-workflow-status', entityType, entityId],
    queryFn: async () =>
      workformExecutionService.getExecutions({
        entity_type: entityType,
        entity_id: entityId,
        page_size: 10,
      }),
    enabled: Boolean(entityType) && Boolean(entityId),
    refetchInterval: 5000,
  });

  const executions = query.data?.results ?? [];

  const renderNodeStatuses = (execution: WorkFormExecution) => {
    const map = execution.node_statuses;
    if (!map || typeof map !== 'object') return null;

    const entries = Object.entries(map).filter(([k, v]) => Boolean(k) && Boolean(v));
    if (entries.length === 0) return null;

    entries.sort(([a], [b]) => a.localeCompare(b));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 600 }}>Step status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {entries.map(([nodeId, status]) => (
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
              {nodeId}: <span style={{ fontWeight: 600 }}>{String(status)}</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderAudit = (execution: WorkFormExecution) => {
    const trail = Array.isArray(execution.audit_trail) ? execution.audit_trail : [];

    if (trail.length === 0) {
      return <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No step events recorded yet.</div>;
    }

    return (
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {trail.map((row: any, idx: number) => (
          <li key={`${execution.id}:${idx}`}>
            <span style={{ fontWeight: 600 }}>{String(row?.event ?? 'event')}</span>
            {row?.node_id ? <span> • node {String(row.node_id)}</span> : null}
            {row?.ts ? (
              <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> • {formatTimestamp(String(row.ts))}</span>
            ) : null}
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card size="small" title="WorkForm executions">
        {query.isLoading ? (
          <div style={{ padding: 12 }}>
            <Spin />
          </div>
        ) : executions.length === 0 ? (
          <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No workflow executions found for this record.</div>
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
