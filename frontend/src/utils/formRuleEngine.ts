/**
 * Form Rule Engine
 * 
 * Evaluates conditional rules for dynamic form behavior.
 * Rules control visibility of fields and steps based on field values.
 */

import { logger } from './logger';

// Types for rule conditions and actions
export interface RuleCondition {
  step_id?: string;        // ID of the step containing the field
  field: string;           // Field key (may include step prefix: "step_id.field_key")
  operator: OperatorType;
  value?: string | number | boolean | string[];
}

export interface RuleAction {
  action: ActionType;
  params: {
    fields?: string[];      // Field keys (may include step prefix)
    steps?: string[];       // Step IDs
    step_id?: string;       // Single step ID
    field?: string;         // Single field key
    value?: unknown;        // Value for set_value action
    options?: string[];     // Options for filter_options action
  };
}

export interface ConditionalRule {
  id: string;
  name: string;
  order: number;
  conditions: RuleCondition[];
  condition_logic: 'and' | 'or';
  actions: RuleAction[];
}

export type OperatorType = 
  | 'eq' | 'neq' 
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'contains' | 'not_contains'
  | 'is_empty' | 'is_not_empty';

export type ActionType = 
  | 'display_fields' | 'hide_fields'
  | 'display_steps' | 'hide_steps'
  | 'filter_options' | 'set_value'
  | 'display_entities';

// Form data structure
export interface FormData {
  [stepId: string]: {
    [fieldKey: string]: unknown;
  };
}

// Visibility state
export interface VisibilityState {
  hiddenFields: Set<string>;   // Set of "stepId.fieldKey" strings
  hiddenSteps: Set<string>;    // Set of step IDs
  filteredOptions: Map<string, string[]>;  // Map of "stepId.fieldKey" to allowed options
  setValues: Map<string, unknown>;  // Map of "stepId.fieldKey" to values to set
}

/**
 * Get field value from form data using a field reference.
 * Field reference can be:
 * - "field_key" (searches all steps)
 * - "step_id.field_key" (specific step)
 */
function getFieldValue(
  fieldRef: string, 
  formData: FormData, 
  currentStepId?: string
): unknown {
  // Check if field ref includes step ID
  if (fieldRef.includes('.')) {
    const [stepId, fieldKey] = fieldRef.split('.', 2);
    return formData[stepId]?.[fieldKey];
  }
  
  // If current step is provided, check there first
  if (currentStepId && formData[currentStepId]?.[fieldRef] !== undefined) {
    return formData[currentStepId][fieldRef];
  }
  
  // Search all steps for the field
  for (const stepId of Object.keys(formData)) {
    if (formData[stepId]?.[fieldRef] !== undefined) {
      return formData[stepId][fieldRef];
    }
  }
  
  return undefined;
}

/**
 * Evaluate a single condition against form data.
 */
function evaluateCondition(
  condition: RuleCondition, 
  formData: FormData
): boolean {
  const fieldRef = condition.step_id 
    ? `${condition.step_id}.${condition.field}` 
    : condition.field;
  
  const fieldValue = getFieldValue(fieldRef, formData);
  const conditionValue = condition.value;
  
  switch (condition.operator) {
    case 'eq':
      return isEqual(fieldValue, conditionValue);
    
    case 'neq':
      return !isEqual(fieldValue, conditionValue);
    
    case 'gt':
      return compareNumbers(fieldValue, conditionValue, (a, b) => a > b);
    
    case 'lt':
      return compareNumbers(fieldValue, conditionValue, (a, b) => a < b);
    
    case 'gte':
      return compareNumbers(fieldValue, conditionValue, (a, b) => a >= b);
    
    case 'lte':
      return compareNumbers(fieldValue, conditionValue, (a, b) => a <= b);
    
    case 'contains':
      return toString(fieldValue).toLowerCase().includes(
        toString(conditionValue).toLowerCase()
      );
    
    case 'not_contains':
      return !toString(fieldValue).toLowerCase().includes(
        toString(conditionValue).toLowerCase()
      );
    
    case 'is_empty':
      return isEmpty(fieldValue);
    
    case 'is_not_empty':
      return !isEmpty(fieldValue);
    
    default:
      logger.warn(`Unknown operator: ${condition.operator}`, { component: 'formRuleEngine' });
      return false;
  }
}

/**
 * Evaluate all conditions for a rule using the specified logic.
 */
function evaluateRuleConditions(
  rule: ConditionalRule, 
  formData: FormData
): boolean {
  if (!rule.conditions || rule.conditions.length === 0) {
    return true; // No conditions = always true
  }
  
  const results = rule.conditions.map(c => evaluateCondition(c, formData));
  
  if (rule.condition_logic === 'or') {
    return results.some(r => r);
  }
  
  // Default to AND logic
  return results.every(r => r);
}

/**
 * Apply actions from a rule to the visibility state.
 */
function applyRuleActions(
  rule: ConditionalRule, 
  visibilityState: VisibilityState,
  ruleMatched: boolean
): void {
  for (const action of rule.actions) {
    switch (action.action) {
      case 'display_fields':
        // Display fields = remove from hidden set when rule matches
        if (ruleMatched && action.params.fields) {
          for (const fieldRef of action.params.fields) {
            visibilityState.hiddenFields.delete(fieldRef);
          }
        }
        break;
      
      case 'hide_fields':
        // Hide fields when rule matches
        if (ruleMatched && action.params.fields) {
          for (const fieldRef of action.params.fields) {
            visibilityState.hiddenFields.add(fieldRef);
          }
        }
        break;
      
      case 'display_steps':
      case 'display_entities':
        // Display steps = remove from hidden set when rule matches
        if (ruleMatched && action.params.steps) {
          for (const stepId of action.params.steps) {
            visibilityState.hiddenSteps.delete(stepId);
          }
        }
        if (ruleMatched && action.params.step_id) {
          visibilityState.hiddenSteps.delete(action.params.step_id);
        }
        break;
      
      case 'hide_steps':
        // Hide steps when rule matches
        if (ruleMatched && action.params.steps) {
          for (const stepId of action.params.steps) {
            visibilityState.hiddenSteps.add(stepId);
          }
        }
        if (ruleMatched && action.params.step_id) {
          visibilityState.hiddenSteps.add(action.params.step_id);
        }
        break;
      
      case 'filter_options':
        // Filter dropdown options when rule matches
        if (ruleMatched && action.params.field && action.params.options) {
          visibilityState.filteredOptions.set(
            action.params.field, 
            action.params.options
          );
        }
        break;
      
      case 'set_value':
        // Set field value when rule matches
        if (ruleMatched && action.params.field !== undefined) {
          visibilityState.setValues.set(
            action.params.field,
            action.params.value
          );
        }
        break;
    }
  }
}

/**
 * Evaluate all rules and compute visibility state.
 * Rules are evaluated in order, later rules can override earlier ones.
 */
export function evaluateRules(
  rules: ConditionalRule[],
  formData: FormData
): VisibilityState {
  const visibilityState: VisibilityState = {
    hiddenFields: new Set(),
    hiddenSteps: new Set(),
    filteredOptions: new Map(),
    setValues: new Map(),
  };
  
  // Sort rules by order
  const sortedRules = [...rules].sort((a, b) => a.order - b.order);
  
  for (const rule of sortedRules) {
    const ruleMatched = evaluateRuleConditions(rule, formData);
    applyRuleActions(rule, visibilityState, ruleMatched);
  }
  
  return visibilityState;
}

/**
 * Check if a specific field should be visible.
 */
export function isFieldVisible(
  stepId: string,
  fieldKey: string,
  visibilityState: VisibilityState
): boolean {
  const fullRef = `${stepId}.${fieldKey}`;
  return !visibilityState.hiddenFields.has(fullRef) && 
         !visibilityState.hiddenFields.has(fieldKey);
}

/**
 * Check if a specific step should be visible.
 */
export function isStepVisible(
  stepId: string,
  visibilityState: VisibilityState
): boolean {
  return !visibilityState.hiddenSteps.has(stepId);
}

/**
 * Get filtered options for a field (if any filter is applied).
 */
export function getFilteredOptions(
  stepId: string,
  fieldKey: string,
  originalOptions: { value: string; label: string }[],
  visibilityState: VisibilityState
): { value: string; label: string }[] {
  const fullRef = `${stepId}.${fieldKey}`;
  const allowedValues = visibilityState.filteredOptions.get(fullRef) || 
                        visibilityState.filteredOptions.get(fieldKey);
  
  if (!allowedValues) {
    return originalOptions;
  }
  
  return originalOptions.filter(opt => allowedValues.includes(opt.value));
}

/**
 * Get value to auto-set for a field (if any set_value rule matched).
 */
export function getAutoSetValue(
  stepId: string,
  fieldKey: string,
  visibilityState: VisibilityState
): unknown | undefined {
  const fullRef = `${stepId}.${fieldKey}`;
  return visibilityState.setValues.get(fullRef) ?? 
         visibilityState.setValues.get(fieldKey);
}

// Helper functions
function isEqual(a: unknown, b: unknown): boolean {
  // Handle null/undefined comparison
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i])); // Recursive for nested arrays
  }
  // Handle case-insensitive string comparison
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Safe numeric comparison that handles null/undefined.
 * Returns false if either value cannot be converted to a number.
 */
function compareNumbers(a: unknown, b: unknown, comparator: (x: number, y: number) => boolean): boolean {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (numA === null || numB === null) return false;
  return comparator(numA, numB);
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value === 'number') return false; // Numbers are never "empty"
  return false;
}

/**
 * Convert flat form data (stepId.fieldKey) to nested FormData structure.
 */
export function flatDataToFormData(
  flatData: Record<string, unknown>,
  steps: { id: string }[]
): FormData {
  const formData: FormData = {};
  
  // Initialize all steps
  for (const step of steps) {
    formData[step.id] = {};
  }
  
  // Populate with values
  for (const [key, value] of Object.entries(flatData)) {
    if (key.includes('.')) {
      const [stepId, fieldKey] = key.split('.', 2);
      if (formData[stepId]) {
        formData[stepId][fieldKey] = value;
      }
    } else {
      // Try to find which step this field belongs to
      // For now, put in first step
      const firstStep = steps[0];
      if (firstStep) {
        formData[firstStep.id][key] = value;
      }
    }
  }
  
  return formData;
}

/**
 * Hook-friendly function to compute visible steps.
 */
export function getVisibleSteps(
  allSteps: { id: string; [key: string]: unknown }[],
  visibilityState: VisibilityState
): typeof allSteps {
  return allSteps.filter(step => isStepVisible(step.id, visibilityState));
}

/**
 * Hook-friendly function to compute visible fields for a step.
 */
export function getVisibleFields(
  stepId: string,
  allFields: { key: string; [k: string]: unknown }[],
  visibilityState: VisibilityState
): typeof allFields {
  return allFields.filter(field => isFieldVisible(stepId, field.key, visibilityState));
}
