/**
 * Forms & Flows In Progress Page
 * 
 * View and manage active form submissions.
 * Implements Phase 1 of the Forms & Flows Enhancement Plan.
 * 
 * Created: 2026-02-03
 * Updated: Phase 5 - Added real-time polling and cancel functionality
 * 
 * Features:
 * - Card grid of active submissions
 * - Progress indicators
 * - Quick resume action
 * - Filter by form type
 * - Real-time updates (10-second polling)
 * - Cancel workflow with confirmation
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { Play, Clock, Filter, RefreshCw, FileText, X, Eye } from 'lucide-react';
import { businessApi } from '../../services/businessApi';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import { workflowExecutionService } from '../../services/workflowExecutionService';
import { workformExecutionService } from '@/services/workformExecutionService';
import { getWorkformsErrorUi } from '@/features/workforms/workformsErrors';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface FormSubmission {
  id: string;
  form_name: string;
  form_icon?: string;
  status: string;
  current_step: number;
  total_steps: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div``;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
  
  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 2px solid rgb(var(--color-border));
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 10px 16px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: ${({ $active }) => ($active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))')};
  border-bottom: 2px solid ${({ $active }) => ($active ? 'rgb(var(--color-primary))' : 'transparent')};
  margin-bottom: -2px;
  cursor: pointer;

  &:hover {
    color: rgb(var(--color-primary));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  
  @media (max-width: 640px) {
    width: 100%;
  }
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  width: 280px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
  
  @media (max-width: 640px) {
    width: 100%;
    flex: 1;
  }
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-text-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 640px) {
    position: absolute;
    right: 0;
    top: 0;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgb(var(--color-text-primary) / 0.10);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const CardIcon = styled.div`
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-primary) / 0.1);
  font-size: 22px;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
  background: ${({ $status }) =>
    $status === 'in_progress'
      ? 'rgba(var(--color-info), 0.10)'
      : $status === 'draft'
        ? 'rgba(var(--color-text-tertiary), 0.10)'
        : 'rgba(var(--color-warning), 0.10)'
  };
  color: ${({ $status }) =>
    $status === 'in_progress'
      ? 'rgb(var(--color-info))'
      : $status === 'draft'
        ? 'rgb(var(--color-text-secondary))'
        : 'rgb(var(--color-warning))'
  };
`;

const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px;
`;

const CardMeta = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 16px;
`;

const ProgressBar = styled.div`
  height: 6px;
  background: rgb(var(--color-border));
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: rgb(var(--color-primary));
  border-radius: 3px;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 16px;
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ResumeButton = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px;
`;

const EmptyMessage = styled.p`
  margin: 0;
  font-size: 14px;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgb(var(--color-text-secondary));
`;

const LastUpdated = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-left: 8px;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
`;

const CancelButton = styled.button`
  padding: 10px 16px;
  background: transparent;
  color: rgb(var(--color-error));
  border: 1px solid rgb(var(--color-error));
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-error), 0.10);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;


// ============================================================================
// Component
// ============================================================================

const FormsFlowsInProgress: React.FC = () => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'submissions' | 'executions'>('submissions');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'my' | 'team'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { id: submissionId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { resumeSubmission } = useQuickActions();

  useEffect(() => {
    if (!submissionId) return;

    resumeSubmission(submissionId).catch((error) => {
      const ui = getWorkformsErrorUi(error, 'inProgress.load');
      showAlert({
        type: 'error',
        title: ui.title,
        content: ui.message,
      });
    });
  }, [resumeSubmission, submissionId]);
  
  // Fetch in-progress submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: any = { status: 'in_progress,draft' };
      
      // Apply filter mode
      if (filterMode === 'my') {
        params.assigned_to = 'me';
      }
      
      const response = await businessApi.get('/workflows/form-submissions/', { params });
      setSubmissions(response.data.results || response.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('[WorkFormsInProgress] Failed to fetch submissions', error);
      setSubmissions([]);
      setLoadError(getWorkformsErrorUi(error, 'inProgress.load').message);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    if (activeTab !== 'submissions') return;
    fetchSubmissions();
  }, [activeTab, filterMode]);
  
  // Real-time polling (10 seconds)
  useEffect(() => {
    if (activeTab !== 'submissions') return;

    const interval = setInterval(() => {
      fetchSubmissions();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [activeTab, filterMode]);
  
  const executionsQuery = useQuery({
    queryKey: ['workform-executions', 'in-progress', filterMode],
    queryFn: async () =>
      workformExecutionService.getExecutions({
        status: 'pending,in_progress',
        started_by: filterMode === 'my' ? 'me' : undefined,
        page_size: 50,
      }),
    enabled: activeTab === 'executions',
    refetchInterval: 10000,
  });

  const handleCancelClick = async (submission: FormSubmission) => {
    const ok = await confirmDialog({
      title: 'Cancel submission?',
      content: `Are you sure you want to cancel "${submission.form_name}"? This action cannot be undone.`,
      okText: 'Yes, cancel',
      cancelText: 'Keep working',
      danger: true,
    });

    if (!ok) return;

    setCancelingId(submission.id);
    try {
      await workflowExecutionService.cancelExecution(submission.id, {
        reason: 'Cancelled by user',
      });

      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (error) {
      logger.error('[WorkFormsInProgress] Failed to cancel workflow', error);
      const ui = getWorkformsErrorUi(error, 'inProgress.cancel');
      showAlert({
        type: 'error',
        title: ui.title,
        content: ui.message,
      });
    } finally {
      setCancelingId(null);
    }
  };
  
  // Filter submissions by search query
  const filteredSubmissions = submissions.filter(sub =>
    sub.form_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Handle resume action
  const handleResume = (submission: FormSubmission) => {
    resumeSubmission(submission.id);
  };
  
  // Format relative time
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <ErrorBoundary resetKeys={[submissionId, filterMode, searchQuery]}>
      <Container role="region" aria-label="In Progress Work">
        <TabsContainer role="tablist" aria-label="In Progress tabs">
          <Tab
            type="button"
            role="tab"
            $active={activeTab === 'submissions'}
            aria-selected={activeTab === 'submissions'}
            onClick={() => setActiveTab('submissions')}
          >
            Form Submissions
          </Tab>
          <Tab
            type="button"
            role="tab"
            $active={activeTab === 'executions'}
            aria-selected={activeTab === 'executions'}
            onClick={() => setActiveTab('executions')}
          >
            WorkForm Runs
          </Tab>
        </TabsContainer>

        {loadError && activeTab === 'submissions' ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: '12px 0',
              padding: '12px',
              border: '1px solid rgb(var(--color-border))',
              borderRadius: 12,
              background: 'rgb(var(--color-primary) / 0.06)',
              color: 'rgb(var(--color-text-primary))',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => fetchSubmissions()}
              style={{
                border: '1px solid rgb(var(--color-border))',
                background: 'rgb(var(--color-surface))',
                color: 'rgb(var(--color-text-primary))',
                padding: '6px 10px',
                borderRadius: 10,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        <Toolbar>
          <ToolbarLeft>
            <SearchInput
              type="search"
              placeholder={activeTab === 'executions' ? 'Search runs…' : 'Search in-progress forms…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={activeTab === 'executions' ? 'Search runs' : 'Search in-progress forms'}
            />
            <FilterSelect
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              aria-label="Filter WorkForms"
            >
              <option value="all">All WorkForms</option>
              <option value="my">My WorkForms</option>
              <option value="team">Team WorkForms</option>
            </FilterSelect>
          </ToolbarLeft>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <LastUpdated>Last updated: {lastUpdated.toLocaleTimeString()}</LastUpdated>
            <RefreshButton
              onClick={() => (activeTab === 'executions' ? executionsQuery.refetch() : fetchSubmissions())}
              disabled={activeTab === 'executions' ? executionsQuery.isFetching : loading}
              aria-label={(activeTab === 'executions' ? executionsQuery.isFetching : loading) ? 'Loading…' : 'Refresh list'}
            >
              <RefreshCw
                size={18}
                className={(activeTab === 'executions' ? executionsQuery.isFetching : loading) ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </RefreshButton>
          </div>
        </Toolbar>

        {activeTab === 'executions' ? (
          (() => {
            const executions = executionsQuery.data?.results ?? [];
            const filtered = executions.filter((ex) =>
              (ex.workform_name || '').toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (executionsQuery.isLoading) {
              return <LoadingState role="status" aria-live="polite">Loading runs…</LoadingState>;
            }

            if (executionsQuery.isError) {
              const ui = getWorkformsErrorUi(executionsQuery.error, 'inProgress.load');
              return (
                <EmptyState role="status" aria-live="polite">
                  <EmptyIcon aria-hidden="true">
                    <Clock size={48} />
                  </EmptyIcon>
                  <EmptyTitle>{ui.title}</EmptyTitle>
                  <EmptyMessage>{ui.message}</EmptyMessage>
                  <ResumeButton onClick={() => void executionsQuery.refetch()} aria-label="Try again">
                    Try again
                  </ResumeButton>
                </EmptyState>
              );
            }

            if (filtered.length === 0) {
              return (
                <EmptyState role="status" aria-live="polite">
                  <EmptyIcon aria-hidden="true">
                    <Clock size={48} />
                  </EmptyIcon>
                  <EmptyTitle>No runs in progress</EmptyTitle>
                  <EmptyMessage>
                    {searchQuery
                      ? 'No matching runs found. Try a different search term.'
                      : 'You have no active WorkForm runs right now. Start one from the Catalog.'}
                  </EmptyMessage>
                </EmptyState>
              );
            }

            return (
              <CardGrid role="list" aria-label={`${filtered.length} runs in progress`}>
                {filtered.map((ex) => (
                  <Card
                    key={ex.id}
                    role="listitem"
                    aria-label={`${ex.workform_name}, status ${ex.status}`}
                    onClick={() => navigate(`/workforms/executions/${ex.id}`)}
                  >
                    <CardHeader>
                      <CardIcon aria-hidden="true">
                        <FileText size={22} />
                      </CardIcon>
                      <StatusBadge $status={ex.status}>
                        <Clock size={12} aria-hidden="true" />
                        {ex.status}
                      </StatusBadge>
                    </CardHeader>

                    <CardTitle>{ex.workform_name}</CardTitle>
                    <CardMeta>
                      {ex.started_at ? `Started ${formatTimeAgo(ex.started_at)}` : 'Started recently'}
                      {ex.started_by_name ? ` • By ${ex.started_by_name}` : ''}
                    </CardMeta>

                    <CardActions>
                      <ResumeButton
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/workforms/executions/${ex.id}`);
                        }}
                        aria-label={`View ${ex.workform_name}`}
                      >
                        <Eye size={16} aria-hidden="true" />
                        View
                      </ResumeButton>
                    </CardActions>
                  </Card>
                ))}
              </CardGrid>
            );
          })()
        ) : loading ? (
          <LoadingState role="status" aria-live="polite">Loading submissions...</LoadingState>
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState role="status" aria-live="polite">
            <EmptyIcon aria-hidden="true">
              <Clock size={48} />
            </EmptyIcon>
            <EmptyTitle>No forms in progress</EmptyTitle>
            <EmptyMessage>
              {searchQuery
                ? 'No matching forms found. Try a different search term.'
                : 'You have no active form submissions or WorkForm runs right now. Start a new one from the Catalog.'}
            </EmptyMessage>
          </EmptyState>
        ) : (
          <CardGrid role="list" aria-label={`${filteredSubmissions.length} forms in progress`}>
            {filteredSubmissions.map((submission) => {
              const progress = submission.total_steps > 0
                ? Math.round((submission.current_step / submission.total_steps) * 100)
                : 0;

              return (
                <Card key={submission.id} role="listitem" aria-label={`${submission.form_name}, ${progress}% complete`}>
                  <CardHeader>
                    <CardIcon aria-hidden="true">
                      {submission.form_icon || <FileText size={22} />}
                    </CardIcon>
                    <StatusBadge $status={submission.status}>
                      <Clock size={12} aria-hidden="true" />
                      {submission.status === 'in_progress' ? 'In Progress' : 'Draft'}
                    </StatusBadge>
                  </CardHeader>

                  <CardTitle>{submission.form_name}</CardTitle>
                  <CardMeta>
                    Updated {formatTimeAgo(submission.updated_at)}
                    {submission.created_by_name && ` • By ${submission.created_by_name}`}
                  </CardMeta>

                  <ProgressBar
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress: ${progress}%`}
                  >
                    <ProgressFill $percent={progress} />
                  </ProgressBar>
                  <ProgressText>
                    <span>
                      Step {submission.current_step} of {submission.total_steps}
                    </span>
                    <span>{progress}% complete</span>
                  </ProgressText>

                  <CardActions>
                    <ResumeButton onClick={() => handleResume(submission)} aria-label={`Resume ${submission.form_name}`}>
                      <Play size={16} aria-hidden="true" />
                      Resume
                    </ResumeButton>
                    <CancelButton
                      onClick={() => void handleCancelClick(submission)}
                      disabled={cancelingId === submission.id}
                      aria-label={`Cancel ${submission.form_name}`}
                    >
                      <X size={16} />
                    </CancelButton>
                  </CardActions>
                </Card>
              );
            })}
          </CardGrid>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default FormsFlowsInProgress;
