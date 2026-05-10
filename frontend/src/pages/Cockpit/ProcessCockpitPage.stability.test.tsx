/**
 * Render-stability regression test for the searchParams functional updater
 * pattern used in ProcessCockpitPage and similar components.
 *
 * Guards against React #185 caused by:
 *   setSearchParams(new URLSearchParams(searchParams))   // ← WRONG: reads live ref
 * vs the correct pattern:
 *   setSearchParams((prev) => { ... })                   // ← RIGHT: functional updater
 *
 * This test uses a minimal reproduction of the tab-change pattern
 * rather than mounting the full ProcessCockpitPage (which requires
 * extensive mocking of 5+ useQuery hooks + context providers).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router-dom';

/**
 * Simulates the CORRECT (fixed) pattern from ProcessCockpitPage.
 * handleTabChange uses setSearchParams((prev) => ...) instead of
 * reading searchParams directly.
 */
function StableTabComponent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  const activeTab = searchParams.get('view') || 'all';

  const handleTabChange = useCallback(
    (tab: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', tab);
        return next;
      });
    },
    [setSearchParams],
  );

  return (
    <div>
      <span data-testid="render-count">{renderCountRef.current}</span>
      <span data-testid="active-tab">{activeTab}</span>
      <button onClick={() => handleTabChange('inbox')}>Inbox</button>
      <button onClick={() => handleTabChange('tasks')}>Tasks</button>
      <button onClick={() => handleTabChange('all')}>All</button>
    </div>
  );
}

describe('searchParams functional updater stability', () => {
  it('stable pattern: tab changes do not cause excessive re-renders', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/?view=all']}>
        <StableTabComponent />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('all');

    // Switch tabs several times
    await user.click(screen.getByText('Inbox'));
    await user.click(screen.getByText('Tasks'));
    await user.click(screen.getByText('All'));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('all');
    });

    // Render count should stay bounded (initial + 3 tab changes)
    const renderCount = Number(screen.getByTestId('render-count').textContent);
    expect(renderCount).toBeLessThan(20);
  });

  it('stable pattern: handleTabChange reference is stable across renders', () => {
    const callbackRefs: Array<(...args: unknown[]) => void> = [];

    function Tracker() {
      const [, setSearchParams] = useSearchParams();
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick < 5) setTick((t) => t + 1);
      }, [tick]);

      const handler = useCallback(
        (tab: string) => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('view', tab);
            return next;
          });
        },
        [setSearchParams],
      );

      callbackRefs.push(handler);
      return <div />;
    }

    render(
      <MemoryRouter>
        <Tracker />
      </MemoryRouter>,
    );

    // All captured refs should be the same function (stable reference)
    const unique = new Set(callbackRefs);
    expect(unique.size).toBe(1);
  });
});
