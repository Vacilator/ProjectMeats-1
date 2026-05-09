/**
 * Forms & Flows History Page
 * 
 * View completed and cancelled form submissions.
 * Implements Phase 1 of the Forms & Flows Enhancement Plan.
 * 
 * Created: 2026-02-03
 * Updated: Phase 5 - Added WorkForm Runs tab
 * 
 * Features:
 * - List of completed/cancelled submissions
 * - Workflow executions tab with audit trail
 * - Date range filtering
 * - Search by form name
 * - View submission details (read-only)
 * - Export to CSV (future)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { showAlert } from '@/utils/uiDialogs';
import { 
  CheckCircle, XCircle, Calendar, Search, Download, 
  Eye, Filter, RefreshCw, FileText, ChevronRight, ChevronDown,
  Clock, AlertCircle
} from 'lucide-react';
import { businessApi } from '../../services/businessApi';
import { workformExecutionService, WorkFormExecution } from '@/services/workformExecutionService';
import { getWorkformsErrorUi } from '@/features/workforms/workformsErrors';
import { formatDateLocal } from '@/utils/formatters';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface FormSubmission {
  id: string;
  form_name: string;
  form_icon?: string;
  status: 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  created_by_name?: string;
  total_steps: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div``;

const TabsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 2px solid rgb(var(--color-border));
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 20px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: ${({ $active }) => 
    $active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'
  };
  border-bottom: 2px solid ${({ $active }) => 
    $active ? 'rgb(var(--color-primary))' : 'transparent'
  };
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: rgb(var(--color-primary));
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  padding: 8px 12px 8px 36px;
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
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-tertiary));
`;

const DateFilter = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DateInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const DateSeparator = styled.span`
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

const ActionButton = styled.button`
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
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  border: 1px solid rgb(var(--color-border));
  
  @media (max-width: 768px) {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const TableHead = styled.thead`
  background: rgb(var(--color-background));
`;

const TableRow = styled.tr`
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const TableHeader = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-secondary));
`;

const TableCell = styled.td`
  padding: 16px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const FormInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FormIcon = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 6px);
  background: rgb(var(--color-primary) / 0.1);
  font-size: 18px;
`;

const FormName = styled.div`
  font-weight: 500;
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
    $status === 'completed'
      ? 'rgba(var(--color-success), 0.10)'
      : 'rgba(var(--color-error), 0.10)'
  };
  color: ${({ $status }) =>
    $status === 'completed' ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))'
  };
`;

const ViewButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
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
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
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

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const PageInfo = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const PageButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const PageButton = styled.button<{ $active?: boolean }>`
  padding: 6px 12px;
  border: 1px solid ${({ $active }) => 
    $active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-sm, 6px);
  background: ${({ $active }) => 
    $active ? 'rgb(var(--color-primary))' : 'transparent'
  };
  color: ${({ $active }) => 
    $active ? 'rgb(var(--color-text-inverse))' : 'rgb(var(--color-text-secondary))'
  };
  font-size: 14px;
  cursor: pointer;
  
  &:hover:not(:disabled) {
    border-color: rgb(var(--color-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ExpandableRow = styled.tr<{ $expanded: boolean }>`
  background: ${({ $expanded }) => 
    $expanded ? 'rgb(var(--color-background))' : 'transparent'
  };
`;

const ExpandedContent = styled.td`
  padding: 20px;
  background: rgb(var(--color-background));
`;

const Timeline = styled.div`
  position: relative;
  padding-left: 30px;
  
  &::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgb(var(--color-border));
  }
`;

const TimelineItem = styled.div`
  position: relative;
  padding-bottom: 20px;
  
  &:last-child {
    padding-bottom: 0;
  }
`;

const TimelineDot = styled.div<{ $status: string }>`
  position: absolute;
  left: -26px;
  top: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${({ $status }) => {
    switch ($status) {
      case 'completed': return 'rgb(var(--color-success))';
      case 'failed': return 'rgb(var(--color-error))';
      case 'skipped': return 'rgb(var(--color-text-secondary))';
      default: return 'rgb(var(--color-info))';
    }
  }};
  background: rgb(var(--color-surface));
`;

const TimelineContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  padding: 12px 16px;
`;

const TimelineHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const TimelineTitle = styled.div`
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const TimelineTime = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const TimelineMeta = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const DurationBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 12px;
  background: rgb(var(--color-primary) / 0.10);
  color: rgb(var(--color-primary));
  margin-left: 8px;
`;

// ============================================================================
// Component
// ============================================================================

const FormsFlowsHistory: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'submissions' | 'workflows'>('submissions');
  const navigate = useNavigate();
  
  // Submissions state
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  
  // Workflow executions state
  const [workflowExecutions, setWorkflowExecutions] = useState<WorkFormExecution[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runsLoadError, setRunsLoadError] = useState<string | null>(null);
  
  const tabOrder: Array<'submissions' | 'workflows'> = ['submissions', 'workflows'];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: 'submissions' | 'workflows'
  ) => {
    const idx = tabOrder.indexOf(current);
    if (idx === -1) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = current === 'submissions' ? 'workflows' : 'submissions';
      setExpandedWorkflow(null);
      setPage(1);
      setActiveTab(next);
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 'submissions' : 'workflows';
      setExpandedWorkflow(null);
      setPage(1);
      setActiveTab(next);
    }
  };

  // Fetch completed/cancelled submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, string> = {
        status: 'completed,cancelled',
        page: String(page),
        page_size: String(pageSize),
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchQuery) params.search = searchQuery;
      
      const response = await businessApi.get('/workflows/form-submissions/', { params });
      setSubmissions(response.data.results || response.data || []);
      setTotalCount(response.data.count || 0);
    } catch (error) {
      logger.error('[WorkFormsHistory] Failed to fetch history', error);
      setSubmissions([]);
      setLoadError(getWorkformsErrorUi(error, 'history.load').message);
    } finally {
      setLoading(false);
    }
  };
  
  
  // Debounced search (respect active tab)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
        return;
      }

      if (activeTab === 'submissions') {
        fetchSubmissions();
      } else {
        fetchWorkflowExecutions();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, page, searchQuery]);
  
  // Fetch workflow executions
  const fetchWorkflowExecutions = async () => {
    setWorkflowsLoading(true);
    setRunsLoadError(null);
    try {
      const params: Record<string, string> = {
        status: 'completed,failed,cancelled',
        page: String(page),
        page_size: String(pageSize),
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchQuery) params.search = searchQuery;

      const response = await workformExecutionService.getExecutions(params as any);
      setWorkflowExecutions(response.results);
      setTotalCount(response.count);
    } catch (error) {
      logger.error('[WorkFormsHistory] Failed to fetch workflow executions', error);
      setWorkflowExecutions([]);
      setRunsLoadError(getWorkformsErrorUi(error, 'history.load').message);
    } finally {
      setWorkflowsLoading(false);
    }
  };

  // Toggle workflow expansion
  const toggleWorkflowExpansion = (workflowId: string) => {
    setExpandedWorkflow((cur) => (cur === workflowId ? null : workflowId));
  };
  
  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions();
    } else {
      fetchWorkflowExecutions();
    }
  }, [activeTab, page, startDate, endDate]);
  
  
  // Calculate duration in readable format
  const formatDuration = (start: string, end?: string) => {
    if (!end) return '-';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffDays}d ${diffHours % 24}h`;
  };
  
  // Format seconds to readable duration
  const formatSeconds = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };
  
  // Handle view details
  const handleViewDetails = (submission: FormSubmission) => {
    // Navigate to submission details page
    window.location.href = `/workflows/details/${submission.id}`;
  };
  
  // Export to CSV - Planned for Wave F (Features) - see REMAINING_WORK_OUTLINE.md
  const handleExport = () => {
    // Feature F3.5: Export to Excel/PDF - scheduled for implementation
    showAlert({
      type: 'info',
      title: 'Coming soon',
      content: 'Export functionality coming soon!',
    });
  };
  
  const totalPages = Math.ceil(totalCount / pageSize);
  const currentLoading = activeTab === 'submissions' ? loading : workflowsLoading;
  const currentData = activeTab === 'submissions' ? submissions : workflowExecutions;
  
  return (
    <ErrorBoundary>
      <Container role="region" aria-label="Form History">
      {/* Tabs */}
      <TabsContainer role="tablist" aria-label="History tabs">
        <Tab
          type="button"
          role="tab"
          $active={activeTab === 'submissions'}
          aria-selected={activeTab === 'submissions'}
          tabIndex={activeTab === 'submissions' ? 0 : -1}
          onClick={() => {
            setExpandedWorkflow(null);
            setPage(1);
            setActiveTab('submissions');
          }}
          onKeyDown={(e) => handleTabKeyDown(e, 'submissions')}
        >
          Form Submissions
        </Tab>
        <Tab
          type="button"
          role="tab"
          $active={activeTab === 'workflows'}
          aria-selected={activeTab === 'workflows'}
          tabIndex={activeTab === 'workflows' ? 0 : -1}
          onClick={() => {
            setExpandedWorkflow(null);
            setPage(1);
            setActiveTab('workflows');
          }}
          onKeyDown={(e) => handleTabKeyDown(e, 'workflows')}
        >
          WorkForm Runs
        </Tab>
      </TabsContainer>
      
      <Toolbar>
        <ToolbarLeft>
          <SearchWrapper>
            <SearchIcon aria-hidden="true">
              <Search size={16} />
            </SearchIcon>
            <SearchInput
              type="search"
              placeholder="Search by form name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search history by form name"
            />
          </SearchWrapper>
          
          <DateFilter role="group" aria-label="Date range filter">
            <Calendar size={16} color="rgb(var(--color-text-tertiary))" aria-hidden="true" />
            <DateInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
            />
            <DateSeparator aria-hidden="true">to</DateSeparator>
            <DateInput
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
            />
          </DateFilter>
        </ToolbarLeft>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <ActionButton onClick={handleExport} aria-label="Export to CSV">
            <Download size={16} aria-hidden="true" />
            Export
          </ActionButton>
          <ActionButton 
            onClick={() => (activeTab === 'submissions' ? fetchSubmissions() : fetchWorkflowExecutions())}
            disabled={currentLoading}
            aria-label={currentLoading ? 'Loading...' : 'Refresh history'}
          >
            <RefreshCw size={16} className={currentLoading ? 'animate-spin' : ''} aria-hidden="true" />
          </ActionButton>
        </div>
      </Toolbar>
      
      {currentLoading ? (
        <LoadingState role="status" aria-live="polite">Loading history...</LoadingState>
      ) : currentData.length === 0 && ((activeTab === 'submissions' && loadError) || (activeTab === 'workflows' && runsLoadError)) ? (
        <EmptyState role="status" aria-live="polite">
          <EmptyIcon aria-hidden="true">
            <FileText size={48} />
          </EmptyIcon>
          <EmptyTitle>Couldn't load history</EmptyTitle>
          <EmptyMessage>{activeTab === 'submissions' ? loadError : runsLoadError}</EmptyMessage>
          <ActionButton onClick={() => (activeTab === 'submissions' ? fetchSubmissions() : fetchWorkflowExecutions())}>
            Try again
          </ActionButton>
        </EmptyState>
      ) : currentData.length === 0 ? (
        <EmptyState role="status" aria-live="polite">
          <EmptyIcon aria-hidden="true">
            <FileText size={48} />
          </EmptyIcon>
          <EmptyTitle>No history found</EmptyTitle>
          <EmptyMessage>
            {searchQuery || startDate || endDate
              ? 'No matching records found. Try adjusting your filters.'
              : 'Completed and cancelled form submissions will appear here once a WorkForm run completes.'}
          </EmptyMessage>
        </EmptyState>
      ) : (
        <>
          {activeTab === 'submissions' ? (
            <Table aria-label="Form submission history">
            <TableHead>
              <tr>
                <TableHeader scope="col">Form</TableHeader>
                <TableHeader scope="col">Status</TableHeader>
                <TableHeader scope="col">Started</TableHeader>
                <TableHeader scope="col">Completed</TableHeader>
                <TableHeader scope="col">By</TableHeader>
                <TableHeader scope="col" style={{ width: '80px' }}>Actions</TableHeader>
              </tr>
            </TableHead>
            <tbody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <FormInfo>
                      <FormIcon aria-hidden="true">
                        {submission.form_icon || <FileText size={18} />}
                      </FormIcon>
                      <FormName>{submission.form_name}</FormName>
                    </FormInfo>
                  </TableCell>
                  <TableCell>
                    <StatusBadge $status={submission.status}>
                      {submission.status === 'completed' 
                        ? <><CheckCircle size={12} aria-hidden="true" /> Completed</>
                        : <><XCircle size={12} aria-hidden="true" /> Cancelled</>
                      }
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{formatDateLocal(submission.created_at)}</TableCell>
                  <TableCell>{formatDateLocal(submission.completed_at || '')}</TableCell>
                  <TableCell>{submission.created_by_name || '-'}</TableCell>
                  <TableCell>
                    <ViewButton 
                      onClick={() => handleViewDetails(submission)}
                      aria-label={`View details for ${submission.form_name}`}
                    >
                      <Eye size={14} aria-hidden="true" />
                      View
                    </ViewButton>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
          ) : (
            <Table aria-label="Workflow execution history">
              <TableHead>
                <tr>
                  <TableHeader scope="col" style={{ width: '40px' }} />
                  <TableHeader scope="col">Workflow Name</TableHeader>
                  <TableHeader scope="col">Status</TableHeader>
                  <TableHeader scope="col">Started By</TableHeader>
                  <TableHeader scope="col">Started At</TableHeader>
                  <TableHeader scope="col">Completed At</TableHeader>
                  <TableHeader scope="col">Duration</TableHeader>
                  <TableHeader scope="col">Details</TableHeader>
                </tr>
              </TableHead>
              <tbody>
                {workflowExecutions.map((execution) => {
                  const isExpanded = expandedWorkflow === execution.id;

                  return (
                    <React.Fragment key={execution.id}>
                      <ExpandableRow $expanded={isExpanded}>
                        <TableCell>
                          <ViewButton
                            onClick={() => toggleWorkflowExpansion(execution.id)}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </ViewButton>
                        </TableCell>
                        <TableCell>
                          <FormName>{execution.workform_name}</FormName>
                        </TableCell>
                        <TableCell>
                          <StatusBadge $status={execution.status}>
                            {execution.status === 'completed' && <><CheckCircle size={12} /> Completed</>}
                            {execution.status === 'failed' && <><AlertCircle size={12} /> Failed</>}
                            {execution.status === 'cancelled' && <><XCircle size={12} /> Cancelled</>}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{execution.started_by_name || '-'}</TableCell>
                        <TableCell>{formatDateLocal(execution.started_at || execution.created_on)}</TableCell>
                        <TableCell>{formatDateLocal(execution.completed_at || '')}</TableCell>
                        <TableCell>{formatDuration(execution.started_at || execution.created_on, execution.completed_at || undefined)}</TableCell>
                        <TableCell>
                          <ViewButton
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/workforms/executions/${execution.id}`);
                            }}
                            aria-label={`View execution details for ${execution.workform_name}`}
                          >
                            <Eye size={14} aria-hidden="true" />
                            View
                          </ViewButton>
                        </TableCell>
                      </ExpandableRow>
                      
                      {isExpanded && (
                        <tr>
                          <ExpandedContent colSpan={8}>
                            <h4 style={{ marginTop: 0, marginBottom: 16 }}>Execution Details</h4>
                            <pre
                              style={{
                                margin: 0,
                                padding: 12,
                                background: 'rgb(var(--color-surface))',
                                border: '1px solid rgb(var(--color-border))',
                                borderRadius: 8,
                                overflow: 'auto',
                                maxHeight: 360,
                              }}
                            >
                              {JSON.stringify({
                                audit_trail: execution.audit_trail || [],
                                context_data: execution.context_data || {},
                              }, null, 2)}
                            </pre>
                          </ExpandedContent>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          )}
          
          
          {totalPages > 1 && (
            <Pagination role="navigation" aria-label="Pagination">
              <PageInfo aria-live="polite">
                Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount}
              </PageInfo>
              <PageButtons>
                <PageButton 
                  onClick={() => setPage(p => p - 1)} 
                  disabled={page <= 1}
                  aria-label="Go to previous page"
                >
                  Previous
                </PageButton>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <PageButton
                      key={pageNum}
                      $active={page === pageNum}
                      onClick={() => setPage(pageNum)}
                      aria-label={`Page ${pageNum}`}
                      aria-current={page === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </PageButton>
                  );
                })}
                <PageButton 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={page >= totalPages}
                  aria-label="Go to next page"
                >
                  Next
                </PageButton>
              </PageButtons>
            </Pagination>
          )}
        </>
      )}
      </Container>
    </ErrorBoundary>
  );
};

export default FormsFlowsHistory;
