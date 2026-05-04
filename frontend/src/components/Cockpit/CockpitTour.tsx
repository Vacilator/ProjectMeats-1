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

import React, { useCallback, useEffect, useState } from 'react';
import {
  Joyride,
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
  
  /**
   * Callback when tour completes or is skipped
   */
  onComplete?: () => void;
}

const tourSteps: Step[] = [
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
    target: '[data-tour="search-input"]',
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
    target: '[data-tour="search-results"]',
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
    target: '[data-tour="quick-actions"]',
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
  onComplete 
}) => {
  const { isReady, hasCompletedTour, markTourCompleted, resetTourCompletion } = useOnboarding();
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    if (!enabled || !isReady || hasCompletedTour('cockpit')) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRunTour(true);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [enabled, hasCompletedTour, isReady]);

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;

    // Tour finished or skipped
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRunTour(false);
      void markTourCompleted('cockpit');

      if (onComplete) {
        onComplete();
      }
    }
  };

  /**
   * Manually restart the tour (can be called from help menu)
   */
  const restartTour = useCallback(() => {
    void resetTourCompletion('cockpit');
    setRunTour(true);
  }, [resetTourCompletion]);

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
    overlayColor: 'rgba(0, 0, 0, 0.5)',
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
      steps={tourSteps}
      run={runTour}
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
