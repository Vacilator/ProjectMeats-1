/**
 * useFavorites Hook
 * 
 * TanStack Query hook for managing user favorites with backend persistence.
 * 
 * Features:
 * - Optimistic updates for instant UI feedback
 * - Automatic cache invalidation
 * - Client-side isFavorited check for performance
 * - Error handling with rollback
 * 
 * Created: 2026-02-23 - Cockpit Phase 2A
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '../utils/queryKeys';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface Favorite {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_title: string;
  created_at: string;
}

export interface FavoritesResponse {
  count: number;
  results: Favorite[];
}

export interface ToggleFavoriteParams {
  entity_type: string;
  entity_id: number;
  entity_title: string;
}

export interface ToggleFavoriteResponse {
  action: 'added' | 'removed';
  favorite: Favorite | null;
}

// ============================================================================
// API Functions
// ============================================================================

const fetchFavorites = async (): Promise<Favorite[]> => {
  // businessApi.baseURL already includes /api/v1
  const response = await businessApi.get<FavoritesResponse>('/favorites/');
  return response.data.results;
};

const toggleFavorite = async (params: ToggleFavoriteParams): Promise<ToggleFavoriteResponse> => {
  const response = await businessApi.post<ToggleFavoriteResponse>('/favorites/toggle/', params);
  return response.data;
};

const checkIsFavorited = async (entity_type: string, entity_id: number): Promise<boolean> => {
  const response = await businessApi.get<{ is_favorited: boolean }>(
    `/favorites/check/?entity_type=${encodeURIComponent(entity_type)}&entity_id=${encodeURIComponent(String(entity_id))}`
  );
  return response.data.is_favorited;
};

// ============================================================================
// Main Hook
// ============================================================================

export const useFavorites = () => {
  const queryClient = useQueryClient();
  const favoritesKey = withTenantQueryKey('favorites');

  // Query for fetching all favorites
  const {
    data: favorites = [],
    isLoading,
    error,
    refetch
  } = useQuery<Favorite[]>({
    queryKey: favoritesKey,
    queryFn: fetchFavorites,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
  });

  // Mutation for toggling favorites
  const toggleMutation = useMutation<
    ToggleFavoriteResponse,
    Error,
    ToggleFavoriteParams,
    { previousFavorites?: Favorite[] }
  >({
    mutationFn: toggleFavorite,
    
    // Optimistic update
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: favoritesKey });
      
      // Snapshot previous value
      const previousFavorites = queryClient.getQueryData<Favorite[]>(favoritesKey);
      
      // Optimistically update cache
      queryClient.setQueryData<Favorite[]>(favoritesKey, (old = []) => {
        const exists = old.find(
          f => f.entity_type === params.entity_type && f.entity_id === params.entity_id
        );
        
        if (exists) {
          // Remove
          return old.filter(
            f => !(f.entity_type === params.entity_type && f.entity_id === params.entity_id)
          );
        } else {
          // Add
          return [
            {
              id: Date.now(), // Temporary ID
              entity_type: params.entity_type,
              entity_id: params.entity_id,
              entity_title: params.entity_title,
              created_at: new Date().toISOString(),
            },
            ...old,
          ];
        }
      });
      
      return { previousFavorites };
    },
    
    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(favoritesKey, context.previousFavorites);
      }
    },
    
    // Refetch after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKey });
    },
  });

  // Helper function to check if an entity is favorited (client-side)
  const isFavorited = (entity_type: string, entity_id: number): boolean => {
    return favorites.some(
      f => f.entity_type === entity_type && f.entity_id === entity_id
    );
  };

  // Get favorites count
  const count = favorites.length;

  // Get favorites by type
  const getFavoritesByType = (entity_type: string): Favorite[] => {
    return favorites.filter(f => f.entity_type === entity_type);
  };

  return {
    favorites,
    count,
    isLoading,
    error,
    refetch,
    toggleFavorite: toggleMutation,
    isFavorited,
    getFavoritesByType,
    // Server-side check (use sparingly, prefer isFavorited for performance)
    checkIsFavorited: async (entity_type: string, entity_id: number) => {
      return await checkIsFavorited(entity_type, entity_id);
    },
  };
};

export default useFavorites;
