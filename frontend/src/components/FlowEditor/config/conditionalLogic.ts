/**
 * Conditional Logic Evaluator
 * 
 * Evaluates conditional rules to determine field visibility.
 * Supports simple and complex conditions with AND/OR logic.
 * 
 * Created: 2026-02-18
 * Phase: D.2 - Dynamic Panel
 */

import { ConditionalRule, ConditionalOperator } from './types';

/**
 * Evaluate a conditional rule against form data
 * 
 * @param rule - Conditional rule to evaluate
 * @param formData - Current form values
 * @returns True if condition is met (field should be visible)
 */
export function evaluateCondition(
  rule: ConditionalRule,
  formData: Record<string, any>
): boolean {
  // Handle nested conditions (AND/OR logic)
  if (rule.conditions && rule.conditions.length > 0) {
    const results = rule.conditions.map(nestedRule =>
      evaluateCondition(nestedRule, formData)
    );

    if (rule.logic === 'OR') {
      return results.some(result => result);
    } else {
      // Default to AND
      return results.every(result => result);
    }
  }

  // Simple condition - must have field and operator
  if (!rule.field || !rule.operator) {
    console.warn('Invalid conditional rule: missing field or operator', rule);
    return true; // Show field by default if rule is invalid
  }

  const fieldValue = formData[rule.field];
  const targetValue = rule.value;

  return evaluateOperator(rule.operator, fieldValue, targetValue);
}

/**
 * Evaluate a single operator comparison
 * 
 * @param operator - Comparison operator
 * @param fieldValue - Actual field value
 * @param targetValue - Expected value to compare against
 * @returns True if comparison passes
 */
function evaluateOperator(
  operator: ConditionalOperator,
  fieldValue: any,
  targetValue: any
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === targetValue;

    case 'notEquals':
      return fieldValue !== targetValue;

    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(targetValue);
      }
      if (typeof fieldValue === 'string') {
        return fieldValue.includes(String(targetValue));
      }
      return false;

    case 'notContains':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(targetValue);
      }
      if (typeof fieldValue === 'string') {
        return !fieldValue.includes(String(targetValue));
      }
      return true;

    case 'in': {
      const allowed = Array.isArray(targetValue) ? targetValue : [targetValue];
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => allowed.includes(v));
      }
      return allowed.includes(fieldValue);
    }

    case 'notIn': {
      const blocked = Array.isArray(targetValue) ? targetValue : [targetValue];
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => blocked.includes(v));
      }
      return !blocked.includes(fieldValue);
    }

    case 'greaterThan':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue > targetValue;
      }
      if (fieldValue instanceof Date && targetValue instanceof Date) {
        return fieldValue.getTime() > targetValue.getTime();
      }
      return false;

    case 'lessThan':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue < targetValue;
      }
      if (fieldValue instanceof Date && targetValue instanceof Date) {
        return fieldValue.getTime() < targetValue.getTime();
      }
      return false;

    case 'greaterThanOrEqual':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue >= targetValue;
      }
      if (fieldValue instanceof Date && targetValue instanceof Date) {
        return fieldValue.getTime() >= targetValue.getTime();
      }
      return false;

    case 'lessThanOrEqual':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue <= targetValue;
      }
      if (fieldValue instanceof Date && targetValue instanceof Date) {
        return fieldValue.getTime() <= targetValue.getTime();
      }
      return false;

    case 'isEmpty':
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'isNotEmpty':
      return (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue !== '' &&
        (!Array.isArray(fieldValue) || fieldValue.length > 0)
      );

    default:
      console.warn(`Unknown operator: ${operator}`);
      return true;
  }
}

/**
 * Get all field IDs referenced in a conditional rule (for dependency tracking)
 * 
 * @param rule - Conditional rule
 * @returns Array of field IDs that this rule depends on
 */
export function getConditionalDependencies(rule: ConditionalRule): string[] {
  const dependencies: string[] = [];

  if (rule.field) {
    dependencies.push(rule.field);
  }

  if (rule.conditions) {
    rule.conditions.forEach(nestedRule => {
      dependencies.push(...getConditionalDependencies(nestedRule));
    });
  }

  return [...new Set(dependencies)]; // Remove duplicates
}
