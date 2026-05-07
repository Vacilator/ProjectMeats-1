import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Collapse, Modal, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import { UnifiedFlowEditor } from '@/components/FlowEditor/UnifiedFlowEditor';
import {
  workformExecutionService,
  type WorkFormExecution,
  type WorkFormExecutionAuditEvent,
} from '@/services/workformExecutionService';
import { getTenantWorkForm } from '@/services/workformsApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

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
  return typeof message === 'string' && message.trim()
    ? message
    : 'Failed to load automation status.';
};

const pickPreferredExecution = (
  executions: WorkFormExecution[],
  requestedExecutionId: string | null,
): WorkFormExecution | null => {
  if (!executions.length) {
    return null;
  }

  if (requestedExecutionId) {
    const exact = executions.find((execution) => execution.id === requestedExecutionId);
    if (exact) {
      return exact;
    }
  }

  return (
    executions.find((execution) => ['pending', 'in_progress'].includes(execution.status)) ||
    executions[0]
  );
};

export const EntityWorkflowStatusPanel: React.FC<EntityWorkflowStatusPanelProps> = ({
  entityType,
  entityId,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = searchParams.get('tab');
  const shouldAutoOpenFlow = searchParams.get('viewProcessFlow') === '1';
  const requestedExecutionId = searchParams.get('executionId');
  const [selectedExecution, setSelectedExecution] = useState<WorkFormExecution | null>(null);

  const queryOptions = useMemo(
    () => ({
      queryKey: withTenantQueryKey('entity-workflow-status', entityType, entityId),
      queryFn: async () =>
        workformExecutionService.getExecutions({
          entity_type: entityType,
          entity_id: entityId,
          page_size: 10,
        }),
      enabled: Boolean(entityType) && Boolean(entityId),
      retry: false,
      refetchInterval: (query: { state: { error: unknown } }) => (query.state.error ? false : 5000),
    }),
    [entityId, entityType],
  );

  const query = useQuery(queryOptions);
  const executions = useMemo(
    () => query.data?.results ?? [],
    [query.data?.results],
  );

  useEffect(() => {
    if (!shouldAutoOpenFlow || activeTab !== 'workflows' || selectedExecution || executions.length === 0) {
      return;
    }

    const nextExecution = pickPreferredExecution(executions, requestedExecutionId);
    if (nextExecution) {
      setSelectedExecution(nextExecution);
    }
  }, [activeTab, executions, requestedExecutionId, selectedExecution, shouldAutoOpenFlow]);

  const flowQuery = useQuery({
    queryKey: withTenantQueryKey(
      'entity-workflow-flow-definition',
      selectedExecution?.workform ?? 'none',
    ),
    enabled: Boolean(selectedExecution?.workform),
    queryFn: async () => getTenantWorkForm(String(selectedExecution!.workform)),
    staleTime: 60_000,
  });

  const clearFlowSearchParams = useCallback(() => {
    const next = new URLSearchParams(location.search);
    next.delete('executionId');
    next.delete('viewProcessFlow');
    navigate(
      {
        pathname: location.pathname,
        search: next.toString() ? `?${next.toString()}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const closeProcessFlow = useCallback(() => {
    setSelectedExecution(null);
    if (shouldAutoOpenFlow || requestedExecutionId) {
      clearFlowSearchParams();
    }
  }, [clearFlowSearchParams, requestedExecutionId, shouldAutoOpenFlow]);

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
    const trail: WorkFormExecutionAuditEvent[] = Array.isArray(execution.audit_trail)
      ? execution.audit_trail
      : [];

    if (trail.length === 0) {
      return (
        <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>
          No step events recorded yet.
        </div>
      );
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
              {ts ? (
                <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                  {' '}
                  • {formatTimestamp(ts)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  };

  const workflowDefinition = flowQuery.data?.workflow_definition;
  const flowNodes = Array.isArray(workflowDefinition?.nodes) ? workflowDefinition.nodes : [];
  const flowEdges = Array.isArray(workflowDefinition?.edges) ? workflowDefinition.edges : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card size="small" title="WorkForm runs">
        {query.isLoading ? (
          <div style={{ padding: 12 }}>
            <Spin />
          </div>
        ) : query.isError ? (
          <Alert type="error" showIcon title={getErrorMessage(query.error)} />
        ) : executions.length === 0 ? (
          <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            No WorkForm runs found for this record.
          </div>
        ) : (
          <Collapse
            items={executions.map((execution) => ({
              key: execution.id,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>{execution.workform_name}</span>
                  <span style={{ color: 'rgb(var(--color-text-secondary))' }}>{execution.status}</span>
                </div>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: 'rgb(var(--color-text-secondary))' }}>
                    {execution.started_at ? <span>Started: {formatTimestamp(execution.started_at)}</span> : null}
                    {execution.completed_at ? <span>Completed: {formatTimestamp(execution.completed_at)}</span> : null}
                    {execution.started_by_name ? <span>By: {execution.started_by_name}</span> : null}
                  </div>

                  {execution.error_message ? (
                    <div style={{ color: 'rgb(var(--color-error))' }}>{execution.error_message}</div>
                  ) : null}

                  <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Current step:{' '}
                    <span style={{ fontWeight: 600 }}>
                      {execution.current_node_label ?? execution.current_node_id ?? '—'}
                    </span>
                    {execution.current_node_label && execution.current_node_id ? (
                      <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                        {' '}
                        ({execution.current_node_id})
                      </span>
                    ) : null}
                    {execution.current_node_type ? <span> • {execution.current_node_type}</span> : null}
                  </div>

                  {execution.errors && execution.errors.length > 0 ? (
                    <div style={{ color: 'rgb(var(--color-error))' }}>
                      {execution.errors.length} error{execution.errors.length === 1 ? '' : 's'}
                    </div>
                  ) : null}

                  {renderNodeStatuses(execution)}

                  <div>{renderAudit(execution)}</div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      onClick={() => navigate(`/workforms/executions/${execution.id}`)}
                    >
                      View execution details
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => setSelectedExecution(execution)}
                    >
                      View Process Flow
                    </Button>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedExecution)}
        onCancel={closeProcessFlow}
        footer={null}
        title={selectedExecution ? `${selectedExecution.workform_name} — Process Flow` : 'Process Flow'}
        width={1200}
        destroyOnHidden
      >
        {flowQuery.isLoading ? (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : flowQuery.isError ? (
          <Alert type="error" showIcon message="Failed to load workflow definition." />
        ) : flowNodes.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="This execution does not expose a saved flow definition yet."
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <TextBlock execution={selectedExecution} />
            <div style={{ minHeight: 540, border: '1px solid rgb(var(--color-border))', borderRadius: 12, overflow: 'hidden' }}>
              <UnifiedFlowEditor
                readOnly
                initialNodes={flowNodes as any}
                initialEdges={flowEdges as any}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const TextBlock: React.FC<{ execution: WorkFormExecution | null }> = ({ execution }) => {
  if (!execution) {
    return null;
  }

  return (
    <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
      Viewing the canonical process flow for this record. Current step:{' '}
      <strong>{execution.current_node_label ?? execution.current_node_id ?? '—'}</strong>
      {execution.current_node_type ? ` • ${execution.current_node_type}` : ''}
    </div>
  );
};

export default EntityWorkflowStatusPanel;
