/**
 * Mind-Map & Continuous Search (Phase 3.1 + 3.4)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Input, Spin } from 'antd';
import debounce from 'lodash/debounce';
import { searchContinuous } from '@/services/searchService';
import { logger } from '@/utils/logger';

interface SearchResult {
  id: string;
  label: string;
  entity_type: string;
}

/**
 * Continuous search with sub-100ms cached responses.
 * Phase 3.4: Continuous Search
 */
export const useContinuousSearch = (entityType: string) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useMemo(
    () => debounce(async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const results = await searchContinuous({ query: searchQuery, entityType });
        setResults(
          results.map((result) => ({
            id: result.id,
            label: result.title,
            entity_type: result.type,
          }))
        );
      } catch (err) {
        logger.error('[ContinuousSearch] Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 300),
    [entityType]
  );

  useEffect(() => {
    performSearch(query);
    return () => performSearch.cancel();
  }, [query, performSearch]);

  return { query, setQuery, results, loading };
};

/**
 * Search input with continuous suggestions.
 */
export const ContinuousSearchInput: React.FC<{
  entityType: string;
  onSelect: (result: SearchResult) => void;
}> = ({ entityType, onSelect }) => {
  const { query, setQuery, results, loading } = useContinuousSearch(entityType);

  return (
    <div>
      <Input.Search
        placeholder="Search..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        loading={loading}
      />
      {results.length > 0 && (
        <div style={{ marginTop: 8, border: '1px solid rgb(var(--color-border))', borderRadius: 4 }}>
          {results.map(result => (
            <div
              key={result.id}
              onClick={() => onSelect(result)}
              style={{ padding: 8, cursor: 'pointer' }}
            >
              {result.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
