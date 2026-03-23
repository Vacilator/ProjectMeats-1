/**
 * Node Components Index
 * 
 * Exports all node components for the Unified Flow Editor.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 * Updated: 2026-02-04 - Phase 2.1 Batch 2 (Added Wait, Document, Utility, Terminal nodes)
 * Updated: 2026-02-05 - Phase 3 Task 3.2 (Added FormReference node)
 * Updated: 2026-02-06 - Phase 4 Batch 2 (Added FormMultiStepContainer node)
 * Updated: 2026-02-19 - Phase E: Added FormNode (renamed from FormStepSingle)
 */

export { BaseNode } from './BaseNode';
export type { BaseNodeData, BaseNodeProps } from './BaseNode';

// Form nodes
// - FormNode: container (Book) using React Flow sub-flows
// - FormStepNode: child step (Page) inside the container
export { FormNode } from './FormNode';
export { FormStepNode } from './FormStepNode';
export type { FormStepNodeData } from './FormStepNode';

// Backward compatibility (legacy step node)
export { FormStepSingleNode } from './FormStepSingleNode';
export type { FormStepNodeData as LegacyFormStepNodeData, FormField } from './FormStepSingleNode';

export { FormReferenceNode } from './FormReferenceNode';
export type { FormReferenceNodeData } from './FormReferenceNode';

export { FormProcessNode } from './FormProcessNode';
export type { ContainerNodeData } from './FormProcessNode';

export { FormProcessContainerNode } from './FormProcessContainerNode';

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

export { FormProcessGroupNode } from './FormProcessGroupNode';
export type { FormProcessGroupData } from './FormProcessGroupNode';

export { FormProcessChildWrapper } from './FormProcessChildWrapper';
export type { ChildWrapperProps } from './FormProcessChildWrapper';

// Smart WorkForm (single-node wizard)
export { SmartWorkFormNode } from './SmartWorkFormNode';
export type { SmartWorkFormNodeData, SmartWorkFormStep, SmartWorkFormField } from './SmartWorkFormNode';

// Phase 7.4 Advanced Node Types (2026-02-27)
export { ParallelPathNode } from './ParallelPathNode';
export type { ParallelPathNodeData } from './ParallelPathNode';

export { SubWorkflowNode } from './SubWorkflowNode';
export type { SubWorkflowNodeData } from './SubWorkflowNode';
