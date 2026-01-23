import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://dev.meatscentral.com';

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

interface WorkflowMonitorProps {
  tenantId?: string;
}

export const WorkflowMonitor: React.FC<WorkflowMonitorProps> = ({ tenantId }) => {
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchWorkflows();
    
    if (autoRefresh) {
      const interval = setInterval(fetchWorkflows, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [filter, autoRefresh]);

  const fetchWorkflows = async () => {
    try {
      const params: any = { limit: 50 };
      if (filter !== 'all') {
        params.status = filter;
      }

      const response = await axios.get(
        `${API_BASE}/admin/system-config/api/runs/my-workflows/`,
        {
          params,
          headers: {
            Authorization: `Token ${localStorage.getItem('authToken')}`,
          },
        }
      );
      setWorkflows(response.data.results || []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'FAILED':
        return <XCircle size={20} className="text-red-500" />;
      case 'IN_PROGRESS':
        return <Activity size={20} className="text-blue-500 animate-pulse" />;
      case 'CANCELLED':
        return <AlertCircle size={20} className="text-gray-500" />;
      default:
        return <Clock size={20} className="text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-600';
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="mt-4 text-gray-600">Loading workflow runs...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity size={28} />
              Workflow Monitor
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time execution tracking and debugging
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded flex items-center gap-2 text-sm font-medium ${
                autoRefresh
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
            <button
              onClick={fetchWorkflows}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
            >
              Refresh Now
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex gap-2">
          {['all', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-auto p-6">
        {workflows.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No workflow runs found</p>
            <p className="text-sm mt-2">
              {filter === 'all'
                ? 'Start a workflow to see it here'
                : `No ${filter.replace('_', ' ').toLowerCase()} workflows`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((run) => (
              <div
                key={run.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-all cursor-pointer"
                onClick={() => setSelectedRun(run.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(run.status)}
                      <h3 className="font-semibold text-gray-900">{run.workflow_name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(run.status)}`}>
                        {run.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDate(run.created_on)}
                      </span>
                      <span>Run ID: {run.id.slice(0, 8)}...</span>
                    </div>

                    {/* Progress Bar */}
                    {run.status === 'IN_PROGRESS' && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{run.progress_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${run.progress_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {run.status === 'COMPLETED' && (
                      <div className="text-sm text-green-600 font-medium">
                        ✓ Completed {formatDate(run.modified_on)}
                      </div>
                    )}

                    {run.status === 'FAILED' && (
                      <div className="text-sm text-red-600 font-medium">
                        ✗ Failed - Click to view error details
                      </div>
                    )}
                  </div>

                  <ChevronRight size={20} className="text-gray-400 mt-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Run Details Modal - simplified for now */}
      {selectedRun && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Workflow Run Details</h2>
              <button
                onClick={() => setSelectedRun(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-600">
              Detailed view will open at{' '}
              <a
                href={`/workflows/run/${selectedRun}`}
                className="text-blue-600 hover:underline"
                target="_blank"
              >
                /workflows/run/{selectedRun}
              </a>
            </p>
            <button
              onClick={() => {
                window.location.href = `/workflows/run/${selectedRun}`;
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Open Full Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
