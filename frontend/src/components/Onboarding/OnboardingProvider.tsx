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
const LEGACY_COCKPIT_TOUR_COMPLETED_KEY = 'cockpit_tour_completed';
const LEGACY_TOURS_COMPLETED_KEY = 'projectmeats_tours_completed';

export type OnboardingTourRunState =
  | 'not_started'
  | 'in_progress'
  | 'skipped'
  | 'completed';

export type OnboardingTourEvent =
  | 'started'
  | 'completed'
  | 'skipped'
  | 'resumed'
  | 'reset';

export interface OnboardingTourStatus {
  status: OnboardingTourRunState;
  last_event: OnboardingTourEvent | null;
  last_event_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  start_count: number;
  complete_count: number;
  skip_count: number;
  resume_count: number;
}

export interface OnboardingState {
  completed_tours: string[];
  tour_statuses: Record<string, OnboardingTourStatus>;
}

interface OnboardingContextValue {
  isReady: boolean;
  completedTours: string[];
  hasCompletedTour: (tourName: string) => boolean;
  getTourStatus: (tourName: string) => OnboardingTourStatus;
  getLaunchNonce: (tourName: string) => number;
  markTourStarted: (
    tourName: string,
    source?: 'auto' | 'resume' | 'restart',
  ) => Promise<void>;
  markTourCompleted: (tourName: string) => Promise<void>;
  markTourSkipped: (tourName: string) => Promise<void>;
  resetTourCompletion: (tourName: string) => Promise<void>;
  launchTour: (tourName: string, mode?: 'resume' | 'restart') => Promise<void>;
}

const DEFAULT_TOUR_STATUS: OnboardingTourStatus = {
  status: 'not_started',
  last_event: null,
  last_event_at: null,
  started_at: null,
  completed_at: null,
  skipped_at: null,
  start_count: 0,
  complete_count: 0,
  skip_count: 0,
  resume_count: 0,
};

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed_tours: [],
  tour_statuses: {},
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const normalizeTourName = (tourName: string): string => tourName.trim();

const normalizeNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
};

const normalizeCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
};

const normalizeTourStatus = (value: unknown): OnboardingTourStatus => {
  const payload = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

  const rawStatus = normalizeNullableString(payload.status);
  const rawLastEvent = normalizeNullableString(payload.last_event);

  const status: OnboardingTourRunState =
    rawStatus === 'in_progress' ||
    rawStatus === 'skipped' ||
    rawStatus === 'completed'
      ? rawStatus
      : 'not_started';

  const lastEvent: OnboardingTourEvent | null =
    rawLastEvent === 'started' ||
    rawLastEvent === 'completed' ||
    rawLastEvent === 'skipped' ||
    rawLastEvent === 'resumed' ||
    rawLastEvent === 'reset'
      ? rawLastEvent
      : null;

  return {
    status,
    last_event: lastEvent,
    last_event_at: normalizeNullableString(payload.last_event_at),
    started_at: normalizeNullableString(payload.started_at),
    completed_at: normalizeNullableString(payload.completed_at),
    skipped_at: normalizeNullableString(payload.skipped_at),
    start_count: normalizeCount(payload.start_count),
    complete_count: normalizeCount(payload.complete_count),
    skip_count: normalizeCount(payload.skip_count),
    resume_count: normalizeCount(payload.resume_count),
  };
};

const getStatusForTour = (
  tourStatuses: Record<string, OnboardingTourStatus>,
  tourName: string,
): OnboardingTourStatus =>
  tourStatuses[normalizeTourName(tourName)] ?? DEFAULT_TOUR_STATUS;

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

  const rawTourStatuses =
    (value as Record<string, unknown>).tour_statuses &&
    typeof (value as Record<string, unknown>).tour_statuses === 'object'
      ? ((value as Record<string, unknown>).tour_statuses as Record<string, unknown>)
      : {};

  const tourStatuses = Object.entries(rawTourStatuses).reduce<Record<string, OnboardingTourStatus>>(
    (accumulator, [tourName, status]) => {
      const normalizedTourName = normalizeTourName(tourName);
      if (!normalizedTourName) {
        return accumulator;
      }

      accumulator[normalizedTourName] = normalizeTourStatus(status);
      return accumulator;
    },
    {},
  );

  return {
    completed_tours: normalizedTours,
    tour_statuses: tourStatuses,
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
    tour_statuses: state.tour_statuses,
  };
};

const updateTourStatus = (
  state: OnboardingState,
  tourName: string,
  updater: (currentStatus: OnboardingTourStatus) => OnboardingTourStatus,
): OnboardingState => {
  const normalizedTourName = normalizeTourName(tourName);
  if (!normalizedTourName) {
    return state;
  }

  return {
    ...state,
    tour_statuses: {
      ...state.tour_statuses,
      [normalizedTourName]: updater(getStatusForTour(state.tour_statuses, normalizedTourName)),
    },
  };
};

const recordTourStarted = (
  state: OnboardingState,
  tourName: string,
  source: 'auto' | 'resume' | 'restart',
): OnboardingState => {
  const baseState = source === 'restart' ? recordTourReset(state, tourName) : state;
  const timestamp = new Date().toISOString();

  return updateTourStatus(baseState, tourName, (currentStatus) => ({
    ...currentStatus,
    status: 'in_progress',
    last_event: source === 'resume' ? 'resumed' : 'started',
    last_event_at: timestamp,
    started_at: currentStatus.started_at ?? timestamp,
    start_count: currentStatus.start_count + 1,
    resume_count:
      source === 'resume'
        ? currentStatus.resume_count + 1
        : currentStatus.resume_count,
  }));
};

const recordLegacyTourCompletion = (state: OnboardingState, tourName: string): OnboardingState => {
  const nextState = updateCompletedTours(state, tourName, true);

  return updateTourStatus(nextState, tourName, (currentStatus) => ({
    ...currentStatus,
    status: currentStatus.status === 'completed' ? currentStatus.status : 'completed',
  }));
};

const readLegacyOnboardingState = (): OnboardingState => {
  if (typeof window === 'undefined') {
    return DEFAULT_ONBOARDING_STATE;
  }

  let nextState = DEFAULT_ONBOARDING_STATE;

  if (window.localStorage.getItem(LEGACY_COCKPIT_TOUR_COMPLETED_KEY)) {
    nextState = recordLegacyTourCompletion(nextState, 'cockpit');
  }

  try {
    const rawTours = window.localStorage.getItem(LEGACY_TOURS_COMPLETED_KEY);
    const legacyTours = rawTours ? JSON.parse(rawTours) : [];
    if (Array.isArray(legacyTours)) {
      legacyTours.forEach((tourName) => {
        if (typeof tourName !== 'string') {
          return;
        }

        nextState = recordLegacyTourCompletion(nextState, tourName);
      });
    }
  } catch {
    // Ignore malformed legacy payloads and continue with the canonical contract.
  }

  return nextState;
};

const clearLegacyOnboardingState = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LEGACY_COCKPIT_TOUR_COMPLETED_KEY);
  window.localStorage.removeItem(LEGACY_TOURS_COMPLETED_KEY);
};

const mergeOnboardingState = (
  currentState: OnboardingState,
  incomingState: OnboardingState,
): OnboardingState => {
  const mergedCompletedTours = Array.from(
    new Set([...currentState.completed_tours, ...incomingState.completed_tours]),
  );

  const mergedTourStatuses = { ...currentState.tour_statuses };
  Object.entries(incomingState.tour_statuses).forEach(([tourName, incomingStatus]) => {
    const existingStatus = mergedTourStatuses[tourName];
    if (!existingStatus || existingStatus.status === 'not_started') {
      mergedTourStatuses[tourName] = incomingStatus;
    }
  });

  return {
    completed_tours: mergedCompletedTours,
    tour_statuses: mergedTourStatuses,
  };
};

const recordTourCompleted = (state: OnboardingState, tourName: string): OnboardingState => {
  const timestamp = new Date().toISOString();
  const nextState = updateCompletedTours(state, tourName, true);

  return updateTourStatus(nextState, tourName, (currentStatus) => ({
    ...currentStatus,
    status: 'completed',
    last_event: 'completed',
    last_event_at: timestamp,
    completed_at: timestamp,
    complete_count: currentStatus.complete_count + 1,
  }));
};

const recordTourSkipped = (state: OnboardingState, tourName: string): OnboardingState => {
  const timestamp = new Date().toISOString();

  return updateTourStatus(state, tourName, (currentStatus) => ({
    ...currentStatus,
    status: 'skipped',
    last_event: 'skipped',
    last_event_at: timestamp,
    skipped_at: timestamp,
    skip_count: currentStatus.skip_count + 1,
  }));
};

const recordTourReset = (state: OnboardingState, tourName: string): OnboardingState => {
  const timestamp = new Date().toISOString();
  const nextState = updateCompletedTours(state, tourName, false);

  return updateTourStatus(nextState, tourName, (currentStatus) => ({
    status: 'not_started',
    last_event: 'reset',
    last_event_at: timestamp,
    started_at: null,
    completed_at: null,
    skipped_at: null,
    start_count: 0,
    complete_count: currentStatus.complete_count,
    skip_count: 0,
    resume_count: 0,
  }));
};

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthState();
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => readCachedOnboardingState());
  const [isReady, setIsReady] = useState(() => !loading && !isAuthenticated);
  const [launchNonceByTour, setLaunchNonceByTour] = useState<Record<string, number>>({});

  useEffect(() => {
    writeCachedOnboardingState(onboardingState);
  }, [onboardingState]);

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
        const nextState = mergeOnboardingState(
          normalizeOnboardingState(response.data?.onboarding_state),
          readLegacyOnboardingState(),
        );
        if (!isCancelled) {
          setOnboardingState(nextState);
        }
        clearLegacyOnboardingState();
        void syncOnboardingState(nextState);
      } catch (error) {
        logger.error(
          'Failed to load onboarding preferences',
          { component: 'OnboardingProvider' },
          error,
        );
        if (!isCancelled) {
          setOnboardingState(
            mergeOnboardingState(readCachedOnboardingState(), readLegacyOnboardingState()),
          );
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
  }, [isAuthenticated, loading, syncOnboardingState]);

  const hasCompletedTour = useCallback(
    (tourName: string) => {
      const normalizedTourName = normalizeTourName(tourName);
      return onboardingState.completed_tours.includes(normalizedTourName);
    },
    [onboardingState.completed_tours],
  );

  const getTourStatus = useCallback(
    (tourName: string) => getStatusForTour(onboardingState.tour_statuses, tourName),
    [onboardingState.tour_statuses],
  );

  const getLaunchNonce = useCallback(
    (tourName: string) => launchNonceByTour[normalizeTourName(tourName)] ?? 0,
    [launchNonceByTour],
  );

  const markTourStarted = useCallback(
    async (tourName: string, source: 'auto' | 'resume' | 'restart' = 'auto') => {
      setOnboardingState((currentState) => {
        const nextState = recordTourStarted(currentState, tourName, source);
        void syncOnboardingState(nextState);
        return nextState;
      });
    },
    [syncOnboardingState],
  );

  const markTourCompleted = useCallback(
    async (tourName: string) => {
      setOnboardingState((currentState) => {
        const nextState = recordTourCompleted(currentState, tourName);
        void syncOnboardingState(nextState);
        return nextState;
      });
    },
    [syncOnboardingState],
  );

  const markTourSkipped = useCallback(
    async (tourName: string) => {
      setOnboardingState((currentState) => {
        const nextState = recordTourSkipped(currentState, tourName);
        void syncOnboardingState(nextState);
        return nextState;
      });
    },
    [syncOnboardingState],
  );

  const resetTourCompletion = useCallback(
    async (tourName: string) => {
      setOnboardingState((currentState) => {
        const nextState = recordTourReset(currentState, tourName);
        void syncOnboardingState(nextState);
        return nextState;
      });
    },
    [syncOnboardingState],
  );

  const launchTour = useCallback(
    async (tourName: string, mode: 'resume' | 'restart' = 'resume') => {
      await markTourStarted(tourName, mode);

      setLaunchNonceByTour((currentNonces) => {
        const normalizedTourName = normalizeTourName(tourName);
        return {
          ...currentNonces,
          [normalizedTourName]: (currentNonces[normalizedTourName] ?? 0) + 1,
        };
      });
    },
    [markTourStarted],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isReady,
      completedTours: onboardingState.completed_tours,
      hasCompletedTour,
      getTourStatus,
      getLaunchNonce,
      markTourStarted,
      markTourCompleted,
      markTourSkipped,
      resetTourCompletion,
      launchTour,
    }),
    [
      getLaunchNonce,
      getTourStatus,
      hasCompletedTour,
      isReady,
      launchTour,
      markTourStarted,
      markTourCompleted,
      markTourSkipped,
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
