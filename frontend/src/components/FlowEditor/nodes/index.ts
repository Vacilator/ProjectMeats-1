/**
 * Node Components Index
 * 
 * Exports all node components for the Unified Flow Editor.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 2.1 Batch 2 (Added Wait, Document, Utility, Terminal nodes)
 * Updated: 2026-02-05 - Phase 3 Task 3.2 (Added FormReference node)
 * Updated: 2026-02-06 - Phase 4 Batch 2 (Added FormMultiStepContainer node)
 */

export { BaseNode } from './BaseNode';
export type { BaseNodeData, BaseNodeProps } from './BaseNode';

export { FormStepSingleNode } from './FormStepSingleNode';
export type { FormStepNodeData, FormField } from './FormStepSingleNode';

export { FormReferenceNode } from './FormReferenceNode';
export type { FormReferenceNodeData } from './FormReferenceNode';

export { FormProcessNode } from './FormProcessNode';
export type { ContainerNodeData } from './FormProcessNode';

// Phase E.3: Labeled group node with parent-child support
export { FormProcessGroupNode } from './FormProcessGroupNode';
export type { FormProcessGroupData, FormProcessGroupNodeProps } from './FormProcessGroupNode';

export { FormProcessChildWrapper, withChildWrapper, autoLayoutChildren, calculateChildYPosition } from './FormProcessChildWrapper';
export type { FormProcessChildData, FormProcessChildWrapperProps } from './FormProcessChildWrapper';

export { TriggerNode } from './TriggerNode';
export type { TriggerNodeData } from './TriggerNode';

export { ConditionIfNode } from './ConditionIfNode';
export type { ConditionIfNodeData, ConditionRule } from './ConditionIfNode';

export { ActionNode } from './ActionNode';
export type { ActionNodeData } from './ActionNode';

export { WaitStateNode } from './WaitStateNode';
export { DocumentNode } from './DocumentNode';
export { UtilityNode } from './UtilityNode';
export { TerminalNode } from './TerminalNode';
