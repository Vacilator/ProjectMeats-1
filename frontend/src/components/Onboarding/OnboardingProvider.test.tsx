import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingProvider, useOnboarding } from './OnboardingProvider';

const apiServiceMock = vi.hoisted(() => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../services/apiService', () => apiServiceMock);

const { apiClient } = apiServiceMock;

const TestConsumer: React.FC = () => {
  const {
    isReady,
    completedTours,
    getLaunchNonce,
    getTourStatus,
    hasCompletedTour,
    launchTour,
    markTourSkipped,
    markTourCompleted,
    markTourStarted,
    resetTourCompletion,
  } = useOnboarding();

  return (
    <div>
      <div data-testid="ready">{isReady ? 'ready' : 'loading'}</div>
      <div data-testid="completed-tours">{completedTours.join(',')}</div>
      <div data-testid="cockpit-complete">{hasCompletedTour('cockpit') ? 'yes' : 'no'}</div>
      <div data-testid="cockpit-status">{getTourStatus('cockpit').status}</div>
      <div data-testid="workflow-launch-nonce">{getLaunchNonce('workflow-editor')}</div>
      <button type="button" onClick={() => void markTourStarted('cockpit')}>
        start-cockpit
      </button>
      <button type="button" onClick={() => void markTourSkipped('cockpit')}>
        skip-cockpit
      </button>
      <button type="button" onClick={() => void markTourCompleted('workflow-editor')}>
        complete-workflow
      </button>
      <button type="button" onClick={() => void launchTour('workflow-editor', 'resume')}>
        launch-workflow
      </button>
      <button type="button" onClick={() => void resetTourCompletion('cockpit')}>
        reset-cockpit
      </button>
    </div>
  );
};

describe('OnboardingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { onboarding_state: { completed_tours: [], tour_statuses: {} } },
    });
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  });

  it('hydrates onboarding tours from backend preferences for authenticated users', async () => {
    localStorage.setItem('accessToken', 'token');
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        onboarding_state: {
          completed_tours: ['cockpit'],
          tour_statuses: { cockpit: { status: 'completed', complete_count: 1 } },
        },
      },
    });

    render(
      <OnboardingProvider>
        <TestConsumer />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready');
    });

    expect(apiClient.get).toHaveBeenCalledWith('/preferences/me/');
    expect(screen.getByTestId('cockpit-complete')).toHaveTextContent('yes');
    expect(screen.getByTestId('cockpit-status')).toHaveTextContent('completed');
    expect(screen.getByTestId('completed-tours')).toHaveTextContent('cockpit');
  });

  it('persists canonical onboarding state without clobbering the rest of the session', async () => {
    localStorage.setItem('accessToken', 'token');
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        onboarding_state: {
          completed_tours: ['cockpit'],
          tour_statuses: { cockpit: { status: 'completed', complete_count: 1 } },
        },
      },
    });

    render(
      <OnboardingProvider>
        <TestConsumer />
      </OnboardingProvider>,
    );

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready');
    });

    await user.click(screen.getByRole('button', { name: 'complete-workflow' }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/preferences/me/', {
        onboarding_state: {
          completed_tours: ['cockpit', 'workflow-editor'],
          tour_statuses: {
            cockpit: {
              status: 'completed',
              last_event: null,
              last_event_at: null,
              started_at: null,
              completed_at: null,
              skipped_at: null,
              start_count: 0,
              complete_count: 1,
              skip_count: 0,
              resume_count: 0,
            },
            'workflow-editor': {
              status: 'completed',
              last_event: 'completed',
              last_event_at: expect.any(String),
              started_at: null,
              completed_at: expect.any(String),
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

    await user.click(screen.getByRole('button', { name: 'reset-cockpit' }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenLastCalledWith('/preferences/me/', {
        onboarding_state: {
          completed_tours: ['workflow-editor'],
          tour_statuses: {
            cockpit: {
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
            'workflow-editor': {
              status: 'completed',
              last_event: 'completed',
              last_event_at: expect.any(String),
              started_at: null,
              completed_at: expect.any(String),
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

  it('tracks skipped tours and explicit launch requests for resume controls', async () => {
    localStorage.setItem('accessToken', 'token');

    render(
      <OnboardingProvider>
        <TestConsumer />
      </OnboardingProvider>,
    );

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready');
    });

    await user.click(screen.getByRole('button', { name: 'start-cockpit' }));
    await user.click(screen.getByRole('button', { name: 'skip-cockpit' }));
    await user.click(screen.getByRole('button', { name: 'launch-workflow' }));

    await waitFor(() => {
      expect(screen.getByTestId('cockpit-status')).toHaveTextContent('skipped');
      expect(screen.getByTestId('workflow-launch-nonce')).toHaveTextContent('1');
    });

    expect(apiClient.patch).toHaveBeenLastCalledWith('/preferences/me/', {
      onboarding_state: {
        completed_tours: [],
        tour_statuses: {
          cockpit: {
            status: 'skipped',
            last_event: 'skipped',
            last_event_at: expect.any(String),
            started_at: expect.any(String),
            completed_at: null,
            skipped_at: expect.any(String),
            start_count: 1,
            complete_count: 0,
            skip_count: 1,
            resume_count: 0,
          },
          'workflow-editor': {
            status: 'in_progress',
            last_event: 'resumed',
            last_event_at: expect.any(String),
            started_at: expect.any(String),
            completed_at: null,
            skipped_at: null,
            start_count: 1,
            complete_count: 0,
            skip_count: 0,
            resume_count: 1,
          },
        },
      },
    });
  });
});
