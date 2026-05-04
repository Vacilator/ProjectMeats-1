import React, { type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingProvider } from '../../Onboarding';
import { useOnboardingTour } from './useOnboardingTour';

const apiServiceMock = vi.hoisted(() => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../../services/apiService', () => apiServiceMock);
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
  ORIGIN: {
    OVERLAY: 'overlay',
  },
  STATUS: {
    FINISHED: 'finished',
    SKIPPED: 'skipped',
  },
}));

const { apiClient } = apiServiceMock;

const wrapper = ({ children }: PropsWithChildren) => (
  <OnboardingProvider>{children}</OnboardingProvider>
);

describe('useOnboardingTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('accessToken', 'token');
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { onboarding_state: { completed_tours: [], tour_statuses: {} } },
    });
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-starts when the shared onboarding contract says the tour is incomplete', async () => {
    const { result } = renderHook(
      () => useOnboardingTour({ name: 'workflow-editor', steps: [], autoStart: true }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/preferences/me/');
    expect(result.current.run).toBe(false);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.run).toBe(true);
  });

  it('does not auto-start a tour that the user intentionally skipped earlier', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        onboarding_state: {
          completed_tours: [],
          tour_statuses: { 'workflow-editor': { status: 'skipped', skip_count: 1 } },
        },
      },
    });

    const { result } = renderHook(
      () => useOnboardingTour({ name: 'workflow-editor', steps: [], autoStart: true }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.run).toBe(false);
  });

  it('resets a completed tour through the shared onboarding provider', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        onboarding_state: {
          completed_tours: ['workflow-editor'],
          tour_statuses: { 'workflow-editor': { status: 'completed', complete_count: 1 } },
        },
      },
    });

    const { result } = renderHook(
      () => useOnboardingTour({ name: 'workflow-editor', steps: [], autoStart: true }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/preferences/me/');

    await act(async () => {
      result.current.resetTour();
      await Promise.resolve();
    });

    expect(result.current.run).toBe(true);
    expect(apiClient.patch).toHaveBeenCalledWith('/preferences/me/', {
      onboarding_state: {
        completed_tours: [],
        tour_statuses: {
          'workflow-editor': {
            status: 'not_started',
            last_event: 'reset',
            last_event_at: expect.any(String),
            started_at: null,
            completed_at: null,
            skipped_at: null,
            start_count: 0,
            complete_count: 1,
            skip_count: 0,
            resume_count: 0,
          },
        },
      },
    });
  });
});
