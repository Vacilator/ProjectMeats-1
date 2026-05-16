/**
 * WorkForm Execution Details
 */

import React from 'react';
import { Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { ActivityFeed } from '@/components/Shared';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { workformExecutionService } from '@/services/workformExecutionService';
import { formSubmissionService } from '@/services/quickActionsService';
import { getWorkformsErrorUi } from '@/features/workforms/workformsErrors';
import { ExecutionStoryView } from '@/features/workforms/ExecutionStoryView';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { withTenantQueryKey } from '@/utils/queryKeys';

export const WorkFormExecutionDetails: React.FC = () => {
  useDocumentTitle('Execution Details');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: withTenantQueryKey('workform-execution', id),
    queryFn: async () => {
      if (!id) throw new Error('Missing execution id');
      return workformExecutionService.getExecution(id);
    },
    enabled: !!id,
    retry: false,
    refetchInterval: (q) => {
      // Prevent error-loop polling: if the last fetch failed (including refetch failures),
      // stop automatic refetching until the user explicitly retries.
      if (q.state.error) return false;

      const status = (q.state.data as Record<string, unknown> | undefined)?.status as string | undefined;
      return status === 'pending' || status === 'in_progress' ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const execution = query.data;
  const isLoadError = query.isError || (query as unknown as Record<string, unknown>).isRefetchError;

  const submissionId = React.useMemo(() => {
    const initial = execution?.initial_data;
    if (!initial || typeof initial !== 'object') return null;

    const rec = initial as Record<string, unknown>;
    const raw = (rec.submission_id ?? rec.form_submission_id) as unknown;
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }, [execution]);

  const submissionQuery = useQuery({
    queryKey: withTenantQueryKey('form-submission', submissionId),
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
        ) : isLoadError || !execution ? (
          <ErrorContainer>
            <ErrorTitle>{getWorkformsErrorUi(query.error, 'executionDetails.load').title}</ErrorTitle>
            <SecondaryText>
              {getWorkformsErrorUi(query.error, 'executionDetails.load').message}
            </SecondaryText>
            <ActionRow>
              <Button variant="secondary" onClick={() => void query.refetch()}>
                Try again
              </Button>
              <Button variant="secondary" onClick={() => navigate('/workforms/history')}>
                View History
              </Button>
              <Button variant="secondary" onClick={() => navigate('/workforms/catalog')}>
                Back to Catalog
              </Button>
            </ActionRow>
          </ErrorContainer>
        ) : (
          <ContentStack data-testid="workform-execution-details-page">
            <HeaderRow>
              <div>
                <ExecutionName data-testid="workform-execution-name">
                  {execution.workform_name}
                </ExecutionName>
                <StatusLine>
                  Status:{' '}
                  <BoldSpan data-testid="workform-execution-status">
                    {execution.status}
                  </BoldSpan>
                </StatusLine>
              </div>
              <ButtonGroup>
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
              </ButtonGroup>
            </HeaderRow>

            <Tabs
              items={[
                {
                  key: 'overview',
                  label: 'Overview',
                  children: (
                    <OverviewStack>
                      {execution.error_message ? (
                        <ErrorMessage data-testid="workform-execution-error-message">
                          {execution.error_message}
                        </ErrorMessage>
                      ) : null}

                      <ExecutionStoryView execution={execution} />

                      <div data-testid="workform-execution-current-step">
                        <SectionLabel>Current step</SectionLabel>
                        {execution.current_node_id ? (
                          <SecondaryText>
                            Node:{' '}
                            <BoldSpan>
                              {execution.current_node_label ?? execution.current_node_id}
                            </BoldSpan>
                            {execution.current_node_label ? (
                              <TertiaryText> ({execution.current_node_id})</TertiaryText>
                            ) : null}
                            {execution.current_node_type ? <span> • {execution.current_node_type}</span> : null}
                            {execution.last_event ? <span> • last: {execution.last_event}</span> : null}
                          </SecondaryText>
                        ) : (
                          <SecondaryText>No active node recorded.</SecondaryText>
                        )}
                      </div>

                      {execution.errors && execution.errors.length > 0 ? (
                        <div data-testid="workform-execution-errors">
                          <SectionLabel>Errors</SectionLabel>
                          <ErrorList>
                            {execution.errors.map((e, idx) => (
                              <ErrorListItem key={`${execution.id}:err:${idx}`}>
                                {e.node_label || e.node_id ? (
                                  <BoldSpan>{e.node_label ?? e.node_id}</BoldSpan>
                                ) : null}
                                {e.node_label && e.node_id ? (
                                  <TertiaryText> ({e.node_id})</TertiaryText>
                                ) : null}
                                {e.node_label || e.node_id ? <span>: </span> : null}
                                {e.error}
                              </ErrorListItem>
                            ))}
                          </ErrorList>
                        </div>
                      ) : null}

                      {submissionId ? (
                        <div>
                          <SectionLabel>Form state</SectionLabel>
                          {submissionQuery.isLoading ? (
                            <SecondaryText>Loading form submission…</SecondaryText>
                          ) : submissionQuery.isError || !submissionQuery.data ? (
                            <SecondaryText>
                              No form submission details found for submission_id={submissionId}.
                            </SecondaryText>
                          ) : (
                            <FormStateStack>
                              <SecondaryText>
                                Submission status: <BoldSpan>{submissionQuery.data.status}</BoldSpan>
                                {submissionQuery.data.current_step_name ? (
                                  <>
                                    {' '}• Current step: <BoldSpan>{submissionQuery.data.current_step_name}</BoldSpan>
                                  </>
                                ) : null}
                              </SecondaryText>

                              {Array.isArray(submissionQuery.data.step_submissions) && submissionQuery.data.step_submissions.length > 0 ? (
                                <StepStack>
                                  {submissionQuery.data.step_submissions
                                    .slice()
                                    .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
                                    .map((step) => (
                                      <SecondaryText key={step.id}>
                                        <BoldSpan>{step.step_name}</BoldSpan>: {step.status}
                                      </SecondaryText>
                                    ))}
                                </StepStack>
                              ) : null}

                              <details>
                                <SummaryLink>
                                  View raw submission data
                                </SummaryLink>
                                <RawDataPre>
                                  {JSON.stringify(
                                    {
                                      data: submissionQuery.data.data,
                                      step_submissions: submissionQuery.data.step_submissions,
                                    },
                                    null,
                                    2
                                  )}
                                </RawDataPre>
                              </details>
                            </FormStateStack>
                          )}
                        </div>
                      ) : null}

                      <DebugDetails data-testid="workform-execution-debug">
                        <DebugSummary>
                          Debug data
                        </DebugSummary>

                        <DebugContent>
                          <div>
                            <SectionLabel>Inputs</SectionLabel>
                            <StatusLine>
                              {execution.initial_data && typeof execution.initial_data === 'object'
                                ? `${Object.keys(execution.initial_data).length} key(s)`
                                : 'No inputs captured.'}
                            </StatusLine>
                            <DetailsSpaced>
                              <SummaryLink>View raw inputs</SummaryLink>
                              <RawDataPre>
                                {JSON.stringify(execution.initial_data ?? {}, null, 2)}
                              </RawDataPre>
                            </DetailsSpaced>
                          </div>

                          {execution.node_statuses && Object.keys(execution.node_statuses).length > 0 ? (
                            <div>
                              <SectionLabel>Step status</SectionLabel>
                              <StepStack>
                                {Object.entries(execution.node_statuses)
                                  .filter(([k, v]) => Boolean(k) && Boolean(v))
                                  .sort(([a], [b]) => {
                                    const la = execution.node_labels?.[a] ?? a;
                                    const lb = execution.node_labels?.[b] ?? b;
                                    return la.localeCompare(lb);
                                  })
                                  .map(([nodeId, status]) => (
                                    <SecondaryText key={`${execution.id}:status:${nodeId}`}>
                                      <BoldSpan>{execution.node_labels?.[nodeId] ?? nodeId}</BoldSpan>
                                      {execution.node_labels?.[nodeId] ? (
                                        <TertiaryText> ({nodeId})</TertiaryText>
                                      ) : null}
                                      <span>: </span>
                                      <BoldSpan>{String(status)}</BoldSpan>
                                    </SecondaryText>
                                  ))}
                              </StepStack>

                              <DetailsSpaced>
                                <SummaryLink>
                                  View raw status map
                                </SummaryLink>
                                <RawDataPre>
                                  {JSON.stringify(execution.node_statuses, null, 2)}
                                </RawDataPre>
                              </DetailsSpaced>
                            </div>
                          ) : null}

                          <div>
                            <SectionLabel>Context</SectionLabel>
                            <StatusLine>
                              Use this for debugging; most UI panels should rely on derived fields (current step, errors, status).
                            </StatusLine>
                            <DetailsSpaced>
                              <SummaryLink>
                                View raw context
                              </SummaryLink>
                              <RawDataPreTall>
                                {JSON.stringify(execution.context_data ?? {}, null, 2)}
                              </RawDataPreTall>
                            </DetailsSpaced>
                          </div>

                          <div>
                            <SectionLabel>Audit Trail</SectionLabel>
                            {Array.isArray(execution.audit_trail) && execution.audit_trail.length > 0 ? (
                              <details>
                                <SummaryLink>
                                  View raw audit trail ({execution.audit_trail.length} event(s))
                                </SummaryLink>
                                <RawDataPreTall>
                                  {JSON.stringify(execution.audit_trail, null, 2)}
                                </RawDataPreTall>
                              </details>
                            ) : (
                              <SecondaryText>No audit entries yet.</SecondaryText>
                            )}
                          </div>
                        </DebugContent>
                      </DebugDetails>
                    </OverviewStack>
                  ),
                },
                {
                  key: 'activity',
                  label: 'Activity',
                  children: id ? (
                    <ActivityFeed
                      entityType="workform_execution"
                      entityId={id}
                      maxHeight="520px"
                      title="Execution Activity"
                    />
                  ) : null,
                },
              ]}
            />
          </ContentStack>
        )}
      </Card>
    </PageContainer>
  );
};

export default WorkFormExecutionDetails;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ErrorTitle = styled.div`
  font-weight: 700;
`;

const SecondaryText = styled.div`
  color: rgb(var(--color-text-secondary));
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ContentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const ExecutionName = styled.div`
  font-weight: 700;
  font-size: 16px;
`;

const StatusLine = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

const BoldSpan = styled.span`
  font-weight: 600;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const OverviewStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
`;

const SectionLabel = styled.div`
  font-weight: 600;
  margin-bottom: 6px;
`;

const TertiaryText = styled.span`
  color: rgb(var(--color-text-tertiary));
`;

const ErrorList = styled.ul`
  margin: 0;
  padding-left: 18px;
`;

const ErrorListItem = styled.li`
  color: rgb(var(--color-error));
`;

const FormStateStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StepStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SummaryLink = styled.summary`
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
`;

const RawDataPre = styled.pre`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
  max-height: 240px;
  margin-top: 8px;
`;

const RawDataPreTall = styled(RawDataPre)`
  max-height: 360px;
`;

const DebugDetails = styled.details`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 12px;
`;

const DebugSummary = styled.summary`
  cursor: pointer;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const DebugContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
`;

const DetailsSpaced = styled.details`
  margin-top: 8px;
`;
