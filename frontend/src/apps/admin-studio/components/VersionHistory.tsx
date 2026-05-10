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
      <div className="p-6 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
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
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="font-semibold">Version {comparisonData.version_a.version}</div>
            <div className="text-sm text-gray-600">{formatToLocal(comparisonData.version_a.created_at)}</div>
            <div className="text-xs text-gray-500 mt-1">{comparisonData.version_a.status}</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="font-semibold">Version {comparisonData.version_b.version}</div>
            <div className="text-sm text-gray-600">{formatToLocal(comparisonData.version_b.created_at)}</div>
            <div className="text-xs text-gray-500 mt-1">{comparisonData.version_b.status}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Schema Changes</h4>
            <div className="space-y-2 text-sm">
              {comparisonData.differences.schema.added_fields.length > 0 && (
                <div className="p-2 bg-green-50 rounded">
                  <div className="font-medium text-green-800">
                    + {comparisonData.differences.schema.added_fields.length} fields added
                  </div>
                  <ul className="ml-4 mt-1 text-green-700">
                    {comparisonData.differences.schema.added_fields.map((field: any) => (
                      <li key={field.key}>• {field.label} ({field.type})</li>
                    ))}
                  </ul>
                </div>
              )}
              {comparisonData.differences.schema.removed_fields.length > 0 && (
                <div className="p-2 bg-red-50 rounded">
                  <div className="font-medium text-red-800">
                    - {comparisonData.differences.schema.removed_fields.length} fields removed
                  </div>
                  <ul className="ml-4 mt-1 text-red-700">
                    {comparisonData.differences.schema.removed_fields.map((field: any) => (
                      <li key={field.key}>• {field.label} ({field.type})</li>
                    ))}
                  </ul>
                </div>
              )}
              {comparisonData.differences.schema.modified_fields.length > 0 && (
                <div className="p-2 bg-yellow-50 rounded">
                  <div className="font-medium text-yellow-800">
                    ~ {comparisonData.differences.schema.modified_fields.length} fields modified
                  </div>
                </div>
              )}
              {comparisonData.differences.schema.added_fields.length === 0 &&
                comparisonData.differences.schema.removed_fields.length === 0 &&
                comparisonData.differences.schema.modified_fields.length === 0 && (
                  <div className="text-gray-500">No schema changes</div>
                )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Workflow Changes</h4>
            <div className="space-y-2 text-sm">
              {comparisonData.differences.workflow.added_steps.length > 0 && (
                <div className="p-2 bg-green-50 rounded">
                  <div className="font-medium text-green-800">
                    + {comparisonData.differences.workflow.added_steps.length} steps added
                  </div>
                </div>
              )}
              {comparisonData.differences.workflow.removed_steps.length > 0 && (
                <div className="p-2 bg-red-50 rounded">
                  <div className="font-medium text-red-800">
                    - {comparisonData.differences.workflow.removed_steps.length} steps removed
                  </div>
                </div>
              )}
              {comparisonData.differences.workflow.modified_steps.length > 0 && (
                <div className="p-2 bg-yellow-50 rounded">
                  <div className="font-medium text-yellow-800">
                    ~ {comparisonData.differences.workflow.modified_steps.length} steps modified
                  </div>
                </div>
              )}
              {comparisonData.differences.workflow.added_steps.length === 0 &&
                comparisonData.differences.workflow.removed_steps.length === 0 &&
                comparisonData.differences.workflow.modified_steps.length === 0 && (
                  <div className="text-gray-500">No workflow changes</div>
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
              ? 'bg-purple-500 text-white'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {compareMode ? 'Cancel Compare' : 'Compare Versions'}
        </button>
      </div>

      {compareMode && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded text-sm">
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
              version.id === currentVersionId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${compareMode ? 'cursor-pointer' : ''}`}
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
                  <GitBranch size={16} className="text-gray-400" />
                  <span className="font-semibold">Version {version.version}</span>
                  {version.is_published && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                      Published
                    </span>
                  )}
                  {version.status === 'DRAFT' && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      Draft
                    </span>
                  )}
                  {version.id === currentVersionId && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      Current
                    </span>
                  )}
                  {compareMode && selectedForCompare === version.id && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                      Selected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
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
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRollback(version.id, version.version);
                    }}
                    className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded flex items-center gap-1"
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
          <div className="text-center py-8 text-gray-500">
            No version history available
          </div>
        )}
      </div>
    </div>
  );
};
