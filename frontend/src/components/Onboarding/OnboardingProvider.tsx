import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuthState } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiService';
import { logger } from '../../utils/logger';

const ONBOARDING_STORAGE_KEY = 'projectmeats_onboarding_state';

export interface OnboardingState {
  completed_tours: string[];
}

interface OnboardingContextValue {
  isReady: boolean;
  completedTours: string[];
  hasCompletedTour: (tourName: string) => boolean;
  markTourCompleted: (tourName: string) => Promise<void>;
  resetTourCompletion: (tourName: string) => Promise<void>;
}

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed_tours: [],
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const normalizeTourName = (tourName: string): string => tourName.trim();

const normalizeOnboardingState = (value: unknown): OnboardingState => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_ONBOARDING_STATE;
  }

  const rawCompletedTours = (value as Record<string, unknown>).completed_tours;
  const completedTours: unknown[] = Array.isArray(rawCompletedTours)
    ? rawCompletedTours
    : [];

  const normalizedTours = completedTours
    .filter((tourName: unknown): tourName is string => typeof tourName === 'string')
    .map((tourName: string) => normalizeTourName(tourName))
    .filter(
      (tourName: string, index: number, tours: string[]) =>
        Boolean(tourName) && tours.indexOf(tourName) === index,
    );

  return {
    completed_tours: normalizedTours,
  };
};

const readCachedOnboardingState = (): OnboardingState => {
  if (typeof window === 'undefined') {
    return DEFAULT_ONBOARDING_STATE;
  }

  try {
    const rawValue = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_ONBOARDING_STATE;
    }
    return normalizeOnboardingState(JSON.parse(rawValue));
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
};

const writeCachedOnboardingState = (state: OnboardingState) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
};

const updateCompletedTours = (
  state: OnboardingState,
  tourName: string,
  completed: boolean,
): OnboardingState => {
  const normalizedTourName = normalizeTourName(tourName);
  if (!normalizedTourName) {
    return state;
  }

  const completedTours = completed
    ? Array.from(new Set([...state.completed_tours, normalizedTourName]))
    : state.completed_tours.filter((name) => name !== normalizedTourName);

  return {
    completed_tours: completedTours,
  };
};

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthState();
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => readCachedOnboardingState());
  const [isReady, setIsReady] = useState(() => !loading && !isAuthenticated);

  useEffect(() => {
    writeCachedOnboardingState(onboardingState);
  }, [onboardingState]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated) {
      setOnboardingState(DEFAULT_ONBOARDING_STATE);
      setIsReady(true);
      return;
    }

    let isCancelled = false;
    setIsReady(false);

    const loadOnboardingState = async () => {
      try {
        const response = await apiClient.get('/preferences/me/');
        const nextState = normalizeOnboardingState(response.data?.onboarding_state);
        if (!isCancelled) {
          setOnboardingState(nextState);
        }
      } catch (error) {
        logger.error(
          'Failed to load onboarding preferences',
          { component: 'OnboardingProvider' },
          error,
        );
        if (!isCancelled) {
          setOnboardingState(readCachedOnboardingState());
        }
      } finally {
        if (!isCancelled) {
          setIsReady(true);
        }
      }
    };

    void loadOnboardingState();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, loading]);

  const syncOnboardingState = useCallback(
    async (nextState: OnboardingState) => {
      if (!isAuthenticated) {
        return;
      }

      try {
        await apiClient.patch('/preferences/me/', {
          onboarding_state: nextState,
        });
      } catch (error) {
        logger.error(
          'Failed to sync onboarding preferences',
          { component: 'OnboardingProvider' },
          error,
        );
      }
    },
    [isAuthenticated],
  );

  const hasCompletedTour = useCallback(
    (tourName: string) => {
      const normalizedTourName = normalizeTourName(tourName);
      return onboardingState.completed_tours.includes(normalizedTourName);
    },
    [onboardingState.completed_tours],
  );

  const markTourCompleted = useCallback(
    async (tourName: string) => {
      setOnboardingState((currentState) => {
        const nextState = updateCompletedTours(currentState, tourName, true);
        void syncOnboardingState(nextState);
        return nextState;
      });
    },
    [syncOnboardingState],
  );

  const resetTourCompletion = useCallback(
    async (tourName: string) => {
      setOnboardingState((currentState) => {
        const nextState = updateCompletedTours(currentState, tourName, false);
        void syncOnboardingState(nextState);
        return nextState;
      });
    },
    [syncOnboardingState],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isReady,
      completedTours: onboardingState.completed_tours,
      hasCompletedTour,
      markTourCompleted,
      resetTourCompletion,
    }),
    [
      hasCompletedTour,
      isReady,
      markTourCompleted,
      onboardingState.completed_tours,
      resetTourCompletion,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = (): OnboardingContextValue => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
