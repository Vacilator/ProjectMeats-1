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
import { formSubmissionService } from '@/services/quickActionsService';

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
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.status as string | undefined;
      return status === 'pending' || status === 'in_progress' ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const execution = query.data;

  const submissionId = React.useMemo(() => {
    const initial = execution?.initial_data;
    if (!initial || typeof initial !== 'object') return null;

    const rec = initial as Record<string, unknown>;
    const raw = (rec.submission_id ?? rec.form_submission_id) as unknown;
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }, [execution]);

  const submissionQuery = useQuery({
    queryKey: ['form-submission', submissionId],
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission id');
      return formSubmissionService.get(submissionId);
    },
    enabled: Boolean(submissionId),
    retry: false,
  });

  return (
    <PageContainer title="WorkForm Run">
      <Card padding="lg">
        {query.isLoading ? (
          <div>Loading run…</div>
        ) : query.isError || !execution ? (
          <div>Run not found.</div>
        ) : (
          <div data-testid="workform-execution-details-page" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div data-testid="workform-execution-name" style={{ fontWeight: 700, fontSize: 16 }}>
                  {execution.workform_name}
                </div>
                <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                  Status:{' '}
                  <span data-testid="workform-execution-status" style={{ fontWeight: 600 }}>
                    {execution.status}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  data-testid="workform-execution-refresh"
                  variant="secondary"
                  onClick={() => void query.refetch()}
                >
                  Refresh
                </Button>
                <Button variant="secondary" onClick={() => navigate('/workforms/history')}>
                  View History
                </Button>
                <Button variant="secondary" onClick={() => navigate('/workforms/catalog')}>
                  Back to Catalog
                </Button>
              </div>
            </div>

            {execution.error_message ? (
              <div data-testid="workform-execution-error-message" style={{ color: 'rgb(var(--color-error))' }}>
                {execution.error_message}
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div data-testid="workform-execution-current-step">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Current step</div>
                {execution.current_node_id ? (
                  <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Node:{' '}
                    <span style={{ fontWeight: 600 }}>
                      {execution.current_node_label ?? execution.current_node_id}
                    </span>
                    {execution.current_node_label ? (
                      <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> ({execution.current_node_id})</span>
                    ) : null}
                    {execution.current_node_type ? <span> • {execution.current_node_type}</span> : null}
                    {execution.last_event ? <span> • last: {execution.last_event}</span> : null}
                  </div>
                ) : (
                  <div style={{ color: 'rgb(var(--color-text-secondary))' }}>No active node recorded.</div>
                )}
              </div>

              {execution.errors && execution.errors.length > 0 ? (
                <div data-testid="workform-execution-errors">
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Errors</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {execution.errors.map((e, idx) => (
                      <li key={`${execution.id}:err:${idx}`} style={{ color: 'rgb(var(--color-error))' }}>
                        {e.node_label || e.node_id ? (
                          <span style={{ fontWeight: 600 }}>{e.node_label ?? e.node_id}</span>
                        ) : null}
                        {e.node_label && e.node_id ? (
                          <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> ({e.node_id})</span>
                        ) : null}
                        {e.node_label || e.node_id ? <span>: </span> : null}
                        {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {submissionId ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Form state</div>
                  {submissionQuery.isLoading ? (
                    <div style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading form submission…</div>
                  ) : submissionQuery.isError || !submissionQuery.data ? (
                    <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      No form submission details found for submission_id={submissionId}.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Submission status: <span style={{ fontWeight: 600 }}>{submissionQuery.data.status}</span>
                        {submissionQuery.data.current_step_name ? (
                          <>
                            {' '}• Current step: <span style={{ fontWeight: 600 }}>{submissionQuery.data.current_step_name}</span>
                          </>
                        ) : null}
                      </div>

                      {Array.isArray(submissionQuery.data.step_submissions) && submissionQuery.data.step_submissions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {submissionQuery.data.step_submissions
                            .slice()
                            .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
                            .map((step) => (
                              <div key={step.id} style={{ color: 'rgb(var(--color-text-secondary))' }}>
                                <span style={{ fontWeight: 600 }}>{step.step_name}</span>: {step.status}
                              </div>
                            ))}
                        </div>
                      ) : null}

                      <details>
                        <summary style={{ cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}>
                          View raw submission data
                        </summary>
                        <pre
                          style={{
                            background: 'rgb(var(--color-surface))',
                            border: '1px solid rgb(var(--color-border))',
                            borderRadius: 8,
                            padding: 12,
                            overflow: 'auto',
                            maxHeight: 240,
                            marginTop: 8,
                          }}
                        >
                          {JSON.stringify(
                            {
                              data: submissionQuery.data.data,
                              step_submissions: submissionQuery.data.step_submissions,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Inputs</div>
                <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                  {execution.initial_data && typeof execution.initial_data === 'object'
                    ? `${Object.keys(execution.initial_data).length} key(s)`
                    : 'No inputs captured.'}
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}>View raw inputs</summary>
                  <pre
                    style={{
                      background: 'rgb(var(--color-surface))',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 8,
                      padding: 12,
                      overflow: 'auto',
                      maxHeight: 240,
                      marginTop: 8,
                    }}
                  >
                    {JSON.stringify(execution.initial_data ?? {}, null, 2)}
                  </pre>
                </details>
              </div>

              {execution.node_statuses && Object.keys(execution.node_statuses).length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Step status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(execution.node_statuses)
                      .filter(([k, v]) => Boolean(k) && Boolean(v))
                      .sort(([a], [b]) => {
                        const la = execution.node_labels?.[a] ?? a;
                        const lb = execution.node_labels?.[b] ?? b;
                        return la.localeCompare(lb);
                      })
                      .map(([nodeId, status]) => (
                        <div key={`${execution.id}:status:${nodeId}`} style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          <span style={{ fontWeight: 600 }}>{execution.node_labels?.[nodeId] ?? nodeId}</span>
                          {execution.node_labels?.[nodeId] ? (
                            <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> ({nodeId})</span>
                          ) : null}
                          : <span style={{ fontWeight: 600 }}>{String(status)}</span>
                        </div>
                      ))}
                  </div>

                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}>
                      View raw status map
                    </summary>
                    <pre
                      style={{
                        background: 'rgb(var(--color-surface))',
                        border: '1px solid rgb(var(--color-border))',
                        borderRadius: 8,
                        padding: 12,
                        overflow: 'auto',
                        maxHeight: 240,
                        marginTop: 8,
                      }}
                    >
                      {JSON.stringify(execution.node_statuses, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Context</div>
                <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                  Use this for debugging; most UI panels should rely on derived fields (current step, errors, status).
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}>
                    View raw context
                  </summary>
                  <pre
                    style={{
                      background: 'rgb(var(--color-surface))',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 8,
                      padding: 12,
                      overflow: 'auto',
                      maxHeight: 360,
                      marginTop: 8,
                    }}
                  >
                    {JSON.stringify(execution.context_data ?? {}, null, 2)}
                  </pre>
                </details>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Audit Trail</div>
                {Array.isArray(execution.audit_trail) && execution.audit_trail.length > 0 ? (
                  <details>
                    <summary style={{ cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}>
                      View raw audit trail ({execution.audit_trail.length} event(s))
                    </summary>
                    <pre
                      style={{
                        background: 'rgb(var(--color-surface))',
                        border: '1px solid rgb(var(--color-border))',
                        borderRadius: 8,
                        padding: 12,
                        overflow: 'auto',
                        maxHeight: 360,
                        marginTop: 8,
                      }}
                    >
                      {JSON.stringify(execution.audit_trail, null, 2)}
                    </pre>
                  </details>
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
