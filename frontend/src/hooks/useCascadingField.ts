/**
 * Cascading Field Hook (Phase 2.3: Entity Cascading)
 * 
 * Handles dependent field filtering based on parent field selections.
 * Example: Selecting "Beef" in protein type automatically filters product cuts to beef-only.
 */
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { businessApi } from '@/services/businessApi';
import { EMPTY_CHOICES } from '@/services/choiceConstants';

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
  enabled = true,
  fetchOptions: customFetchOptions,
}: {
  fieldId: string;
  parentValue: any;
  enabled?: boolean;
  fetchOptions?: (parentValue: any) => Promise<CascadingFieldOption[]>;
}) => {
  const parentSignature = useMemo(() => {
    if (Array.isArray(parentValue)) {
      return parentValue
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .join('\u0001');
    }

    if (parentValue == null) return '';
    if (typeof parentValue === 'string') return parentValue.trim();
    return String(parentValue);
  }, [parentValue]);

  const normalizedParentValue = useMemo(() => {
    if (Array.isArray(parentValue)) {
      return parentValue.map((item) => String(item ?? '').trim()).filter(Boolean);
    }

    if (typeof parentValue === 'string') return parentValue.trim();
    return parentValue;
  }, [parentSignature]);

  const hasParentValue = Array.isArray(normalizedParentValue)
    ? normalizedParentValue.length > 0
    : Boolean(normalizedParentValue);

  const queryEnabled = enabled && hasParentValue && Boolean(fieldId);

  const query = useQuery<CascadingFieldOption[]>({
    queryKey: ['cascading-field-options', fieldId, parentSignature],
    enabled: queryEnabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (customFetchOptions) {
        const nextOptions = await customFetchOptions(normalizedParentValue);
        return Array.isArray(nextOptions) && nextOptions.length > 0
          ? nextOptions
          : (EMPTY_CHOICES as CascadingFieldOption[]);
      }

      const response = await businessApi.get(`/form-fields/${fieldId}/cascade-options/`, {
        params: { parent_value: normalizedParentValue },
      });

      return Array.isArray(response.data) && response.data.length > 0
        ? response.data
        : (EMPTY_CHOICES as CascadingFieldOption[]);
    },
  });

  const errorMessage = query.error
    ? ((query.error as any)?.response?.data?.error as string | undefined) ||
      'Failed to fetch cascaded options'
    : null;

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    options: queryEnabled
      ? query.data ?? (EMPTY_CHOICES as CascadingFieldOption[])
      : (EMPTY_CHOICES as CascadingFieldOption[]),
    loading: query.isFetching,
    error: queryEnabled ? errorMessage : null,
    refresh,
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
