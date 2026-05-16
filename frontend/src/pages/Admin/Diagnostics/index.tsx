/**
 * Admin Diagnostics Page
 *
 * Displays runtime error logs with filtering and summary stats.
 * Admin/superuser only — provides visibility into frontend and API errors.
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import { AdminPage, AdminSection } from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/contexts/AuthContext';
import { withTenantQueryKey } from '@/utils/queryKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorLogEntry {
  id: number;
  level: 'error' | 'warn' | 'fatal';
  source: 'frontend' | 'backend' | 'api';
  message: string;
  stack_trace: string;
  component: string;
  url: string;
  user_agent: string;
  tenant_id: string | null;
  user_id: number | null;
  metadata: Record<string, unknown>;
  fingerprint: string;
  occurrence_count: number;
  created_on: string;
}

interface ErrorSummary {
  last_24h: {
    total: number;
    by_level: Record<string, number>;
    by_source: Record<string, number>;
  };
  last_7d: {
    total: number;
    top_components: Array<{ component: string; count: number }>;
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FiltersRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  align-items: center;
`;

const FilterSelect = styled.select`
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
`;

const SearchInput = styled.input`
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  min-width: 200px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const StatCard = styled.div<{ variant?: 'error' | 'warn' | 'info' }>`
  padding: 16px;
  border-radius: 8px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  text-align: center;

  .value {
    font-size: 28px;
    font-weight: 700;
    color: ${({ variant }) =>
      variant === 'error'
        ? 'rgb(239, 68, 68)'
        : variant === 'warn'
          ? 'rgb(234, 179, 8)'
          : 'rgb(var(--color-text-primary))'};
  }
  .label {
    font-size: 12px;
    color: rgb(var(--color-text-secondary));
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    text-align: left;
    padding: 8px 12px;
    background: rgb(var(--color-surface-hover));
    border-bottom: 2px solid rgb(var(--color-border));
    font-weight: 600;
    color: rgb(var(--color-text-secondary));
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid rgb(var(--color-border));
    vertical-align: top;
  }

  tr:hover td {
    background: rgb(var(--color-surface-hover));
  }
`;

const LevelBadge = styled.span<{ level: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${({ level }) =>
    level === 'fatal'
      ? 'rgba(239, 68, 68, 0.15)'
      : level === 'error'
        ? 'rgba(239, 68, 68, 0.1)'
        : 'rgba(234, 179, 8, 0.1)'};
  color: ${({ level }) =>
    level === 'fatal' || level === 'error'
      ? 'rgb(239, 68, 68)'
      : 'rgb(234, 179, 8)'};
`;

const SourceBadge = styled.span<{ source: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: ${({ source }) =>
    source === 'api'
      ? 'rgba(59, 130, 246, 0.1)'
      : 'rgba(139, 92, 246, 0.1)'};
  color: ${({ source }) =>
    source === 'api' ? 'rgb(59, 130, 246)' : 'rgb(139, 92, 246)'};
`;

const MessageCell = styled.div`
  max-width: 400px;
  word-break: break-word;
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 2px;
  display: flex;
  align-items: center;
`;

const StackTrace = styled.pre`
  margin: 8px 0 0;
  padding: 8px 12px;
  background: rgb(var(--color-surface-hover));
  border-radius: 4px;
  font-size: 11px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: rgb(var(--color-text-secondary));
`;

const MetadataBlock = styled.pre`
  margin: 4px 0 0;
  padding: 6px 10px;
  background: rgb(var(--color-surface-hover));
  border-radius: 4px;
  font-size: 11px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const OccurrenceBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 0 6px;
  height: 20px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  font-size: 11px;
  font-weight: 600;
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ErrorRow({ entry }: { entry: ErrorLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(entry.created_on).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [entry.created_on]);

  const hasDetails = entry.stack_trace || Object.keys(entry.metadata).length > 0;

  return (
    <>
      <tr>
        <td>
          {hasDetails && (
            <ExpandButton onClick={() => setExpanded(!expanded)} aria-label="Toggle details">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </ExpandButton>
          )}
        </td>
        <td><LevelBadge level={entry.level}>{entry.level}</LevelBadge></td>
        <td><SourceBadge source={entry.source}>{entry.source}</SourceBadge></td>
        <td>
          <MessageCell>{entry.message.slice(0, 200)}</MessageCell>
        </td>
        <td>{entry.component || '—'}</td>
        <td>
          {entry.occurrence_count > 1 && (
            <OccurrenceBadge>×{entry.occurrence_count}</OccurrenceBadge>
          )}
        </td>
        <td title={entry.created_on}>{timeAgo}</td>
      </tr>
      {expanded && hasDetails && (
        <tr>
          <td colSpan={7} style={{ padding: '0 12px 12px 40px' }}>
            {entry.stack_trace && (
              <StackTrace>{entry.stack_trace}</StackTrace>
            )}
            {Object.keys(entry.metadata).length > 0 && (
              <MetadataBlock>{JSON.stringify(entry.metadata, null, 2)}</MetadataBlock>
            )}
            {entry.url && (
              <div style={{ fontSize: 11, color: 'rgb(var(--color-text-secondary))', marginTop: 4 }}>
                URL: {entry.url}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function DiagnosticsPage() {
  useDocumentTitle('Diagnostics');
  const { user } = useAuth();
  const toast = useToast();

  const [levelFilter, setLevelFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const summaryQuery = useQuery<ErrorSummary>({
    queryKey: withTenantQueryKey('error-reports-summary'),
    queryFn: async () => {
      try {
        const resp = await businessApi.get('/error-reports/summary/');
        return resp.data;
      } catch {
        return { total: 0, by_level: {}, by_source: {} };
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  const logsQuery = useQuery<ErrorLogEntry[]>({
    queryKey: withTenantQueryKey('error-reports', levelFilter, sourceFilter, searchQuery),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (levelFilter) params.set('level', levelFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        if (searchQuery) params.set('search', searchQuery);
        const resp = await businessApi.get(`/error-reports/?${params.toString()}`);
        return Array.isArray(resp.data?.results) ? resp.data.results : (Array.isArray(resp.data) ? resp.data : []);
      } catch {
        return [];
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  const handlePrune = async () => {
    try {
      await businessApi.delete('/error-reports/prune/');
      toast.success('Old error logs pruned');
      logsQuery.refetch();
      summaryQuery.refetch();
    } catch {
      toast.error('Failed to prune logs');
    }
  };

  const summary = summaryQuery.data;
  const logs = logsQuery.data ?? [];

  const isSuperuserOrAdmin = user?.is_superuser || user?.is_staff;

  if (!isSuperuserOrAdmin) {
    return (
      <AdminPage title="Diagnostics" icon={<AlertTriangle size={20} />}>
        <EmptyState>You need admin privileges to view diagnostics.</EmptyState>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Diagnostics"
      description="Runtime error monitoring and reporting"
      icon={<AlertTriangle size={20} />}
    >
        <AdminSection title="Error Summary (Last 24 Hours)">
          <StatsGrid>
            <StatCard variant="error">
              <div className="value">{summary?.last_24h?.total ?? 0}</div>
              <div className="label">Total Errors (24h)</div>
            </StatCard>
            <StatCard variant="error">
              <div className="value">{summary?.last_24h?.by_level?.error ?? 0}</div>
              <div className="label">Errors</div>
            </StatCard>
            <StatCard variant="warn">
              <div className="value">{summary?.last_24h?.by_level?.warn ?? 0}</div>
              <div className="label">Warnings</div>
            </StatCard>
            <StatCard variant="error">
              <div className="value">{summary?.last_24h?.by_level?.fatal ?? 0}</div>
              <div className="label">Fatal</div>
            </StatCard>
            <StatCard variant="info">
              <div className="value">{summary?.last_24h?.by_source?.frontend ?? 0}</div>
              <div className="label">Frontend</div>
            </StatCard>
            <StatCard variant="info">
              <div className="value">{summary?.last_24h?.by_source?.api ?? 0}</div>
              <div className="label">API</div>
            </StatCard>
          </StatsGrid>

          {summary?.last_7d?.top_components && summary.last_7d.top_components.length > 0 && (
            <div style={{ marginBottom: 16, fontSize: 13, color: 'rgb(var(--color-text-secondary))' }}>
              <strong>Top error components (7d):</strong>{' '}
              {summary.last_7d.top_components
                .slice(0, 5)
                .map((c) => `${c.component || 'unknown'} (${c.count})`)
                .join(' · ')}
            </div>
          )}
        </AdminSection>

        <AdminSection title="Error Logs">
          <FiltersRow>
            <FilterSelect
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              aria-label="Filter by level"
            >
              <option value="">All levels</option>
              <option value="fatal">Fatal</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
            </FilterSelect>

            <FilterSelect
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              <option value="frontend">Frontend</option>
              <option value="api">API</option>
              <option value="backend">Backend</option>
            </FilterSelect>

            <SearchInput
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search error messages"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => { logsQuery.refetch(); summaryQuery.refetch(); }}
              aria-label="Refresh"
            >
              <RefreshCw size={14} />
            </Button>

            {user?.is_superuser && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrune}
                aria-label="Prune old logs"
              >
                <Trash2 size={14} /> Prune 30d+
              </Button>
            )}
          </FiltersRow>

          {logs.length === 0 ? (
            <EmptyState>
              {logsQuery.isLoading ? 'Loading...' : '✅ No errors found — looking good!'}
            </EmptyState>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: 30 }} />
                    <th>Level</th>
                    <th>Source</th>
                    <th>Message</th>
                    <th>Component</th>
                    <th>Count</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry) => (
                    <ErrorRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </AdminSection>
      </AdminPage>
  );
}
