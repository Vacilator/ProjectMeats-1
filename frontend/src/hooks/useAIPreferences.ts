/**
 * useAIPreferences — Hook for managing user AI settings.
 *
 * Fetches, caches, and updates UserAIPreferences via TanStack Query.
 * Provides optimistic updates for toggle actions.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { userAIPreferencesApi } from '../services/aiService';
import type { UserAIPreferences } from '../services/aiService';
import { withTenantQueryKey } from '../utils/queryKeys';

const AI_PREFS_KEY = 'ai-user-preferences';

const prefsQueryKey = () => withTenantQueryKey(AI_PREFS_KEY);

export function useAIPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery<UserAIPreferences>({
    queryKey: prefsQueryKey(),
    queryFn: userAIPreferencesApi.get,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<UserAIPreferences>) => userAIPreferencesApi.update(data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: prefsQueryKey() });
      const previous = queryClient.getQueryData<UserAIPreferences>(prefsQueryKey());
      if (previous) {
        queryClient.setQueryData<UserAIPreferences>(prefsQueryKey(), {
          ...previous,
          ...newData,
        });
      }
      return { previous };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(prefsQueryKey(), context.previous);
      }
      message.error('Failed to update AI preferences');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: prefsQueryKey() });
    },
    onSuccess: () => {
      message.success('AI preferences updated');
    },
  });

  const toggleApprovalRequired = useCallback(() => {
    const current = query.data?.require_external_approval ?? true;
    mutation.mutate({ require_external_approval: !current });
  }, [query.data, mutation]);

  const toggleConfidenceBadges = useCallback(() => {
    const current = query.data?.show_ai_confidence_badges ?? true;
    mutation.mutate({ show_ai_confidence_badges: !current });
  }, [query.data, mutation]);

  const toggleSuggestions = useCallback(() => {
    const current = query.data?.show_ai_suggestions ?? true;
    mutation.mutate({ show_ai_suggestions: !current });
  }, [query.data, mutation]);

  const updatePreference = useCallback((key: keyof UserAIPreferences, value: unknown) => {
    mutation.mutate({ [key]: value } as Partial<UserAIPreferences>);
  }, [mutation]);

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    updatePreference,
    toggleApprovalRequired,
    toggleConfidenceBadges,
    toggleSuggestions,
    isSaving: mutation.isPending,
  };
}
