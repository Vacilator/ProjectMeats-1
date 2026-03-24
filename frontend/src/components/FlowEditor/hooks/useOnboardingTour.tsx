/**
 * Onboarding Tour Hook
 * 
 * Provides guided tours for first-time users using react-joyride.
 * Implements industry-standard onboarding (like Typeform, Shopify).
 * 
 * Features:
 * - Step-by-step workflow creation guide
 * - Persistent tour state (localStorage)
 * - Skip/restart functionality
 * - Contextual hints
 * 
 * Created: 2026-02-26 - Gap Analysis Phase 1.1
 */
import { useState, useEffect, useCallback } from 'react';
import {
  EVENTS,
  STATUS,
  type EventData,
  type Options,
  type PartialDeep,
  type Step,
  type Styles,
} from 'react-joyride';

export interface TourConfig {
  name: string;
  steps: Step[];
  autoStart?: boolean;
}

const TOUR_STORAGE_KEY = 'projectmeats_tours_completed';

/**
 * Custom hook for managing onboarding tours
 */
export const useOnboardingTour = (tourConfig: TourConfig) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Check if user has completed this tour
  useEffect(() => {
    const completedTours = JSON.parse(
      localStorage.getItem(TOUR_STORAGE_KEY) || '[]'
    );

    if (!completedTours.includes(tourConfig.name) && tourConfig.autoStart) {
      // Delay start to ensure DOM elements are rendered
      setTimeout(() => setRun(true), 1000);
    }
  }, [tourConfig.name, tourConfig.autoStart]);

  const handleJoyrideCallback = useCallback(
    (data: EventData) => {
      const { status, index, type, action } = data;

      if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        // Mark tour as completed
        const completedTours = JSON.parse(
          localStorage.getItem(TOUR_STORAGE_KEY) || '[]'
        );

        if (!completedTours.includes(tourConfig.name)) {
          completedTours.push(tourConfig.name);
          localStorage.setItem(
            TOUR_STORAGE_KEY,
            JSON.stringify(completedTours)
          );
        }

        setRun(false);
        setStepIndex(0);
      } else if (type === EVENTS.STEP_AFTER) {
        setStepIndex(index + (action === 'prev' ? -1 : 1));
      }
    },
    [tourConfig.name]
  );

  const startTour = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  const resetTour = useCallback(() => {
    const completedTours = JSON.parse(
      localStorage.getItem(TOUR_STORAGE_KEY) || '[]'
    );

    const updatedTours = completedTours.filter(
      (name: string) => name !== tourConfig.name
    );

    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updatedTours));
    setStepIndex(0);
    setRun(true);
  }, [tourConfig.name]);

  return {
    run,
    stepIndex,
    steps: tourConfig.steps,
    handleJoyrideCallback,
    startTour,
    resetTour,
  };
};

/**
 * Tour steps for Workflow Editor
 */
export const workflowEditorTourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>👋 Welcome to Workforms!</h3>
        <p style={{ margin: 0 }}>
          Let's take a quick tour to help you create your first workflow.
          This will only take 60 seconds.
        </p>
      </div>
    ),
    placement: 'center',
  },
  {
    target: '.node-palette',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>🎨 Node Palette</h3>
        <p style={{ margin: 0 }}>
          Drag nodes from here onto the canvas to build your workflow.
          Each node type performs a different action.
        </p>
      </div>
    ),
    placement: 'right',
  },
  {
    target: '.react-flow__pane',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>🖌️ Canvas</h3>
        <p style={{ margin: 0 }}>
          Drop nodes here and connect them to create workflows.
          Drag to pan, scroll to zoom, or use the toolbar controls.
        </p>
      </div>
    ),
    placement: 'top',
  },
  {
    target: '[data-tour="toolbar"]',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>🛠️ Toolbar</h3>
        <p style={{ margin: 0 }}>
          Quick access to common actions: undo/redo, zoom, alignment,
          and save. Use keyboard shortcuts for faster editing!
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '.node-config-panel',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>⚙️ Configuration Panel</h3>
        <p style={{ margin: 0 }}>
          When you click a node, configure its properties here.
          Changes are saved automatically as you type.
        </p>
      </div>
    ),
    placement: 'left',
    skipBeacon: true,
  },
  {
    target: 'body',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>🚀 You're Ready!</h3>
        <p style={{ margin: '0 0 8px 0' }}>
          That's it! Now try creating your first workflow:
        </p>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Drag a <strong>Form</strong> node to the canvas</li>
          <li>Click it to configure the form fields</li>
          <li>Add more nodes and connect them</li>
          <li>Click <strong>Save</strong> when done</li>
        </ol>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
          💡 Press <code>Shift+?</code> anytime to see all keyboard shortcuts
        </p>
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
        <h3 style={{ margin: '0 0 8px 0' }}>📚 Welcome to the Catalog!</h3>
        <p style={{ margin: 0 }}>
          This is where you manage all your workflows and forms.
          Let's explore what you can do here.
        </p>
      </div>
    ),
    placement: 'center',
  },
  {
    target: '[data-tour="create-button"]',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>✨ Create New</h3>
        <p style={{ margin: 0 }}>
          Click here to create a new workflow or form from scratch,
          or choose from pre-built templates.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-bar"]',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>🔍 Search & Filter</h3>
        <p style={{ margin: 0 }}>
          Quickly find workflows by name, status, or category.
          Use filters to narrow down results.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="workflow-card"]',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>📄 Workflow Cards</h3>
        <p style={{ margin: 0 }}>
          Each card shows a workflow summary. Click to edit,
          or use the menu for more actions (duplicate, export, delete).
        </p>
      </div>
    ),
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: 'body',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px 0' }}>🎉 You're All Set!</h3>
        <p style={{ margin: 0 }}>
          Now you know how to manage your workflows. Ready to build something amazing?
        </p>
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
  overlayColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 10000,
  showProgress: true,
  buttons: ['back', 'close', 'primary', 'skip'],
};

export const tourStyles: PartialDeep<Styles> = {
  tooltip: {
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
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
    color: '#fff',
  },
  buttonBack: {
    color: 'rgb(var(--color-primary))',
    marginRight: '8px',
  },
  buttonSkip: {
    color: 'rgb(var(--color-text-secondary))',
  },
};
