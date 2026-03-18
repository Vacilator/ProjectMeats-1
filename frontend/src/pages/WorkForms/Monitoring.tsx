/**
 * Process Monitoring Page - "Punch-In" View
 *
 * Real-time dashboard for monitoring active workflow executions.
 * Users can "punch in" to see exactly where a process is stuck and why.
 *
 * Features:
 * - Table view of active FormSubmissions (via process-monitor endpoint)
 * - Side panel with "Who, When, Why" execution details
 * - Overdue / SLA indicators
 * - Real-time auto-refresh every 10 seconds
 * - Filter by status, search by name / user
 *
 * Phase: 7 - WorkForms Strategic Overhaul
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  Clock, AlertCircle, CheckCircle, XCircle,
  RefreshCw, Search, Eye, User, Calendar, X, Timer, AlertTriangle,
} from 'lucide-react';
import { businessApi } from '../../services/businessApi';

// ============================================================================
// TypeScript Interfaces — matched to the /process-monitor/ API response
// ============================================================================

interface ProcessMonitorRow {
  id: string;
  form_id: string;
  form_name: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string | null;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  current_step_id: string | null;
  current_step_name: string | null;
  current_step_order: number | null;
  current_step_entity_type: string | null;
  current_step_status: string | null;
  current_step_updated_at: string | null;
  assigned_to: {
    assignment_type?: string;
    assigned_user_id?: string;
    assigned_user_name?: string;
    assigned_role?: string;
    due_days?: number;
  } | null;
  assigned_to_display: string | null;
  due_days: number | null;
  due_at: string | null;
  is_overdue: boolean;
  time_in_current_step_seconds: number | null;
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

// ── Execution Detail Panel ────────────────────────────────────────────────────

const DetailOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0 0 0 / 0.3);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
`;

const DetailPanel = styled.div`
  width: min(480px, 95vw);
  height: 100%;
  background: rgb(var(--color-surface));
  box-shadow: -4px 0 24px rgba(0 0 0 / 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface-secondary));
`;

const DetailTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: var(--radius-md, 8px);
  flex-shrink: 0;
  margin-left: 12px;

  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }
`;

const DetailBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const DetailSection = styled.div`
  background: rgb(var(--color-surface-secondary));
  border-radius: var(--radius-md, 8px);
  padding: 16px;
`;

const DetailSectionTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
`;

const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgb(var(--color-border));
  font-size: 14px;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: rgb(var(--color-text-tertiary));
  }
`;

const DetailKey = styled.span`
  color: rgb(var(--color-text-secondary));
  min-width: 130px;
  font-weight: 500;
`;

const DetailValue = styled.span`
  color: rgb(var(--color-text-primary));
  flex: 1;
  word-break: break-word;
`;

const OverdueBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md, 8px);
  color: rgb(239, 68, 68);
  font-size: 14px;
  font-weight: 500;
`;

// ============================================================================
// Main Component
// ============================================================================

export const Monitoring: React.FC = () => {
  const [rows, setRows] = useState<ProcessMonitorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRow, setSelectedRow] = useState<ProcessMonitorRow | null>(null);

  /**
   * Fetch process-monitor rows.
   * Uses the enriched endpoint that includes current-step assignee, SLA, and
   * elapsed time — exactly the data needed for the Punch-In side panel.
   */
  const fetchRows = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const response = await businessApi.get('/workflows/form-submissions/process-monitor/', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          ordering: '-updated_at',
        },
      });

      const data = response.data;
      setRows(data.results || data || []);
    } catch (error) {
      console.error('[Monitoring] Failed to fetch process-monitor rows:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);

  /** Load on mount and whenever status filter changes */
  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  /** Auto-refresh every 10 seconds (silent) */
  useEffect(() => {
    const interval = setInterval(() => fetchRows(true), 10_000);
    return () => clearInterval(interval);
  }, [fetchRows]);

  /** Filter rows by search query */
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(row =>
      (row.form_name ?? '').toLowerCase().includes(q) ||
      row.id.toLowerCase().includes(q) ||
      (row.created_by_name ?? '').toLowerCase().includes(q) ||
      (row.assigned_to_display ?? '').toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  /** Format relative date */
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  /** Format seconds into a human-readable duration */
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress': return <Clock size={14} />;
      case 'completed':   return <CheckCircle size={14} />;
      case 'cancelled':   return <XCircle size={14} />;
      default:            return <AlertCircle size={14} />;
    }
  };

  const getStatusDisplay = (status: string) =>
    status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

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

        <RefreshButton onClick={() => fetchRows()} disabled={isRefreshing}>
          <RefreshCw size={16} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </RefreshButton>
      </Toolbar>

      {isLoading ? (
        <LoadingOverlay>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Loading active workflows...</p>
        </LoadingOverlay>
      ) : filteredRows.length === 0 ? (
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
              <Th>Current Step</Th>
              <Th>Assigned To</Th>
              <Th>Time in Step</Th>
              <Th>Last Activity</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredRows.map((row) => (
              <Tr key={row.id} clickable onClick={() => setSelectedRow(row)}>
                <Td>
                  <strong>{row.form_name ?? 'Unknown Workflow'}</strong>
                  <div style={{ fontSize: '12px', color: 'rgb(var(--color-text-tertiary))', marginTop: '4px' }}>
                    ID: {row.id.slice(0, 8)}…
                  </div>
                </Td>
                <Td>
                  <StatusBadge status={row.status}>
                    {getStatusIcon(row.status)}
                    {getStatusDisplay(row.status)}
                  </StatusBadge>
                  {row.is_overdue && (
                    <div style={{ marginTop: '4px' }}>
                      <StatusBadge status="cancelled">
                        <AlertTriangle size={12} />
                        Overdue
                      </StatusBadge>
                    </div>
                  )}
                </Td>
                <Td>
                  {row.current_step_name ? (
                    <span>{row.current_step_name}</span>
                  ) : (
                    <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>
                  )}
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={14} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                    {row.assigned_to_display ?? row.created_by_name ?? 'Unassigned'}
                  </div>
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Timer size={14} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                    {formatDuration(row.time_in_current_step_seconds)}
                  </div>
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={14} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                    {formatDate(row.updated_at)}
                  </div>
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <ActionButton onClick={() => setSelectedRow(row)}>
                    <Eye size={14} />
                    Punch In
                  </ActionButton>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Execution Detail Side Panel */}
      {selectedRow && (
        <DetailOverlay onClick={() => setSelectedRow(null)}>
          <DetailPanel onClick={(e) => e.stopPropagation()}>
            <DetailHeader>
              <DetailTitle title={selectedRow.form_name ?? 'Workflow Details'}>
                {selectedRow.form_name ?? 'Workflow Details'}
              </DetailTitle>
              <CloseButton onClick={() => setSelectedRow(null)} aria-label="Close panel">
                <X size={18} />
              </CloseButton>
            </DetailHeader>

            <DetailBody>
              {/* Overdue warning */}
              {selectedRow.is_overdue && (
                <OverdueBanner>
                  <AlertTriangle size={16} />
                  This workflow step is overdue and requires immediate attention.
                </OverdueBanner>
              )}

              {/* Status */}
              <DetailSection>
                <DetailSectionTitle>Workflow Status</DetailSectionTitle>
                <DetailRow>
                  <StatusBadge status={selectedRow.status}>
                    {getStatusIcon(selectedRow.status)}
                    {getStatusDisplay(selectedRow.status)}
                  </StatusBadge>
                </DetailRow>
              </DetailSection>

              {/* Current Step */}
              <DetailSection>
                <DetailSectionTitle>Current Step</DetailSectionTitle>
                <DetailRow>
                  <DetailKey>Step Name</DetailKey>
                  <DetailValue>{selectedRow.current_step_name ?? '—'}</DetailValue>
                </DetailRow>
                {selectedRow.current_step_order !== null && (
                  <DetailRow>
                    <DetailKey>Step Order</DetailKey>
                    <DetailValue>#{selectedRow.current_step_order}</DetailValue>
                  </DetailRow>
                )}
                {selectedRow.current_step_entity_type && (
                  <DetailRow>
                    <DetailKey>Entity Type</DetailKey>
                    <DetailValue>{selectedRow.current_step_entity_type}</DetailValue>
                  </DetailRow>
                )}
                {selectedRow.current_step_status && (
                  <DetailRow>
                    <DetailKey>Step Status</DetailKey>
                    <DetailValue>{getStatusDisplay(selectedRow.current_step_status)}</DetailValue>
                  </DetailRow>
                )}
                <DetailRow>
                  <Timer size={14} />
                  <DetailKey>Time in Step</DetailKey>
                  <DetailValue>{formatDuration(selectedRow.time_in_current_step_seconds)}</DetailValue>
                </DetailRow>
              </DetailSection>

              {/* Assignment */}
              <DetailSection>
                <DetailSectionTitle>Assigned To</DetailSectionTitle>
                <DetailRow>
                  <User size={14} />
                  <DetailKey>Assignee</DetailKey>
                  <DetailValue>{selectedRow.assigned_to_display ?? 'Unassigned'}</DetailValue>
                </DetailRow>
                {selectedRow.assigned_to?.assignment_type && (
                  <DetailRow>
                    <DetailKey>Assignment Type</DetailKey>
                    <DetailValue>{selectedRow.assigned_to.assignment_type}</DetailValue>
                  </DetailRow>
                )}
                {selectedRow.due_days !== null && (
                  <DetailRow>
                    <DetailKey>SLA (days)</DetailKey>
                    <DetailValue>{selectedRow.due_days} day{selectedRow.due_days === 1 ? '' : 's'}</DetailValue>
                  </DetailRow>
                )}
                {selectedRow.due_at && (
                  <DetailRow>
                    <AlertCircle size={14} />
                    <DetailKey>Due At</DetailKey>
                    <DetailValue style={{ color: selectedRow.is_overdue ? 'rgb(239, 68, 68)' : undefined }}>
                      {new Date(selectedRow.due_at).toLocaleString()}
                    </DetailValue>
                  </DetailRow>
                )}
              </DetailSection>

              {/* History */}
              <DetailSection>
                <DetailSectionTitle>Timeline</DetailSectionTitle>
                <DetailRow>
                  <Calendar size={14} />
                  <DetailKey>Started By</DetailKey>
                  <DetailValue>{selectedRow.created_by_name ?? '—'}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <Calendar size={14} />
                  <DetailKey>Created At</DetailKey>
                  <DetailValue>{selectedRow.created_at ? new Date(selectedRow.created_at).toLocaleString() : '—'}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <Calendar size={14} />
                  <DetailKey>Last Activity</DetailKey>
                  <DetailValue>{formatDate(selectedRow.updated_at)}</DetailValue>
                </DetailRow>
                {selectedRow.current_step_updated_at && (
                  <DetailRow>
                    <Calendar size={14} />
                    <DetailKey>Step Updated</DetailKey>
                    <DetailValue>{formatDate(selectedRow.current_step_updated_at)}</DetailValue>
                  </DetailRow>
                )}
              </DetailSection>

              {/* Submission ID */}
              <DetailSection>
                <DetailSectionTitle>Reference</DetailSectionTitle>
                <DetailRow>
                  <DetailKey>Submission ID</DetailKey>
                  <DetailValue style={{ fontSize: '12px', fontFamily: 'monospace' }}>{selectedRow.id}</DetailValue>
                </DetailRow>
              </DetailSection>
            </DetailBody>
          </DetailPanel>
        </DetailOverlay>
      )}
    </Container>
  );
};

export default Monitoring;
