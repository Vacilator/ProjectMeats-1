/**
 * Activity & Audit Logs Page
 * 
 * Timeline view of all admin actions for security and compliance.
 * Displays activity logs with filtering, search, and CSV export.
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Clock, 
  User as UserIcon, 
  Download, 
  Filter, 
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Calendar,
  FileText,
  Loader
} from 'lucide-react';
import axios from 'axios';

// Types
interface ActivityLog {
  id: number;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  } | null;
  action: string;
  action_display: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  created_at: string;
  tenant: {
    id: number;
    name: string;
  };
}

interface ActivityFilters {
  search: string;
  action: string;
  entity_type: string;
  start_date: string;
  end_date: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Action type configuration
const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'user.invite', label: 'User Invited' },
  { value: 'user.role_change', label: 'Role Changed' },
  { value: 'user.deactivate', label: 'User Deactivated' },
  { value: 'user.activate', label: 'User Activated' },
  { value: 'profile.update', label: 'Profile Updated' },
  { value: 'config.update', label: 'Configuration Updated' },
  { value: 'theme.update', label: 'Theme Updated' },
  { value: 'optionlist.create', label: 'Option List Created' },
  { value: 'optionlist.update', label: 'Option List Updated' },
  { value: 'optionlist.delete', label: 'Option List Deleted' },
];

const ENTITY_TYPES = [
  { value: '', label: 'All Entities' },
  { value: 'TenantUser', label: 'Users' },
  { value: 'Tenant', label: 'Profile' },
  { value: 'TenantConfiguration', label: 'Configurations' },
  { value: 'SystemChoiceList', label: 'Option Lists' },
];

const ActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>({
    search: '',
    action: '',
    entity_type: '',
    start_date: '',
    end_date: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load activity logs
  const loadLogs = async (pageNum: number = 1, appendMode: boolean = false) => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: pageNum.toString(),
        page_size: '20',
        ordering: '-created_at',
      });

      // Add filters
      if (filters.search) params.append('search', filters.search);
      if (filters.action) params.append('action', filters.action);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.start_date) params.append('created_at__gte', filters.start_date);
      if (filters.end_date) params.append('created_at__lte', filters.end_date);

      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/v1/activity-logs/?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Ensure response.data.results is always an array
      const results = Array.isArray(response.data.results) ? response.data.results : [];
      
      if (appendMode) {
        setLogs(prev => [...prev, ...results]);
      } else {
        setLogs(results);
      }

      setHasMore(!!response.data.next);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load activity logs');
      console.error('Error loading activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load more logs (pagination)
  const loadMore = () => {
    loadLogs(page + 1, true);
  };

  // Apply filters
  const applyFilters = () => {
    setPage(1);
    loadLogs(1, false);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      action: '',
      entity_type: '',
      start_date: '',
      end_date: '',
    });
    setPage(1);
    setTimeout(() => loadLogs(1, false), 0);
  };

  // Export to CSV
  const exportToCsv = async () => {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.action) params.append('action', filters.action);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.start_date) params.append('created_at__gte', filters.start_date);
      if (filters.end_date) params.append('created_at__lte', filters.end_date);

      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/activity-logs/export/?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError('Failed to export activity logs');
      console.error('Error exporting logs:', err);
    } finally {
      setExporting(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadLogs();
  }, []);

  // Format date/time
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    // Relative time for recent activity
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    // Absolute time for older activity
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get action icon
  const getActionIcon = (action: string) => {
    if (action.includes('invite') || action.includes('create')) return <CheckCircle size={16} />;
    if (action.includes('deactivate') || action.includes('delete')) return <XCircle size={16} />;
    if (action.includes('update') || action.includes('change')) return <Info size={16} />;
    return <FileText size={16} />;
  };

  // Get action color
  const getActionColor = (action: string) => {
    if (action.includes('invite') || action.includes('create')) return '#22c55e';
    if (action.includes('deactivate') || action.includes('delete')) return '#ef4444';
    if (action.includes('update') || action.includes('change')) return '#3b82f6';
    return '#6b7280';
  };

  return (
    <Container>
      <Header>
        <div>
          <Title>Activity & Audit Logs</Title>
          <Subtitle>Complete audit trail of all admin actions</Subtitle>
        </div>
        <HeaderActions>
          <FilterButton
            onClick={() => setShowFilters(!showFilters)}
            $active={showFilters}
          >
            <Filter size={18} />
            Filters
          </FilterButton>
          <ExportButton
            onClick={exportToCsv}
            disabled={exporting || logs.length === 0}
          >
            {exporting ? <Loader size={18} className="spin" /> : <Download size={18} />}
            Export CSV
          </ExportButton>
        </HeaderActions>
      </Header>

      {showFilters && (
        <FiltersPanel>
          <FiltersGrid>
            <FilterGroup>
              <FilterLabel>
                <Search size={16} />
                Search
              </FilterLabel>
              <FilterInput
                type="text"
                placeholder="Search description, entity..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Action Type</FilterLabel>
              <FilterSelect
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              >
                {ACTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Entity Type</FilterLabel>
              <FilterSelect
                value={filters.entity_type}
                onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              >
                {ENTITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>
                <Calendar size={16} />
                Start Date
              </FilterLabel>
              <FilterInput
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>
                <Calendar size={16} />
                End Date
              </FilterLabel>
              <FilterInput
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </FilterGroup>
          </FiltersGrid>

          <FiltersActions>
            <ResetButton onClick={resetFilters}>Reset All</ResetButton>
            <ApplyButton onClick={applyFilters}>Apply Filters</ApplyButton>
          </FiltersActions>
        </FiltersPanel>
      )}

      {error && (
        <ErrorMessage>
          <AlertCircle size={18} />
          {error}
        </ErrorMessage>
      )}

      {loading && logs.length === 0 ? (
        <LoadingState>
          <Loader size={32} className="spin" />
          <p>Loading activity logs...</p>
        </LoadingState>
      ) : logs.length === 0 ? (
        <EmptyState>
          <Clock size={48} />
          <h3>No Activity Yet</h3>
          <p>Activity logs will appear here as admin actions are performed.</p>
        </EmptyState>
      ) : (
        <>
          <Timeline>
            {logs.map((log, index) => (
              <TimelineItem key={log.id}>
                <TimelineDot $color={getActionColor(log.action)}>
                  {getActionIcon(log.action)}
                </TimelineDot>
                {index < logs.length - 1 && <TimelineLine />}
                
                <ActivityCard>
                  <ActivityHeader>
                    <ActivityMeta>
                      <ActionBadge $color={getActionColor(log.action)}>
                        {log.action_display}
                      </ActionBadge>
                      <ActivityTime>
                        <Clock size={14} />
                        {formatDateTime(log.created_at)}
                      </ActivityTime>
                    </ActivityMeta>
                    
                    <ActivityUser>
                      <UserIcon size={14} />
                      {log.user 
                        ? `${log.user.first_name} ${log.user.last_name}`.trim() || log.user.username
                        : 'System'}
                    </ActivityUser>
                  </ActivityHeader>

                  <ActivityDescription>{log.description}</ActivityDescription>

                  {(log.entity_type || log.ip_address) && (
                    <ActivityFooter>
                      {log.entity_type && (
                        <EntityInfo>
                          <FileText size={14} />
                          {log.entity_type}
                          {log.entity_id && ` #${log.entity_id}`}
                        </EntityInfo>
                      )}
                      {log.ip_address && (
                        <IpInfo>
                          IP: {log.ip_address}
                        </IpInfo>
                      )}
                    </ActivityFooter>
                  )}
                </ActivityCard>
              </TimelineItem>
            ))}
          </Timeline>

          {hasMore && (
            <LoadMoreContainer>
              <LoadMoreButton onClick={loadMore} disabled={loading}>
                {loading ? (
                  <>
                    <Loader size={18} className="spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </LoadMoreButton>
            </LoadMoreContainer>
          )}
        </>
      )}
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.5rem 0;
`;

const Subtitle = styled.p`
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 100%;
    
    button {
      flex: 1;
    }
  }
`;

const FilterButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-bg-secondary))'};
  color: ${props => props.$active ? '#ffffff' : 'rgb(var(--color-text-primary))'};
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$active ? 'rgb(var(--color-primary-dark))' : 'rgb(var(--color-bg-tertiary))'};
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const ExportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: rgb(var(--color-primary));
  color: #ffffff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgb(var(--color-primary-dark));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
`;

const FiltersPanel = styled.div`
  background: rgb(var(--color-bg-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FilterLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
`;

const FilterInput = styled.input`
  padding: 0.625rem;
  background: rgb(var(--color-bg-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const FilterSelect = styled.select`
  padding: 0.625rem;
  background: rgb(var(--color-bg-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const FiltersActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;

  @media (max-width: 768px) {
    button {
      flex: 1;
    }
  }
`;

const ResetButton = styled.button`
  padding: 0.625rem 1rem;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-bg-tertiary));
  }
`;

const ApplyButton = styled.button`
  padding: 0.625rem 1.5rem;
  background: rgb(var(--color-primary));
  color: #ffffff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-primary-dark));
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 0.5rem;
  color: #ef4444;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;

  .spin {
    animation: spin 1s linear infinite;
    color: rgb(var(--color-primary));
  }

  p {
    color: rgb(var(--color-text-secondary));
    font-size: 0.875rem;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;

  svg {
    color: rgb(var(--color-text-tertiary));
    margin-bottom: 1rem;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
    margin: 0 0 0.5rem 0;
  }

  p {
    color: rgb(var(--color-text-secondary));
    font-size: 0.875rem;
    max-width: 400px;
  }
`;

const Timeline = styled.div`
  position: relative;
`;

const TimelineItem = styled.div`
  position: relative;
  display: flex;
  gap: 1.5rem;
  padding-bottom: 1.5rem;

  &:last-child {
    padding-bottom: 0;
  }
`;

const TimelineDot = styled.div<{ $color: string }>`
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: ${props => props.$color};
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
`;

const TimelineLine = styled.div`
  position: absolute;
  left: 1rem;
  top: 2rem;
  bottom: 0;
  width: 2px;
  background: rgb(var(--color-border));
`;

const ActivityCard = styled.div`
  flex: 1;
  background: rgb(var(--color-bg-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const ActivityHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const ActivityMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const ActionBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  background: ${props => `${props.$color}15`};
  color: ${props => props.$color};
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const ActivityTime = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: rgb(var(--color-text-tertiary));
  font-size: 0.8125rem;
`;

const ActivityUser = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.8125rem;
  font-weight: 500;
`;

const ActivityDescription = styled.p`
  color: rgb(var(--color-text-primary));
  font-size: 0.9375rem;
  line-height: 1.5;
  margin: 0 0 0.75rem 0;
`;

const ActivityFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgb(var(--color-border));
  flex-wrap: wrap;
`;

const EntityInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: rgb(var(--color-text-tertiary));
  font-size: 0.8125rem;
`;

const IpInfo = styled.div`
  color: rgb(var(--color-text-tertiary));
  font-size: 0.8125rem;
  font-family: monospace;
`;

const LoadMoreContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgb(var(--color-border));
`;

const LoadMoreButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 2rem;
  background: rgb(var(--color-bg-secondary));
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgb(var(--color-bg-tertiary));
    border-color: rgb(var(--color-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
`;

export default ActivityPage;
