/**
 * Legacy FormProcessGroupNode
 *
 * Kept for backward compatibility.
 * Restored to the purple multi-step container renderer (FormProcessNode).
 */

import { FormProcessNode, type ContainerNodeData } from './FormProcessNode';

export type FormProcessGroupData = ContainerNodeData;

// Deprecated alias
export const FormProcessGroupNode = FormProcessNode;

export default FormProcessNode;
