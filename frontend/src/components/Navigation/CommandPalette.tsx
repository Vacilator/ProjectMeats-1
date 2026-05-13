/**
 * Command Palette Component (Wave 2: Cockpit Command Center)
 *
 * Features:
 * - Universal search across all entities (⌘K / Ctrl+K)
 * - Results grouped by entity type with icons
 * - Recent items section
 * - Quick actions
 * - Keyboard navigation (up/down/enter/escape)
 * - Listens for pm:open-command-palette CustomEvent
 *
 * Theme Compliance:
 * - Uses CSS custom properties
 * - No hardcoded colors
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, Plus, FileText, Users, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EntityDetailModal } from '../Shared/EntityDetailModal';
import { getEntityIcon } from '@/components/Shared/entityListPresentation';
import { entityTypeDisplayName } from '@/utils/entityTypeRegistry';
import { logger } from '@/utils/logger';
import {
  getRecentItems,
  getSearchColorVar,
  groupSearchResultsByType,
  searchRanked,
  trackRecentItem,
  type SearchItem,
} from '@/services/searchService';

type SearchResult = SearchItem;

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  /** CSS var name holding RGB tuple (e.g. "--color-info"). */
  colorVar: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Quick Actions Configuration
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-po',
    title: 'New Purchase Order',
    description: 'Create a purchase order',
    icon: <Plus size={16} />,
    route: '/purchase-orders?action=create',
    colorVar: '--color-info',
  },
  {
    id: 'new-so',
    title: 'New Sales Order',
    description: 'Create a sales order',
    icon: <FileText size={16} />,
    route: '/sales-orders?action=create',
    colorVar: '--color-success',
  },
  {
    id: 'new-supplier',
    title: 'Add Supplier',
    description: 'Create a new supplier',
    icon: <Building2 size={16} />,
    route: '/suppliers?action=create',
    colorVar: '--color-primary',
  },
  {
    id: 'new-customer',
    title: 'Add Customer',
    description: 'Create a new customer',
    icon: <Users size={16} />,
    route: '/customers?action=create',
    colorVar: '--color-warning',
  },
];

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
`;

const PaletteContainer = styled.div`
  width: 100%;
  max-width: 640px;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  box-shadow: 0 25px 50px -12px rgba(var(--color-overlay), 0.25);
  overflow: hidden;
  animation: slideDown 0.2s ease-out;

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const SearchInputContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgb(var(--color-border));
  gap: 0.75rem;
`;

const SearchIcon = styled(Search)`
  color: rgb(var(--color-text-tertiary));
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  font-size: 1.125rem;
  color: rgb(var(--color-text-primary));
  outline: none;

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-border));
  }
`;

const ResultsContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const ResultSection = styled.div`
  padding: 0.5rem;
`;

const SectionTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--color-text-tertiary));
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
`;

const SectionIcon = styled.span`
  display: flex;
  align-items: center;
  color: rgb(var(--color-text-tertiary));
`;

const SectionCount = styled.span`
  font-size: 0.7rem;
  color: rgb(var(--color-text-tertiary));
  margin-left: auto;
`;

const ResultItem = styled.div<{ $isSelected: boolean }>`
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  gap: 0.75rem;
  background: ${props => props.$isSelected ? 'rgb(var(--color-primary) / 0.1)' : 'transparent'};

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const ResultIcon = styled.div<{ $colorVar: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: ${(p) => `rgba(var(${p.$colorVar}), 0.12)`};
  color: ${(p) => `rgb(var(${p.$colorVar}))`};
  font-size: 1rem;
`;

const ResultContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ResultTitle = styled.div`
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultSubtitle = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultType = styled.span`
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-secondary));
  text-transform: capitalize;
`;

const ResultLabels = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
`;

const Label = styled.span`
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  white-space: nowrap;
`;

const ScoreBadge = styled.span<{ $score: number }>`
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.35rem;
  border-radius: var(--radius-sm);
  background: ${(p) =>
    p.$score >= 80
      ? 'rgba(var(--color-success), 0.15)'
      : p.$score >= 60
        ? 'rgba(var(--color-warning), 0.15)'
        : 'rgba(var(--color-text-tertiary), 0.10)'};
  color: ${(p) =>
    p.$score >= 80
      ? 'rgb(var(--color-success))'
      : p.$score >= 60
        ? 'rgb(var(--color-warning))'
        : 'rgb(var(--color-text-tertiary))'};
`;

const SearchOptions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const DateRangeSelect = styled.select`
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
`;

const ResultsCount = styled.span`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
  margin-left: auto;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const FooterHint = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary));
`;

const KeyHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
`;

const KeyBadge = styled.kbd`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 0.25rem;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  font-size: 0.625rem;
  font-family: inherit;
`;

const EmptyState = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyStateHint = styled.div`
  margin-top: 0.25rem;
  font-size: 0.875rem;
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: rgb(var(--color-text-tertiary));
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
`;

const QuickActionItem = styled.button<{ $isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: ${props => props.$isSelected ? 'rgb(var(--color-primary) / 0.1)' : 'transparent'};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-background));
    border-color: rgb(var(--color-primary) / 0.3);
  }
`;

const QuickActionIcon = styled.div<{ $colorVar: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: ${(p) => `rgba(var(${p.$colorVar}), 0.12)`};
  color: ${(p) => `rgb(var(${p.$colorVar}))`};
`;

const QuickActionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const QuickActionTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const QuickActionDescription = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary));
`;

// ============================================================================
// Icon Mapping
// ============================================================================

const getIconElement = (iconName: string): string => {
  const icons: Record<string, string> = {
    Building2: '🏢',
    Users: '👥',
    ShoppingCart: '🛒',
    Receipt: '📄',
    Package: '📦',
    User: '👤',
    FileText: '📋',
    Factory: '🏭',
    Truck: '🚚',
    File: '📁',
  };
  return icons[iconName] || '📁';
};

/** Flattens grouped results into a single list preserving group order. */
const flattenGrouped = (grouped: Record<string, SearchResult[]>): SearchResult[] =>
  Object.values(grouped).flat();

// ============================================================================
// Search Cache (in-memory with TTL)
// ============================================================================

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

const CACHE_TTL_MS = 30000; // 30 seconds
const searchCache = new Map<string, CacheEntry>();

const getCachedResults = (query: string): SearchResult[] | null => {
  const entry = searchCache.get(query);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(query);
    return null;
  }

  return entry.results;
};

const setCachedResults = (query: string, results: SearchResult[]): void => {
  // Limit cache size to prevent memory bloat
  if (searchCache.size > 100) {
    const oldestKey = searchCache.keys().next().value as string | undefined;
    if (oldestKey) {
      searchCache.delete(oldestKey);
    } else {
      searchCache.clear();
    }
  }

  searchCache.set(query, {
    results,
    timestamp: Date.now(),
  });
};

// ============================================================================
// Component
// ============================================================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('last_30_days');
  const [totalCount, setTotalCount] = useState(0);

  // Entity detail modal state
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string | number } | null>(null);

  const handleEntityDetailClose = useCallback(() => setSelectedEntity(null), []);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Listen for pm:open-command-palette CustomEvent
  useEffect(() => {
    const handler = () => {
      // This event is dispatched externally (e.g. from Home page) to open the palette.
      // The parent Layout component handles setting isOpen — this is a fallback listener.
    };
    window.addEventListener('pm:open-command-palette', handler);
    return () => window.removeEventListener('pm:open-command-palette', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Fetch recent items
  useEffect(() => {
    if (isOpen) {
      fetchRecentItems();
    }
  }, [isOpen]);

  const fetchRecentItems = async () => {
    try {
      setRecentItems(await getRecentItems(5));
    } catch (err) {
      logger.error('Failed to fetch recent items:', err);
    }
  };

  // Debounced search with caching and ranked results (300ms debounce)
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    // Check cache first
    const cacheKey = `${query}-${dateRange}`;
    const cached = getCachedResults(cacheKey);
    if (cached) {
      setResults(cached);
      setTotalCount(cached.length);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await searchRanked({
          query,
          dateRange,
          limit: 8,
        });

        const fetchedResults = response.results;
        setCachedResults(cacheKey, fetchedResults);

        setResults(fetchedResults);
        setTotalCount(response.total || fetchedResults.length);
        setSelectedIndex(0);
      } catch (err) {
        logger.error('[CommandPalette] Search failed:', err);
        setResults([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, dateRange]);

  // Group results by entity type
  const groupedResults = useMemo(
    () => groupSearchResultsByType(results),
    [results],
  );
  const flatResults = useMemo(() => flattenGrouped(groupedResults), [groupedResults]);

  // Keyboard navigation — supports quick actions
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const searchItems = query.length >= 2 ? flatResults : recentItems;
    const showQuickActions = query.length < 2;
    const totalItems = showQuickActions
      ? searchItems.length + QUICK_ACTIONS.length
      : searchItems.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (showQuickActions) {
          if (selectedIndex < searchItems.length) {
            handleSelect(searchItems[selectedIndex]);
          } else {
            const actionIndex = selectedIndex - searchItems.length;
            if (QUICK_ACTIONS[actionIndex]) {
              handleQuickAction(QUICK_ACTIONS[actionIndex]);
            }
          }
        } else if (searchItems[selectedIndex]) {
          handleSelect(searchItems[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [query, flatResults, recentItems, selectedIndex, onClose]);

  const handleSelect = async (item: SearchResult) => {
    // Track item access
    try {
      await trackRecentItem({ type: item.type, id: item.id, title: item.title });
    } catch {
      // Ignore tracking errors
    }

    if (item.route) {
      onClose();
      navigate(item.route);
      return;
    }

    // Preserve existing behavior for other entity types.
    setSelectedEntity({ type: item.type, id: item.id });
  };

  const handleQuickAction = useCallback((action: QuickAction) => {
    onClose();
    navigate(action.route);
  }, [onClose, navigate]);

  return (
    <Overlay $isOpen={isOpen} onClick={onClose}>
      <PaletteContainer onClick={e => e.stopPropagation()}>
        <SearchInputContainer>
          <SearchIcon size={20} />
          <SearchInput
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search suppliers, customers, orders..."
          />
          <CloseButton onClick={onClose} aria-label="Close search">
            <X size={16} />
          </CloseButton>
        </SearchInputContainer>

        {/* Date Range Filter - Show only when searching */}
        {query.length >= 2 && (
          <SearchOptions>
            <DateRangeSelect
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Filter by date range"
            >
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="last_90_days">Last 90 days</option>
              <option value="all_time">All time</option>
            </DateRangeSelect>
            {totalCount > 0 && (
              <ResultsCount>{totalCount} results</ResultsCount>
            )}
          </SearchOptions>
        )}

        <ResultsContainer aria-live="polite" role="listbox" aria-label="Search results">
          {isLoading ? (
            <LoadingSpinner>Searching...</LoadingSpinner>
          ) : query.length >= 2 ? (
            // Grouped search results by entity type
            flatResults.length > 0 ? (
              <>
                {Object.entries(groupedResults).map(([type, items]) => {
                  // Calculate the flat index offset for this group
                  const groupStartIndex = flatResults.indexOf(items[0]);
                  return (
                    <ResultSection key={type}>
                      <SectionHeader>
                        <SectionIcon>{getEntityIcon(type, 14)}</SectionIcon>
                        <SectionTitle>{entityTypeDisplayName(type)}</SectionTitle>
                        <SectionCount>{items.length}</SectionCount>
                      </SectionHeader>
                      {items.map((item, idx) => {
                        const flatIndex = groupStartIndex + idx;
                        return (
                          <ResultItem
                            key={`${item.type}-${item.id}`}
                            $isSelected={flatIndex === selectedIndex}
                            role="option"
                            aria-selected={flatIndex === selectedIndex}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                          >
                            <ResultIcon $colorVar={item.colorVar}>
                              {getIconElement(item.icon ?? '')}
                            </ResultIcon>
                            <ResultContent>
                              <ResultTitle>{item.title}</ResultTitle>
                              {item.subtitle && (
                                <ResultSubtitle>{item.subtitle}</ResultSubtitle>
                              )}
                              {item.labels && item.labels.length > 0 && (
                                <ResultLabels>
                                  {item.labels.map((label, labelIdx) => (
                                    <Label key={labelIdx}>{label}</Label>
                                  ))}
                                </ResultLabels>
                              )}
                            </ResultContent>
                            <ScoreBadge $score={item.score || 0}>
                              {Math.round(item.score || 0)}
                            </ScoreBadge>
                            <ResultType>{item.type.replace('_', ' ')}</ResultType>
                          </ResultItem>
                        );
                      })}
                    </ResultSection>
                  );
                })}
              </>
            ) : (
              <EmptyState>
                No results found for "{query}"
                <br />
                <EmptyStateHint>
                  Try a broader query or check that data exists for your tenant
                </EmptyStateHint>
              </EmptyState>
            )
          ) : (
            // Default view: Recent items + Quick actions
            <>
              {recentItems.length > 0 && (
                <ResultSection>
                  <SectionTitle>Recent</SectionTitle>
                  {recentItems.map((item, index) => (
                    <ResultItem
                      key={`${item.type}-${item.id}`}
                      $isSelected={index === selectedIndex}
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <ResultIcon $colorVar={item.colorVar}>
                        {getIconElement(item.icon ?? '')}
                      </ResultIcon>
                      <ResultContent>
                        <ResultTitle>{item.title}</ResultTitle>
                        {item.subtitle && (
                          <ResultSubtitle>{item.subtitle}</ResultSubtitle>
                        )}
                      </ResultContent>
                      <ResultType>{item.type.replace('_', ' ')}</ResultType>
                    </ResultItem>
                  ))}
                </ResultSection>
              )}
              <ResultSection>
                <SectionTitle>Quick Actions</SectionTitle>
                <QuickActionsGrid>
                  {QUICK_ACTIONS.map((action, index) => {
                    const actionIndex = recentItems.length + index;
                    return (
                      <QuickActionItem
                        key={action.id}
                        $isSelected={actionIndex === selectedIndex}
                        onClick={() => handleQuickAction(action)}
                        onMouseEnter={() => setSelectedIndex(actionIndex)}
                      >
                        <QuickActionIcon $colorVar={action.colorVar}>
                          {action.icon}
                        </QuickActionIcon>
                        <QuickActionContent>
                          <QuickActionTitle>{action.title}</QuickActionTitle>
                          <QuickActionDescription>{action.description}</QuickActionDescription>
                        </QuickActionContent>
                      </QuickActionItem>
                    );
                  })}
                </QuickActionsGrid>
              </ResultSection>
            </>
          )}
        </ResultsContainer>

        <Footer>
          <FooterHint>
            <KeyHint>
              <KeyBadge><ArrowUp size={10} /></KeyBadge>
              <KeyBadge><ArrowDown size={10} /></KeyBadge>
              to navigate
            </KeyHint>
            <KeyHint>
              <KeyBadge><CornerDownLeft size={10} /></KeyBadge>
              to select
            </KeyHint>
            <KeyHint>
              <KeyBadge>esc</KeyBadge>
              to close
            </KeyHint>
          </FooterHint>
        </Footer>
      </PaletteContainer>

      {/* Entity Detail Modal */}
      {selectedEntity && (
        <EntityDetailModal
          isOpen={!!selectedEntity}
          onClose={handleEntityDetailClose}
          entityType={selectedEntity.type}
          entityId={selectedEntity.id}
          onExpandEntity={(entity) => {
            // Keep modal open but load relational data for expanded view
            logger.debug('[CommandPalette] Expanding entity:', {
              id: entity?.id,
              type: entity?.type,
            });
            setSelectedEntity(null); // Close detail modal
            // Trigger search with entity context for mind-map view
              handleSelect({
                id: entity.id,
                type: entity.type,
                title: entity.name || entity.title || '',
                subtitle: entity.subtitle || '',
                icon: entity.metadata?.icon || '',
                colorVar: getSearchColorVar({ type: entity.type, metadata: entity.metadata }),
                route: entity.metadata?.listRoute || `/${entity.type}s`,
                score: 1,
                labels: [],
                metadata: entity.metadata ?? {},
              });
            }}
          />
      )}
    </Overlay>
  );
};

export default CommandPalette;
