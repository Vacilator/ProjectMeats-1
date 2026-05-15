import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import { useParams } from 'react-router-dom';
import { adminClient } from '../../services/apiService';
import { Clock, CheckCircle, Activity, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { logger } from '@/utils/logger';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';


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
  useDocumentTitle('Workflow Execution');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: fetch functions defined below use only `runId`
  }, [runId]);

  const fetchRunDetails = async () => {
    try {
      const response = await adminClient.get(`/admin/system-config/api/runs/${runId}/`);
      setRunData(response.data);
    } catch (error) {
      logger.error('Failed to fetch run details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutionLog = async () => {
    try {
      const response = await adminClient.get(`/admin/system-config/api/runs/${runId}/execution-log/`);
      setExecutionLog(response.data.timeline || []);
    } catch (error) {
      logger.error('Failed to fetch execution log:', error);
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
        return <CheckCircle size={20} style={{ color: 'rgb(var(--color-success))' }} />;
      case 'current':
        return <Activity size={20} className="animate-pulse" style={{ color: 'rgb(var(--color-primary))' }} />;
      case 'pending':
        return <Clock size={20} style={{ color: 'rgb(var(--color-text-quaternary))' }} />;
      default:
        return <AlertCircle size={20} style={{ color: 'rgb(var(--color-text-quaternary))' }} />;
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
      <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!runData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'rgb(var(--color-error))' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Workflow Run Not Found</h1>
          <p className="mt-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>Run ID: {runId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      {/* Header */}
      <div style={{ background: 'rgb(var(--color-bg-primary))', borderBottom: '1px solid rgb(var(--color-border))' }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{runData.workflow_name}</h1>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Run ID: {runData.id}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={
                  runData.status === 'COMPLETED'
                    ? { background: 'rgba(var(--color-success), 0.1)', color: 'rgb(var(--color-success))' }
                    : runData.status === 'FAILED'
                    ? { background: 'rgba(var(--color-error), 0.1)', color: 'rgb(var(--color-error))' }
                    : runData.status === 'IN_PROGRESS'
                    ? { background: 'rgba(var(--color-primary), 0.1)', color: 'rgb(var(--color-primary))' }
                    : { background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-secondary))' }
                }
              >
                {runData.status.replace('_', ' ')}
              </span>
              {runData.status === 'IN_PROGRESS' && (
                <div className="text-right">
                  <div className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Step {runData.current_step_index + 1} of {runData.total_steps}
                  </div>
                  <div className="w-48 rounded-full h-2 mt-1" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${runData.progress_percentage}%`, background: 'rgb(var(--color-primary))' }}
                     />
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
            <div className="rounded-lg p-6" style={{ background: 'rgb(var(--color-bg-primary))', border: '1px solid rgb(var(--color-border))' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>Workflow Steps</h2>
              <div className="space-y-3">
                {runData.step_details && runData.step_details.map((step: StepDetail) => (
                  <div key={step.index} className="pl-4" style={{ borderLeft: '4px solid rgb(var(--color-border))' }}>
                    <div className="flex items-start gap-3">
                      {getStepIcon(step.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{step.label}</h3>
                          <span className="text-xs" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{step.type}</span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Step {step.index + 1}</p>
                        {step.status === 'completed' && (
                          <button
                            onClick={() => toggleStepExpand(step.index)}
                            className="mt-2 text-sm flex items-center gap-1"
                            style={{ color: 'rgb(var(--color-primary))' }}
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
                          <div className="mt-3 p-3 rounded text-xs" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
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
            <div className="rounded-lg p-6" style={{ background: 'rgb(var(--color-bg-primary))', border: '1px solid rgb(var(--color-border))' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>Execution Log</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {executionLog.length === 0 ? (
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No execution log entries yet</p>
                ) : (
                  executionLog.map((entry) => (
                    <div
                      key={`${entry.event}-${entry.step_name ?? ''}-${entry.timestamp ?? ''}`}
                      className="pl-3 py-2"
                      style={{ borderLeft: '2px solid rgb(var(--color-primary))' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-sm">
                          <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {entry.event.replace('_', ' ')}
                          </span>
                          {entry.step_name && (
                            <span style={{ color: 'rgb(var(--color-text-secondary))' }}> - {entry.step_name}</span>
                          )}
                        </div>
                        <span className="text-xs" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      {entry.message && (
                        <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{entry.message}</p>
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
            <div className="rounded-lg p-6" style={{ background: 'rgb(var(--color-bg-primary))', border: '1px solid rgb(var(--color-border))' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>Metadata</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt style={{ color: 'rgb(var(--color-text-tertiary))' }}>Created</dt>
                  <dd className="font-medium mt-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {formatTimestamp(runData.created_on)}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: 'rgb(var(--color-text-tertiary))' }}>Last Updated</dt>
                  <dd className="font-medium mt-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {formatTimestamp(runData.modified_on)}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: 'rgb(var(--color-text-tertiary))' }}>Workflow</dt>
                  <dd className="font-medium mt-1" style={{ color: 'rgb(var(--color-text-primary))' }}>{runData.workflow_slug}</dd>
                </div>
              </dl>
            </div>

            {/* Error Log */}
            {runData.error_log && runData.error_log.length > 0 && (
              <div className="rounded-lg p-6" style={{ background: 'rgba(var(--color-error), 0.05)', border: '1px solid rgba(var(--color-error), 0.2)' }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: 'rgb(var(--color-error))' }}>Errors</h2>
                <div className="space-y-2">
                  {runData.error_log.map((error: any, idx: number) => (
                    <div key={idx} className="text-sm">
                      <div className="font-medium" style={{ color: 'rgb(var(--color-error))' }}>{error.type}</div>
                      <div className="mt-1" style={{ color: 'rgba(var(--color-error), 0.8)' }}>{error.message}</div>
                      {error.timestamp && (
                        <div className="text-xs mt-1" style={{ color: 'rgba(var(--color-error), 0.6)' }}>
                          {formatTimestamp(error.timestamp)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Context Toggle */}
            <div className="rounded-lg p-6" style={{ background: 'rgb(var(--color-bg-primary))', border: '1px solid rgb(var(--color-border))' }}>
              <button
                onClick={() => setShowDataContext(!showDataContext)}
                className="w-full text-left flex items-center justify-between"
              >
                <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Data Context</h2>
                {showDataContext ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
              {showDataContext && (
                <div className="mt-4 p-3 rounded text-xs overflow-auto max-h-96" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
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
