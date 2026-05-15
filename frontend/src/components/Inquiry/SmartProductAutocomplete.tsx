/**
 * Smart Product Autocomplete with Rich Previews
 * 
 * Enhanced product selection with:
 * - Fuzzy search integration with Cockpit
 * - Rich preview cards with product details
 * - Suggested products based on customer preferences
 * - Quick actions (add to favorites, view details)
 * - Keyboard navigation (↑/↓/Enter/Esc)
 * 
 * Created: 2026-02-26 - Auto-Suggest Integration
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import debounce from 'lodash/debounce';
import { businessApi } from '../../services/businessApi';
import { Product } from '../../types';
import { Search as SearchIcon, Star, Package, DollarSign, X } from 'lucide-react';
import { coerceFiniteNumber, formatFixedWithFallback } from './numberFormatting';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SmartProductAutocompleteProps {
  value: string;
  onChange: (productId: string, product: Product) => void;
  suggestedProducts?: Product[];
  /**
   * Optional filter for master catalog search.
   * Accepts a single protein type or list (e.g. 'beef' or ['beef','pork']).
   */
  proteinTypeFilter?: string | string[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

interface SearchResult {
  id: string;
  product_code: string;
  name?: string;
  description?: string;
  description_of_product_item?: string;
  protein_type?: string;
  type_of_protein?: string;
  avg_price?: number;
  is_active?: boolean;
  is_suggested?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  position: relative;
  width: 100%;
`;

const SearchInput = styled.input<{ $error?: boolean; $hasValue?: boolean }>`
  width: 100%;
  padding: 10px 40px 10px 38px;
  border: 1.5px solid ${props => props.$error ? 'rgb(var(--color-error))' : props.$hasValue ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
  background: rgb(var(--color-bg-primary));
  
  &:focus {
    outline: none;
    border-color: ${props => props.$error ? 'rgb(var(--color-error))' : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px ${props => props.$error ? 'rgba(var(--color-error), 0.1)' : 'rgba(var(--color-primary), 0.1)'};
  }
  
  &:disabled {
    background: rgb(var(--color-background-disabled));
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const SearchIconWrapper = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-secondary));
  pointer-events: none;
`;

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  
  &:hover {
    background: rgba(var(--color-overlay), 0.05);
    color: rgb(var(--color-text-primary));
  }
`;

const Dropdown = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'block' : 'none'};
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 400px;
  overflow-y: auto;
  background: rgb(var(--color-bg-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(var(--color-overlay), 0.15);
  /* Sit above modal/table stacking contexts */
  z-index: 2000;
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 4px;
    
    &:hover {
      background: rgb(var(--color-text-secondary));
    }
  }
`;

const SectionHeader = styled.div<{ $variant?: 'suggested' | 'results' }>`
  padding: 12px 16px 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${props => props.$variant === 'suggested' ? 'rgb(var(--color-warning))' : 'rgb(var(--color-text-secondary))'};
  background: ${props => props.$variant === 'suggested' ? 'rgba(var(--color-warning), 0.05)' : 'transparent'};
  border-bottom: 1px solid rgb(var(--color-border));
  position: sticky;
  top: 0;
  z-index: 10;
`;

const ResultItem = styled.div<{ $isSelected?: boolean; $isSuggested?: boolean }>`
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgb(var(--color-border-light));
  background: ${props => props.$isSelected ? 'rgba(var(--color-primary), 0.08)' : 'rgb(var(--color-bg-primary))'};
  
  &:hover {
    background: ${props => props.$isSelected ? 'rgba(var(--color-primary), 0.12)' : 'rgba(var(--color-primary), 0.05)'};
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const ResultHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const ProductCode = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SuggestedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(var(--color-warning), 0.15);
  color: rgb(var(--color-warning));
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const PriceTag = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-success));
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ProductDescription = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 6px;
  line-height: 1.4;
`;

const ProductMeta = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  
  span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  
  .icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }
  
  .message {
    font-size: 14px;
    line-height: 1.5;
  }
`;

const LoadingState = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  
  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(var(--color-primary), 0.2);
    border-top-color: rgb(var(--color-primary));
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// ============================================================================
// Component
// ============================================================================

export const SmartProductAutocomplete: React.FC<SmartProductAutocompleteProps> = ({
  value,
  onChange,
  suggestedProducts = [],
  proteinTypeFilter,
  placeholder = 'Search products...',
  disabled = false,
  error = false,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Load selected product details if value changes externally
  useEffect(() => {
    if (value && !selectedProduct) {
      fetchProductById(value);
    }
  }, [value]);
  
  const fetchProductById = async (productId: string) => {
    try {
      const response = await businessApi.get(`system/products/${productId}/`);
      setSelectedProduct(response.data);
      setSearchTerm(response.data.product_code);
    } catch (err) {
      logger.error('Failed to fetch product:', err);
    }
  };
  
  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        const normalizedProteinFilter = (() => {
          if (!proteinTypeFilter) return undefined;
          const raw = Array.isArray(proteinTypeFilter) ? proteinTypeFilter : [proteinTypeFilter];
          const normalized = raw
            .map((t) => String(t).toLowerCase().trim())
            .filter(Boolean);
          return normalized.length ? normalized : undefined;
        })();

        // Query master product catalog directly so we can apply protein filtering.
        // Backend expects comma-separated string for ?protein=beef,pork
        const response = await businessApi.get('system/products/', {
          params: {
            search: query,
            is_active: true,
            page_size: 20,
            ...(normalizedProteinFilter ? { protein: normalizedProteinFilter.join(',') } : {}),
          },
        });

        const raw = response.data as any;
        const products = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];

        // Mark suggested products
        const enrichedResults = products.map((p: Product) => ({
          ...p,
          is_suggested: suggestedProducts.some(sp => String(sp.id) === String((p as any).id)),
        }));

        setResults(enrichedResults);
      } catch (err) {
        logger.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [suggestedProducts, proteinTypeFilter]
  );
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectedProduct(null);
    setIsOpen(true);
    setSelectedIndex(0);
    debouncedSearch(value);
  };
  
  const handleSelectProduct = (product: SearchResult) => {
    setSelectedProduct(product as Product);
    setSearchTerm(product.product_code);
    setIsOpen(false);
    setSelectedIndex(0);
    onChange(product.id, product as Product);
  };
  
  const handleClear = () => {
    setSearchTerm('');
    setSelectedProduct(null);
    setResults([]);
    setIsOpen(false);
    onChange('', null as any);
    inputRef.current?.focus();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allResults = suggestedProducts.length > 0 ? [
      ...suggestedProducts.map(p => ({ ...p, is_suggested: true })),
      ...results.filter(r => !suggestedProducts.some(sp => sp.id === r.id)),
    ] : results;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelectProduct(allResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };
  
  const handleFocus = () => {
    if (!selectedProduct && suggestedProducts.length > 0) {
      setIsOpen(true);
    }
  };
  
  // Prepare display results
  const displaySuggested = searchTerm.length === 0 ? suggestedProducts : [];
  const displayResults = results.filter(r => !displaySuggested.some(s => s.id === r.id));
  const allResults = [...displaySuggested.map(p => ({ ...p, is_suggested: true })), ...displayResults];
  
  return (
    <Container>
      <SearchIconWrapper>
        <SearchIcon size={16} />
      </SearchIconWrapper>
      
      <SearchInput
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        $error={error}
        $hasValue={!!selectedProduct}
        autoFocus={autoFocus}
      />
      
      {searchTerm && !disabled && (
        <ClearButton onClick={handleClear} type="button">
          <X size={16} />
        </ClearButton>
      )}
      
      <Dropdown ref={dropdownRef} $isOpen={isOpen}>
        {loading && (
          <LoadingState>
            <div className="spinner" />
            Searching products...
          </LoadingState>
        )}
        
        {!loading && allResults.length === 0 && searchTerm.length > 0 && (
          <EmptyState>
            <div className="icon">📦</div>
            <div className="message">
              No products found for "{searchTerm}"
              <br />
              Try a different search term
            </div>
          </EmptyState>
        )}
        
        {!loading && displaySuggested.length > 0 && (
          <>
            <SectionHeader $variant="suggested">
              <Star size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Suggested for Customer
            </SectionHeader>
            {displaySuggested.map((product, index) => (
              <ResultItem
                key={`suggested-${product.id}`}
                $isSelected={index === selectedIndex}
                $isSuggested={true}
                onClick={() => handleSelectProduct(product)}
              >
                <ResultHeader>
                  <ProductCode>
                    <Package size={16} />
                    {product.product_code}
                    <SuggestedBadge>
                      <Star size={10} />
                      Suggested
                    </SuggestedBadge>
                  </ProductCode>
                   {coerceFiniteNumber(product.avg_price) !== null && (
                     <PriceTag>
                       <DollarSign size={14} />
                        {formatFixedWithFallback(product.avg_price, 2)}/lb
                     </PriceTag>
                   )}
                </ResultHeader>
                <ProductDescription>
                  {product.description_of_product_item ?? product.description ?? product.name ?? ''}
                </ProductDescription>
                <ProductMeta>
                  {(product.type_of_protein ?? product.protein_type) && (
                    <span>🥩 {product.type_of_protein ?? product.protein_type}</span>
                  )}
                </ProductMeta>
              </ResultItem>
            ))}
          </>
        )}
        
        {!loading && displayResults.length > 0 && (
          <>
            {displaySuggested.length > 0 && <SectionHeader $variant="results">All Results</SectionHeader>}
            {displayResults.map((product, baseIndex) => {
              const index = displaySuggested.length + baseIndex;
              return (
                <ResultItem
                  key={product.id}
                  $isSelected={index === selectedIndex}
                  onClick={() => handleSelectProduct(product)}
                >
                  <ResultHeader>
                    <ProductCode>
                      <Package size={16} />
                      {product.product_code}
                    </ProductCode>
                     {coerceFiniteNumber(product.avg_price) !== null && (
                       <PriceTag>
                         <DollarSign size={14} />
                          {formatFixedWithFallback(product.avg_price, 2)}/lb
                       </PriceTag>
                     )}
                  </ResultHeader>
                  <ProductDescription>
                    {product.description_of_product_item ?? product.description ?? product.name ?? ''}
                  </ProductDescription>
                  <ProductMeta>
                    {(product.type_of_protein ?? product.protein_type) && (
                      <span>🥩 {product.type_of_protein ?? product.protein_type}</span>
                    )}
                  </ProductMeta>
                </ResultItem>
              );
            })}
          </>
        )}
      </Dropdown>
    </Container>
  );
};
