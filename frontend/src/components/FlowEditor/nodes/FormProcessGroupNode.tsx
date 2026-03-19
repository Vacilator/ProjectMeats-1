/**
 * Legacy FormProcessGroupNode
 *
 * Kept for backward compatibility. The canonical Form container is `FormNode`.
 */

import { FormNode, type FormNodeData } from './FormNode';

export type FormProcessGroupData = FormNodeData;

// Deprecated alias
export const FormProcessGroupNode = FormNode;

export default FormNode;
