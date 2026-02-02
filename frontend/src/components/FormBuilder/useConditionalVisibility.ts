/**
 * useConditionalVisibility Hook
 * 
 * Evaluates visibility rules against current form values to determine
 * which fields should be visible.
 */
import { useMemo, useCallback } from 'react';
import type { VisibilityRule, VisibilityCondition, ConditionOperator } from './ConditionalVisibilityRules';

// ============================================================================
// TYPES
// ============================================================================

export interface FormValues {
  [fieldId: string]: unknown;
}

export interface UseConditionalVisibilityResult {
  /** Check if a specific field should be visible */
  isFieldVisible: (fieldId: string) => boolean;
  /** Get all visible field IDs */
  visibleFields: string[];
  /** Get all hidden field IDs */
  hiddenFields: string[];
  /** Evaluate a single rule */
  evaluateRule: (rule: VisibilityRule, values: FormValues) => boolean;
}

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluates a single condition against form values
 */
const evaluateCondition = (
  condition: VisibilityCondition,
  fieldValue: unknown
): boolean => {
  const { operator, value: conditionValue } = condition;
  
  // Handle empty/not-empty operators first
  if (operator === 'is_empty') {
    return fieldValue === undefined || 
           fieldValue === null || 
           fieldValue === '' ||
           (Array.isArray(fieldValue) && fieldValue.length === 0);
  }
  
  if (operator === 'is_not_empty') {
    return fieldValue !== undefined && 
           fieldValue !== null && 
           fieldValue !== '' &&
           !(Array.isArray(fieldValue) && fieldValue.length === 0);
  }
  
  // For other operators, convert values to comparable types
  const normalizedFieldValue = normalizeValue(fieldValue);
  const normalizedConditionValue = normalizeValue(conditionValue);
  
  switch (operator) {
    case 'equals':
      return normalizedFieldValue === normalizedConditionValue;
      
    case 'not_equals':
      return normalizedFieldValue !== normalizedConditionValue;
      
    case 'contains':
      if (typeof normalizedFieldValue === 'string') {
        return normalizedFieldValue.toLowerCase().includes(
          String(normalizedConditionValue).toLowerCase()
        );
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => 
          normalizeValue(v) === normalizedConditionValue
        );
      }
      return false;
      
    case 'not_contains':
      if (typeof normalizedFieldValue === 'string') {
        return !normalizedFieldValue.toLowerCase().includes(
          String(normalizedConditionValue).toLowerCase()
        );
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v => 
          normalizeValue(v) === normalizedConditionValue
        );
      }
      return true;
      
    case 'greater_than':
      return Number(normalizedFieldValue) > Number(normalizedConditionValue);
      
    case 'less_than':
      return Number(normalizedFieldValue) < Number(normalizedConditionValue);
      
    case 'in_list':
      if (Array.isArray(conditionValue)) {
        return conditionValue.some(v => 
          normalizeValue(v) === normalizedFieldValue
        );
      }
      // If condition value is comma-separated string
      if (typeof conditionValue === 'string') {
        return conditionValue.split(',').map(v => v.trim()).includes(
          String(normalizedFieldValue)
        );
      }
      return normalizedFieldValue === normalizedConditionValue;
      
    case 'not_in_list':
      if (Array.isArray(conditionValue)) {
        return !conditionValue.some(v => 
          normalizeValue(v) === normalizedFieldValue
        );
      }
      if (typeof conditionValue === 'string') {
        return !conditionValue.split(',').map(v => v.trim()).includes(
          String(normalizedFieldValue)
        );
      }
      return normalizedFieldValue !== normalizedConditionValue;
      
    default:
      return false;
  }
};

/**
 * Normalizes a value for comparison
 */
const normalizeValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  return String(value).trim().toLowerCase();
};

/**
 * Evaluates all conditions in a rule
 */
const evaluateRuleConditions = (
  rule: VisibilityRule,
  values: FormValues
): boolean => {
  if (rule.conditions.length === 0) {
    // No conditions means always true (field visible by default)
    return true;
  }
  
  const results = rule.conditions.map(condition => {
    const fieldValue = values[condition.fieldId];
    return evaluateCondition(condition, fieldValue);
  });
  
  if (rule.logicalOperator === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
};

// ============================================================================
// HOOK
// ============================================================================

export const useConditionalVisibility = (
  rules: VisibilityRule[],
  values: FormValues,
  allFieldIds: string[]
): UseConditionalVisibilityResult => {
  
  // Memoize rule evaluation
  const evaluateRule = useCallback((rule: VisibilityRule, formValues: FormValues): boolean => {
    const conditionsMatch = evaluateRuleConditions(rule, formValues);
    
    // If action is 'show', field is visible when conditions match
    // If action is 'hide', field is visible when conditions DON'T match
    return rule.action === 'show' ? conditionsMatch : !conditionsMatch;
  }, []);
  
  // Calculate visibility for all fields
  const { visibleFields, hiddenFields } = useMemo(() => {
    const visible: string[] = [];
    const hidden: string[] = [];
    
    // Group rules by target field
    const rulesByField = rules.reduce((acc, rule) => {
      if (!acc[rule.targetFieldId]) {
        acc[rule.targetFieldId] = [];
      }
      acc[rule.targetFieldId].push(rule);
      return acc;
    }, {} as Record<string, VisibilityRule[]>);
    
    allFieldIds.forEach(fieldId => {
      const fieldRules = rulesByField[fieldId] || [];
      
      if (fieldRules.length === 0) {
        // No rules for this field, it's always visible
        visible.push(fieldId);
      } else {
        // Evaluate all rules for this field
        // If ANY rule makes it visible, the field is visible
        const isVisible = fieldRules.some(rule => evaluateRule(rule, values));
        
        if (isVisible) {
          visible.push(fieldId);
        } else {
          hidden.push(fieldId);
        }
      }
    });
    
    return { visibleFields: visible, hiddenFields: hidden };
  }, [rules, values, allFieldIds, evaluateRule]);
  
  // Check single field visibility
  const isFieldVisible = useCallback((fieldId: string): boolean => {
    return visibleFields.includes(fieldId);
  }, [visibleFields]);
  
  return {
    isFieldVisible,
    visibleFields,
    hiddenFields,
    evaluateRule,
  };
};

export default useConditionalVisibility;
