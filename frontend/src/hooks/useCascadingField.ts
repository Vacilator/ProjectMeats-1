/**
 * Cascading Field Hook (Phase 2.3: Entity Cascading)
 * 
 * Handles dependent field filtering based on parent field selections.
 * Example: Selecting "Beef" in protein type automatically filters product cuts to beef-only.
 */
import { useState, useEffect, useCallback } from 'react';
import { businessApi } from '@/services/businessApi';

export interface CascadingFieldOption {
  value: string;
  label: string;
}

export interface CascadingFieldConfig {
  fieldId: string;
  parentFieldKey: string;
  filterKey: string;
  enabled: boolean;
}

/**
 * Hook for managing cascading field options.
 * 
 * @param fieldId - UUID of the field with cascading enabled
 * @param parentValue - Current value of the parent field
 * @param enabled - Whether cascading is enabled for this field
 * 
 * @returns Object with:
 *   - options: Filtered options based on parent value
 *   - loading: Whether options are being fetched
 *   - error: Error message if fetch failed
 *   - refresh: Function to manually refresh options
 * 
 * @example
 * ```tsx
 * const MyForm = () => {
 *   const [proteinType, setProteinType] = useState('');
 *   
 *   const {
 *     options: cutOptions,
 *     loading,
 *     error
 *   } = useCascadingField({
 *     fieldId: 'cuts-field-uuid',
 *     parentValue: proteinType,
 *     enabled: !!proteinType
 *   });
 *   
 *   return (
 *     <>
 *       <Select
 *         value={proteinType}
 *         onChange={setProteinType}
 *         options={[
 *           { value: 'Beef', label: 'Beef' },
 *           { value: 'Chicken', label: 'Chicken' }
 *         ]}
 *       />
 *       
 *       <Select
 *         value={cut}
 *         onChange={setCut}
 *         options={cutOptions}
 *         loading={loading}
 *         disabled={!proteinType || loading}
 *       />
 *     </>
 *   );
 * };
 * ```
 */
export const useCascadingField = ({
  fieldId,
  parentValue,
  enabled = true
}: {
  fieldId: string;
  parentValue: any;
  enabled?: boolean;
}) => {
  const [options, setOptions] = useState<CascadingFieldOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    if (!enabled || !parentValue || !fieldId) {
      setOptions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.get(
        `/form-fields/${fieldId}/cascade-options/`,
        {
          params: { parent_value: parentValue }
        }
      );
      
      setOptions(response.data || []);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to fetch cascaded options';
      setError(errorMsg);
      console.error('[useCascadingField] Error fetching options:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [fieldId, parentValue, enabled]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return {
    options,
    loading,
    error,
    refresh: fetchOptions
  };
};

/**
 * Helper function to check if a field has cascading enabled.
 * 
 * @param field - Field configuration object
 * @returns True if cascading is enabled and properly configured
 */
export const isCascadingField = (field: any): boolean => {
  return !!(
    field?.cascade_enabled &&
    field?.cascade_parent_field &&
    field?.cascade_filter_key
  );
};

/**
 * Helper function to get cascading configuration from field.
 * 
 * @param field - Field configuration object
 * @returns Cascading config or null if not configured
 */
export const getCascadingConfig = (field: any): CascadingFieldConfig | null => {
  if (!isCascadingField(field)) {
    return null;
  }

  return {
    fieldId: field.id,
    parentFieldKey: field.cascade_parent_field_key,
    filterKey: field.cascade_filter_key,
    enabled: field.cascade_enabled
  };
};
