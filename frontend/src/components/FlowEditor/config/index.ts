/**
 * Configuration Engine - Public API
 * 
 * Central export point for all configuration engine modules.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
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
export { formStepSingleSchema, allSchemas } from './nodeConfigSchemas';

// Re-export for convenience
export { type NodeConfigSchema as Schema } from './types';
