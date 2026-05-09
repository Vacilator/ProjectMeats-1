/**
 * Activity & Audit Logs Page
 *
 * Timeline view of admin actions with filtering and CSV export.
 */
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Filter,
  Info,
  Loader,
  Search,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, AdminSection, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { logger } from '@/utils/logger';

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

type Tone = 'success' | 'danger' | 'info' | 'neutral';

const getActionTone = (action: string): Tone => {
  if (action.includes('invite') || action.includes('create')) return 'success';
  if (action.includes('deactivate') || action.includes('delete')) return 'danger';
  if (action.includes('update') || action.includes('change') || action.includes('role')) return 'info';
  return 'neutral';
};

const ActivityPage: React.FC = () => {
  const { permissions } = useAdminPermissions();
  const canView = permissions.can_view_audit_logs;

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const defaultFilters: ActivityFilters = {
    search: '',
    action: '',
    entity_type: '',
    start_date: '',
    end_date: '',
  };

  const [draftFilters, setDraftFilters] = useState<ActivityFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ActivityFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  const buildParams = (filters: ActivityFilters, pageNum: number) => {
    const params: Record<string, string | number> = {
      page: pageNum,
      page_size: 20,
      ordering: '-created_at',
    };

    if (filters.search) params.search = filters.search;
    if (filters.action) params.action = filters.action;
    if (filters.entity_type) params.entity_type = filters.entity_type;
    if (filters.start_date) params.created_at__gte = filters.start_date;
    if (filters.end_date) params.created_at__lte = filters.end_date;

    return params;
  };

  const loadLogs = async (
    pageNum: number = 1,
    appendMode: boolean = false,
    filters: ActivityFilters = appliedFilters
  ) => {
    try {
      setLoading(true);
      setError('');

      const params = buildParams(filters, pageNum);
      const response = await apiClient.get('/activity-logs/', { params });
      const results = Array.isArray((response.data as any)?.results) ? (response.data as any).results : [];

      if (appendMode) {
        setLogs((prev) => [...prev, ...results]);
      } else {
        setLogs(results);
      }

      setHasMore(Boolean((response.data as any)?.next));
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load activity logs');
      logger.error('Error loading activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => loadLogs(page + 1, true, appliedFilters);

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(1);
    setShowFilters(false);
    loadLogs(1, false, draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(1);
    setShowFilters(false);
    setTimeout(() => loadLogs(1, false, defaultFilters), 0);
  };

  const refresh = () => loadLogs(1, false, appliedFilters);

  const exportToCsv = async () => {
    try {
      setExporting(true);

      const params: Record<string, string> = {};
      if (appliedFilters.search) params.search = appliedFilters.search;
      if (appliedFilters.action) params.action = appliedFilters.action;
      if (appliedFilters.entity_type) params.entity_type = appliedFilters.entity_type;
      if (appliedFilters.start_date) params.created_at__gte = appliedFilters.start_date;
      if (appliedFilters.end_date) params.created_at__lte = appliedFilters.end_date;

      const response = await apiClient.get('/activity-logs/export/', {
        params,
        responseType: 'blob',
      });

      const data = response.data as any;
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to export activity logs');
      logger.error('Error exporting logs:', err);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    loadLogs(1, false, appliedFilters);
  }, [canView]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    if (action.includes('invite') || action.includes('create')) return <CheckCircle size={16} />;
    if (action.includes('deactivate') || action.includes('delete')) return <XCircle size={16} />;
    if (action.includes('update') || action.includes('change') || action.includes('role')) return <Info size={16} />;
    return <FileText size={16} />;
  };

  return (
    <AdminPage
      title="Activity & Audit Logs"
      description="Complete audit trail of admin actions for your tenant."
      icon="🕒"
      actions={
        canView ? (
          <>
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((s) => !s)}
              aria-pressed={showFilters}
            >
              <Filter size={16} /> Filters
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <Loader size={16} /> Refresh
            </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={exportToCsv}
            disabled={exporting || logs.length === 0}
          >
            {exporting ? <Loader size={16} /> : <Download size={16} />}
            Export CSV
          </Button>
          </>
        ) : undefined
      }
      headerExtras={
        showFilters ? (
          <FiltersCard>
            <FiltersGrid>
              <FilterGroup>
                <FilterLabel>
                  <Search size={14} /> Search
                </FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Search description, entity…"
                  value={draftFilters.search}
                  onChange={(e) => setDraftFilters({ ...draftFilters, search: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </FilterGroup>

              <FilterGroup>
                <FilterLabel>Action Type</FilterLabel>
                <FilterSelect
                  value={draftFilters.action}
                  onChange={(e) => setDraftFilters({ ...draftFilters, action: e.target.value })}
                >
                  {ACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterGroup>

              <FilterGroup>
                <FilterLabel>Entity Type</FilterLabel>
                <FilterSelect
                  value={draftFilters.entity_type}
                  onChange={(e) => setDraftFilters({ ...draftFilters, entity_type: e.target.value })}
                >
                  {ENTITY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterGroup>

              <FilterGroup>
                <FilterLabel>
                  <Calendar size={14} /> Start Date
                </FilterLabel>
                <FilterInput
                  type="date"
                  value={draftFilters.start_date}
                  onChange={(e) => setDraftFilters({ ...draftFilters, start_date: e.target.value })}
                />
              </FilterGroup>

              <FilterGroup>
                <FilterLabel>
                  <Calendar size={14} /> End Date
                </FilterLabel>
                <FilterInput
                  type="date"
                  value={draftFilters.end_date}
                  onChange={(e) => setDraftFilters({ ...draftFilters, end_date: e.target.value })}
                />
              </FilterGroup>
            </FiltersGrid>

            <FiltersActions>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={applyFilters}>
                Apply
              </Button>
            </FiltersActions>
          </FiltersCard>
        ) : null
      }
    >
      <AdminGuard
        feature="audit_logs"
        allow={(p) => p.can_view_audit_logs}
        loadingFallback={<LoadingSkeleton type="list" rows={8} />}
      >
        {error && (
        <ErrorBanner role="alert">
          <AlertCircle size={18} />
          {error}
        </ErrorBanner>
      )}

      <AdminSection>
        {loading && logs.length === 0 ? (
          <LoadingSkeleton type="list" rows={8} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title="No activity yet"
            message="Activity logs will appear here as admin actions are performed."
          />
        ) : (
          <Timeline>
            {logs.map((log, index) => {
              const tone = getActionTone(log.action);
              return (
                <TimelineItem key={log.id}>
                  <TimelineDot $tone={tone} aria-hidden="true">
                    {getActionIcon(log.action)}
                  </TimelineDot>
                  {index < logs.length - 1 && <TimelineLine aria-hidden="true" />}

                  <ActivityCard>
                    <ActivityHeader>
                      <ActivityMeta>
                        <ActionBadge $tone={tone}>{log.action_display}</ActionBadge>
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
                        {log.ip_address && <IpInfo>IP: {log.ip_address}</IpInfo>}
                      </ActivityFooter>
                    )}
                  </ActivityCard>
                </TimelineItem>
              );
            })}

            {hasMore && (
              <LoadMoreContainer>
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader size={16} /> Loading…
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </LoadMoreContainer>
            )}
          </Timeline>
        )}
      </AdminSection>
      </AdminGuard>
    </AdminPage>
  );
};

const FiltersCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 14px;
`;

const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FilterLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 650;
  color: rgb(var(--color-text-secondary));
`;

const controlStyles = `
  padding: 10px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const FilterInput = styled.input`
  ${controlStyles}
`;

const FilterSelect = styled.select`
  ${controlStyles}
  cursor: pointer;
`;

const FiltersActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(var(--color-error), 0.12);
  border: 1px solid rgba(var(--color-error), 0.24);
  border-radius: var(--radius-lg);
  color: rgb(var(--color-error));
  font-size: 13px;
`;

const Timeline = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const TimelineItem = styled.div`
  position: relative;
  display: flex;
  gap: 14px;
`;

const TimelineDot = styled.div<{ $tone: Tone }>`
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: ${(p) => toneToColor(p.$tone)};
  color: rgb(var(--color-text-inverse));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
`;

const TimelineLine = styled.div`
  position: absolute;
  left: 16px;
  top: 32px;
  bottom: -14px;
  width: 2px;
  background: rgb(var(--color-border));
`;

const ActivityCard = styled.div`
  flex: 1;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: rgba(var(--color-primary), 0.55);
    box-shadow: var(--shadow-sm);
  }
`;

const ActivityHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ActivityMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const ActionBadge = styled.span<{ $tone: Tone }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: ${(p) => toneToBg(p.$tone)};
  color: ${(p) => toneToColor(p.$tone)};
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const ActivityTime = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const ActivityUser = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  font-weight: 600;
`;

const ActivityDescription = styled.p`
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 10px 0;
`;

const ActivityFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid rgb(var(--color-border));
  flex-wrap: wrap;
`;

const EntityInfo = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const IpInfo = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  font-family: var(--font-mono);
`;

const LoadMoreContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 8px;
`;

function toneToColor(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'rgb(var(--color-success))';
    case 'danger':
      return 'rgb(var(--color-danger))';
    case 'info':
      return 'rgb(var(--color-info))';
    default:
      return 'rgb(var(--color-text-secondary))';
  }
}

function toneToBg(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'rgba(var(--color-success), 0.14)';
    case 'danger':
      return 'rgba(var(--color-danger), 0.14)';
    case 'info':
      return 'rgba(var(--color-info), 0.14)';
    default:
      return 'rgba(var(--color-text-secondary), 0.14)';
  }
}

export default ActivityPage;
