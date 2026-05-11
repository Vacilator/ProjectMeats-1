import { describe, expect, it } from 'vitest';

import {
  buildCanonicalSearchParams,
  buildCanonicalSearchPath,
  getCanonicalSearchQuery,
} from './canonicalSearch';

describe('canonicalSearch', () => {
  it('preserves tab and item while updating q', () => {
    const next = buildCanonicalSearchParams('?tab=action-required&item=review-1&q=old', 'copper');

    expect(next.toString()).toBe('tab=action-required&item=review-1&q=copper');
  });

  it('removes q when the next query is empty', () => {
    const next = buildCanonicalSearchParams('?tab=pipeline&q=old', '');

    expect(next.toString()).toBe('tab=pipeline');
  });

  it('builds the canonical command-center path', () => {
    expect(
      buildCanonicalSearchPath({
        query: 'brisket',
        searchParams: '?tab=pipeline',
      }),
    ).toBe('/command-center?tab=pipeline&q=brisket');
  });

  it('reads q from search params', () => {
    expect(getCanonicalSearchQuery('?tab=overview&q=steel')).toBe('steel');
  });
});
