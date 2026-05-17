/**
 * AuditLogViewer Component
 * 
 * Wave 4 Task 4.10: Audit log viewer for admin studio configuration changes.
 * 
 * Displays a filterable, searchable list of configuration changes with:
 * - Timeline view with change type badges
 * - Filter by entity type, change type, user, date range
 * - Search by entity name or notes
 * - Detail modal showing before/after values
 * - Export functionality
 */
import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  configService,
  ConfigAuditLogSummary,
  ConfigAuditLog,
  AuditLogSummaryStats,
  AuditLogFilters,
} from '../../../services/configService';
import { logger } from '@/utils/logger';

interface AuditLogViewerProps {
  /** Filter to specific entity type (e.g., 'TenantConfig', 'SystemChoiceList') */
  entityType?: string;
  /** Show compact view (fewer columns) */
  compact?: boolean;
  /** Initial page size */
  pageSize?: number;
  /** Callback when viewer is closed */
  onClose?: () => void;
}

// Change type badge colors (theme tokens)
const CHANGE_TYPE_COLORS: Record<string, { background: string; color: string }> = {
  CREATE: { background: 'rgb(var(--color-success-bg))', color: 'rgb(var(--color-success))' },
  UPDATE: { background: 'rgb(var(--color-warning-bg))', color: 'rgb(var(--color-warning))' },
  DELETE: { background: 'rgb(var(--color-error-bg))', color: 'rgb(var(--color-error))' },
  IMPORT: { background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))' },
  EXPORT: { background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))' },
};

// Entity type icons
const ENTITY_TYPE_ICONS: Record<string, string> = {
  TenantConfig: '⚙️',
  SystemChoiceList: '📋',
  SystemChoiceItem: '📝',
  SystemFieldSchema: '🔧',
  default: '📦',
};

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  entityType: initialEntityType,
  compact = false,
  pageSize: initialPageSize = 25,
  onClose,
}) => {
  // State
  const [logs, setLogs] = useState<ConfigAuditLogSummary[]>([]);
  const [summary, setSummary] = useState<AuditLogSummaryStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<ConfigAuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({
    entity_type: initialEntityType,
    page: 1,
    page_size: initialPageSize,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  
  // Date filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Load audit logs
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const appliedFilters: AuditLogFilters = {
        ...filters,
        search: searchQuery || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
      
      const [logsResponse, summaryResponse] = await Promise.all([
        configService.getAuditLogs(appliedFilters),
        configService.getAuditLogSummary(),
      ]);
      
      setLogs(logsResponse.results);
      setTotalCount(logsResponse.count);
      setSummary(summaryResponse);
    } catch (err) {
      logger.error('Failed to load audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, dateFrom, dateTo]);
  
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);
  
  // Load log details
  const loadLogDetail = async (id: string) => {
    try {
      const detail = await configService.getAuditLogDetail(id);
      setSelectedLog(detail);
    } catch (err) {
      logger.error('Failed to load log detail:', err);
    }
  };
  
  // Filter handlers
  const handleFilterChange = (key: keyof AuditLogFilters, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1, // Reset to first page on filter change
    }));
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };
  
  // Pagination
  const totalPages = Math.ceil(totalCount / (filters.page_size || initialPageSize));
  
  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };
  
  // Get entity icon
  const getEntityIcon = (entityType: string) => {
    return ENTITY_TYPE_ICONS[entityType] || ENTITY_TYPE_ICONS.default;
  };
  
  // Get change type badge
  const getChangeTypeBadge = (changeType: string) => {
    const colors = CHANGE_TYPE_COLORS[changeType] || { background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-primary))' };
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{ background: colors.background, color: colors.color }}
      >
        {changeType}
      </span>
    );
  };
  
  // Render JSON diff
  const renderValue = (value: unknown) => {
    if (value === null || value === undefined) return <span className="italic" style={{ color: 'rgb(var(--color-text-quaternary))' }}>null</span>;
    if (typeof value === 'object') {
      return (
        <pre className="text-xs p-2 rounded overflow-x-auto" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return <span className="font-mono text-sm">{String(value)}</span>;
  };
  
  return (
    <div className="flex flex-col h-full" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      {/* Header */}
      <div className="border-b p-4" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
              📜 Audit Log
              {totalCount > 0 && (
                <span className="text-sm font-normal" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                  ({totalCount.toLocaleString()} entries)
                </span>
              )}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
              Track all configuration changes with complete history
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
            >
              ✕ Close
            </button>
          )}
        </div>
        
        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by entity name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[rgb(var(--color-primary))] text-sm"
            />
          </form>
          
          {/* Entity Type Filter */}
          <select
            value={filters.entity_type || ''}
            onChange={(e) => handleFilterChange('entity_type', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
          >
            <option value="">All Entity Types</option>
            <option value="TenantConfig">⚙️ TenantConfig</option>
            <option value="SystemChoiceList">📋 SystemChoiceList</option>
            <option value="SystemChoiceItem">📝 SystemChoiceItem</option>
            <option value="SystemFieldSchema">🔧 SystemFieldSchema</option>
          </select>
          
          {/* Change Type Filter */}
          <select
            value={filters.change_type || ''}
            onChange={(e) => handleFilterChange('change_type', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
          >
            <option value="">All Changes</option>
            <option value="CREATE">✨ Created</option>
            <option value="UPDATE">📝 Updated</option>
            <option value="DELETE">🗑️ Deleted</option>
            <option value="IMPORT">📥 Imported</option>
            <option value="EXPORT">📤 Exported</option>
          </select>
          
          {/* Date Range */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
            placeholder="To"
          />
          
          {/* Refresh Button */}
          <button
            onClick={loadLogs}
            className="px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-info-bg))] transition-colors text-sm" style={{ background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      
      {/* Summary Stats (collapsible) */}
      {summary && !compact && (
        <div className="border-b p-4" style={{ background: 'rgb(var(--color-bg-primary))' }}>
          <div className="grid grid-cols-4 gap-4">
            {/* Change Type Breakdown */}
            <div className="rounded-lg p-3" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--color-text-tertiary))' }}>By Change Type</h3>
              <div className="space-y-1">
                {summary.by_change_type.slice(0, 4).map((item) => (
                  <div key={item.change_type} className="flex justify-between text-sm">
                    <span>{item.change_type}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Entity Type Breakdown */}
            <div className="rounded-lg p-3" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--color-text-tertiary))' }}>By Entity Type</h3>
              <div className="space-y-1">
                {summary.by_entity_type.slice(0, 4).map((item) => (
                  <div key={item.entity_type} className="flex justify-between text-sm">
                    <span>{getEntityIcon(item.entity_type)} {item.entity_type}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Top Users */}
            <div className="rounded-lg p-3" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Top Users</h3>
              <div className="space-y-1">
                {summary.by_user.slice(0, 4).map((item) => (
                  <div key={item.user_email} className="flex justify-between text-sm">
                    <span className="truncate max-w-[120px]" title={item.user_email}>
                      {item.user_email || 'System'}
                    </span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Total */}
            <div className="rounded-lg p-3 flex flex-col justify-center items-center" style={{ background: 'rgb(var(--color-info-bg))' }}>
              <span className="text-3xl font-bold" style={{ color: 'rgb(var(--color-primary))' }}>{summary.total_count}</span>
              <span className="text-xs" style={{ color: 'rgb(var(--color-primary))' }}>Total Changes</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="p-4 border-b" style={{ background: 'rgb(var(--color-error-bg))', borderColor: 'rgb(var(--color-error))' }}>
          <div className="text-sm" style={{ color: 'rgb(var(--color-error))' }}>{error}</div>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'rgb(var(--color-primary))' }} />
        </div>
      )}
      
      {/* Log List */}
      {!loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                <div className="text-4xl mb-4">📜</div>
                <p>No audit logs found</p>
                <p className="text-sm mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadLogDetail(log.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadLogDetail(log.id); } }}
                  className="p-4 hover:bg-[rgb(var(--color-bg-secondary))] cursor-pointer transition-colors" style={{ background: 'rgb(var(--color-bg-primary))' }}
                >
                  <div className="flex items-start gap-4">
                    {/* Entity Icon */}
                    <div className="text-2xl">{getEntityIcon(log.entity_type)}</div>
                    
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getChangeTypeBadge(log.change_type)}
                        <span className="font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {log.entity_name}
                        </span>
                        {log.field_name && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'rgb(var(--color-text-tertiary))', background: 'rgb(var(--color-bg-tertiary))' }}>
                            {log.field_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgb(var(--color-bg-tertiary))' }}>
                          {log.entity_type}
                        </span>
                        <span>by {log.user_display}</span>
                      </div>
                    </div>
                    
                    {/* Timestamp */}
                    <div className="text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                      {formatTimestamp(log.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t p-4 flex justify-between items-center" style={{ background: 'rgb(var(--color-bg-primary))' }}>
          <div className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            Page {filters.page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={(filters.page || 1) <= 1}
              className="px-3 py-1 border rounded text-sm hover:bg-[rgb(var(--color-bg-secondary))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={(filters.page || 1) >= totalPages}
              className="px-3 py-1 border rounded text-sm hover:bg-[rgb(var(--color-bg-secondary))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
      
      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-[rgba(var(--color-overlay),0.5)] flex items-center justify-center z-50">
          <div className="rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden" style={{ background: 'rgb(var(--color-bg-primary))' }}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {getEntityIcon(selectedLog.entity_type)}
                  {selectedLog.entity_name}
                </h2>
                <p className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                  {selectedLog.change_type_display} by {selectedLog.user_display}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="hover:text-[rgb(var(--color-text-secondary))]" style={{ color: 'rgb(var(--color-text-quaternary))' }}
              >
                ✕
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>Entity Type:</span>
                    <span className="ml-2 font-medium">{selectedLog.entity_type}</span>
                  </div>
                  <div>
                    <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>Change Type:</span>
                    <span className="ml-2">{getChangeTypeBadge(selectedLog.change_type)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>Timestamp:</span>
                    <span className="ml-2 font-medium">
                      {dayjs(selectedLog.created_at).format('MMM D, YYYY h:mm A')}
                    </span>
                  </div>
                  {selectedLog.ip_address && (
                    <div>
                      <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>IP Address:</span>
                      <span className="ml-2 font-mono text-xs">{selectedLog.ip_address}</span>
                    </div>
                  )}
                </div>
                
                {/* Field Change (for UPDATE) */}
                {selectedLog.field_name && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      Field Changed: <code className="px-1" style={{ background: 'rgb(var(--color-bg-tertiary))' }}>{selectedLog.field_name}</code>
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-error))' }}>Before:</div>
                        {renderValue(selectedLog.old_value)}
                      </div>
                      <div>
                        <div className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-success))' }}>After:</div>
                        {renderValue(selectedLog.new_value)}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Snapshot Before (for DELETE/complex changes) */}
                {selectedLog.snapshot_before && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-error))' }}>Previous State</h3>
                    {renderValue(selectedLog.snapshot_before)}
                  </div>
                )}
                
                {/* Snapshot After (for CREATE/complex changes) */}
                {selectedLog.snapshot_after && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-success))' }}>New State</h3>
                    {renderValue(selectedLog.snapshot_after)}
                  </div>
                )}
                
                {/* Notes */}
                {selectedLog.notes && (
                  <div className="border rounded-lg p-4" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
                    <h3 className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Notes</h3>
                    <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{selectedLog.notes}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t flex justify-end" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] transition-colors text-sm" style={{ background: 'rgb(var(--color-bg-quaternary))', color: 'rgb(var(--color-text-primary))' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
