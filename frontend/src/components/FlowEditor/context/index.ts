/**
 * Context Index
 * 
 * Phase E.1: Foundation - Step 3/4 (Centralized State Management)
 * 
 * Barrel export for FlowEditor context.
 * 
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */

export { 
  FlowEditorProvider, 
  useFlowEditor,
  useFlowEditorNodeActions,
  default as FlowEditorContext 
} from './FlowEditorContext';

export type {
  EditorMode,
  ModalType,
  ModalState,
  UISettings,
  FlowEditorContextValue,
  FlowEditorNodeActionsValue,
  FlowEditorProviderProps,
} from './FlowEditorContext';
