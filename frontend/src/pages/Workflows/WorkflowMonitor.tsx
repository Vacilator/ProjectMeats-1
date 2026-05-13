/**
 * Workflow Monitor - Real-time Execution Tracking
 * 
 * Displays active and historical workflow runs with live status updates,
 * progress tracking, and filtering capabilities.
 */
import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';
import { adminClient } from '../../services/apiService';
import { Activity, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, RefreshCw, Play, Filter } from 'lucide-react';
import styled from 'styled-components';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { logger } from '@/utils/logger';
import { formatToLocal } from '@/utils/formatters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';


interface WorkflowRun {
  id: string;
  workflow_slug: string;
  workflow_name: string;
  status: string;
  progress_percentage: number;
  current_step_index: number;
  created_on: string;
  modified_on: string;
}



/* === Styled Components === */

const MonitorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
`;

const ControlsBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1rem;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`;

const FilterButton = styled.button<{ active?: boolean }>`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background-color: ${props => props.active 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-surface))'};
  color: ${props => props.active 
    ? 'rgb(var(--color-primary-foreground))' 
    : 'rgb(var(--color-text-primary))'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.active 
      ? 'rgb(var(--color-primary-hover))' 
      : 'rgb(var(--color-surface-hover))'};
    box-shadow: var(--shadow-sm);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const RefreshButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background-color: ${props => props.active 
    ? 'rgba(var(--color-success), 0.1)' 
    : 'rgb(var(--color-surface))'};
  color: ${props => props.active 
    ? 'rgb(var(--color-success))' 
    : 'rgb(var(--color-text-primary))'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.active 
      ? 'rgba(var(--color-success), 0.15)' 
      : 'rgb(var(--color-surface-hover))'};
  }

  svg {
    animation: ${props => props.active ? 'spin 2s linear infinite' : 'none'};
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const WorkflowGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const WorkflowCard = styled.div`
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const WorkflowHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const WorkflowInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const WorkflowTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const WorkflowName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: var(--radius-full);
  background-color: ${props => {
    switch (props.$status) {
      case 'COMPLETED': return 'rgba(var(--color-success), 0.1)';
      case 'FAILED': return 'rgba(var(--color-danger), 0.1)';
      case 'IN_PROGRESS': return 'rgba(var(--color-info), 0.1)';
      case 'CANCELLED': return 'rgba(var(--color-text-secondary), 0.1)';
      default: return 'rgba(var(--color-text-secondary), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'COMPLETED': return 'rgb(var(--color-success))';
      case 'FAILED': return 'rgb(var(--color-danger))';
      case 'IN_PROGRESS': return 'rgb(var(--color-info))';
      case 'CANCELLED': return 'rgb(var(--color-text-secondary))';
      default: return 'rgb(var(--color-text-secondary))';
    }
  }};
`;

const MetaInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const ProgressSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ProgressHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background-color: rgb(var(--color-border-light));
  border-radius: var(--radius-full);
  overflow: hidden;
`;

const ProgressFill = styled.div<{ percentage: number }>`
  height: 100%;
  width: ${props => props.percentage}%;
  background: linear-gradient(90deg, rgb(var(--color-info)), rgb(var(--color-primary)));
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(var(--color-surface-raw, 255, 255, 255), 0.3),
      transparent
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

const StatusMessage = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => {
    switch (props.$status) {
      case 'COMPLETED': return 'rgb(var(--color-success))';
      case 'FAILED': return 'rgb(var(--color-danger))';
      default: return 'rgb(var(--color-text-secondary))';
    }
  }};
`;

const ChevronIcon = styled(ChevronRight)`
  color: rgb(var(--color-text-secondary));
  opacity: 0.5;
  transition: all 0.2s ease;

  ${WorkflowCard}:hover & {
    opacity: 1;
    transform: translateX(4px);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
`;

const EmptyIcon = styled.div`
  display: inline-flex;
  padding: 1.5rem;
  background-color: rgb(var(--color-surface-hover));
  border-radius: 50%;
  margin-bottom: 1.5rem;
  
  svg {
    color: rgb(var(--color-text-secondary));
    opacity: 0.5;
  }
`;

const EmptyTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const EmptyDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  max-width: 400px;
  margin: 0 auto;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
`;


/* === Main Component === */

export const WorkflowMonitor: React.FC = () => {
  useDocumentTitle('Workflow Monitor');
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchWorkflows();
    
    if (autoRefresh) {
      const interval = setInterval(fetchWorkflows, 5000);
      return () => clearInterval(interval);
    }
  }, [filter, autoRefresh]);

  const fetchWorkflows = async () => {
    try {
      const params: any = { limit: 50 };
      if (filter !== 'all') {
        params.status = filter;
      }

      const response = await adminClient.get('/admin/system-config/api/runs/my-workflows/', { params });
      setWorkflows(response.data.results || []);
    } catch (error) {
      logger.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const size = 18;
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={size} />;
      case 'FAILED':
        return <XCircle size={size} />;
      case 'IN_PROGRESS':
        return <Activity size={size} />;
      case 'CANCELLED':
        return <AlertCircle size={size} />;
      default:
        return <Clock size={size} />;
    }
  };

  const handleWorkflowClick = (runId: string) => {
    navigate(`/workflows/run/${runId}`);
  };

  if (loading) {
    return (
      <PageContainer
        title="Workflow Monitor"
        description="Real-time execution tracking and debugging"
        maxWidth="xl"
      >
        <Card>
          <LoadingState>
            <Skeleton active paragraph={{ rows: 8 }} />
          </LoadingState>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Workflow Monitor"
      description="Real-time execution tracking and debugging"
      maxWidth="xl"
      actions={
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/workflows')}
        >
          <Play size={16} />
          Start New Workflow
        </Button>
      }
    >
      <MonitorContainer>
        {/* Controls Bar */}
        <ControlsBar>
          <FilterGroup>
            <Filter size={18} style={{ color: 'rgb(var(--color-text-secondary))' }} />
            {['all', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'].map((status) => (
              <FilterButton
                key={status}
                active={filter === status}
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </FilterButton>
            ))}
          </FilterGroup>

          <ActionGroup>
            <RefreshButton
              active={autoRefresh}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw size={16} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </RefreshButton>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWorkflows}
            >
              Refresh Now
            </Button>
          </ActionGroup>
        </ControlsBar>

        {/* Workflow List */}
        {workflows.length === 0 ? (
          <Card>
            <EmptyState>
              <EmptyIcon>
                <Activity size={48} />
              </EmptyIcon>
              <EmptyTitle>No workflow runs found</EmptyTitle>
              <EmptyDescription>
                {filter === 'all'
                  ? 'Start a workflow to see it here. Click "Start New Workflow" to begin.'
                  : `No ${filter.replace('_', ' ').toLowerCase()} workflows found. Try adjusting your filters.`}
              </EmptyDescription>
            </EmptyState>
          </Card>
        ) : (
          <WorkflowGrid>
            {workflows.map((run) => (
              <WorkflowCard
                key={run.id}
                onClick={() => handleWorkflowClick(run.id)}
              >
                <WorkflowHeader>
                  <WorkflowInfo>
                    <WorkflowTitle>
                      <WorkflowName>{run.workflow_name}</WorkflowName>
                      <StatusBadge $status={run.status}>
                        {getStatusIcon(run.status)}
                        {run.status.replace('_', ' ')}
                      </StatusBadge>
                    </WorkflowTitle>

                    <MetaInfo>
                      <MetaItem>
                        <Clock size={14} />
                        Started {formatToLocal(run.created_on)}
                      </MetaItem>
                      <MetaItem>
                        Run ID: {run.id.slice(0, 8)}...
                      </MetaItem>
                    </MetaInfo>

                    {run.status === 'IN_PROGRESS' && (
                      <ProgressSection>
                        <ProgressHeader>
                          <span>Progress</span>
                          <span>{run.progress_percentage}%</span>
                        </ProgressHeader>
                        <ProgressBar>
                          <ProgressFill percentage={run.progress_percentage} />
                        </ProgressBar>
                      </ProgressSection>
                    )}

                    {run.status === 'COMPLETED' && (
                      <StatusMessage $status="COMPLETED">
                        <CheckCircle size={16} />
                        Completed {formatToLocal(run.modified_on)}
                      </StatusMessage>
                    )}

                    {run.status === 'FAILED' && (
                      <StatusMessage $status="FAILED">
                        <XCircle size={16} />
                        Failed - Click to view error details
                      </StatusMessage>
                    )}
                  </WorkflowInfo>

                  <ChevronIcon size={24} />
                </WorkflowHeader>
              </WorkflowCard>
            ))}
          </WorkflowGrid>
        )}
      </MonitorContainer>
    </PageContainer>
  );
};
