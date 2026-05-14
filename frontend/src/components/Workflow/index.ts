/**
 * Workflow components — Golden standard for entity status/action display.
 *
 * Use these components across ALL workflow entity pages for consistent
 * status rendering, cascading actions, and party/contact display.
 */
export { StatusActionCell } from './StatusActionCell';
export type { StatusActionCellProps } from './StatusActionCell';

export { WorkflowStatusBar } from './WorkflowStatusBar';
export type { WorkflowStatusBarProps } from './WorkflowStatusBar';

export {
  getWorkflowConfig,
  getTransitionLabel,
  getPrimaryTransition,
} from './workflowConfig';
export type { EntityWorkflowConfig, TransitionMeta } from './workflowConfig';
