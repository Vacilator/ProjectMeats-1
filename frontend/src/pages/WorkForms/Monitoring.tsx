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
import ProcessMonitor from '../Cockpit/ProcessMonitor';

export const Monitoring: React.FC = () => {
  const activeExecutionsQuery = useQuery({
    queryKey: ['workform-executions', 'active'],
    queryFn: async () => workformExecutionService.getExecutions({ status: 'pending,in_progress', page_size: 25 }),
    refetchInterval: 5000,
  });

  const active = activeExecutionsQuery.data?.results ?? [];

  return (
    <ErrorBoundary>
      <PageContainer title="Monitoring">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
