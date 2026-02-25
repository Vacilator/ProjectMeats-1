/**
 * Node Validation Service
 * 
 * Validates node configurations and returns validation errors/warnings.
 * Provides real-time validation feedback for config panels.
 * 
 * Agent C: Advanced Polish
 * Created: 2026-02-24
 */

import { Node } from '@xyflow/react';
import { schemaRegistry } from '../components/FlowEditor/config/schemaRegistry';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  path?: string; // JSONPath to field (e.g., "request.headers[0].key")
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  missingRequired: string[];
  score: number; // 0-100 completeness score
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Validate a single field against its schema definition
 */
function validateField(
  fieldName: string,
  fieldValue: any,
  fieldSchema: any,
  context: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Required field check
  if (fieldSchema.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
    errors.push({
      field: fieldName,
      message: `${fieldSchema.label || fieldName} is required`,
      severity: 'error'
    });
    return errors; // Skip other checks if required and empty
  }
  
  // Skip validation if field is empty and not required
  if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
    return errors;
  }
  
  // Type validation
  if (fieldSchema.type === 'number' && isNaN(Number(fieldValue))) {
    errors.push({
      field: fieldName,
      message: `${fieldSchema.label || fieldName} must be a number`,
      severity: 'error'
    });
  }
  
  if (fieldSchema.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) {
    errors.push({
      field: fieldName,
      message: `${fieldSchema.label || fieldName} must be a valid email`,
      severity: 'error'
    });
  }
  
  if (fieldSchema.type === 'url' && !/^https?:\/\/.+/.test(fieldValue)) {
    errors.push({
      field: fieldName,
      message: `${fieldSchema.label || fieldName} must be a valid URL`,
      severity: 'warning'
    });
  }
  
  // Min/Max validation
  if (fieldSchema.min !== undefined && Number(fieldValue) < fieldSchema.min) {
    errors.push({
      field: fieldName,
      message: `${fieldSchema.label || fieldName} must be at least ${fieldSchema.min}`,
      severity: 'error'
    });
  }
  
  if (fieldSchema.max !== undefined && Number(fieldValue) > fieldSchema.max) {
    errors.push({
      field: fieldName,
      message: `${fieldSchema.label || fieldName} must be at most ${fieldSchema.max}`,
      severity: 'error'
    });
  }
  
  // Pattern validation
  if (fieldSchema.pattern && !new RegExp(fieldSchema.pattern).test(fieldValue)) {
    errors.push({
      field: fieldName,
      message: fieldSchema.patternError || `${fieldSchema.label || fieldName} format is invalid`,
      severity: 'error'
    });
  }
  
  // Array validation
  if (fieldSchema.type === 'array') {
    if (!Array.isArray(fieldValue)) {
      errors.push({
        field: fieldName,
        message: `${fieldSchema.label || fieldName} must be an array`,
        severity: 'error'
      });
    } else if (fieldSchema.minItems && fieldValue.length < fieldSchema.minItems) {
      errors.push({
        field: fieldName,
        message: `${fieldSchema.label || fieldName} must have at least ${fieldSchema.minItems} items`,
        severity: 'error'
      });
    }
  }
  
  // Custom validation function
  if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
    const customError = fieldSchema.validate(fieldValue, context);
    if (customError) {
      errors.push({
        field: fieldName,
        message: customError,
        severity: 'error'
      });
    }
  }
  
  return errors;
}

/**
 * Check conditional visibility (showIf)
 */
function isFieldVisible(fieldSchema: any, values: Record<string, any>): boolean {
  if (!fieldSchema.showIf) return true;
  
  const { field, operator, value } = fieldSchema.showIf;
  const fieldValue = values[field];
  
  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'contains':
      return String(fieldValue).includes(String(value));
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'notExists':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    case 'greaterThan':
      return Number(fieldValue) > Number(value);
    case 'lessThan':
      return Number(fieldValue) < Number(value);
    default:
      return true;
  }
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a node's configuration against its schema
 */
export function validateNode(node: Node, allNodes?: Node[], allEdges?: any[]): ValidationResult {
  const schema = schemaRegistry.get(node.type || '');
  
  if (!schema || !schema.sections) {
    // No schema or no fields to validate
    return {
      isValid: true,
      errors: [],
      warnings: [],
      missingRequired: [],
      score: 100
    };
  }
  
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const missingRequired: string[] = [];
  const values = node.data?.config || node.data || {};
  
  // Flatten sections into single field array
  const allFields = schema.sections.flatMap(section => section.fields || []);
  
  let totalFields = 0;
  let completedFields = 0;
  
  // Validate each field
  for (const fieldSchema of allFields) {
    const fieldName = fieldSchema.name;
    const fieldValue = values[fieldName];
    
    // Check conditional visibility
    if (!isFieldVisible(fieldSchema, values)) {
      continue; // Skip hidden fields
    }
    
    totalFields++;
    
    // Count as completed if has value (even if invalid)
    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
      completedFields++;
    }
    
    // Validate field
    const fieldErrors = validateField(fieldName, fieldValue, fieldSchema, values);
    
    for (const error of fieldErrors) {
      if (error.severity === 'error') {
        errors.push(error);
        if (fieldSchema.required) {
          missingRequired.push(fieldName);
        }
      } else {
        warnings.push(error);
      }
    }
  }
  
  // Calculate completeness score
  const score = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 100;
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    score
  };
}

/**
 * Get quick validation summary for badge display
 */
export function getValidationBadge(node: Node): {
  show: boolean;
  type: 'error' | 'warning' | 'success';
  count: number;
  message: string;
} {
  const result = validateNode(node);
  
  if (result.errors.length > 0) {
    return {
      show: true,
      type: 'error',
      count: result.errors.length,
      message: result.errors.length === 1 
        ? result.errors[0].message 
        : `${result.errors.length} configuration errors`
    };
  }
  
  if (result.warnings.length > 0) {
    return {
      show: true,
      type: 'warning',
      count: result.warnings.length,
      message: result.warnings.length === 1
        ? result.warnings[0].message
        : `${result.warnings.length} warnings`
    };
  }
  
  // Show success badge if score is 100
  if (result.score === 100) {
    return {
      show: true,
      type: 'success',
      count: 0,
      message: 'Configuration complete'
    };
  }
  
  return {
    show: false,
    type: 'success',
    count: 0,
    message: ''
  };
}

/**
 * Get list of all validation errors for tooltip
 */
export function getValidationTooltip(node: Node): string {
  const result = validateNode(node);
  
  if (result.errors.length === 0 && result.warnings.length === 0) {
    return result.score === 100 
      ? '✓ Configuration complete' 
      : `Configuration ${result.score}% complete`;
  }
  
  const lines: string[] = [];
  
  if (result.errors.length > 0) {
    lines.push('Errors:');
    result.errors.forEach(error => {
      lines.push(`  • ${error.message}`);
    });
  }
  
  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Warnings:');
    result.warnings.forEach(warning => {
      lines.push(`  • ${warning.message}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Filter upstream variables by expected type
 * Agent C Feature: Type-aware variable picker
 */
export function filterVariablesByType(
  variables: Array<{ name: string; type: string; value?: any }>,
  expectedType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'
): Array<{ name: string; type: string; value?: any }> {
  if (expectedType === 'any') {
    return variables;
  }
  
  return variables.filter(v => {
    // Exact type match
    if (v.type === expectedType) return true;
    
    // Type coercion rules
    if (expectedType === 'string') {
      // Everything can be converted to string
      return true;
    }
    
    if (expectedType === 'number') {
      // Only number and boolean can be converted to number
      return v.type === 'number' || v.type === 'boolean';
    }
    
    if (expectedType === 'boolean') {
      // Number and string can be converted to boolean
      return v.type === 'boolean' || v.type === 'number' || v.type === 'string';
    }
    
    return false;
  });
}
