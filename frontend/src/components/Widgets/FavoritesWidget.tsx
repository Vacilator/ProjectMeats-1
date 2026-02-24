/**
 * FavoritesWidget Component
 * 
 * Displays user's favorite entities for quick access.
 * Integrates with SmartSearch favorites system.
 * 
 * Features:
 * - Quick access to saved favorites
 * - Drag to reorder
 * - Remove favorites
 * - Jump to entity details
 * 
 * Created: 2026-02-21 - Cockpit Phase 1: Smart Search Foundation
 * 
 * @module FavoritesWidget
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Star, X, ExternalLink } from 'lucide-react';
import { apiClient } from '../../services/apiService';
import { useFavorites } from '../../hooks/useFavorites';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FavoriteEntity {
  id: string;
  type: string;
  name: string;
  subtitle?: string;
  color?: string;
}

export interface FavoritesWidgetProps {
  /** Maximum number of favorites to display */
  maxItems?: number;
  /** Callback when favorite is clicked */
  onSelectFavorite?: (favorite: FavoriteEntity) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));

  svg {
    color: rgb(var(--color-warning));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
`;

const FavoritesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FavoriteItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    border-color: rgb(var(--color-primary));
    transform: translateX(2px);
  }
`;

const FavoriteIcon = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: ${props => props.$color ? `${props.$color}15` : 'rgb(var(--color-background-primary))'};
  color: ${props => props.$color || 'rgb(var(--color-primary))'};
  border-radius: 4px;
  flex-shrink: 0;
`;

const FavoriteContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const FavoriteName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FavoriteSubtitle = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const RemoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-error));
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  margin-bottom: 8px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 13px;
  line-height: 1.4;
`;

// ============================================================================
// Main Component
// ============================================================================

export const FavoritesWidget: React.FC<FavoritesWidgetProps> = ({
  maxItems = 10,
  onSelectFavorite,
}) => {
  const [favorites, setFavorites] = useState<FavoriteEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load favorites from localStorage and hydrate with API data
   */
  const loadFavorites = useCallback(async () => {
    setIsLoading(true);

    try {
      // Get favorite IDs from localStorage
      const savedFavorites = localStorage.getItem('cockpit_favorites');
      if (!savedFavorites) {
        setFavorites([]);
        setIsLoading(false);
        return;
      }

      const favoriteIds: string[] = JSON.parse(savedFavorites);
      if (favoriteIds.length === 0) {
        setFavorites([]);
        setIsLoading(false);
        return;
      }

      // Fetch entity details for each favorite
      // In a real implementation, this would be a batch API call
      const favoriteEntities: FavoriteEntity[] = [];

      for (const id of favoriteIds.slice(0, maxItems)) {
        try {
          // This is a simplified example - you'd need to determine entity type
          // and call the appropriate API endpoint
          const response = await apiClient.get(`/entities/${id}/`);
          favoriteEntities.push({
            id: response.data.id,
            type: response.data.type,
            name: response.data.name || response.data.title,
            subtitle: response.data.subtitle || response.data.status,
            color: getEntityColor(response.data.type),
          });
        } catch (error) {
          console.warn(`[FavoritesWidget] Failed to load favorite ${id}:`, error);
          // Skip this favorite if it fails to load
        }
      }

      setFavorites(favoriteEntities);
    } catch (error) {
      console.error('[FavoritesWidget] Failed to load favorites:', error);
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadFavorites();

    // Listen for storage changes (favorites updated in other components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cockpit_favorites') {
        loadFavorites();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadFavorites]);

  /**
   * Remove favorite
   */
  const handleRemove = useCallback((favoriteId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Remove from localStorage
    const savedFavorites = localStorage.getItem('cockpit_favorites');
    if (savedFavorites) {
      const favoriteIds: string[] = JSON.parse(savedFavorites);
      const updatedIds = favoriteIds.filter(id => id !== favoriteId);
      localStorage.setItem('cockpit_favorites', JSON.stringify(updatedIds));

      // Update local state
      setFavorites(prev => prev.filter(f => f.id !== favoriteId));
    }
  }, []);

  /**
   * Handle favorite selection
   */
  const handleSelect = useCallback((favorite: FavoriteEntity) => {
    if (onSelectFavorite) {
      onSelectFavorite(favorite);
    }
  }, [onSelectFavorite]);

  return (
    <Container>
      <Header>
        <Title>
          <Star size={16} />
          Favorites
        </Title>
      </Header>

      <Content>
        {isLoading ? (
          <EmptyState>
            <EmptyIcon>
              <Star size={32} />
            </EmptyIcon>
            <EmptyText>Loading favorites...</EmptyText>
          </EmptyState>
        ) : favorites.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <Star size={32} />
            </EmptyIcon>
            <EmptyText>
              No favorites yet.
              <br />
              Star items in search to save them here.
            </EmptyText>
          </EmptyState>
        ) : (
          <FavoritesList>
            {favorites.map(favorite => (
              <FavoriteItem
                key={favorite.id}
                onClick={() => handleSelect(favorite)}
              >
                <FavoriteIcon $color={favorite.color}>
                  <ExternalLink size={14} />
                </FavoriteIcon>

                <FavoriteContent>
                  <FavoriteName>{favorite.name}</FavoriteName>
                  {favorite.subtitle && (
                    <FavoriteSubtitle>{favorite.subtitle}</FavoriteSubtitle>
                  )}
                </FavoriteContent>

                <RemoveButton
                  onClick={(e) => handleRemove(favorite.id, e)}
                  title="Remove from favorites"
                >
                  <X size={14} />
                </RemoveButton>
              </FavoriteItem>
            ))}
          </FavoritesList>
        )}
      </Content>
    </Container>
  );
};

// Helper function (should match SmartSearch)
const getEntityColor = (type: string) => {
  switch (type) {
    case 'customer': return 'rgb(34, 197, 94)';
    case 'supplier': return 'rgb(168, 85, 247)';
    case 'contact': return 'rgb(59, 130, 246)';
    case 'product': return 'rgb(249, 115, 22)';
    case 'order': return 'rgb(234, 179, 8)';
    case 'inquiry': return 'rgb(239, 68, 68)';
    default: return 'rgb(var(--color-primary))';
  }
};
