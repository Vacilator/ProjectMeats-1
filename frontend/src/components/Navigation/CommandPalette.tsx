/**
 * Command Palette Component (Wave 2: Cockpit Command Center)
 * 
 * Features:
 * - Universal search across all entities (⌘K / Ctrl+K)
 * - Search operators (supplier:, customer:, po:, etc.)
 * - Recent items section
 * - Quick actions
 * - Keyboard navigation
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 * - No hardcoded colors
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import { apiClient } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  route: string;
  score: number;
}

interface SearchResponse {
  query: string;
  search_text: string;
  operator?: string;
  results: SearchResult[];
  counts: Record<string, number>;
  total: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
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
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
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
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--color-text-tertiary));
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

const ResultIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: ${props => props.$color}20;
  color: ${props => props.$color};
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

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
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

// ============================================================================
// Component
// ============================================================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
      const response = await apiClient.get('search/recent/', { params: { limit: 5 } });
      setRecentItems(response.data.items || []);
    } catch (err) {
      console.error('Failed to fetch recent items:', err);
    }
  };

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<SearchResponse>('search/universal/', {
          params: { q: query, limit: 8 }
        });
        setResults(response.data.results);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = query.length >= 2 ? results : recentItems;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selectedIndex]) {
          handleSelect(items[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [query, results, recentItems, selectedIndex, onClose]);

  const handleSelect = async (item: SearchResult) => {
    // Track item access
    try {
      await apiClient.post('search/recent/', {
        entity_type: item.type,
        entity_id: item.id,
        title: item.title
      });
    } catch (err) {
      // Ignore tracking errors
    }

    onClose();
    navigate(item.route);
  };

  const displayItems = query.length >= 2 ? results : recentItems;
  const showRecent = query.length < 2 && recentItems.length > 0;

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
          <CloseButton onClick={onClose}>
            <X size={16} />
          </CloseButton>
        </SearchInputContainer>

        <ResultsContainer>
          {isLoading ? (
            <LoadingSpinner>Searching...</LoadingSpinner>
          ) : displayItems.length > 0 ? (
            <ResultSection>
              <SectionTitle>
                {showRecent ? 'Recent' : `Results (${displayItems.length})`}
              </SectionTitle>
              {displayItems.map((item, index) => (
                <ResultItem
                  key={`${item.type}-${item.id}`}
                  $isSelected={index === selectedIndex}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <ResultIcon $color={item.color}>
                    {getIconElement(item.icon)}
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
          ) : query.length >= 2 ? (
            <EmptyState>
              No results found for "{query}"
              <br />
              <small>Try: supplier:name, po:number, @contact</small>
            </EmptyState>
          ) : (
            <EmptyState>
              Start typing to search...
              <br />
              <small>Use operators: supplier:, customer:, po:, so:, @</small>
            </EmptyState>
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
    </Overlay>
  );
};

export default CommandPalette;
