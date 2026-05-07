/**
 * Onboarding Tour Hook
 * 
 * Provides guided tours for first-time users using react-joyride.
 * Implements industry-standard onboarding (like Typeform, Shopify).
 * 
 * Features:
 * - Step-by-step workflow creation guide
 * - Persistent tour state via the shared onboarding preferences contract
 * - Skip/restart functionality
 * - Contextual hints
 * 
 * Created: 2026-02-26 - Gap Analysis Phase 1.1
 */
import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  ACTIONS,
  EVENTS,
  ORIGIN,
  STATUS,
  type EventData,
  type Options,
  type PartialDeep,
  type Step,
  type Styles,
} from 'react-joyride';
import { useOnboarding } from '../../Onboarding';

export interface TourConfig {
  name: string;
  steps: Step[];
  autoStart?: boolean;
}

/**
 * Custom hook for managing onboarding tours
 */
export const useOnboardingTour = (tourConfig: TourConfig) => {
  const {
    isReady,
    getLaunchNonce,
    getTourStatus,
    hasCompletedTour,
    markTourCompleted,
    markTourSkipped,
    markTourStarted,
    resetTourCompletion,
  } = useOnboarding();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const launchNonce = getLaunchNonce(tourConfig.name);
  const tourStatus = getTourStatus(tourConfig.name);

  // Check if user has completed this tour
  useEffect(() => {
    if (
      !tourConfig.autoStart ||
      !isReady ||
      hasCompletedTour(tourConfig.name) ||
      tourStatus.status === 'skipped'
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void markTourStarted(tourConfig.name, 'auto');
      setRun(true);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    hasCompletedTour,
    isReady,
    markTourStarted,
    tourConfig.autoStart,
    tourConfig.name,
    tourStatus.status,
  ]);

  useEffect(() => {
    if (launchNonce === 0) {
      return;
    }

    setStepIndex(0);
    setRun(true);
  }, [launchNonce]);

  const handleJoyrideCallback = useCallback(
    (data: EventData) => {
      const { status, index, type, action, origin } = data;

      const completeTour = (markCompleted: boolean) => {
        if (markCompleted) {
          void markTourCompleted(tourConfig.name);
        }

        setRun(false);
        setStepIndex(0);
      };

      // Finished or explicitly skipped.
      if (status === STATUS.FINISHED) {
        completeTour(true);
        return;
      }

      // Emergency escape hatch: clicking the overlay, close button, or ESC should never lock the UI.
      if (
        status === STATUS.SKIPPED ||
        action === ACTIONS.CLOSE ||
        action === ACTIONS.SKIP ||
        origin === ORIGIN.OVERLAY ||
        type === EVENTS.ERROR
      ) {
        void markTourSkipped(tourConfig.name);
        completeTour(false);
        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        // If a step target isn't in the DOM (or isn't visible), Joyride emits TARGET_NOT_FOUND.
        // Advance so the tour never gets stuck behind the overlay.
        const delta = action === ACTIONS.PREV ? -1 : 1;
        const maxIndex = Math.max(0, tourConfig.steps.length - 1);
        const nextIndex = Math.min(maxIndex, Math.max(0, index + delta));
        setStepIndex(nextIndex);
      }
    },
    [markTourCompleted, markTourSkipped, tourConfig.name, tourConfig.steps.length]
  );

  const startTour = useCallback(() => {
    void markTourStarted(tourConfig.name, 'resume');
    setStepIndex(0);
    setRun(true);
  }, [markTourStarted, tourConfig.name]);

  const resetTour = useCallback(() => {
    void resetTourCompletion(tourConfig.name);
    setStepIndex(0);
    setRun(true);
  }, [resetTourCompletion, tourConfig.name]);

  return {
    run,
    stepIndex,
    steps: tourConfig.steps,
    handleJoyrideCallback,
    startTour,
    resetTour,
  };
};

// ============================================================================
// Styled Components (tour step content)
// ============================================================================

const TourStepTitle = styled.h3`
  margin: 0 0 8px 0;
`;

const TourStepText = styled.p`
  margin: 0;
`;

const TourStepTextSpaced = styled.p`
  margin: 0 0 8px 0;
`;

const TourStepList = styled.ol`
  margin: 0;
  padding-left: 20px;
`;

const TourStepHint = styled.p`
  margin: 8px 0 0 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

/**
 * Tour steps for Workflow Editor
 */
export const workflowEditorTourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div>
        <TourStepTitle>👋 Welcome to Workforms!</TourStepTitle>
        <TourStepText>
          Let's take a quick tour to help you create your first workflow.
          This will only take 60 seconds.
        </TourStepText>
      </div>
    ),
    placement: 'center',
  },
  {
    target: '.node-palette',
    content: (
      <div>
        <TourStepTitle>🎨 Node Palette</TourStepTitle>
        <TourStepText>
          Drag nodes from here onto the canvas to build your workflow.
          Each node type performs a different action.
        </TourStepText>
      </div>
    ),
    placement: 'right',
  },
  {
    target: '.react-flow__pane',
    content: (
      <div>
        <TourStepTitle>🖌️ Canvas</TourStepTitle>
        <TourStepText>
          Drop nodes here and connect them to create workflows.
          Drag to pan, scroll to zoom, or use the toolbar controls.
        </TourStepText>
      </div>
    ),
    placement: 'top',
  },
  {
    target: '[data-tour="toolbar"]',
    content: (
      <div>
        <TourStepTitle>🛠️ Toolbar</TourStepTitle>
        <TourStepText>
          Quick access to common actions: undo/redo, zoom, alignment,
          and save. Use keyboard shortcuts for faster editing!
        </TourStepText>
      </div>
    ),
    placement: 'bottom',
  },
  {
    // Step 5 ("Configuration Panel") used to target the config portal, which is hidden until a node is selected.
    // Targeting a hidden element can trap users behind the overlay if bounding boxes can't be computed.
    target: '.react-flow__pane',
    content: (
      <div>
        <TourStepTitle>⚙️ Configuration Panel</TourStepTitle>
        <TourStepText>
          Click any node on the canvas to open the Configuration Panel and edit its properties.
          Changes are saved automatically as you type.
        </TourStepText>
      </div>
    ),
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: 'body',
    content: (
      <div>
        <TourStepTitle>🚀 You're Ready!</TourStepTitle>
        <TourStepTextSpaced>
          That's it! Now try creating your first workflow:
        </TourStepTextSpaced>
        <TourStepList>
          <li>Drag a <strong>Form</strong> node to the canvas</li>
          <li>Click it to configure the form fields</li>
          <li>Add more nodes and connect them</li>
          <li>Click <strong>Save</strong> when done</li>
        </TourStepList>
        <TourStepHint>
          💡 Press <code>Shift+?</code> anytime to see all keyboard shortcuts
        </TourStepHint>
      </div>
    ),
    placement: 'center',
  },
];

/**
 * Tour steps for Catalog view
 */
export const catalogTourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div>
        <TourStepTitle>📚 Welcome to the Catalog!</TourStepTitle>
        <TourStepText>
          This is where you manage all your workflows and forms.
          Let's explore what you can do here.
        </TourStepText>
      </div>
    ),
    placement: 'center',
  },
  {
    target: '[data-tour="create-button"]',
    content: (
      <div>
        <TourStepTitle>✨ Create New</TourStepTitle>
        <TourStepText>
          Click here to create a new workflow or form from scratch,
          or choose from pre-built templates.
        </TourStepText>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-bar"]',
    content: (
      <div>
        <TourStepTitle>🔍 Search & Filter</TourStepTitle>
        <TourStepText>
          Quickly find workflows by name, status, or category.
          Use filters to narrow down results.
        </TourStepText>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="workflow-card"]',
    content: (
      <div>
        <TourStepTitle>📄 Workflow Cards</TourStepTitle>
        <TourStepText>
          Each card shows a workflow summary. Click to edit,
          or use the menu for more actions (duplicate, export, delete).
        </TourStepText>
      </div>
    ),
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: 'body',
    content: (
      <div>
        <TourStepTitle>🎉 You're All Set!</TourStepTitle>
        <TourStepText>
          Now you know how to manage your workflows. Ready to build something amazing?
        </TourStepText>
      </div>
    ),
    placement: 'center',
  },
];

/**
 * Custom styles for tour tooltips
 */
export const tourOptions: Partial<Options> = {
  primaryColor: 'rgb(var(--color-primary))',
  textColor: 'rgb(var(--color-text-primary))',
  backgroundColor: 'rgb(var(--color-background))',
  arrowColor: 'rgb(var(--color-background))',
  overlayColor: 'rgba(var(--color-overlay), 0.5)',
  // Keep the tour UI above fullscreen Workforms editor surfaces + portals.
  zIndex: 20000,
  showProgress: true,
  buttons: ['back', 'close', 'primary', 'skip'],
  // Escape hatch: allow backdrop click + ESC to always dismiss.
  overlayClickAction: 'close',
  dismissKeyAction: 'close',
  closeButtonAction: 'skip',
};

export const tourStyles: PartialDeep<Styles> = {
  tooltip: {
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(var(--color-overlay), 0.15)',
  },
  buttonClose: {
    zIndex: 20001,
  },
  tooltipTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  tooltipContent: {
    padding: '8px 0',
  },
  buttonPrimary: {
    backgroundColor: 'rgb(var(--color-primary))',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    padding: '8px 16px',
    color: 'rgb(var(--color-surface))',
  },
  buttonBack: {
    color: 'rgb(var(--color-primary))',
    marginRight: '8px',
  },
  buttonSkip: {
    color: 'rgb(var(--color-text-secondary))',
    zIndex: 20001,
  },
};
