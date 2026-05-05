import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CockpitTour, COCKPIT_TOUR_SELECTORS } from './CockpitTour';

const onboardingMock = vi.hoisted(() => ({
  useOnboarding: vi.fn(),
}));

const joyrideSpy = vi.hoisted(() => vi.fn());

vi.mock('../Onboarding', () => onboardingMock);
vi.mock('react-joyride', () => ({
  ACTIONS: {
    CLOSE: 'close',
    PREV: 'prev',
    SKIP: 'skip',
  },
  EVENTS: {
    ERROR: 'error',
    STEP_AFTER: 'step:after',
    TARGET_NOT_FOUND: 'target:not-found',
  },
  Joyride: (props: { run: boolean; stepIndex?: number; steps?: unknown[] }) => {
    joyrideSpy(props);
    return (
      <div
        data-testid="joyride"
        data-run={String(props.run)}
        data-step-count={String(props.steps?.length ?? 0)}
        data-step-index={String(props.stepIndex ?? 0)}
      />
    );
  },
  ORIGIN: {
    OVERLAY: 'overlay',
  },
  STATUS: {
    FINISHED: 'finished',
    SKIPPED: 'skipped',
  },
}));

const mockUseOnboarding = onboardingMock.useOnboarding as ReturnType<typeof vi.fn>;

describe('CockpitTour', () => {
  const markTourStarted = vi.fn().mockResolvedValue(undefined);
  const markTourCompleted = vi.fn().mockResolvedValue(undefined);
  const markTourSkipped = vi.fn().mockResolvedValue(undefined);
  const launchTour = vi.fn().mockResolvedValue(undefined);
  let launchNonce = 0;
  let tourStatus = 'not_started';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    launchNonce = 0;
    tourStatus = 'not_started';

    mockUseOnboarding.mockReturnValue({
      isReady: true,
      hasCompletedTour: vi.fn(() => false),
      getTourStatus: vi.fn(() => ({ status: tourStatus })),
      getLaunchNonce: vi.fn(() => launchNonce),
      launchTour,
      markTourCompleted,
      markTourSkipped,
      markTourStarted,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for cockpit readiness before launching the filtered cockpit steps', async () => {
    const availableSelectors = [
      COCKPIT_TOUR_SELECTORS.smartSearch,
      COCKPIT_TOUR_SELECTORS.widgetGrid,
    ];
    const { rerender } = render(
      <>
        <div id="tour-smart-search" />
        <CockpitTour
          enabled
          isCockpitLoaded={false}
          availableSelectors={availableSelectors}
        />
      </>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'false');
    expect(markTourStarted).not.toHaveBeenCalled();

    rerender(
      <>
        <div id="tour-smart-search" />
        <div id="tour-cockpit-grid" />
        <CockpitTour
          enabled
          isCockpitLoaded
          availableSelectors={availableSelectors}
        />
      </>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'true');
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-step-count', '4');
    expect(markTourStarted).toHaveBeenCalledWith('cockpit', 'auto');
  });

  it('keeps the quick actions step when the widget anchor is mounted before launch', async () => {
    render(
      <>
        <div id="tour-smart-search" />
        <div id="tour-cockpit-grid" />
        <div id="tour-quick-actions" />
        <CockpitTour
          enabled
          isCockpitLoaded
          availableSelectors={Object.values(COCKPIT_TOUR_SELECTORS)}
        />
      </>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'true');
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-step-count', '5');
    expect(markTourStarted).toHaveBeenCalledWith('cockpit', 'auto');
  });

  it('waits for readiness on manual relaunch without recording a second auto-start event', async () => {
    launchNonce = 1;
    tourStatus = 'completed';

    const { rerender } = render(
      <>
        <div id="tour-smart-search" />
        <div id="tour-cockpit-grid" />
        <div id="tour-quick-actions" />
        <CockpitTour
          enabled
          isCockpitLoaded={false}
          availableSelectors={Object.values(COCKPIT_TOUR_SELECTORS)}
        />
      </>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'false');

    rerender(
      <>
        <div id="tour-smart-search" />
        <div id="tour-cockpit-grid" />
        <div id="tour-quick-actions" />
        <CockpitTour
          enabled
          isCockpitLoaded
          availableSelectors={Object.values(COCKPIT_TOUR_SELECTORS)}
        />
      </>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'true');
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-step-count', '5');
    expect(markTourStarted).not.toHaveBeenCalled();
  });
});
