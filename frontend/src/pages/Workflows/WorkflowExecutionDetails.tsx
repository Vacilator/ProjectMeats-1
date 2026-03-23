import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { adminClient } from '../../services/apiService';
import { Clock, CheckCircle, Activity, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';


interface StepDetail {
  index: number;
  id: string;
  label: string;
  type: string;
  status: 'completed' | 'current' | 'pending';
}

interface ExecutionLogEntry {
  timestamp: string;
  event: string;
  step_index: number;
  step_name?: string;
  message?: string;
  data_summary?: any;
}

export const WorkflowExecutionDetails: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const [runData, setRunData] = useState<any>(null);
  const [executionLog, setExecutionLog] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDataContext, setShowDataContext] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (runId) {
      fetchRunDetails();
      fetchExecutionLog();
    }
  }, [runId]);

  const fetchRunDetails = async () => {
    try {
      const response = await adminClient.get(`/admin/system-config/api/runs/${runId}/`);
      setRunData(response.data);
    } catch (error) {
      console.error('Failed to fetch run details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutionLog = async () => {
    try {
      const response = await adminClient.get(`/admin/system-config/api/runs/${runId}/execution-log/`);
      setExecutionLog(response.data.timeline || []);
    } catch (error) {
      console.error('Failed to fetch execution log:', error);
    }
  };

  const toggleStepExpand = (stepIndex: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepIndex)) {
      newExpanded.delete(stepIndex);
    } else {
      newExpanded.add(stepIndex);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'current':
        return <Activity size={20} className="text-blue-500 animate-pulse" />;
      case 'pending':
        return <Clock size={20} className="text-gray-300" />;
      default:
        return <AlertCircle size={20} className="text-gray-400" />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading execution details...</p>
        </div>
      </div>
    );
  }

  if (!runData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Workflow Run Not Found</h1>
          <p className="text-gray-600 mt-2">Run ID: {runId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{runData.workflow_name}</h1>
              <p className="text-sm text-gray-500 mt-1">Run ID: {runData.id}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  runData.status === 'COMPLETED'
                    ? 'bg-green-100 text-green-800'
                    : runData.status === 'FAILED'
                    ? 'bg-red-100 text-red-800'
                    : runData.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {runData.status.replace('_', ' ')}
              </span>
              {runData.status === 'IN_PROGRESS' && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Step {runData.current_step_index + 1} of {runData.total_steps}
                  </div>
                  <div className="w-48 bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${runData.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Step Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workflow Steps */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Workflow Steps</h2>
              <div className="space-y-3">
                {runData.step_details && runData.step_details.map((step: StepDetail) => (
                  <div key={step.index} className="border-l-4 border-gray-200 pl-4">
                    <div className="flex items-start gap-3">
                      {getStepIcon(step.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{step.label}</h3>
                          <span className="text-xs text-gray-500">{step.type}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Step {step.index + 1}</p>
                        {step.status === 'completed' && (
                          <button
                            onClick={() => toggleStepExpand(step.index)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {expandedSteps.has(step.index) ? (
                              <>
                                <ChevronDown size={16} /> Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronRight size={16} /> Show Details
                              </>
                            )}
                          </button>
                        )}
                        {expandedSteps.has(step.index) && (
                          <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(
                                runData.data_context.steps?.find(
                                  (s: any) => s.step_index === step.index
                                ),
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Log */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Execution Log</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {executionLog.length === 0 ? (
                  <p className="text-sm text-gray-500">No execution log entries yet</p>
                ) : (
                  executionLog.map((entry, idx) => (
                    <div
                      key={idx}
                      className="border-l-2 border-blue-300 pl-3 py-2 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">
                            {entry.event.replace('_', ' ')}
                          </span>
                          {entry.step_name && (
                            <span className="text-gray-600"> - {entry.step_name}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      {entry.message && (
                        <p className="text-xs text-gray-600 mt-1">{entry.message}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Metadata & Actions */}
          <div className="space-y-6">
            {/* Metadata */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Metadata</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="font-medium text-gray-900 mt-1">
                    {formatTimestamp(runData.created_on)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Last Updated</dt>
                  <dd className="font-medium text-gray-900 mt-1">
                    {formatTimestamp(runData.modified_on)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Workflow</dt>
                  <dd className="font-medium text-gray-900 mt-1">{runData.workflow_slug}</dd>
                </div>
              </dl>
            </div>

            {/* Error Log */}
            {runData.error_log && runData.error_log.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-lg font-bold text-red-900 mb-4">Errors</h2>
                <div className="space-y-2">
                  {runData.error_log.map((error: any, idx: number) => (
                    <div key={idx} className="text-sm">
                      <div className="font-medium text-red-800">{error.type}</div>
                      <div className="text-red-600 mt-1">{error.message}</div>
                      {error.timestamp && (
                        <div className="text-xs text-red-500 mt-1">
                          {formatTimestamp(error.timestamp)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Context Toggle */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <button
                onClick={() => setShowDataContext(!showDataContext)}
                className="w-full text-left flex items-center justify-between"
              >
                <h2 className="text-lg font-bold text-gray-900">Data Context</h2>
                {showDataContext ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
              {showDataContext && (
                <div className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-96">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(runData.data_context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
