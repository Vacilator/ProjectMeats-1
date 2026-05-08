/**
 * Form Version Control Hook (Phase 2.4)
 *
 * Manages form versioning with snapshot, rollback, and history capabilities.
 */
import { useState, useEffect, useCallback } from 'react';
import { businessApi } from '@/services/businessApi';
import { logger } from '@/utils/logger';

export interface FormVersion {
  version_number: number;
  change_summary: string;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

export interface VersionDiff {
  [field: string]: {
    old: any;
    new: any;
  };
}

/**
 * Hook for managing form version control.
 *
 * @param formId - UUID of the form
 * @param autoFetch - Whether to automatically fetch version history on mount
 *
 * @returns Object with version control operations:
 *   - versions: Array of version history
 *   - loading: Whether operation is in progress
 *   - error: Error message if operation failed
 *   - enableVersioning: Enable version control for form
 *   - createVersion: Create new version snapshot
 *   - rollback: Rollback to previous version
 *   - compareVersions: Get diff between two versions
 *   - refreshHistory: Manually refresh version history
 *
 * @example
 * ```tsx
 * const FormEditor = ({ formId }) => {
 *   const {
 *     versions,
 *     loading,
 *     enableVersioning,
 *     createVersion,
 *     rollback
 *   } = useFormVersioning(formId);
 *
 *   const handleSave = async () => {
 *     // Save form changes
 *     await saveForm(formData);
 *
 *     // Create version snapshot
 *     await createVersion('Added notification step');
 *   };
 *
 *   return (
 *     <>
 *       <Button onClick={handleSave}>Save & Version</Button>
 *       <VersionHistory
 *         versions={versions}
 *         onRollback={rollback}
 *       />
 *     </>
 *   );
 * };
 * ```
 */
export const useFormVersioning = (formId: string, autoFetch = true) => {
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersionHistory = useCallback(async () => {
    if (!formId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.get(
        `/forms/${formId}/version-history/`
      );
      setVersions(response.data || []);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to fetch version history';
      setError(errorMsg);
      logger.error('Error fetching version history', { component: 'useFormVersioning' }, err);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (autoFetch) {
      fetchVersionHistory();
    }
  }, [fetchVersionHistory, autoFetch]);

  const enableVersioning = useCallback(async () => {
    if (!formId) {
      throw new Error('Form ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.post(
        `/forms/${formId}/enable-versioning/`
      );

      // Refresh history to show initial version
      await fetchVersionHistory();

      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to enable versioning';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [formId, fetchVersionHistory]);

  const createVersion = useCallback(async (changeSummary: string) => {
    if (!formId) {
      throw new Error('Form ID is required');
    }

    if (!changeSummary) {
      throw new Error('Change summary is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.post(
        `/forms/${formId}/create-version/`,
        { change_summary: changeSummary }
      );

      // Refresh history to show new version
      await fetchVersionHistory();

      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to create version';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [formId, fetchVersionHistory]);

  const rollback = useCallback(async (versionNumber: number) => {
    if (!formId) {
      throw new Error('Form ID is required');
    }

    if (!versionNumber || versionNumber < 1) {
      throw new Error('Valid version number is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.post(
        `/forms/${formId}/rollback/`,
        { version_number: versionNumber }
      );

      // Refresh history to show rollback version
      await fetchVersionHistory();

      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to rollback';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [formId, fetchVersionHistory]);

  const compareVersions = useCallback(async (
    versionA: number,
    versionB: number
  ): Promise<VersionDiff> => {
    if (!formId) {
      throw new Error('Form ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.get(
        `/forms/${formId}/compare-versions/`,
        {
          params: {
            version_a: versionA,
            version_b: versionB
          }
        }
      );

      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to compare versions';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  return {
    versions,
    loading,
    error,
    enableVersioning,
    createVersion,
    rollback,
    compareVersions,
    refreshHistory: fetchVersionHistory
  };
};

/**
 * Helper function to check if form has versioning enabled.
 *
 * @param form - Form object
 * @returns True if versioning is enabled
 */
export const isVersioningEnabled = (form: any): boolean => {
  return form?.version_enabled === true;
};

/**
 * Helper function to get current version number.
 *
 * @param form - Form object
 * @returns Current version number or null
 */
export const getCurrentVersion = (form: any): number | null => {
  return form?.current_version?.version_number || null;
};

/**
 * Helper function to format version label.
 *
 * @param version - Version object
 * @returns Formatted label (e.g., "v3 (Current)")
 */
export const formatVersionLabel = (version: FormVersion): string => {
  const label = `v${version.version_number}`;
  return version.is_current ? `${label} (Current)` : label;
};
