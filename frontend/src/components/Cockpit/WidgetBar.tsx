/**
 * Cockpit Widget Bar Component
 * 
 * Always-visible collapsible sidebar for quick access during calls.
 * 
 * Features:
 * - Mini-search bar (debounced 300ms, auto-focus on load)
 * - Favorites list (click to open entity)
 * - Quick notes area (auto-save to localStorage)
 * - Draggable positioning (left/right)
 * - User preference persistence
 * 
 * Created: 2026-02-23 - Cockpit Phase 2A Enhancement
 * 
 * @module WidgetBar
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { 
  Search, Star, FileText, ChevronLeft, ChevronRight, 
  X, Menu, Settings 
} from 'lucide-react';
import { apiClient } from '../../services/apiService';
import { EntityDetailModal } from '../Shared/EntityDetailModal';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface WidgetBarConfig {
  position: 'left' | 'right';
  isCollapsed: boolean;
  width: number;
}

interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
}

interface FavoriteEntity {
  id: string;
  type: string;
  name: string;
  subtitle?: string;
  timestamp: number;
}

export interface WidgetBarProps {
  /** Callback when search result is selected */
  onSelectEntity?: (entity: SearchResult) => void;
  /** Initial configuration */
  initialConfig?: Partial<WidgetBarConfig>;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div<{ $position: 'left' | 'right'; $isCollapsed: boolean; $width: number }>`
  position: fixed;
  top: 60px; /* Below header */
  ${props => props.$position}: 0;
  width: ${props => props.$isCollapsed ? '48px' : `${props.$width}px`};
  height: calc(100vh - 60px);
  background: rgb(var(--color-background-primary));
  border-${props => props.$position === 'left' ? 'right' : 'left'}: 1px solid rgb(var(--color-border));
  box-shadow: ${props => props.$position === 'left' ? '2px' : '-2px'} 0 8px rgba(0, 0, 0, 0.1);
  z-index: 900;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
`;

const CollapseButton = styled.button<{ $position: 'left' | 'right' }>`
  position: absolute;
  top: 12px;
  ${props => props.$position}: 12px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background-secondary));
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 56px 12px 12px 12px;
  overflow-y: auto;
  flex: 1;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 2px;
  }
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: rgb(var(--color-text-tertiary));
  margin: 0;
  padding: 0 4px;
`;

// Mini Search
const SearchContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 8px 8px 32px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 8px;
  top: 8px;
  color: rgb(var(--color-text-tertiary));
  pointer-events: none;
`;

const SearchResults = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  padding: 4px;
`;

const SearchResultItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
  }
`;

const ResultIcon = styled.div<{ $color: string }>`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: ${props => props.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
`;

const ResultContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ResultTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultSubtitle = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Favorites
const FavoritesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FavoriteItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    border-color: rgb(var(--color-primary));
  }
`;

const FavoriteIcon = styled(Star)`
  color: rgb(var(--color-warning));
  fill: rgb(var(--color-warning));
  flex-shrink: 0;
`;

const FavoriteName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RemoveFavoriteButton = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-tertiary));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-danger));
    color: white;
  }
`;

const EmptyState = styled.div`
  padding: 16px 8px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
`;

// Quick Notes
const NotesTextarea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 8px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  font-family: inherit;
  resize: vertical;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const SaveIndicator = styled.div<{ $visible: boolean }>`
  font-size: 11px;
  color: rgb(var(--color-success));
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s;
  padding: 0 4px;
`;

// ============================================================================
// Main Component
// ============================================================================

export const WidgetBar: React.FC<WidgetBarProps> = ({
  onSelectEntity,
  initialConfig,
}) => {
  // Configuration state
  const [config, setConfig] = useState<WidgetBarConfig>({
    position: 'left',
    isCollapsed: false,
    width: 280,
    ...initialConfig,
  });

  // Mini-search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: number } | null>(null);

  // Quick notes state
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimeoutRef = useRef<NodeJS.Timeout>();

  // Load configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('cockpit_widget_bar_config');
    if (savedConfig) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
      } catch (error) {
        console.error('[WidgetBar] Failed to load config:', error);
      }
    }

    const savedFavorites = localStorage.getItem('cockpit_favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('[WidgetBar] Failed to load favorites:', error);
      }
    }

    const savedNotes = localStorage.getItem('cockpit_quick_notes');
    if (savedNotes) {
      setNotes(savedNotes);
    }

    // Auto-focus search on mount (if not collapsed)
    if (!config.isCollapsed) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, []);

  // Save configuration to localStorage
  const saveConfig = useCallback((newConfig: WidgetBarConfig) => {
    setConfig(newConfig);
    localStorage.setItem('cockpit_widget_bar_config', JSON.stringify(newConfig));
  }, []);

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    saveConfig({ ...config, isCollapsed: !config.isCollapsed });
  }, [config, saveConfig]);

  // Debounced mini-search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiClient.get(`/search/universal/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data.results?.slice(0, 5) || []);
      } catch (error) {
        console.error('[WidgetBar] Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Handle search result click
  const handleSelectResult = useCallback((result: SearchResult) => {
    setSelectedEntity({ type: result.type, id: result.id });
    setSearchQuery('');
    setSearchResults([]);
    if (onSelectEntity) {
      onSelectEntity(result);
    }
  }, [onSelectEntity]);

  // Handle favorite click
  const handleFavoriteClick = useCallback((favorite: FavoriteEntity) => {
    setSelectedEntity({ type: favorite.type, id: parseInt(favorite.id) });
  }, []);

  // Remove favorite
  const handleRemoveFavorite = useCallback((favoriteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.filter(f => f.id !== favoriteId);
    setFavorites(newFavorites);
    localStorage.setItem('cockpit_favorites', JSON.stringify(newFavorites));
  }, [favorites]);

  // Auto-save notes (debounced 1s)
  useEffect(() => {
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    notesTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('cockpit_quick_notes', notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }, 1000);

    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, [notes]);

  // Collapsed view
  if (config.isCollapsed) {
    return (
      <Container $position={config.position} $isCollapsed={true} $width={config.width}>
        <CollapseButton $position={config.position} onClick={toggleCollapse}>
          {config.position === 'left' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </CollapseButton>
      </Container>
    );
  }

  // Expanded view
  return (
    <>
      <Container $position={config.position} $isCollapsed={false} $width={config.width}>
        <CollapseButton $position={config.position} onClick={toggleCollapse}>
          {config.position === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </CollapseButton>

        <Content>
          {/* Mini Search */}
          <Section>
            <SectionTitle>Quick Search</SectionTitle>
            <SearchContainer>
              <SearchIcon>
                <Search size={16} />
              </SearchIcon>
              <SearchInput
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
              />
              {searchResults.length > 0 && (
                <SearchResults>
                  {searchResults.map(result => (
                    <SearchResultItem
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelectResult(result)}
                    >
                      <ResultIcon $color={result.color}>
                        {result.icon}
                      </ResultIcon>
                      <ResultContent>
                        <ResultTitle>{result.title}</ResultTitle>
                        {result.subtitle && <ResultSubtitle>{result.subtitle}</ResultSubtitle>}
                      </ResultContent>
                    </SearchResultItem>
                  ))}
                </SearchResults>
              )}
            </SearchContainer>
          </Section>

          {/* Favorites */}
          <Section>
            <SectionTitle>Favorites</SectionTitle>
            <FavoritesList>
              {favorites.length === 0 ? (
                <EmptyState>No favorites yet.<br />Star items to add them here.</EmptyState>
              ) : (
                favorites.map(favorite => (
                  <FavoriteItem
                    key={favorite.id}
                    onClick={() => handleFavoriteClick(favorite)}
                  >
                    <FavoriteIcon size={16} />
                    <FavoriteName>{favorite.name}</FavoriteName>
                    <RemoveFavoriteButton onClick={(e) => handleRemoveFavorite(favorite.id, e)}>
                      <X size={14} />
                    </RemoveFavoriteButton>
                  </FavoriteItem>
                ))
              )}
            </FavoritesList>
          </Section>

          {/* Quick Notes */}
          <Section>
            <SectionTitle>Quick Notes</SectionTitle>
            <NotesTextarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Type notes here... (auto-saves)"
            />
            <SaveIndicator $visible={notesSaved}>✓ Saved</SaveIndicator>
          </Section>
        </Content>
      </Container>

      {/* Entity Detail Modal */}
      {selectedEntity && (
        <EntityDetailModal
          entityType={selectedEntity.type}
          entityId={selectedEntity.id}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </>
  );
};

export default WidgetBar;
