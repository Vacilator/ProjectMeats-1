/**
 * Render-stability regression test for the queryClient.invalidateQueries
 * pattern used in EmailIngestionCockpitPanel.
 *
 * Guards against React #185 caused by:
 *   const refetchAll = useCallback(() => { ... }, [emailsQuery, pendingReviewsQuery])
 * where TanStack Query result objects change identity every render, making deps
 * always "stale" → new refetchAll reference → effect/callback cascade → loop.
 *
 * The fix uses `queryClient.invalidateQueries({ queryKey: [...] })` which has
 * a stable reference from useQueryClient().
 *
 * NOTE: These tests avoid actual useQuery calls (which hang under JSDOM with
 * mocked axios). Instead they test the *pattern* — callback reference stability
 * when using queryClient vs query result objects as deps.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('queryClient.invalidateQueries stability', () => {
  it('queryClient reference is stable across component re-renders', async () => {
    const qc = createTestQueryClient();
    const clientRefs: Array<unknown> = [];

    function ClientTracker() {
      const queryClient = useQueryClient();
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick < 5) setTick((t) => t + 1);
      }, [tick]);

      clientRefs.push(queryClient);
      return <div data-testid="tick">{tick}</div>;
    }

    render(
      <QueryClientProvider client={qc}>
        <ClientTracker />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tick')).toHaveTextContent('5');
    });

    // queryClient reference should be identical across all renders
    const unique = new Set(clientRefs);
    expect(unique.size).toBe(1);
  });

  it('useCallback with queryClient dep produces a stable handler across rapid re-renders', async () => {
    const qc = createTestQueryClient();
    const handlerRefs: Array<() => void> = [];

    function StableHandler() {
      const queryClient = useQueryClient();
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick < 8) setTick((t) => t + 1);
      }, [tick]);

      const handleRefreshAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['emails'] });
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
      }, [queryClient]);

      handlerRefs.push(handleRefreshAll);
      return <div data-testid="tick">{tick}</div>;
    }

    render(
      <QueryClientProvider client={qc}>
        <StableHandler />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tick')).toHaveTextContent('8');
    });

    // Handler reference should be stable — all captured refs are the same function
    const unique = new Set(handlerRefs);
    expect(unique.size).toBe(1);
  });

  it('new object in deps causes callback instability (validates our detection)', async () => {
    const qc = createTestQueryClient();
    const handlerRefs: Array<() => void> = [];

    function UnstableHandler() {
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick < 4) setTick((t) => t + 1);
      }, [tick]);

      // Simulate the broken pattern: fresh object in deps each render
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: test verifies unstable object identity causes handler churn
      const queryResult = { data: tick, refetch: () => {} };

      const handler = useCallback(() => {
        queryResult.refetch();
         
      }, [queryResult]);

      handlerRefs.push(handler);
      return <div data-testid="tick">{tick}</div>;
    }

    render(
      <QueryClientProvider client={qc}>
        <UnstableHandler />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tick')).toHaveTextContent('4');
    });

    // Fresh object dep → callback changes every render
    const unique = new Set(handlerRefs);
    expect(unique.size).toBeGreaterThan(1);
  });
});
