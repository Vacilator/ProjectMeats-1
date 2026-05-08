import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Collapse, Modal, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const UnifiedFlowEditor = lazy(() => import('@/components/FlowEditor/UnifiedFlowEditor').then(m => ({ default: m.UnifiedFlowEditor })));
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
      <StatusColumn>
        <SectionLabel>Step status</SectionLabel>
        <NodeBadgeRow>
          {entries.map(([nodeId, status]) => {
            const label = labels[nodeId];
            return (
              <NodeBadge
                key={`${execution.id}:node:${nodeId}`}
              >
                {label ? (
                  <>
                    {label}{' '}
                    <TertiarySpan>({nodeId})</TertiarySpan>
                  </>
                ) : (
                  nodeId
                )}
                : <BoldSpan>{String(status)}</BoldSpan>
              </NodeBadge>
            );
          })}
        </NodeBadgeRow>
      </StatusColumn>
    );
  };

  const renderAudit = (execution: WorkFormExecution) => {
    const trail: WorkFormExecutionAuditEvent[] = Array.isArray(execution.audit_trail)
      ? execution.audit_trail
      : [];

    if (trail.length === 0) {
      return (
        <TertiaryText>
          No step events recorded yet.
        </TertiaryText>
      );
    }

    return (
      <AuditList>
        {trail.map((raw: WorkFormExecutionAuditEvent, idx: number) => {
          const event = typeof raw?.event === 'string' ? raw.event : 'event';
          const nodeId = typeof raw?.node_id === 'string' ? raw.node_id : null;
          const ts = typeof raw?.ts === 'string' ? raw.ts : null;

          return (
            <li key={`${execution.id}:${idx}`}>
              <BoldSpan>{event}</BoldSpan>
              {nodeId ? <span> • node {nodeId}</span> : null}
              {ts ? (
                <TertiarySpan>
                  {' '}
                  • {formatTimestamp(ts)}
                </TertiarySpan>
              ) : null}
            </li>
          );
        })}
      </AuditList>
    );
  };

  const workflowDefinition = flowQuery.data?.workflow_definition;
  const flowNodes = Array.isArray(workflowDefinition?.nodes) ? workflowDefinition.nodes : [];
  const flowEdges = Array.isArray(workflowDefinition?.edges) ? workflowDefinition.edges : [];

  return (
    <PanelStack>
      <Card size="small" title="WorkForm runs">
        {query.isLoading ? (
          <LoadingWrapper>
            <Spin />
          </LoadingWrapper>
        ) : query.isError ? (
          <Alert type="error" showIcon title={getErrorMessage(query.error)} />
        ) : executions.length === 0 ? (
          <TertiaryText>
            No WorkForm runs found for this record.
          </TertiaryText>
        ) : (
          <Collapse
            items={executions.map((execution) => ({
              key: execution.id,
              label: (
                <CollapseHeader>
                  <BoldSpan>{execution.workform_name}</BoldSpan>
                  <SecondarySpan>{execution.status}</SecondarySpan>
                </CollapseHeader>
              ),
              children: (
                <ExecutionContent>
                  <MetaRow>
                    {execution.started_at ? <span>Started: {formatTimestamp(execution.started_at)}</span> : null}
                    {execution.completed_at ? <span>Completed: {formatTimestamp(execution.completed_at)}</span> : null}
                    {execution.started_by_name ? <span>By: {execution.started_by_name}</span> : null}
                  </MetaRow>

                  {execution.error_message ? (
                    <ErrorText>{execution.error_message}</ErrorText>
                  ) : null}

                  <SecondaryText>
                    Current step:{' '}
                    <BoldSpan>
                      {execution.current_node_label ?? execution.current_node_id ?? '—'}
                    </BoldSpan>
                    {execution.current_node_label && execution.current_node_id ? (
                      <TertiarySpan>
                        {' '}
                        ({execution.current_node_id})
                      </TertiarySpan>
                    ) : null}
                    {execution.current_node_type ? <span> • {execution.current_node_type}</span> : null}
                  </SecondaryText>

                  {execution.errors && execution.errors.length > 0 ? (
                    <ErrorText>
                      {execution.errors.length} error{execution.errors.length === 1 ? '' : 's'}
                    </ErrorText>
                  ) : null}

                  {renderNodeStatuses(execution)}

                  <div>{renderAudit(execution)}</div>

                  <ActionRow>
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
                  </ActionRow>
                </ExecutionContent>
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
          <ModalLoading>
            <Spin />
          </ModalLoading>
        ) : flowQuery.isError ? (
          <Alert type="error" showIcon message="Failed to load workflow definition." />
        ) : flowNodes.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="This execution does not expose a saved flow definition yet."
          />
        ) : (
          <FlowGrid>
            <TextBlock execution={selectedExecution} />
            <FlowEditorWrapper>
              <Suspense fallback={<Spin />}>
                <UnifiedFlowEditor
                  readOnly
                  initialNodes={flowNodes as any}
                  initialEdges={flowEdges as any}
                />
              </Suspense>
            </FlowEditorWrapper>
          </FlowGrid>
        )}
      </Modal>
    </PanelStack>
  );
};

const TextBlock: React.FC<{ execution: WorkFormExecution | null }> = ({ execution }) => {
  if (!execution) {
    return null;
  }

  return (
    <SecondaryText>
      Viewing the canonical process flow for this record. Current step:{' '}
      <strong>{execution.current_node_label ?? execution.current_node_id ?? '—'}</strong>
      {execution.current_node_type ? ` • ${execution.current_node_type}` : ''}
    </SecondaryText>
  );
};

export default EntityWorkflowStatusPanel;

/* ─── Styled Components ─── */

const PanelStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LoadingWrapper = styled.div`
  padding: 12px;
`;

const StatusColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SectionLabel = styled.div`
  font-weight: 600;
`;

const NodeBadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const NodeBadge = styled.span`
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const BoldSpan = styled.span`
  font-weight: 600;
`;

const TertiarySpan = styled.span`
  color: rgb(var(--color-text-tertiary));
`;

const TertiaryText = styled.div`
  color: rgb(var(--color-text-tertiary));
`;

const SecondarySpan = styled.span`
  color: rgb(var(--color-text-secondary));
`;

const SecondaryText = styled.div`
  color: rgb(var(--color-text-secondary));
`;

const ErrorText = styled.div`
  color: rgb(var(--color-error));
`;

const AuditList = styled.ol`
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CollapseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
`;

const ExecutionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: rgb(var(--color-text-secondary));
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ModalLoading = styled.div`
  padding: 16px;
  text-align: center;
`;

const FlowGrid = styled.div`
  display: grid;
  gap: 12px;
`;

const FlowEditorWrapper = styled.div`
  min-height: 540px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  overflow: hidden;
`;
