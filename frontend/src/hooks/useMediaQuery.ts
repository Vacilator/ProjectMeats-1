import { useState, useEffect } from 'react';

/**
 * Reactive CSS media-query hook.
 *
 * @param query  A valid CSS media query string, e.g. `(max-width: 768px)`.
 * @returns `true` when the viewport currently matches the query.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isTablet = useMediaQuery('(max-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** Convenience: viewport ≤ 768px */
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');

/** Convenience: viewport ≤ 1024px */
export const useIsTablet = () => useMediaQuery('(max-width: 1024px)');
