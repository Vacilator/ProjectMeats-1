/**
 * CockpitTour - Guided tour for first-time Cockpit users
 * 
 * Features:
 * - Step-by-step walkthrough of Cockpit features
 * - Auto-starts on first visit using the shared onboarding contract
 * - Skip/dismiss functionality
 * - Responsive tooltips
 * - ARIA-compliant for accessibility
 * 
 * @module components/Cockpit/CockpitTour
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTIONS,
  EVENTS,
  Joyride,
  ORIGIN,
  STATUS,
  type EventData,
  type Options,
  type PartialDeep,
  type Step,
  type Styles,
} from 'react-joyride';
import { useOnboarding } from '../Onboarding';

interface CockpitTourProps {
  /**
   * Whether the tour should be active
   * Set to false to disable tour completely
   */
  enabled?: boolean;
  isCockpitLoaded?: boolean;
  availableSelectors?: string[];
  
  /**
   * Callback when tour completes or is skipped
   */
  onComplete?: () => void;
}

export const COCKPIT_TOUR_SELECTORS = {
  smartSearch: '#tour-smart-search',
  widgetGrid: '#tour-cockpit-grid',
  quickActions: '#tour-quick-actions',
} as const;

const DEFAULT_AVAILABLE_SELECTORS = Object.values(COCKPIT_TOUR_SELECTORS);
const AUTO_START_DELAY_MS = 250;
const TARGET_WAIT_TIMEOUT_MS = 4000;
const TARGET_WAIT_INTERVAL_MS = 150;

interface CockpitTourStep extends Step {
  requiredSelector?: string;
}

const normalizeAvailableSelectors = (availableSelectors: string[]): string[] =>
  Array.from(new Set(availableSelectors.filter(Boolean)));

const resolveCockpitTourSteps = (
  availableSelectors: string[],
  root: ParentNode | null,
): Step[] => {
  const allowedSelectors = new Set(normalizeAvailableSelectors(availableSelectors));

  return cockpitTourSteps
    .filter((step) => {
      if (!step.requiredSelector) {
        return true;
      }

      if (!allowedSelectors.has(step.requiredSelector)) {
        return false;
      }

      return root?.querySelector(step.requiredSelector) != null;
    })
    .map(({ requiredSelector, ...step }) => step);
};

const getPendingSelectors = (availableSelectors: string[], root: ParentNode | null): string[] => {
  const allowedSelectors = normalizeAvailableSelectors(availableSelectors);

  return allowedSelectors.filter((selector) => root?.querySelector(selector) == null);
};

const cockpitTourSteps: CockpitTourStep[] = [
  {
    target: 'body',
    content: (
      <div>
        <h2>Welcome to Cockpit! 🚀</h2>
        <p>
          Your central hub for managing customers, suppliers, orders, and inquiries.
          Let's take a quick tour to get you started!
        </p>
        <p style={{ fontSize: '0.875rem', color: 'rgb(var(--color-text-secondary))' }}>
          This will only take 60 seconds. You can skip anytime.
        </p>
      </div>
    ),
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: COCKPIT_TOUR_SELECTORS.smartSearch,
    requiredSelector: COCKPIT_TOUR_SELECTORS.smartSearch,
    content: (
      <div>
        <h3>Smart Search</h3>
        <p>
          <strong>Type any name to pull up contacts instantly!</strong>
        </p>
        <p>
          Search for customers, suppliers, products, or orders.
          Results show related records automatically.
        </p>
        <div style={{ 
          padding: '0.75rem', 
          background: 'rgb(var(--color-info) / 0.1)',
          borderRadius: '4px',
          margin: '0.5rem 0'
        }}>
          <strong>💡 Pro Tip:</strong> Press <kbd>⌘K</kbd> (Mac) or <kbd>Ctrl+K</kbd> (Windows)
          to open search from anywhere!
        </div>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: COCKPIT_TOUR_SELECTORS.widgetGrid,
    requiredSelector: COCKPIT_TOUR_SELECTORS.widgetGrid,
    content: (
      <div>
        <h3>Widget Dashboard</h3>
        <p>
          Your customizable workspace with real-time data:
        </p>
        <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
          <li>Today's key numbers and metrics</li>
          <li>Your tasks and upcoming calls</li>
          <li>Recent activity and orders</li>
          <li>Quick action buttons</li>
        </ul>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Click "Customize" to rearrange widgets or add new ones.
        </p>
      </div>
    ),
    placement: 'center',
  },
  {
    target: COCKPIT_TOUR_SELECTORS.quickActions,
    requiredSelector: COCKPIT_TOUR_SELECTORS.quickActions,
    content: (
      <div>
        <h3>Quick Actions</h3>
        <p>
          Create new records with one click:
        </p>
        <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
          <li>📞 New Call Log</li>
          <li>📋 New Inquiry</li>
          <li>📦 New Purchase Order</li>
          <li>📄 New Sales Order</li>
        </ul>
      </div>
    ),
    placement: 'top',
  },
  {
    target: 'body',
    content: (
      <div>
        <h2>You're All Set! ✨</h2>
        <p>
          You've learned the basics of Cockpit. Here's your quick reference:
        </p>
        <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
          <li><strong>⌘K</strong> or <strong>Ctrl+K</strong> - Open search anywhere</li>
          <li><strong>Type a name</strong> - Instant pull-up with relations</li>
          <li><strong>Customize button</strong> - Rearrange your widgets</li>
          <li><strong>Quick Actions</strong> - One-click record creation</li>
        </ul>
        <div style={{ 
          padding: '0.75rem', 
          background: 'rgb(var(--color-success) / 0.1)',
          borderRadius: '4px',
          margin: '1rem 0'
        }}>
          <strong>💼 Need help?</strong> Click the ? icon in the top right corner anytime.
        </div>
      </div>
    ),
    placement: 'center',
  },
];

export const CockpitTour: React.FC<CockpitTourProps> = ({
  enabled = true,
  isCockpitLoaded = true,
  availableSelectors = DEFAULT_AVAILABLE_SELECTORS,
  onComplete,
}) => {
  const {
    isReady,
    hasCompletedTour,
    getTourStatus,
    getLaunchNonce,
    launchTour,
    markTourCompleted,
    markTourSkipped,
    markTourStarted,
  } = useOnboarding();
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [resolvedSteps, setResolvedSteps] = useState<Step[]>(() =>
    typeof document === 'undefined'
      ? cockpitTourSteps
          .filter((step) => !step.requiredSelector)
          .map(({ requiredSelector, ...step }) => step)
      : resolveCockpitTourSteps(DEFAULT_AVAILABLE_SELECTORS, document),
  );
  const [pendingLaunch, setPendingLaunch] = useState<{ key: number; source: 'auto' | 'manual' } | null>(
    null,
  );
  const cockpitTourStatus = getTourStatus('cockpit');
  const cockpitLaunchNonce = getLaunchNonce('cockpit');
  const retryTimerRef = useRef<number | null>(null);
  const normalizedAvailableSelectors = useMemo(
    () => normalizeAvailableSelectors(availableSelectors),
    [availableSelectors],
  );
  const availableSelectorsSignature = useMemo(
    () => normalizedAvailableSelectors.join('|'),
    [normalizedAvailableSelectors],
  );

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearRetryTimer();
  }, [clearRetryTimer]);

  useEffect(() => {
    if (
      !enabled ||
      !isReady ||
      !isCockpitLoaded ||
      runTour ||
      pendingLaunch !== null ||
      hasCompletedTour('cockpit') ||
      cockpitTourStatus.status === 'skipped' ||
      cockpitTourStatus.status === 'in_progress'
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingLaunch({ key: Date.now(), source: 'auto' });
    }, AUTO_START_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    cockpitTourStatus.status,
    enabled,
    hasCompletedTour,
    isCockpitLoaded,
    isReady,
    pendingLaunch,
    runTour,
  ]);

  useEffect(() => {
    if (!enabled || !isCockpitLoaded || cockpitLaunchNonce === 0) {
      return;
    }

    setPendingLaunch({ key: cockpitLaunchNonce, source: 'manual' });
  }, [cockpitLaunchNonce, enabled, isCockpitLoaded]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined' || pendingLaunch !== null) {
      return;
    }

    setResolvedSteps(resolveCockpitTourSteps(normalizedAvailableSelectors, document));
  }, [availableSelectorsSignature, enabled, normalizedAvailableSelectors, pendingLaunch]);

  useEffect(() => {
    if (
      !enabled ||
      !isReady ||
      !isCockpitLoaded ||
      pendingLaunch === null ||
      typeof document === 'undefined'
    ) {
      return;
    }

    let isCancelled = false;
    const launchStartedAt = Date.now();

    const resolveLaunch = () => {
      const pendingSelectors = getPendingSelectors(normalizedAvailableSelectors, document);
      if (
        pendingSelectors.length > 0 &&
        Date.now() - launchStartedAt < TARGET_WAIT_TIMEOUT_MS
      ) {
        retryTimerRef.current = window.setTimeout(() => {
          resolveLaunch();
        }, TARGET_WAIT_INTERVAL_MS);
        return;
      }

      clearRetryTimer();
      if (isCancelled) {
        return;
      }

      const nextSteps = resolveCockpitTourSteps(normalizedAvailableSelectors, document);
      setResolvedSteps(nextSteps);
      setStepIndex(0);
      setPendingLaunch(null);

      if (nextSteps.length <= 1) {
        return;
      }

      if (pendingLaunch.source === 'auto') {
        void markTourStarted('cockpit', 'auto');
      }

      if (!isCancelled) {
        setRunTour(true);
      }
    };

    resolveLaunch();

    return () => {
      isCancelled = true;
      clearRetryTimer();
    };
  }, [
    availableSelectorsSignature,
    clearRetryTimer,
    enabled,
    isCockpitLoaded,
    isReady,
    markTourStarted,
    normalizedAvailableSelectors,
    pendingLaunch,
  ]);

  const waitForStepTarget = useCallback(
    (currentIndex: number) => {
      if (typeof document === 'undefined') {
        return;
      }

      clearRetryTimer();
      const currentStep = resolvedSteps[currentIndex];
      const targetSelector =
        currentStep && typeof currentStep.target === 'string' ? currentStep.target : null;

      if (!targetSelector || targetSelector === 'body') {
        const nextIndex = Math.min(resolvedSteps.length - 1, currentIndex + 1);
        if (nextIndex !== currentIndex) {
          setStepIndex(nextIndex);
          setRunTour(true);
        } else {
          setRunTour(false);
          setStepIndex(0);
          void markTourCompleted('cockpit');
          if (onComplete) {
            onComplete();
          }
        }
        return;
      }

      const waitStartedAt = Date.now();
      const resumeTour = () => {
        if (document.querySelector(targetSelector)) {
          setStepIndex(currentIndex);
          setRunTour(true);
          return;
        }

        if (Date.now() - waitStartedAt >= TARGET_WAIT_TIMEOUT_MS) {
          const nextIndex = Math.min(resolvedSteps.length - 1, currentIndex + 1);
          if (nextIndex !== currentIndex) {
            setStepIndex(nextIndex);
            setRunTour(true);
          } else {
            setRunTour(false);
            setStepIndex(0);
            void markTourCompleted('cockpit');
            if (onComplete) {
              onComplete();
            }
          }
          return;
        }

        retryTimerRef.current = window.setTimeout(resumeTour, TARGET_WAIT_INTERVAL_MS);
      };

      resumeTour();
    },
    [clearRetryTimer, markTourCompleted, onComplete, resolvedSteps],
  );

  const handleJoyrideCallback = useCallback((data: EventData) => {
    const { action, index, origin, status, type } = data;

    if (status === STATUS.FINISHED) {
      setRunTour(false);
      setStepIndex(0);
      void markTourCompleted('cockpit');

      if (onComplete) {
        onComplete();
      }
      return;
    }

    if (
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE ||
      action === ACTIONS.SKIP ||
      origin === ORIGIN.OVERLAY ||
      type === EVENTS.ERROR
    ) {
      setRunTour(false);
      setStepIndex(0);
      void markTourSkipped('cockpit');
      if (onComplete) {
        onComplete();
      }
      return;
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      setRunTour(false);
      waitForStepTarget(index);
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      const delta = action === ACTIONS.PREV ? -1 : 1;
      const maxIndex = Math.max(0, resolvedSteps.length - 1);
      const nextIndex = Math.min(maxIndex, Math.max(0, index + delta));
      setStepIndex(nextIndex);
    }
  }, [markTourCompleted, markTourSkipped, onComplete, resolvedSteps.length, waitForStepTarget]);

  /**
   * Manually restart the tour (can be called from help menu)
   */
  const restartTour = useCallback(() => {
    void launchTour('cockpit', 'restart');
  }, [launchTour]);

  // Expose restart function to parent
  useEffect(() => {
    (window as any).restartCockpitTour = restartTour;
    return () => {
      delete (window as any).restartCockpitTour;
    };
  }, [restartTour]);

  if (!enabled) return null;

  const options: Partial<Options> = {
    primaryColor: 'rgb(var(--color-primary))',
    textColor: 'rgb(var(--color-text-primary))',
    backgroundColor: 'rgb(var(--color-background))',
    arrowColor: 'rgb(var(--color-background))',
    overlayColor: 'rgba(var(--color-overlay), 0.5)',
    zIndex: 10000,
    showProgress: true,
    buttons: ['back', 'close', 'primary', 'skip'],
    closeButtonAction: 'skip',
  };

  const styles: PartialDeep<Styles> = {
    tooltip: {
      borderRadius: '8px',
      padding: '1.5rem',
      fontSize: '0.9375rem',
    },
    tooltipContent: {
      padding: '0.5rem 0',
    },
    buttonPrimary: {
      backgroundColor: 'rgb(var(--color-primary))',
      color: 'rgb(var(--color-surface))',
      borderRadius: '4px',
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      fontWeight: 500,
    },
    buttonBack: {
      color: 'rgb(var(--color-text-secondary))',
      marginRight: '0.5rem',
    },
    buttonSkip: {
      color: 'rgb(var(--color-text-secondary))',
    },
  };

  return (
      <Joyride
      steps={resolvedSteps}
      run={runTour}
      stepIndex={stepIndex}
      continuous
      options={options}
      styles={styles}
      onEvent={handleJoyrideCallback}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        open: 'Open',
        skip: 'Skip Tour',
      }}
    />
  );
};
