/**
 * Flow Editor Index
 * 
 * Unified visual editor for forms and workflows.
 *
 * Deterministic init:
 * - Import nodeConfigSchemas here so schemaRegistry is populated before first interaction.
 *   This prevents "first click" config panel races where fallback schemas are used and never re-render.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */

import './config/nodeConfigSchemas';

export { UnifiedFlowEditor } from './UnifiedFlowEditor';
export type { NODE_TYPE_REGISTRY, NodeTypeDefinition, NodeCategory } from './nodeTypes';
export * from './nodes';
