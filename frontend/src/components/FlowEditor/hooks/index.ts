/**
 * Shared Hooks Index
 * 
 * Phase E.1: Foundation - Step 2/4 (Shared Hooks)
 * 
 * Exports all shared hooks for FlowEditor components.
 * 
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */

// Modal state management
export { useModalState } from './useModalState';
export type { UseModalStateOptions, UseModalStateReturn } from './useModalState';

// Panel state management
export { usePanelState } from './usePanelState';
export type { UsePanelStateOptions, UsePanelStateReturn } from './usePanelState';

// Field validation
export { useFieldValidation } from './useFieldValidation';
export type { 
  ValidationRule, 
  ValidationRules, 
  ValidationErrors,
  UseFieldValidationOptions, 
  UseFieldValidationReturn 
} from './useFieldValidation';

// Node configuration
export { useNodeConfig } from './useNodeConfig';
export type { UseNodeConfigOptions, UseNodeConfigReturn } from './useNodeConfig';

// Upstream variables (already exists)
export { useUpstreamVariables } from './useUpstreamVariables';
export type { UpstreamVariable, FieldType } from './useUpstreamVariables';

// Node shadow state (already exists)
export { useNodeShadowState } from './useNodeShadowState';
