/**
 * FormBuilder components barrel export.
 * 
 * NOTE: Main FormBuilder.tsx removed - use components/form-builder instead.
 * This module kept for ConditionalVisibilityRules used by SchemaEditor.
 */
export { default as ConditionalVisibilityRules } from './ConditionalVisibilityRules';
export { default as useConditionalVisibility } from './useConditionalVisibility';
export { default as FieldConfigPanel } from './FieldConfigPanel';
export type {
  ConditionOperator,
  LogicalOperator,
  FormField,
  VisibilityCondition,
  VisibilityRule,
} from './ConditionalVisibilityRules';
export type {
  FormValues,
  UseConditionalVisibilityResult,
} from './useConditionalVisibility';
export type {
  FieldType,
  FieldOption,
  ValidationRule,
  FieldConfig,
  FieldConfigPanelProps,
} from './FieldConfigPanel';
