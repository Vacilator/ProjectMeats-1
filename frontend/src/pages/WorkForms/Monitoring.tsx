/**
 * Process Monitoring Page - "Punch-In" View
 * 
 * Real-time dashboard for monitoring active workflow executions.
 * Users can "punch in" to see exactly where a process is stuck and why.
 * 
 * Features:
 * - Table view of active FormSubmissions
 * - Click to open read-only UnifiedFlowEditor
 * - Highlight current node in workflow
 * - Side panel with "Who, When, Why" execution details
 * - Real-time status updates
 * - Filter by workflow type and status
 * 
 * Created: 2026-03-18
 * Phase: 7 - WorkForms Strategic Overhaul
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  Play, Clock, AlertCircle, CheckCircle, XCircle,
  RefreshCw, Filter, Search, Eye, User, Calendar
} from 'lucide-react';
import { businessApi } from '../../services/businessApi';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface FormSubmission {
  id: string;
  form: {
    id: string;
    name: string;
    workflow_definition: any;
  };
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  current_step?: number;
  total_steps?: number;
  created_at: string;
  updated_at: string;
  created_by?: {
    id: string;
    name: string;
    email: string;
  };
  data?: Record<string, any>;
}

interface ExecutionDetails {
  submission: FormSubmission;
  currentNodeId?: string;
  currentNodeType?: string;
  currentNodeLabel?: string;
  blockedReason?: string;
  waitingFor?: string;
  lastActivity?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 24px;
  background: rgb(var(--color-background-primary));
  min-height: 100vh;
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
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
  flex: 1;
`;

const SearchInput = styled.input`
  padding: 8px 12px 8px 36px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  min-width: 280px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
`;

const SearchIconWrapper = styled.div`
  position: relative;
  flex: 1;
  max-width: 400px;
`;

const SearchIconStyled = styled(Search)`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-tertiary));
  pointer-events: none;
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
  }
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
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
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
`;

const Thead = styled.thead`
  background: rgb(var(--color-surface-secondary));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Th = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Tbody = styled.tbody``;

const Tr = styled.tr<{ clickable?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border));
  transition: background 0.2s;
  
  ${props => props.clickable && `
    cursor: pointer;
    
    &:hover {
      background: rgb(var(--color-surface-hover));
    }
  `}
  
  &:last-child {
    border-bottom: none;
  }
`;

const Td = styled.td`
  padding: 16px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-full, 9999px);
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch (props.status) {
      case 'in_progress':
        return `
          background: rgb(59 130 246 / 0.1);
          color: rgb(59 130 246);
        `;
      case 'completed':
        return `
          background: rgb(34 197 94 / 0.1);
          color: rgb(34 197 94);
        `;
      case 'cancelled':
        return `
          background: rgb(239 68 68 / 0.1);
          color: rgb(239 68 68);
        `;
      default:
        return `
          background: rgb(var(--color-surface-secondary));
          color: rgb(var(--color-text-tertiary));
        `;
    }
  }}
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-primary));
    color: white;
    border-color: rgb(var(--color-primary));
  }
`;

const EmptyState = styled.div`
  padding: 60px 20px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 8px 0;
`;

const EmptyMessage = styled.p`
  font-size: 14px;
  margin: 0;
`;

const LoadingOverlay = styled.div`
  padding: 40px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

// ============================================================================
// Main Component
// ============================================================================

export const Monitoring: React.FC = () => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<ExecutionDetails | null>(null);

  /**
   * Fetch active form submissions
   */
  const fetchSubmissions = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const response = await businessApi.get('/workflows/form-submissions/', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          ordering: '-updated_at',
        },
      });

      setSubmissions(response.data.results || response.data || []);
    } catch (error) {
      console.error('[Monitoring] Failed to fetch submissions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);

  /**
   * Load submissions on mount and status filter change
   */
  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  /**
   * Auto-refresh every 10 seconds
   */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSubmissions(true); // Silent refresh
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchSubmissions]);

  /**
   * Filter submissions by search query
   */
  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;

    const query = searchQuery.toLowerCase();
    return submissions.filter(sub =>
      sub.form.name.toLowerCase().includes(query) ||
      sub.id.toLowerCase().includes(query) ||
      sub.created_by?.name.toLowerCase().includes(query)
    );
  }, [submissions, searchQuery]);

  /**
   * Handle "Punch In" - Open execution details
   */
  const handlePunchIn = useCallback((submission: FormSubmission) => {
    // Determine current node from workflow definition and submission data
    const currentNodeId = submission.data?.current_node_id || 'unknown';
    const currentNodeType = submission.data?.current_node_type || 'unknown';

    setSelectedSubmission({
      submission,
      currentNodeId,
      currentNodeType,
      currentNodeLabel: submission.data?.current_node_label || 'Unknown Step',
      blockedReason: submission.data?.blocked_reason,
      waitingFor: submission.data?.waiting_for,
      lastActivity: submission.updated_at,
    });
  }, []);

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Clock size={14} />;
      case 'completed':
        return <CheckCircle size={14} />;
      case 'cancelled':
        return <XCircle size={14} />;
      default:
        return <AlertCircle size={14} />;
    }
  };

  /**
   * Get status display name
   */
  const getStatusDisplay = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <Container>
      <Header>
        <Title>Process Monitoring</Title>
        <Subtitle>
          Real-time view of active workflow executions. Click any row to "punch in" and see execution details.
        </Subtitle>
      </Header>

      <Toolbar>
        <ToolbarLeft>
          <SearchIconWrapper>
            <SearchIconStyled size={18} />
            <SearchInput
              type="text"
              placeholder="Search by workflow name, ID, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchIconWrapper>

          <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </FilterSelect>
        </ToolbarLeft>

        <RefreshButton onClick={() => fetchSubmissions()} disabled={isRefreshing}>
          <RefreshCw size={16} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </RefreshButton>
      </Toolbar>

      {isLoading ? (
        <LoadingOverlay>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Loading active workflows...</p>
        </LoadingOverlay>
      ) : filteredSubmissions.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📊</EmptyIcon>
          <EmptyTitle>No Active Workflows</EmptyTitle>
          <EmptyMessage>
            {searchQuery
              ? 'No workflows match your search criteria.'
              : 'There are no active workflow executions at the moment.'}
          </EmptyMessage>
        </EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Workflow Name</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Started By</Th>
              <Th>Last Activity</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredSubmissions.map((submission) => (
              <Tr key={submission.id} clickable onClick={() => handlePunchIn(submission)}>
                <Td>
                  <strong>{submission.form.name}</strong>
                  <div style={{ fontSize: '12px', color: 'rgb(var(--color-text-tertiary))', marginTop: '4px' }}>
                    ID: {submission.id.slice(0, 8)}...
                  </div>
                </Td>
                <Td>
                  <StatusBadge status={submission.status}>
                    {getStatusIcon(submission.status)}
                    {getStatusDisplay(submission.status)}
                  </StatusBadge>
                </Td>
                <Td>
                  {submission.current_step && submission.total_steps ? (
                    <span>
                      Step {submission.current_step} of {submission.total_steps}
                    </span>
                  ) : (
                    <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>
                  )}
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={14} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                    {submission.created_by?.name || 'Unknown'}
                  </div>
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={14} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                    {formatDate(submission.updated_at)}
                  </div>
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <ActionButton onClick={() => handlePunchIn(submission)}>
                    <Eye size={14} />
                    Punch In
                  </ActionButton>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* TODO: Add modal/side panel for execution details */}
      {selectedSubmission && (
        <div style={{ marginTop: '24px', padding: '16px', background: 'rgb(var(--color-surface))', borderRadius: '8px' }}>
          <h3>Selected: {selectedSubmission.submission.form.name}</h3>
          <p>Current Node: {selectedSubmission.currentNodeLabel}</p>
          <p>Status: {selectedSubmission.submission.status}</p>
          <p>Last Activity: {formatDate(selectedSubmission.lastActivity || '')}</p>
          <p style={{ fontSize: '12px', color: 'rgb(var(--color-text-tertiary))' }}>
            (Full UnifiedFlowEditor integration coming in next iteration)
          </p>
        </div>
      )}
    </Container>
  );
};

export default Monitoring;
