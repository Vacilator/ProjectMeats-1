import React, { useState, useEffect, useCallback } from 'react';
import { Clock, GitBranch, X, History, RotateCcw } from 'lucide-react';
import { adminClient } from '@/services/apiService';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';
import { formatToLocal } from '@/utils/formatters';

interface Version {
  id: string;
  version: number;
  status: string;
  created_at: string;
  is_published: boolean;
  field_count: number;
  step_count: number;
}

interface VersionHistoryProps {
  blueprintId: string;
  currentVersionId: string;
  onVersionSelect: (versionId: string) => void;
  onRollback: (newVersionId: string) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  blueprintId,
  currentVersionId,
  onVersionSelect,
  onRollback,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);

  const fetchVersionHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminClient.get(
        '/admin/system-config/api/studio/versions/history/',
        {
          params: { blueprint_id: blueprintId },
        }
      );
      setVersions(response.data.versions || []);
    } catch (error) {
      logger.error('Failed to fetch version history:', error);
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void fetchVersionHistory();
  }, [fetchVersionHistory]);

  const handleRollback = async (versionId: string, versionNumber: number) => {
    const ok = await confirmDialog({
      title: `Rollback to version ${versionNumber}?`,
      content: 'This will create a new draft version.',
      okText: 'Rollback',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      const response = await adminClient.post(
        `/admin/system-config/api/studio/versions/${versionId}/rollback/`,
        {}
      );

      showAlert({
        title: 'Rollback complete',
        content: response.data?.message ?? 'Rollback complete.',
        type: 'success',
      });
      onRollback(response.data.new_version_id);
      void fetchVersionHistory();
    } catch (error) {
      logger.error('Rollback failed:', error);
      showAlert({
        title: 'Rollback failed',
        content: 'Failed to rollback. See console for details.',
        type: 'error',
      });
    }
  };

  const handleCompare = async (versionBId: string) => {
    if (!selectedForCompare) return;

    try {
      const response = await adminClient.get(
        `/admin/system-config/api/studio/versions/${selectedForCompare}/compare/`,
        {
          params: { with: versionBId },
        }
      );
      setComparisonData(response.data);
    } catch (error) {
      logger.error('Comparison failed:', error);
      showAlert({
        title: 'Comparison failed',
        content: 'Failed to compare versions. See console for details.',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
        <div className="animate-spin inline-block w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'rgb(var(--color-primary))' }} />
        <p className="mt-2">Loading version history...</p>
      </div>
    );
  }

  if (comparisonData) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Version Comparison</h3>
          <button
            onClick={() => {
              setComparisonData(null);
              setCompareMode(false);
              setSelectedForCompare(null);
            }}
            className="hover:text-[rgb(var(--color-text-secondary))]" style={{ color: 'rgb(var(--color-text-tertiary))' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 rounded-lg" style={{ background: 'rgb(var(--color-info-bg))' }}>
            <div className="font-semibold">Version {comparisonData.version_a.version}</div>
            <div className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{formatToLocal(comparisonData.version_a.created_at)}</div>
            <div className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{comparisonData.version_a.status}</div>
          </div>
          <div className="p-3 bg-[rgb(var(--color-info-bg))] rounded-lg">
            <div className="font-semibold">Version {comparisonData.version_b.version}</div>
            <div className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{formatToLocal(comparisonData.version_b.created_at)}</div>
            <div className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{comparisonData.version_b.status}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Schema Changes</h4>
            <div className="space-y-2 text-sm">
              {comparisonData.differences.schema.added_fields.length > 0 && (
                <div className="p-2 rounded" style={{ background: 'rgb(var(--color-success-bg))' }}>
                  <div className="font-medium" style={{ color: 'rgb(var(--color-success))' }}>
                    + {comparisonData.differences.schema.added_fields.length} fields added
                  </div>
                  <ul className="ml-4 mt-1" style={{ color: 'rgb(var(--color-success))' }}>
                    {comparisonData.differences.schema.added_fields.map((field: Record<string, unknown>) => (
                      <li key={String(field.key ?? '')}>• {String(field.label ?? '')} ({String(field.type ?? '')})</li>
                    ))}
                  </ul>
                </div>
              )}
              {comparisonData.differences.schema.removed_fields.length > 0 && (
                <div className="p-2 rounded" style={{ background: 'rgb(var(--color-error-bg))' }}>
                  <div className="font-medium" style={{ color: 'rgb(var(--color-error))' }}>
                    - {comparisonData.differences.schema.removed_fields.length} fields removed
                  </div>
                  <ul className="ml-4 mt-1" style={{ color: 'rgb(var(--color-error))' }}>
                    {comparisonData.differences.schema.removed_fields.map((field: Record<string, unknown>) => (
                      <li key={String(field.key ?? '')}>• {String(field.label ?? '')} ({String(field.type ?? '')})</li>
                    ))}
                  </ul>
                </div>
              )}
              {comparisonData.differences.schema.modified_fields.length > 0 && (
                <div className="p-2 rounded" style={{ background: 'rgb(var(--color-warning-bg))' }}>
                  <div className="font-medium" style={{ color: 'rgb(var(--color-warning))' }}>
                    ~ {comparisonData.differences.schema.modified_fields.length} fields modified
                  </div>
                </div>
              )}
              {comparisonData.differences.schema.added_fields.length === 0 &&
                comparisonData.differences.schema.removed_fields.length === 0 &&
                comparisonData.differences.schema.modified_fields.length === 0 && (
                  <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No schema changes</div>
                )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Workflow Changes</h4>
            <div className="space-y-2 text-sm">
              {comparisonData.differences.workflow.added_steps.length > 0 && (
                <div className="p-2 rounded" style={{ background: 'rgb(var(--color-success-bg))' }}>
                  <div className="font-medium" style={{ color: 'rgb(var(--color-success))' }}>
                    + {comparisonData.differences.workflow.added_steps.length} steps added
                  </div>
                </div>
              )}
              {comparisonData.differences.workflow.removed_steps.length > 0 && (
                <div className="p-2 rounded" style={{ background: 'rgb(var(--color-error-bg))' }}>
                  <div className="font-medium" style={{ color: 'rgb(var(--color-error))' }}>
                    - {comparisonData.differences.workflow.removed_steps.length} steps removed
                  </div>
                </div>
              )}
              {comparisonData.differences.workflow.modified_steps.length > 0 && (
                <div className="p-2 rounded" style={{ background: 'rgb(var(--color-warning-bg))' }}>
                  <div className="font-medium" style={{ color: 'rgb(var(--color-warning))' }}>
                    ~ {comparisonData.differences.workflow.modified_steps.length} steps modified
                  </div>
                </div>
              )}
              {comparisonData.differences.workflow.added_steps.length === 0 &&
                comparisonData.differences.workflow.removed_steps.length === 0 &&
                comparisonData.differences.workflow.modified_steps.length === 0 && (
                  <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No workflow changes</div>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History size={20} />
          <h3 className="text-lg font-bold">Version History</h3>
        </div>
        <button
          onClick={() => {
            setCompareMode(!compareMode);
            setSelectedForCompare(null);
          }}
          className={`px-3 py-1 text-sm rounded ${
            compareMode
              ? 'bg-[rgb(var(--color-info-bg))]0 text-[rgb(var(--color-text-inverse))]'
              : 'border hover:bg-[rgb(var(--color-bg-secondary))]'
          }`}
          style={!compareMode ? { borderColor: 'rgb(var(--color-border-secondary))', color: 'rgb(var(--color-text-secondary))' } : undefined}
        >
          {compareMode ? 'Cancel Compare' : 'Compare Versions'}
        </button>
      </div>

      {compareMode && (
        <div className="mb-4 p-3 bg-[rgb(var(--color-info-bg))] border border-[rgb(var(--color-border-primary))] rounded text-sm">
          {selectedForCompare
            ? 'Select another version to compare with'
            : 'Select first version to compare'}
        </div>
      )}

      <div className="space-y-3">
        {versions.map((version) => (
          <div
            key={version.id}
            role={compareMode ? 'button' : undefined}
            tabIndex={compareMode ? 0 : undefined}
            className={`p-4 border rounded-lg transition-all ${
              compareMode ? 'cursor-pointer' : ''
            }`}
            style={{
              borderColor: version.id === currentVersionId ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border-primary))',
              background: version.id === currentVersionId ? 'rgb(var(--color-info-bg))' : undefined,
            }}
            onClick={() => {
              if (compareMode) {
                if (!selectedForCompare) {
                  setSelectedForCompare(version.id);
                } else if (selectedForCompare !== version.id) {
                  handleCompare(version.id);
                }
              }
            }}
            onKeyDown={(e) => {
              if (compareMode && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                if (!selectedForCompare) {
                  setSelectedForCompare(version.id);
                } else if (selectedForCompare !== version.id) {
                  handleCompare(version.id);
                }
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch size={16} style={{ color: 'rgb(var(--color-text-quaternary))' }} />
                  <span className="font-semibold">Version {version.version}</span>
                  {version.is_published && (
                    <span className="px-2 py-0.5 text-xs rounded" style={{ background: 'rgb(var(--color-success-bg))', color: 'rgb(var(--color-success))' }}>
                      Published
                    </span>
                  )}
                  {version.status === 'DRAFT' && (
                    <span className="px-2 py-0.5 text-xs rounded" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}>
                      Draft
                    </span>
                  )}
                  {version.id === currentVersionId && (
                    <span className="px-2 py-0.5 text-xs rounded" style={{ background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))' }}>
                      Current
                    </span>
                  )}
                  {compareMode && selectedForCompare === version.id && (
                    <span className="px-2 py-0.5 bg-[rgb(var(--color-info-bg))] text-[rgb(var(--color-primary))] text-xs rounded">
                      Selected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {formatToLocal(version.created_at)}
                  </div>
                  <div>{version.field_count} fields</div>
                  <div>{version.step_count} steps</div>
                </div>
              </div>

              {!compareMode && version.id !== currentVersionId && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onVersionSelect(version.id)}
                    className="px-3 py-1 text-sm hover:bg-[rgb(var(--color-info-bg))] rounded" style={{ color: 'rgb(var(--color-primary))' }}
                  >
                    View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRollback(version.id, version.version);
                    }}
                    className="px-3 py-1 text-sm text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-info-bg))] rounded flex items-center gap-1"
                  >
                    <RotateCcw size={14} />
                    Rollback
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {versions.length === 0 && (
          <div className="text-center py-8" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            No version history available
          </div>
        )}
      </div>
    </div>
  );
};
