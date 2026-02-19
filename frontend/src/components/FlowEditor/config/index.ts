/**
 * Configuration Engine - Public API
 * 
 * Central export point for all configuration engine modules.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
 * Updated: 2026-02-18 - Phase D.2 - Dynamic Panel
 */

// Type definitions
export type {
  FieldType,
  ConditionalOperator,
  LogicalOperator,
  ConditionalRule,
  ValidationRuleType,
  ValidationRule,
  SelectOption,
  ConfigField,
  ConfigSection,
  ConfigPreset,
  NodeConfigSchema,
  NodeContext,
  FieldRendererProps,
  SchemaValidationResult,
  ComponentType
} from './types';

// Schema registry
export { schemaRegistry } from './schemaRegistry';

// Node schemas
export { formSchema, formStepSingleSchema, allSchemas } from './nodeConfigSchemas';  // Phase E: Added formSchema

// Conditional logic (Phase D.2)
export { evaluateCondition, getConditionalDependencies } from './conditionalLogic';

// Validation engine (Phase D.2)
export { validateField, validateAllFields, isFormValid } from './validationEngine';

// Field renderers (Phase D.2)
export { 
  renderTextField,
  renderSelectField,
  renderToggleField
} from './fieldRenderers/basicRenderers';

// Re-export for convenience
export { type NodeConfigSchema as Schema } from './types';
