/**
 * SearchableSelect Component
 * 
 * A smart select component that:
 * - Shows normal dropdown for small option sets (<50)
 * - Switches to searchable API-backed dropdown for large sets
 * - Debounced search (300ms)
 * - Loading states and "no results" handling
 * - Keyboard navigation support
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { entityOptionsService } from '../../services/quickActionsService';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  entityType: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  initialOptions?: Option[];
  threshold?: number; // Number of options before switching to search mode
  filterParams?: Record<string, any>;
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Container = styled.div`
  position: relative;
  width: 100%;
`;

const SelectTrigger = styled.button<{ $hasError?: boolean; $isOpen?: boolean }>`
  width: 100%;
  min-height: 44px;
  padding: 10px 40px 10px 14px;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  text-align: left;
  background: white;
  border: 1.5px solid ${props => props.$hasError ? '#ef4444' : props.$isOpen ? '#3b82f6' : '#d1d5db'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  
  ${props => props.$hasError && css`
    background: #fef2f2;
  `}
  
  &:hover:not(:disabled) {
    border-color: ${props => props.$hasError ? '#dc2626' : '#3b82f6'};
  }
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
  
  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const ChevronIcon = styled.span<{ $isOpen?: boolean }>`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%) ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0)'};
  transition: transform 0.2s;
  color: #6b7280;
  pointer-events: none;
`;

const Dropdown = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 300px;
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  flex-direction: column;
  overflow: hidden;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: none;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  
  &:focus {
    outline: none;
    background: white;
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const OptionsList = styled.div`
  flex: 1;
  overflow-y: auto;
  max-height: 250px;
`;

const OptionItem = styled.button<{ $isHighlighted?: boolean; $isSelected?: boolean }>`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  text-align: left;
  border: none;
  background: ${props => 
    props.$isHighlighted ? '#eff6ff' : 
    props.$isSelected ? '#f0fdf4' : 
    'white'
  };
  color: ${props => props.$isSelected ? '#15803d' : '#1f2937'};
  cursor: pointer;
  transition: background 0.1s;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: #eff6ff;
  }
  
  ${props => props.$isSelected && css`
    font-weight: 500;
    
    &::after {
      content: '✓';
      margin-left: auto;
      color: #22c55e;
    }
  `}
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #6b7280;
  font-size: 14px;
`;

const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: ${spin} 0.6s linear infinite;
`;

const NoResults = styled.div`
  padding: 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
`;

const InfoBar = styled.div`
  padding: 8px 14px;
  font-size: 12px;
  color: #6b7280;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
`;

const PlaceholderText = styled.span`
  color: #9ca3af;
`;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  entityType,
  value,
  onChange,
  onBlur,
  placeholder = 'Select...',
  hasError = false,
  disabled = false,
  initialOptions = [],
  threshold = 50,
  filterParams,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we should use search mode
  useEffect(() => {
    if (initialOptions.length >= threshold || totalCount >= threshold) {
      setIsSearchMode(true);
    }
  }, [initialOptions.length, totalCount, threshold]);

  // Load initial options if not provided
  useEffect(() => {
    if (initialOptions.length === 0 && entityType) {
      loadOptions();
    }
  }, [entityType, filterParams, initialOptions.length]);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onBlur?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onBlur]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && isSearchMode && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, isSearchMode]);

  const loadOptions = async (query: string = '') => {
    setIsLoading(true);
    try {
      const cancelKey = `search-${entityType}-${Date.now()}`;
      const response = await entityOptionsService.searchOptions(entityType, query, cancelKey, filterParams);
      setOptions(response.options);
      setTotalCount(response.total_count);
      
      if (response.total_count >= threshold) {
        setIsSearchMode(true);
      }
    } catch (err) {
      console.error('Failed to load options:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setHighlightedIndex(-1);
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      loadOptions(query);
    }, 300);
  }, [entityType, filterParams]);

  const handleToggle = () => {
    if (disabled) return;
    
    if (!isOpen) {
      setIsOpen(true);
      setSearchQuery('');
      if (options.length === 0 || isSearchMode) {
        loadOptions();
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < options.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : options.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const selectedOption = options.find(o => o.value === value) || 
    initialOptions.find(o => o.value === value);

  return (
    <Container ref={containerRef}>
      <SelectTrigger
        type="button"
        $hasError={hasError}
        $isOpen={isOpen}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedOption ? (
          selectedOption.label
        ) : (
          <PlaceholderText>{placeholder}</PlaceholderText>
        )}
        <ChevronIcon $isOpen={isOpen}>▼</ChevronIcon>
      </SelectTrigger>

      <Dropdown $isOpen={isOpen} role="listbox">
        {isSearchMode && (
          <SearchInput
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="🔍 Type to search..."
            aria-label="Search options"
          />
        )}

        <OptionsList>
          {isLoading ? (
            <LoadingState>
              <Spinner />
              Searching...
            </LoadingState>
          ) : options.length === 0 ? (
            <NoResults>
              {searchQuery ? 'No matches found' : 'No options available'}
            </NoResults>
          ) : (
            options.map((option, index) => (
              <OptionItem
                key={option.value}
                type="button"
                $isHighlighted={index === highlightedIndex}
                $isSelected={option.value === value}
                onClick={() => handleSelect(option)}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </OptionItem>
            ))
          )}
        </OptionsList>

        {totalCount > options.length && (
          <InfoBar>
            Showing {options.length} of {totalCount} results
            {searchQuery && ' - refine your search for more specific results'}
          </InfoBar>
        )}
      </Dropdown>
    </Container>
  );
};

export default SearchableSelect;
