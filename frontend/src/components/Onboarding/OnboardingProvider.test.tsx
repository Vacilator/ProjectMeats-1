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
    hasCompletedTour,
    markTourCompleted,
    resetTourCompletion,
  } = useOnboarding();

  return (
    <div>
      <div data-testid="ready">{isReady ? 'ready' : 'loading'}</div>
      <div data-testid="completed-tours">{completedTours.join(',')}</div>
      <div data-testid="cockpit-complete">{hasCompletedTour('cockpit') ? 'yes' : 'no'}</div>
      <button type="button" onClick={() => void markTourCompleted('workflow-editor')}>
        complete-workflow
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
      data: { onboarding_state: { completed_tours: [] } },
    });
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  });

  it('hydrates onboarding tours from backend preferences for authenticated users', async () => {
    localStorage.setItem('accessToken', 'token');
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { onboarding_state: { completed_tours: ['cockpit'] } },
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
    expect(screen.getByTestId('completed-tours')).toHaveTextContent('cockpit');
  });

  it('persists canonical onboarding state without clobbering the rest of the session', async () => {
    localStorage.setItem('accessToken', 'token');
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { onboarding_state: { completed_tours: ['cockpit'] } },
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
        onboarding_state: { completed_tours: ['cockpit', 'workflow-editor'] },
      });
    });

    await user.click(screen.getByRole('button', { name: 'reset-cockpit' }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenLastCalledWith('/preferences/me/', {
        onboarding_state: { completed_tours: ['workflow-editor'] },
      });
    });
  });
});
