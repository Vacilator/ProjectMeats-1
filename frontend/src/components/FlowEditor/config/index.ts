/**
 * Configuration Engine - Public API
 * 
 * Central export point for all configuration engine modules.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
 * Updated: 2026-02-18 - Phase D.2 - Dynamic Panel
 * Updated: 2026-02-19 - Phase D/E - Schema initialization fix
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

// Node schemas + initialization (IMPORTANT: This import has side effects)
export { 
  formStepSingleSchema, 
  formProcessSchema,
  createRecordSchema,
  outlookEmailSchema,
  allSchemas,
  initializeSchemas // Explicit export for manual initialization if needed
} from './nodeConfigSchemas';

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

// Complex field renderers (Phase D.3)
export {
  renderEntitySelector,
  renderFieldMapping,
  renderVariablePicker,
  renderValidationBuilder,
} from './fieldRenderers/complexRenderers';

// Re-export for convenience
export { type NodeConfigSchema as Schema } from './types';
