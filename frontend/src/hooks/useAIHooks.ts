/**
 * Shared AI hooks — reusable TanStack Query patterns for AI operations.
 *
 * Centralizes pending review queries, resolve mutations, and feedback mutations
 * so every consumer uses the same query keys, invalidation patterns, and error handling.
 */

import { useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { message } from 'antd';
import {
  aiStaffApi,
  aiFeedbackApi,
  type PendingReviewItem,
  type PendingReviewResolveRequest,
  type PendingReviewResolveResponse,
  type AIInboxFeedbackSubmitRequest,
  type AIInboxFeedbackSubmitResponse,
} from '../services/aiService';
import { normalizeAIError, AI_QUERY_KEYS } from '../utils/apiRetry';
import { withTenantQueryKey } from '../utils/queryKeys';

// ============================================================================
// Query Keys (stable, tenant-scoped)
// ============================================================================

const PENDING_REVIEWS_KEY = 'ai-pending-reviews';

const pendingReviewsQueryKey = (highlightedId?: string | null) =>
  withTenantQueryKey(PENDING_REVIEWS_KEY, highlightedId ?? '');

// ============================================================================
// useAIPendingReviews
// ============================================================================

export interface UseAIPendingReviewsOptions {
  /** Highlighted draft ID to prioritize in the list */
  highlightedId?: string | null;
  /** Polling interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Additional TanStack Query options */
  enabled?: boolean;
}

/**
 * Fetch pending AI review items with stable query keys.
 *
 * Replaces inline useQuery({ queryKey: [...], queryFn: aiStaffApi.listPendingReviews })
 * patterns used across AICommandCenter, Cockpit surfaces, MyTasks, etc.
 */
export function useAIPendingReviews(options: UseAIPendingReviewsOptions = {}) {
  const { highlightedId, refetchInterval = 0, enabled = true } = options;

  return useQuery<PendingReviewItem[]>({
    queryKey: pendingReviewsQueryKey(highlightedId),
    queryFn: () => aiStaffApi.listPendingReviews({ highlightedId }),
    refetchInterval: refetchInterval || undefined,
    enabled,
    staleTime: 30_000,
    retry: 2,
  } as UseQueryOptions<PendingReviewItem[]>);
}

// ============================================================================
// useAIResolve
// ============================================================================

export interface UseAIResolveOptions {
  /** Called after successful resolution */
  onSuccess?: (data: PendingReviewResolveResponse) => void;
  /** Additional query keys to invalidate on success */
  invalidateKeys?: string[];
}

/**
 * Mutation hook for resolving a pending AI review item.
 *
 * Automatically invalidates pending reviews and common entity queries on success.
 */
export function useAIResolve(options: UseAIResolveOptions = {}) {
  const queryClient = useQueryClient();

  const invalidateRelatedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey(PENDING_REVIEWS_KEY) });
    // Invalidate common entity lists that may have new records
    const entityKeys = [
      'contacts', 'suppliers', 'customers', 'inquiries',
      'purchase-orders', 'sales-orders',
      ...(options.invalidateKeys ?? []),
    ];
    for (const key of entityKeys) {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(key) });
    }
  }, [queryClient, options.invalidateKeys]);

  return useMutation({
    mutationFn: ({ feedbackId, data }: { feedbackId: string; data: PendingReviewResolveRequest }) =>
      aiStaffApi.resolvePendingReview(feedbackId, data),
    onSuccess: (data) => {
      invalidateRelatedQueries();
      options.onSuccess?.(data);
    },
    onError: (error) => {
      const aiError = normalizeAIError(error);
      message.error(aiError.message);
    },
  });
}

// ============================================================================
// useAIBatchResolve
// ============================================================================

export interface UseAIBatchResolveOptions {
  onSuccess?: (data: { resolved: Array<{ id: string; status: string }>; errors: Array<{ id: string; error: string }>; total_resolved: number }) => void;
}

/**
 * Mutation hook for batch-resolving multiple pending review items.
 */
export function useAIBatchResolve(options: UseAIBatchResolveOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedbackIds: string[]) => aiStaffApi.batchResolve(feedbackIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(PENDING_REVIEWS_KEY) });
      if (data.total_resolved > 0) {
        message.success(`Resolved ${data.total_resolved} item(s)`);
      }
      if (data.errors.length > 0) {
        message.warning(`${data.errors.length} item(s) failed to resolve`);
      }
      options.onSuccess?.(data);
    },
    onError: (error) => {
      const aiError = normalizeAIError(error);
      message.error(aiError.message);
    },
  });
}

// ============================================================================
// useAIFeedback
// ============================================================================

export interface UseAIFeedbackOptions {
  /** Called after successful feedback submission */
  onSuccess?: (data: AIInboxFeedbackSubmitResponse) => void;
}

/**
 * Mutation hook for submitting AI feedback (thumbs up/down + optional comment).
 *
 * Used by AIInboxFeedbackActions, AIDraftReviewModal, and HITLReviewCard.
 */
export function useAIFeedback(options: UseAIFeedbackOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AIInboxFeedbackSubmitRequest) => aiFeedbackApi.submit(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(PENDING_REVIEWS_KEY) });
      options.onSuccess?.(data);
    },
    onError: (error) => {
      const aiError = normalizeAIError(error);
      message.error(`Feedback failed: ${aiError.message}`);
    },
  });
}

// Re-export query keys for external use
export { AI_QUERY_KEYS, pendingReviewsQueryKey };
