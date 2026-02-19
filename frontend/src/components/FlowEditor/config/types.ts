/**
 * Dynamic Configuration Engine - Type Definitions
 * 
 * Core type system for schema-based node configuration.
 * Enables declarative configuration instead of hardcoded React components.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
 */

import { ComponentType } from 'react';

// ============================================================================
// Field Types
// ============================================================================

/**
 * Supported field types for configuration panels
 */
export type FieldType =
  | 'text'              // Single-line text input
  | 'textarea'          // Multi-line text area
  | 'select'            // Dropdown selection (single)
  | 'multiselect'       // Dropdown selection (multiple)
  | 'toggle'            // Boolean toggle switch
  | 'number'            // Number input
  | 'date'              // Date picker
  | 'datetime'          // Date + time picker
  | 'color'             // Color picker
  | 'entity-selector'   // Entity type selector (Customer, Product, etc.)
  | 'field-mapping'     // Visual field mapper (drag-and-drop)
  | 'variable-picker'   // Variable picker from upstream nodes
  | 'validation-builder' // Validation rule builder
  | 'code-editor'       // Code editor (JSON, JavaScript)
  | 'file-upload'       // File upload
  | 'custom';           // Custom component

// ============================================================================
// Conditional Logic
// ============================================================================

/**
 * Comparison operators for conditional rules
 */
export type ConditionalOperator =
  | 'equals'       // Field value equals target value
  | 'notEquals'    // Field value does not equal target value
  | 'contains'     // Field value contains target value (arrays/strings)
  | 'notContains'  // Field value does not contain target value
  | 'greaterThan'  // Field value > target value (numbers/dates)
  | 'lessThan'     // Field value < target value (numbers/dates)
  | 'greaterThanOrEqual' // Field value >= target value
  | 'lessThanOrEqual'    // Field value <= target value
  | 'isEmpty'      // Field value is null/undefined/empty string
  | 'isNotEmpty';  // Field value is not null/undefined/empty string

/**
 * Logical operators for combining multiple conditions
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Conditional rule for showing/hiding fields
 * 
 * @example
 * // Show "recipients" field only when "notifyViaEmail" is true
 * {
 *   field: 'notifyViaEmail',
 *   operator: 'equals',
 *   value: true
 * }
 * 
 * @example
 * // Show "customMessage" when type is "custom" AND enabled is true
 * {
 *   logic: 'AND',
 *   conditions: [
 *     { field: 'type', operator: 'equals', value: 'custom' },
 *     { field: 'enabled', operator: 'equals', value: true }
 *   ]
 * }
 */
export interface ConditionalRule {
  /** Field ID to watch for changes */
  field?: string;
  
  /** Comparison operator */
  operator?: ConditionalOperator;
  
  /** Value to compare against */
  value?: any;
  
  /** Logical operator (for multiple conditions) */
  logic?: LogicalOperator;
  
  /** Nested conditions (for complex logic) */
  conditions?: ConditionalRule[];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Built-in validation rule types
 */
export type ValidationRuleType =
  | 'required'       // Field must have a value
  | 'minLength'      // Minimum string length
  | 'maxLength'      // Maximum string length
  | 'min'            // Minimum number value
  | 'max'            // Maximum number value
  | 'regex'          // Regular expression match
  | 'email'          // Valid email format
  | 'url'            // Valid URL format
  | 'custom';        // Custom validation function

/**
 * Validation rule definition
 * 
 * @example
 * { type: 'required', message: 'Name is required' }
 * 
 * @example
 * { type: 'minLength', value: 3, message: 'Name must be at least 3 characters' }
 * 
 * @example
 * {
 *   type: 'custom',
 *   message: 'Invalid format',
 *   validator: (value, allValues) => value.startsWith('prefix_')
 * }
 */
export interface ValidationRule {
  /** Validation rule type */
  type: ValidationRuleType;
  
  /** Error message to display when validation fails */
  message: string;
  
  /** Value for the rule (e.g., min=5, regex=/[A-Z]+/) */
  value?: any;
  
  /** Custom validation function */
  validator?: (value: any, allValues: Record<string, any>) => boolean;
}

// ============================================================================
// Select Options
// ============================================================================

/**
 * Option for select/multiselect fields
 */
export interface SelectOption {
  /** Option value (stored in form data) */
  value: string | number;
  
  /** Display label */
  label: string;
  
  /** Optional description */
  description?: string;
  
  /** Optional icon component */
  icon?: ComponentType;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Group label (for grouped options) */
  group?: string;
}

// ============================================================================
// Configuration Fields
// ============================================================================

/**
 * Configuration field definition
 * 
 * Defines a single input field in a configuration panel.
 */
export interface ConfigField {
  /** Unique field identifier (used as data key) */
  id: string;
  
  /** Field type (determines renderer component) */
  type: FieldType;
  
  /** Display label */
  label: string;
  
  /** Placeholder text (for text inputs) */
  placeholder?: string;
  
  /** Help text (shown in tooltip or below field) */
  helpText?: string;
  
  /** Default value (used when field is empty) */
  defaultValue?: any;
  
  /** Required field validation */
  required?: boolean;
  
  /** Options for select/multiselect fields */
  options?: SelectOption[];
  
  /** Validation rules */
  validation?: ValidationRule[];
  
  /** Conditional visibility rule */
  conditional?: ConditionalRule;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Custom component (for type='custom') */
  component?: ComponentType<any>;
  
  /** Additional props passed to field renderer */
  props?: Record<string, any>;
}

// ============================================================================
// Configuration Sections
// ============================================================================

/**
 * Configuration section (group of fields)
 * 
 * Sections provide visual organization and collapsible groups.
 */
export interface ConfigSection {
  /** Unique section identifier */
  id: string;
  
  /** Section title */
  title: string;
  
  /** Icon component (lucide-react icon) */
  icon?: ComponentType;
  
  /** Fields in this section */
  fields: ConfigField[];
  
  /** Can section be collapsed? */
  collapsible?: boolean;
  
  /** Expanded by default? */
  defaultExpanded?: boolean;
  
  /** Section description (optional) */
  description?: string;
  
  /** Conditional visibility (hide entire section) */
  conditional?: ConditionalRule;
}

// ============================================================================
// Configuration Presets
// ============================================================================

/**
 * Preset configuration values
 * 
 * Allows saving and loading common configurations.
 */
export interface ConfigPreset {
  /** Preset identifier */
  id: string;
  
  /** Preset name */
  name: string;
  
  /** Preset description */
  description: string;
  
  /** Field values (field ID → value) */
  values: Record<string, any>;
  
  /** Thumbnail icon */
  icon?: ComponentType;
  
  /** Is this a default preset? */
  isDefault?: boolean;
  
  /** Created by user (for sharing) */
  createdBy?: string;
  
  /** Creation timestamp */
  createdAt?: string;
}

// ============================================================================
// Node Configuration Schema
// ============================================================================

/**
 * Complete configuration schema for a node type
 * 
 * Defines all sections, fields, validation, and behavior for a node's config panel.
 * 
 * @example
 * const formStepSchema: NodeConfigSchema = {
 *   nodeType: 'formStepSingle',
 *   displayName: 'Form Step: Single',
 *   sections: [
 *     {
 *       id: 'basic',
 *       title: 'Basic Properties',
 *       fields: [
 *         { id: 'name', type: 'text', label: 'Step Name', required: true }
 *       ]
 *     }
 *   ]
 * };
 */
export interface NodeConfigSchema {
  /** Node type identifier (matches node.type) */
  nodeType: string;
  
  /** Human-readable name */
  displayName: string;
  
  /** Description of what this node does */
  description?: string;
  
  /** Icon for node type */
  icon?: ComponentType;
  
  /** Configuration sections */
  sections: ConfigSection[];
  
  /** Context-aware configuration (different fields based on context) */
  contextAware?: boolean;
  
  /** Available presets */
  presets?: ConfigPreset[];
  
  /** Schema version (for migrations) */
  version?: string;
  
  /** Tags for categorization */
  tags?: string[];
}

// ============================================================================
// Context Information
// ============================================================================

/**
 * Node context information
 * 
 * Provides context about where a node is placed (standalone vs inside container).
 * Used for context-aware configuration.
 */
export interface NodeContext {
  /** Is node inside a Form Process container? */
  insideFormProcess: boolean;
  
  /** Parent node ID (if inside container) */
  parentNodeId?: string;
  
  /** Sibling nodes (other steps in same container) */
  siblingNodes?: string[];
  
  /** Step index (if inside container) */
  stepIndex?: number;
  
  /** Total steps in container */
  totalSteps?: number;
}

// ============================================================================
// Field Renderer Props
// ============================================================================

/**
 * Common props passed to all field renderer components
 */
export interface FieldRendererProps<T = any> {
  /** Field definition */
  field: ConfigField;
  
  /** Current field value */
  value: T;
  
  /** Change handler */
  onChange: (value: T) => void;
  
  /** Validation error message (if any) */
  error?: string;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** All form values (for cross-field logic) */
  allValues?: Record<string, any>;
  
  /** Node context */
  context?: NodeContext;
}

// ============================================================================
// Schema Validation Result
// ============================================================================

/**
 * Result of schema validation
 */
export interface SchemaValidationResult {
  /** Is schema valid? */
  valid: boolean;
  
  /** Error messages (if invalid) */
  errors: string[];
  
  /** Warning messages (non-fatal) */
  warnings?: string[];
}

// ============================================================================
// Exports
// ============================================================================

export type {
  // Re-export for convenience
  ComponentType
};
export interface FieldRenderProps extends FieldRendererProps {
  data?: Record<string, any>;
  onFieldChange?: (fieldId: string, value: any) => void;
}
