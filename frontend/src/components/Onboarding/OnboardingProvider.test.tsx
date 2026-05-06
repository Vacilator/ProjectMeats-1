import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingProvider, useOnboarding } from './OnboardingProvider';
import { userPreferencesService } from '../../services/userPreferencesService';

const mockUseAuthState = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuthState: () => mockUseAuthState(),
}));

vi.mock('../../services/userPreferencesService', () => ({
  userPreferencesService: {
    getCurrent: vi.fn(),
    updateCurrent: vi.fn(),
  },
}));

const mockedUserPreferencesService = vi.mocked(userPreferencesService, true);

const TestConsumer: React.FC = () => {
  const {
    hasCompletedTour,
    getTourStatus,
    isReady,
    launchTour,
    markTourCompleted,
  } = useOnboarding();

  return (
    <div>
      <div data-testid="ready">{String(isReady)}</div>
      <div data-testid="completed">{String(hasCompletedTour('cockpit'))}</div>
      <div data-testid="status">{getTourStatus('cockpit').status}</div>
      <button
        type="button"
        onClick={() => {
          void markTourCompleted('cockpit');
        }}
      >
        Complete
      </button>
      <button
        type="button"
        onClick={() => {
          void launchTour('cockpit', 'restart');
        }}
      >
        Restart
      </button>
    </div>
  );
};

describe('OnboardingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseAuthState.mockReturnValue({
      isAuthenticated: true,
      loading: false,
    });

    mockedUserPreferencesService.getCurrent.mockResolvedValue({
      onboarding_state: {
        completed_tours: [],
        tour_statuses: {},
      },
    } as any);

    mockedUserPreferencesService.updateCurrent.mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('migrates legacy onboarding localStorage keys into the shared onboarding state', async () => {
    localStorage.setItem('cockpit_tour_completed', 'true');
    localStorage.setItem('projectmeats_tours_completed', JSON.stringify(['workflow-editor']));

    render(
      <OnboardingProvider>
        <TestConsumer />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
      expect(screen.getByTestId('completed')).toHaveTextContent('true');
    });

    expect(mockedUserPreferencesService.updateCurrent).toHaveBeenCalledWith({
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
            complete_count: 0,
            skip_count: 0,
            resume_count: 0,
          },
          'workflow-editor': {
            status: 'completed',
            last_event: null,
            last_event_at: null,
            started_at: null,
            completed_at: null,
            skipped_at: null,
            start_count: 0,
            complete_count: 0,
            skip_count: 0,
            resume_count: 0,
          },
        },
      },
    });
    expect(localStorage.getItem('cockpit_tour_completed')).toBeNull();
    expect(localStorage.getItem('projectmeats_tours_completed')).toBeNull();
  });

  it('restarts a completed tour without preserving completed state', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider>
        <TestConsumer />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });

    await user.click(screen.getByText('Complete'));

    await waitFor(() => {
      expect(screen.getByTestId('completed')).toHaveTextContent('true');
      expect(screen.getByTestId('status')).toHaveTextContent('completed');
    });

    await user.click(screen.getByText('Restart'));

    await waitFor(() => {
      expect(screen.getByTestId('completed')).toHaveTextContent('false');
      expect(screen.getByTestId('status')).toHaveTextContent('in_progress');
    });
  });
});
