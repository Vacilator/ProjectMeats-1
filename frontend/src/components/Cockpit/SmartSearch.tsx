/**
 * SmartSearch Component
 * 
 * Mind-map style search with cascading relational results.
 * Displays entity relationships in chunks (calls, S.O.'s, associates).
 * 
 * Features:
 * - Cascading results (type entity → see relations)
 * - Breadcrumb navigation
 * - Top-5 results per entity type
 * - Relational chunks (recent activity, associates, orders)
 * - Favorites integration
 * 
 * Created: 2026-02-21 - Cockpit Phase 1: Smart Search Foundation
 * 
 * @module SmartSearch
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { 
  Search, ChevronRight, Star, Clock, Phone, FileText, 
  Users, Building2, Package, TrendingUp, X, Home 
} from 'lucide-react';
import { apiClient } from '../../services/apiService';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SearchEntity {
  id: string;
  type: 'customer' | 'supplier' | 'contact' | 'product' | 'order' | 'inquiry';
  name: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

export interface RelationalChunk {
  type: 'calls' | 'orders' | 'inquiries' | 'associates' | 'products';
  title: string;
  items: SearchEntity[];
  icon: React.ReactNode;
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  entity?: SearchEntity;
}

export interface SmartSearchProps {
  /** Initial search query */
  initialQuery?: string;
  /** Callback when entity is selected */
  onSelectEntity?: (entity: SearchEntity) => void;
  /** Callback when search closes */
  onClose?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background-primary));
`;

const SearchHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  color: rgb(var(--color-text-tertiary));
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 40px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
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

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  padding: 4px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }
`;

const Breadcrumbs = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgb(var(--color-background-secondary));
  border-radius: 6px;
  font-size: 13px;
  overflow-x: auto;
  white-space: nowrap;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 2px;
  }
`;

const BreadcrumbItem = styled.button<{ $isActive?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => props.$isActive ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$isActive ? 'white' : 'rgb(var(--color-text-secondary))'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;

  &:hover {
    background: ${props => props.$isActive ? 'rgb(var(--color-primary-hover))' : 'rgb(var(--color-background-tertiary))'};
    color: ${props => props.$isActive ? 'white' : 'rgb(var(--color-text-primary))'};
  }
`;

const BreadcrumbSeparator = styled(ChevronRight)`
  color: rgb(var(--color-text-tertiary));
  flex-shrink: 0;
`;

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const Section = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));

  svg {
    color: rgb(var(--color-primary));
  }
`;

const SectionCount = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-weight: normal;
`;

const ResultGrid = styled.div`
  display: grid;
  gap: 8px;
`;

const ResultCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    border-color: rgb(var(--color-primary));
    transform: translateX(4px);
  }
`;

const ResultIcon = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: ${props => props.$color ? `${props.$color}15` : 'rgb(var(--color-background-primary))'};
  color: ${props => props.$color || 'rgb(var(--color-primary))'};
  border-radius: 6px;
  flex-shrink: 0;
`;

const ResultContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ResultTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultSubtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ResultMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 4px;
`;

const FavoriteButton = styled.button<{ $isFavorite: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: ${props => props.$isFavorite ? 'rgb(var(--color-warning))' : 'rgb(var(--color-text-tertiary))'};
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: ${props => props.$isFavorite ? 'rgb(var(--color-warning))' : 'rgb(var(--color-text-primary))'};
  }

  svg {
    fill: ${props => props.$isFavorite ? 'currentColor' : 'none'};
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 16px;
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const EmptyMessage = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  max-width: 400px;
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getEntityIcon = (type: SearchEntity['type'], size = 20) => {
  switch (type) {
    case 'customer': return <Users size={size} />;
    case 'supplier': return <Building2 size={size} />;
    case 'contact': return <Users size={size} />;
    case 'product': return <Package size={size} />;
    case 'order': return <FileText size={size} />;
    case 'inquiry': return <FileText size={size} />;
    default: return <FileText size={size} />;
  }
};

const getEntityColor = (type: SearchEntity['type']) => {
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

// ============================================================================
// Main Component
// ============================================================================

export const SmartSearch: React.FC<SmartSearchProps> = ({
  initialQuery = '',
  onSelectEntity,
  onClose,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Record<string, SearchEntity[]>>({});
  const [relationalChunks, setRelationalChunks] = useState<RelationalChunk[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'home', label: 'Search' }]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load favorites from localStorage
   */
  useEffect(() => {
    const savedFavorites = localStorage.getItem('cockpit_favorites');
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      } catch (error) {
        console.error('[SmartSearch] Failed to load favorites:', error);
      }
    }
  }, []);

  /**
   * Save favorites to localStorage
   */
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    localStorage.setItem('cockpit_favorites', JSON.stringify(Array.from(newFavorites)));
  }, []);

  /**
   * Search entities with debouncing
   */
  const searchEntities = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({});
      return;
    }

    setIsLoading(true);

    try {
      console.log('[SmartSearch] Searching for:', searchQuery);
      
      // Call universal search API (correct endpoint)
      const response = await apiClient.get('/search/universal/', {
        params: { q: searchQuery, limit: 5 },
      });

      console.log('[SmartSearch] Search response:', response.data);

      // The API returns results already grouped by type
      // Format: { results: [{type, id, title, subtitle, metadata}], counts: {}, total: N }
      const grouped: Record<string, SearchEntity[]> = {};
      
      if (response.data.results && Array.isArray(response.data.results)) {
        response.data.results.forEach((item: any) => {
          const type = item.type;
          if (!grouped[type]) {
            grouped[type] = [];
          }
          grouped[type].push({
            id: item.id,
            type,
            name: item.title || item.name || 'Unnamed',
            subtitle: item.subtitle || '',
            metadata: item.metadata || {},
          });
        });
      }

      console.log('[SmartSearch] Grouped results:', grouped);
      setResults(grouped);
    } catch (error: any) {
      console.error('[SmartSearch] Search failed:', error);
      console.error('[SmartSearch] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setResults({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle query change with debouncing
   */
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchEntities(newQuery);
    }, 300);
  }, [searchEntities]);

  /**
   * Load relational chunks for an entity
   */
  const loadRelationalChunks = useCallback(async (entity: SearchEntity) => {
    setIsLoading(true);

    try {
      // Fetch related entities based on type
      const chunks: RelationalChunk[] = [];

      // Example: For a customer, fetch recent orders, calls, inquiries
      if (entity.type === 'customer' || entity.type === 'supplier') {
        // Recent orders
        const ordersRes = await apiClient.get(`/${entity.type}s/${entity.id}/orders/`, {
          params: { limit: 5 },
        });
        if (ordersRes.data.results?.length) {
          chunks.push({
            type: 'orders',
            title: 'Recent Orders',
            items: ordersRes.data.results.map((o: any) => ({
              id: o.id,
              type: 'order',
              name: o.order_number || `Order #${o.id}`,
              subtitle: o.status,
              metadata: o,
            })),
            icon: <FileText size={16} />,
          });
        }

        // Recent calls (if available)
        try {
          const callsRes = await apiClient.get(`/${entity.type}s/${entity.id}/calls/`, {
            params: { limit: 5 },
          });
          if (callsRes.data.results?.length) {
            chunks.push({
              type: 'calls',
              title: 'Recent Calls',
              items: callsRes.data.results.map((c: any) => ({
                id: c.id,
                type: 'inquiry',
                name: `Call on ${new Date(c.created_at).toLocaleDateString()}`,
                subtitle: c.notes,
                metadata: c,
              })),
              icon: <Phone size={16} />,
            });
          }
        } catch (error) {
          // Calls API may not exist yet
        }

        // Associates (contacts)
        try {
          const contactsRes = await apiClient.get(`/${entity.type}s/${entity.id}/contacts/`, {
            params: { limit: 5 },
          });
          if (contactsRes.data.results?.length) {
            chunks.push({
              type: 'associates',
              title: 'Contacts',
              items: contactsRes.data.results.map((c: any) => ({
                id: c.id,
                type: 'contact',
                name: c.name || `${c.first_name} ${c.last_name}`,
                subtitle: c.title || c.email,
                metadata: c,
              })),
              icon: <Users size={16} />,
            });
          }
        } catch (error) {
          // Contacts API may not exist yet
        }
      }

      setRelationalChunks(chunks);
    } catch (error) {
      console.error('[SmartSearch] Failed to load relational chunks:', error);
      setRelationalChunks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle entity selection
   */
  const handleSelectEntity = useCallback((entity: SearchEntity) => {
    // Add to breadcrumbs
    setBreadcrumbs(prev => [
      ...prev,
      { id: entity.id, label: entity.name, entity },
    ]);

    // Load relational chunks
    loadRelationalChunks(entity);

    // Callback
    if (onSelectEntity) {
      onSelectEntity(entity);
    }
  }, [loadRelationalChunks, onSelectEntity]);

  /**
   * Navigate breadcrumb
   */
  const handleBreadcrumbClick = useCallback((index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);

    // If navigating back to home, show search results
    if (index === 0) {
      setRelationalChunks([]);
      if (query) {
        searchEntities(query);
      }
    } else {
      // Load relational chunks for the selected entity
      const entity = newBreadcrumbs[index].entity;
      if (entity) {
        loadRelationalChunks(entity);
      }
    }
  }, [breadcrumbs, query, loadRelationalChunks, searchEntities]);

  /**
   * Toggle favorite
   */
  const toggleFavorite = useCallback((entityId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(entityId)) {
        newFavorites.delete(entityId);
      } else {
        newFavorites.add(entityId);
      }
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, [saveFavorites]);

  /**
   * Clear search
   */
  const handleClear = useCallback(() => {
    setQuery('');
    setResults({});
    setRelationalChunks([]);
    setBreadcrumbs([{ id: 'home', label: 'Search' }]);
  }, []);

  /**
   * Render search results (top-5 per type)
   */
  const renderSearchResults = () => {
    const types = Object.keys(results);

    if (types.length === 0) {
      return (
        <EmptyState>
          <EmptyIcon>
            <Search size={48} />
          </EmptyIcon>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyMessage>
            Try a different search term or check your spelling
          </EmptyMessage>
        </EmptyState>
      );
    }

    return types.map(type => {
      const entities = results[type];
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's';

      return (
        <Section key={type}>
          <SectionHeader>
            <SectionTitle>
              {getEntityIcon(type as SearchEntity['type'], 16)}
              {typeLabel}
              <SectionCount>({entities.length})</SectionCount>
            </SectionTitle>
          </SectionHeader>

          <ResultGrid>
            {entities.map(entity => (
              <ResultCard
                key={entity.id}
                onClick={() => handleSelectEntity(entity)}
              >
                <ResultIcon $color={getEntityColor(entity.type)}>
                  {getEntityIcon(entity.type)}
                </ResultIcon>

                <ResultContent>
                  <ResultTitle>{entity.name}</ResultTitle>
                  {entity.subtitle && (
                    <ResultSubtitle>{entity.subtitle}</ResultSubtitle>
                  )}
                  <ResultMeta>
                    <Clock size={10} />
                    Last modified: Today
                  </ResultMeta>
                </ResultContent>

                <FavoriteButton
                  $isFavorite={favorites.has(entity.id)}
                  onClick={(e) => toggleFavorite(entity.id, e)}
                  title={favorites.has(entity.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={16} />
                </FavoriteButton>
              </ResultCard>
            ))}
          </ResultGrid>
        </Section>
      );
    });
  };

  /**
   * Render relational chunks
   */
  const renderRelationalChunks = () => {
    if (relationalChunks.length === 0) {
      return (
        <EmptyState>
          <EmptyIcon>
            <TrendingUp size={48} />
          </EmptyIcon>
          <EmptyTitle>No related items</EmptyTitle>
          <EmptyMessage>
            This entity doesn't have any related records yet
          </EmptyMessage>
        </EmptyState>
      );
    }

    return relationalChunks.map(chunk => (
      <Section key={chunk.type}>
        <SectionHeader>
          <SectionTitle>
            {chunk.icon}
            {chunk.title}
            <SectionCount>({chunk.items.length})</SectionCount>
          </SectionTitle>
        </SectionHeader>

        <ResultGrid>
          {chunk.items.map(item => (
            <ResultCard
              key={item.id}
              onClick={() => handleSelectEntity(item)}
            >
              <ResultIcon $color={getEntityColor(item.type)}>
                {getEntityIcon(item.type)}
              </ResultIcon>

              <ResultContent>
                <ResultTitle>{item.name}</ResultTitle>
                {item.subtitle && (
                  <ResultSubtitle>{item.subtitle}</ResultSubtitle>
                )}
              </ResultContent>

              <FavoriteButton
                $isFavorite={favorites.has(item.id)}
                onClick={(e) => toggleFavorite(item.id, e)}
                title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={16} />
              </FavoriteButton>
            </ResultCard>
          ))}
        </ResultGrid>
      </Section>
    ));
  };

  return (
    <Container>
      <SearchHeader>
        <SearchInputWrapper>
          <SearchIcon>
            <Search size={18} />
          </SearchIcon>
          <SearchInput
            type="text"
            placeholder="Search customers, suppliers, orders..."
            value={query}
            onChange={handleQueryChange}
            autoFocus
          />
          {query && (
            <ClearButton onClick={handleClear} title="Clear search">
              <X size={18} />
            </ClearButton>
          )}
        </SearchInputWrapper>

        {breadcrumbs.length > 1 && (
          <Breadcrumbs>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <BreadcrumbSeparator size={14} />}
                <BreadcrumbItem
                  $isActive={index === breadcrumbs.length - 1}
                  onClick={() => handleBreadcrumbClick(index)}
                >
                  {index === 0 && <Home size={12} />}
                  {crumb.label}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </Breadcrumbs>
        )}
      </SearchHeader>

      <ContentArea>
        {isLoading ? (
          <EmptyState>
            <EmptyIcon>
              <Search size={48} />
            </EmptyIcon>
            <EmptyTitle>Searching...</EmptyTitle>
          </EmptyState>
        ) : breadcrumbs.length > 1 ? (
          renderRelationalChunks()
        ) : (
          renderSearchResults()
        )}
      </ContentArea>
    </Container>
  );
};
