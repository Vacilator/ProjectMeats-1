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
import {
  configService,
  ConfigAuditLogSummary,
  ConfigAuditLog,
  AuditLogSummaryStats,
  AuditLogFilters,
} from '../../../services/configService';

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

// Change type badge colors
const CHANGE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  CREATE: { bg: 'bg-green-100', text: 'text-green-800' },
  UPDATE: { bg: 'bg-amber-100', text: 'text-amber-800' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-800' },
  IMPORT: { bg: 'bg-blue-100', text: 'text-blue-800' },
  EXPORT: { bg: 'bg-purple-100', text: 'text-purple-800' },
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
      console.error('Failed to load audit logs:', err);
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
      console.error('Failed to load log detail:', err);
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
    const colors = CHANGE_TYPE_COLORS[changeType] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
        {changeType}
      </span>
    );
  };
  
  // Render JSON diff
  const renderValue = (value: unknown) => {
    if (value === null || value === undefined) return <span className="text-gray-400 italic">null</span>;
    if (typeof value === 'object') {
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return <span className="font-mono text-sm">{String(value)}</span>;
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📜 Audit Log
              {totalCount > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({totalCount.toLocaleString()} entries)
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Track all configuration changes with complete history
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </form>
          
          {/* Entity Type Filter */}
          <select
            value={filters.entity_type || ''}
            onChange={(e) => handleFilterChange('entity_type', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="To"
          />
          
          {/* Refresh Button */}
          <button
            onClick={loadLogs}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      
      {/* Summary Stats (collapsible) */}
      {summary && !compact && (
        <div className="bg-white border-b p-4">
          <div className="grid grid-cols-4 gap-4">
            {/* Change Type Breakdown */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-xs font-medium text-gray-500 mb-2">By Change Type</h3>
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
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-xs font-medium text-gray-500 mb-2">By Entity Type</h3>
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
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-xs font-medium text-gray-500 mb-2">Top Users</h3>
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
            <div className="bg-blue-50 rounded-lg p-3 flex flex-col justify-center items-center">
              <span className="text-3xl font-bold text-blue-700">{summary.total_count}</span>
              <span className="text-xs text-blue-600">Total Changes</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100">
          <div className="text-red-700 text-sm">{error}</div>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}
      
      {/* Log List */}
      {!loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📜</div>
                <p>No audit logs found</p>
                <p className="text-sm mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => loadLogDetail(log.id)}
                  className="p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Entity Icon */}
                    <div className="text-2xl">{getEntityIcon(log.entity_type)}</div>
                    
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getChangeTypeBadge(log.change_type)}
                        <span className="font-medium text-gray-900 truncate">
                          {log.entity_name}
                        </span>
                        {log.field_name && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {log.field_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {log.entity_type}
                        </span>
                        <span>by {log.user_display}</span>
                      </div>
                    </div>
                    
                    {/* Timestamp */}
                    <div className="text-sm text-gray-500 whitespace-nowrap">
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
        <div className="bg-white border-t p-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Page {filters.page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={(filters.page || 1) <= 1}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={(filters.page || 1) >= totalPages}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
      
      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {getEntityIcon(selectedLog.entity_type)}
                  {selectedLog.entity_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedLog.change_type_display} by {selectedLog.user_display}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
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
                    <span className="text-gray-500">Entity Type:</span>
                    <span className="ml-2 font-medium">{selectedLog.entity_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Change Type:</span>
                    <span className="ml-2">{getChangeTypeBadge(selectedLog.change_type)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Timestamp:</span>
                    <span className="ml-2 font-medium">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </span>
                  </div>
                  {selectedLog.ip_address && (
                    <div>
                      <span className="text-gray-500">IP Address:</span>
                      <span className="ml-2 font-mono text-xs">{selectedLog.ip_address}</span>
                    </div>
                  )}
                </div>
                
                {/* Field Change (for UPDATE) */}
                {selectedLog.field_name && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Field Changed: <code className="bg-gray-100 px-1">{selectedLog.field_name}</code>
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-red-600 font-medium mb-1">Before:</div>
                        {renderValue(selectedLog.old_value)}
                      </div>
                      <div>
                        <div className="text-xs text-green-600 font-medium mb-1">After:</div>
                        {renderValue(selectedLog.new_value)}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Snapshot Before (for DELETE/complex changes) */}
                {selectedLog.snapshot_before && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium text-red-700 mb-2">Previous State</h3>
                    {renderValue(selectedLog.snapshot_before)}
                  </div>
                )}
                
                {/* Snapshot After (for CREATE/complex changes) */}
                {selectedLog.snapshot_after && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium text-green-700 mb-2">New State</h3>
                    {renderValue(selectedLog.snapshot_after)}
                  </div>
                )}
                
                {/* Notes */}
                {selectedLog.notes && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Notes</h3>
                    <p className="text-sm text-gray-600">{selectedLog.notes}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
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
