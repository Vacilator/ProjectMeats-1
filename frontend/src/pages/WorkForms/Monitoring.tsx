/**
 * WorkForms Monitoring (alias)
 *
 * We intentionally reuse the Cockpit ProcessMonitor implementation to avoid
 * duplicating monitoring logic in multiple places.
 *
 * Route stability:
 * - WorkForms tab keeps using /workforms/monitoring
 * - Cockpit also exposes /cockpit/process-monitor
 */

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { workformExecutionService } from '@/services/workformExecutionService';
import { withTenantQueryKey } from '@/utils/queryKeys';
import ProcessMonitor from '../Cockpit/ProcessMonitor';

const formatDuration = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
};

export const Monitoring: React.FC = () => {
  const analyticsQuery = useQuery({
    queryKey: withTenantQueryKey('workform-executions', 'analytics'),
    queryFn: async () => workformExecutionService.getAnalytics({ days: 30, limit: 5 }),
    refetchInterval: 15000,
  });

  const activeExecutionsQuery = useQuery({
    queryKey: withTenantQueryKey('workform-executions', 'active'),
    queryFn: async () => workformExecutionService.getExecutions({ status: 'pending,in_progress', page_size: 25 }),
    refetchInterval: 5000,
  });

  const active = activeExecutionsQuery.data?.results ?? [];
  const summary = analyticsQuery.data?.summary;
  const topWorkforms = analyticsQuery.data?.top_workforms ?? [];
  const topFailedNodes = analyticsQuery.data?.top_failed_nodes ?? [];
  const slowestActions = analyticsQuery.data?.slowest_actions ?? [];

  return (
    <ErrorBoundary>
      <PageContainer title="Monitoring">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Execution Analytics</div>
                <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 14, marginTop: 4 }}>
                  Telemetry-backed summary for the last 30 days.
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  void analyticsQuery.refetch();
                  void activeExecutionsQuery.refetch();
                }}
                disabled={analyticsQuery.isFetching || activeExecutionsQuery.isFetching}
              >
                Refresh
              </Button>
            </div>

            {analyticsQuery.isLoading ? (
              <div style={{ marginTop: 12 }}>Loading analytics…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                  }}
                >
                  {[
                    { label: 'Total runs', value: String(summary?.total_runs ?? 0) },
                    { label: 'Active runs', value: String(summary?.active_runs ?? 0) },
                    { label: 'Completed', value: String(summary?.completed_runs ?? 0) },
                    { label: 'Failed', value: String(summary?.failed_runs ?? 0) },
                    { label: 'Success rate', value: `${summary?.success_rate ?? 0}%` },
                    { label: 'Avg duration', value: formatDuration(summary?.avg_duration_ms) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        border: '1px solid rgb(var(--color-border))',
                        borderRadius: 12,
                        padding: 12,
                        background: 'rgb(var(--color-surface))',
                      }}
                    >
                      <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 12 }}>{item.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Top WorkForms</div>
                    {topWorkforms.length === 0 ? (
                      <div style={{ color: 'rgb(var(--color-text-secondary))' }}>No runs in the selected window.</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {topWorkforms.map((row) => (
                          <li key={row.workform_id}>
                            <strong>{row.workform_name}</strong> — {row.total_runs} runs, {row.success_rate}% success
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div
                    style={{
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Top failed steps</div>
                    {topFailedNodes.length === 0 ? (
                      <div style={{ color: 'rgb(var(--color-text-secondary))' }}>No failed steps recorded.</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {topFailedNodes.map((row) => (
                          <li key={`${row.workform_id}:${row.node_id}:failed`}>
                            <strong>{row.node_label ?? row.node_id}</strong> — {row.failure_count} failures
                            <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 12 }}>
                              {row.workform_name}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div
                    style={{
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Slowest actions</div>
                    {slowestActions.length === 0 ? (
                      <div style={{ color: 'rgb(var(--color-text-secondary))' }}>No completed action timings yet.</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {slowestActions.map((row) => (
                          <li key={`${row.workform_id}:${row.node_id}:slow`}>
                            <strong>{row.node_label ?? row.node_id}</strong> — {formatDuration(row.avg_duration_ms)}
                            <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 12 }}>
                              {row.workform_name} • {row.sample_count} sample(s)
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>Active WorkForm Executions</div>
              <Button
                variant="secondary"
                onClick={() => activeExecutionsQuery.refetch()}
                disabled={activeExecutionsQuery.isFetching}
              >
                Refresh
              </Button>
            </div>

            {activeExecutionsQuery.isLoading ? (
              <div style={{ marginTop: 12 }}>Loading…</div>
            ) : active.length === 0 ? (
              <div style={{ marginTop: 12, color: 'rgb(var(--color-text-secondary))' }}>No active executions.</div>
            ) : (
              <ul style={{ marginTop: 12, paddingLeft: 18 }}>
                {active.map((ex) => (
                  <li key={ex.id}>
                    <Link to={`/workforms/executions/${ex.id}`}>
                      {ex.workform_name} — {ex.status}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Legacy monitor (FormSubmission-based) */}
          <ProcessMonitor />
        </div>
      </PageContainer>
    </ErrorBoundary>
  );
};

export default Monitoring;
