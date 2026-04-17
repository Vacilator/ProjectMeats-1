/**
 * WorkForm Execution Details
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { workformExecutionService } from '@/services/workformExecutionService';

export const WorkFormExecutionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['workform-execution', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing execution id');
      return workformExecutionService.getExecution(id);
    },
    enabled: !!id,
  });

  const execution = query.data;

  return (
    <PageContainer title="Workflow Execution">
      <Card padding="lg">
        {query.isLoading ? (
          <div>Loading execution…</div>
        ) : query.isError || !execution ? (
          <div>Execution not found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{execution.workform_name}</div>
                <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                  Status: <span style={{ fontWeight: 600 }}>{execution.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => navigate('/workforms/history')}>
                  View History
                </Button>
                <Button variant="secondary" onClick={() => navigate('/workforms/catalog')}>
                  Back to Catalog
                </Button>
              </div>
            </div>

            {execution.error_message ? (
              <div style={{ color: 'rgb(var(--color-error))' }}>{execution.error_message}</div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {execution.node_statuses && Object.keys(execution.node_statuses).length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Step status</div>
                  <pre
                    style={{
                      background: 'rgb(var(--color-surface))',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 8,
                      padding: 12,
                      overflow: 'auto',
                      maxHeight: 240,
                    }}
                  >
                    {JSON.stringify(execution.node_statuses, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Context</div>
                <pre
                  style={{
                    background: 'rgb(var(--color-surface))',
                    border: '1px solid rgb(var(--color-border))',
                    borderRadius: 8,
                    padding: 12,
                    overflow: 'auto',
                    maxHeight: 360,
                  }}
                >
                  {JSON.stringify(execution.context_data ?? {}, null, 2)}
                </pre>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Audit Trail</div>
                {Array.isArray(execution.audit_trail) && execution.audit_trail.length > 0 ? (
                  <pre
                    style={{
                      background: 'rgb(var(--color-surface))',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 8,
                      padding: 12,
                      overflow: 'auto',
                      maxHeight: 360,
                    }}
                  >
                    {JSON.stringify(execution.audit_trail, null, 2)}
                  </pre>
                ) : (
                  <div style={{ color: 'rgb(var(--color-text-secondary))' }}>No audit entries yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
};

export default WorkFormExecutionDetails;
