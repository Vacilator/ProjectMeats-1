/**
 * WorkForms Monitoring
 *
 * WorkForms Monitoring is the canonical execution drill-in surface.
 * Command Center owns queue triage and action-required operator work.
 */

import React, { useCallback, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { workformExecutionService } from '@/services/workformExecutionService';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const formatDuration = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
};

export const Monitoring: React.FC = () => {
  useDocumentTitle('WorkForms Monitoring');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const analyticsQueryKey = useMemo(
    () => withTenantQueryKey('workform-executions', 'analytics'),
    [],
  );
  const activeExecutionsQueryKey = useMemo(
    () => withTenantQueryKey('workform-executions', 'active'),
    [],
  );
  const analyticsQuery = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: async () => workformExecutionService.getAnalytics({ days: 30, limit: 5 }),
    refetchInterval: 15000,
  });

  const activeExecutionsQuery = useQuery({
    queryKey: activeExecutionsQueryKey,
    queryFn: async () => workformExecutionService.getExecutions({ status: 'pending,in_progress', page_size: 25 }),
    refetchInterval: 5000,
  });

  const active = activeExecutionsQuery.data?.results ?? [];
  const summary = analyticsQuery.data?.summary;
  const topWorkforms = analyticsQuery.data?.top_workforms ?? [];
  const topFailedNodes = analyticsQuery.data?.top_failed_nodes ?? [];
  const slowestActions = analyticsQuery.data?.slowest_actions ?? [];
  const activeExecutionCount = active.length;

  const handleOpenCommandCenter = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleOpenWorkFormsHistory = useCallback(() => {
    navigate('/workforms/history');
  }, [navigate]);

  const handleOpenWorkFormsCatalog = useCallback(() => {
    navigate('/workforms/catalog');
  }, [navigate]);

  const handleRefreshMonitoring = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: analyticsQueryKey });
    void queryClient.invalidateQueries({ queryKey: activeExecutionsQueryKey });
  }, [activeExecutionsQueryKey, analyticsQueryKey, queryClient]);

  const handleRefreshActiveExecutions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: activeExecutionsQueryKey });
  }, [activeExecutionsQueryKey, queryClient]);

  return (
    <ErrorBoundary>
      <PageContainer title="WorkForms Monitoring">
        <PageStack>
          <Card padding="lg">
            <SectionHeader>
              <div>
                <SectionTitle>Execution drill-in</SectionTitle>
                <SectionSubtitle>
                  Command Center owns action-required triage. Use WorkForms Monitoring
                  for execution analytics, active runs, failure hotspots, and
                  submission-level follow-through.
                </SectionSubtitle>
                <ExecutionSummaryRow>
                  <ExecutionSummaryItem>
                    <strong>{summary?.active_runs ?? activeExecutionCount}</strong> active runs
                  </ExecutionSummaryItem>
                  <ExecutionSummaryItem>
                    <strong>{topFailedNodes.length}</strong> recent failure hotspots
                  </ExecutionSummaryItem>
                  <ExecutionSummaryItem>
                    <strong>{slowestActions.length}</strong> slow-step diagnostics
                  </ExecutionSummaryItem>
                </ExecutionSummaryRow>
              </div>
              <ActionButtonGroup>
                <Button variant="secondary" onClick={handleOpenCommandCenter}>
                  Home
                </Button>
                <Button variant="secondary" onClick={handleOpenWorkFormsHistory}>
                  View WorkForms History
                </Button>
              </ActionButtonGroup>
            </SectionHeader>
          </Card>

          <Card padding="lg">
            <SectionHeader>
              <div>
                <SectionTitle>Execution Analytics</SectionTitle>
                <SectionSubtitle>
                  Telemetry-backed summary for the last 30 days.
                </SectionSubtitle>
              </div>
              <Button
                variant="secondary"
                onClick={handleRefreshMonitoring}
                disabled={analyticsQuery.isFetching || activeExecutionsQuery.isFetching}
              >
                Refresh
              </Button>
            </SectionHeader>

            {analyticsQuery.isLoading ? (
              <LoadingText>Loading analytics…</LoadingText>
            ) : analyticsQuery.isError ? (
              <ErrorBox>
                <p>Failed to load analytics.</p>
                <Button variant="secondary" onClick={() => void analyticsQuery.refetch()}>
                  Retry
                </Button>
              </ErrorBox>
            ) : (
              <AnalyticsContent>
                <MetricGrid>
                  {[
                    { label: 'Total runs', value: String(summary?.total_runs ?? 0) },
                    { label: 'Active runs', value: String(summary?.active_runs ?? 0) },
                    { label: 'Completed', value: String(summary?.completed_runs ?? 0) },
                    { label: 'Failed', value: String(summary?.failed_runs ?? 0) },
                    { label: 'Success rate', value: `${summary?.success_rate ?? 0}%` },
                    { label: 'Avg duration', value: formatDuration(summary?.avg_duration_ms) },
                  ].map((item) => (
                    <MetricCard key={item.label}>
                      <MetricLabel>{item.label}</MetricLabel>
                      <MetricValue>{item.value}</MetricValue>
                    </MetricCard>
                  ))}
                </MetricGrid>

                <DetailGrid>
                  <DetailPanel>
                    <PanelTitle>Top WorkForms</PanelTitle>
                    {topWorkforms.length === 0 ? (
                      <SecondaryText>No runs in the selected window.</SecondaryText>
                    ) : (
                      <DetailList>
                        {topWorkforms.map((row) => (
                          <li key={row.workform_id}>
                            <strong>{row.workform_name}</strong> — {row.total_runs} runs, {row.success_rate}% success
                          </li>
                        ))}
                      </DetailList>
                    )}
                  </DetailPanel>

                  <DetailPanel>
                    <PanelTitle>Top failed steps</PanelTitle>
                    {topFailedNodes.length === 0 ? (
                      <SecondaryText>No failed steps recorded.</SecondaryText>
                    ) : (
                      <DetailList>
                        {topFailedNodes.map((row) => (
                          <li key={`${row.workform_id}:${row.node_id}:failed`}>
                            <strong>{row.node_label ?? row.node_id}</strong> — {row.failure_count} failures
                            <DetailMeta>
                              {row.workform_name}
                            </DetailMeta>
                          </li>
                        ))}
                      </DetailList>
                    )}
                  </DetailPanel>

                  <DetailPanel>
                    <PanelTitle>Slowest actions</PanelTitle>
                    {slowestActions.length === 0 ? (
                      <SecondaryText>No completed action timings yet.</SecondaryText>
                    ) : (
                      <DetailList>
                        {slowestActions.map((row) => (
                          <li key={`${row.workform_id}:${row.node_id}:slow`}>
                            <strong>{row.node_label ?? row.node_id}</strong> — {formatDuration(row.avg_duration_ms)}
                            <DetailMeta>
                              {row.workform_name} • {row.sample_count} sample(s)
                            </DetailMeta>
                          </li>
                        ))}
                      </DetailList>
                    )}
                  </DetailPanel>
                </DetailGrid>
              </AnalyticsContent>
            )}
          </Card>

          <Card padding="lg">
            <SectionHeader>
              <SectionTitle>Active WorkForm Executions</SectionTitle>
              <Button
                variant="secondary"
                onClick={handleRefreshActiveExecutions}
                disabled={activeExecutionsQuery.isFetching}
              >
                Refresh
              </Button>
            </SectionHeader>

            {activeExecutionsQuery.isLoading ? (
              <LoadingText>Loading…</LoadingText>
            ) : active.length === 0 ? (
              <EmptyStateStack>
                <EmptyStateText>No active executions.</EmptyStateText>
                <Button variant="secondary" onClick={handleOpenWorkFormsCatalog}>
                  Open WorkForms Catalog
                </Button>
              </EmptyStateStack>
            ) : (
              <ExecutionList>
                {active.map((ex) => (
                  <li key={ex.id}>
                    <Link to={`/workforms/executions/${ex.id}`}>
                      {ex.workform_name} — {ex.status}
                    </Link>
                  </li>
                ))}
              </ExecutionList>
            )}
          </Card>
        </PageStack>
      </PageContainer>
    </ErrorBoundary>
  );
};

export default Monitoring;

const PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const ActionButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.div`
  font-weight: 700;
`;

const SectionSubtitle = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  margin-top: 4px;
`;

const ExecutionSummaryRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
`;

const ExecutionSummaryItem = styled.div`
  border-radius: 999px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  padding: 6px 10px;

  strong {
    color: rgb(var(--color-text-primary));
  }
`;

const LoadingText = styled.div`
  margin-top: 12px;
`;

const ErrorBox = styled.div`
  margin-top: 12px;
  padding: 16px;
  border-radius: 8px;
  background: rgba(var(--color-error), 0.06);
  color: rgb(var(--color-error));
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AnalyticsContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
`;

const MetricCard = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 12px;
  background: rgb(var(--color-surface));
`;

const MetricLabel = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const MetricValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  margin-top: 6px;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
`;

const DetailPanel = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 12px;
`;

const PanelTitle = styled.div`
  font-weight: 600;
  margin-bottom: 8px;
`;

const SecondaryText = styled.div`
  color: rgb(var(--color-text-secondary));
`;

const DetailList = styled.ul`
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DetailMeta = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const EmptyStateText = styled.div`
  color: rgb(var(--color-text-secondary));
`;

const EmptyStateStack = styled.div`
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
`;

const ExecutionList = styled.ul`
  margin-top: 12px;
  padding-left: 18px;
`;
