/**
 * useStepRouting Hook
 *
 * Evaluates step routing rules to determine the next step in a workflow.
 */
import { useMemo, useCallback } from 'react';
import type {
  RoutingRule,
  RoutingCondition,
  ConditionOperator
} from './StepRoutingLogic';

// ============================================================================
// TYPES
// ============================================================================

export interface FormValues {
  [fieldId: string]: unknown;
}

export interface UseStepRoutingResult {
  /** Get the next step based on current form values */
  getNextStep: (formValues: FormValues) => string | null;
  /** Get all possible next steps from the current step */
  getPossibleNextSteps: () => string[];
  /** Evaluate a single routing rule */
  evaluateRule: (rule: RoutingRule, formValues: FormValues) => boolean;
  /** Check if a specific rule's conditions are met */
  isRuleSatisfied: (ruleId: string, formValues: FormValues) => boolean;
  /** Get the default next step (when no conditions match) */
  defaultNextStep: string | null;
}

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluates a single condition against a field value
 */
const evaluateCondition = (
  condition: RoutingCondition,
  fieldValue: unknown
): boolean => {
  const { operator, value: conditionValue } = condition;

  // Handle empty/not-empty operators
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

  // Handle equals
  if (operator === 'equals') {
    if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
      return fieldValue.toLowerCase() === conditionValue.toLowerCase();
    }
    return fieldValue === conditionValue;
  }

  // Handle not_equals
  if (operator === 'not_equals') {
    if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
      return fieldValue.toLowerCase() !== conditionValue.toLowerCase();
    }
    return fieldValue !== conditionValue;
  }

  // Handle contains
  if (operator === 'contains') {
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(v =>
        typeof v === 'string' && typeof conditionValue === 'string'
          ? v.toLowerCase().includes(conditionValue.toLowerCase())
          : v === conditionValue
      );
    }
    if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
      return fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
    }
    return false;
  }

  // Handle numeric comparisons
  if (operator === 'greater_than') {
    const numField = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
    const numCondition = typeof conditionValue === 'number' ? conditionValue : parseFloat(String(conditionValue));
    return !isNaN(numField) && !isNaN(numCondition) && numField > numCondition;
  }

  if (operator === 'less_than') {
    const numField = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
    const numCondition = typeof conditionValue === 'number' ? conditionValue : parseFloat(String(conditionValue));
    return !isNaN(numField) && !isNaN(numCondition) && numField < numCondition;
  }

  // Handle in_list
  if (operator === 'in_list') {
    const list = Array.isArray(conditionValue) ? conditionValue : [conditionValue];

    if (typeof fieldValue === 'string') {
      return list.some((item) => String(item).toLowerCase() === fieldValue.toLowerCase());
    }

    if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
      return (list as Array<string | number | boolean>).includes(fieldValue);
    }

    return false;
  }

  return false;
};

/**
 * Evaluates all conditions in a rule
 */
const evaluateRuleConditions = (
  rule: RoutingRule,
  values: FormValues
): boolean => {
  if (rule.conditions.length === 0) {
    // No conditions means always true (for default routes)
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

export const useStepRouting = (
  rules: RoutingRule[],
  currentStepId: string
): UseStepRoutingResult => {

  // Get rules for current step, sorted by priority
  const stepRules = useMemo(() => {
    return rules
      .filter(r => r.sourceStepId === currentStepId)
      .sort((a, b) => a.priority - b.priority);
  }, [rules, currentStepId]);

  // Get the default next step
  const defaultNextStep = useMemo(() => {
    const defaultRule = stepRules.find(r => r.isDefault);
    return defaultRule?.targetStepId ?? null;
  }, [stepRules]);

  // Evaluate a single rule
  const evaluateRule = useCallback((rule: RoutingRule, formValues: FormValues): boolean => {
    return evaluateRuleConditions(rule, formValues);
  }, []);

  // Check if a specific rule is satisfied
  const isRuleSatisfied = useCallback((ruleId: string, formValues: FormValues): boolean => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return false;
    return evaluateRuleConditions(rule, formValues);
  }, [rules]);

  // Get the next step based on form values
  const getNextStep = useCallback((formValues: FormValues): string | null => {
    // Evaluate rules in priority order
    for (const rule of stepRules) {
      if (evaluateRuleConditions(rule, formValues)) {
        return rule.targetStepId;
      }
    }

    // Fall back to default
    return defaultNextStep;
  }, [stepRules, defaultNextStep]);

  // Get all possible next steps
  const getPossibleNextSteps = useCallback((): string[] => {
    const targets = new Set<string>();
    for (const rule of stepRules) {
      targets.add(rule.targetStepId);
    }
    return Array.from(targets);
  }, [stepRules]);

  return {
    getNextStep,
    getPossibleNextSteps,
    evaluateRule,
    isRuleSatisfied,
    defaultNextStep,
  };
};

export default useStepRouting;
