/**
 * Configuration Schema Registry
 * 
 * Central registry for all node configuration schemas.
 * Provides validation, registration, and retrieval of schemas.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
 */

import { NodeConfigSchema, SchemaValidationResult } from './types';

/**
 * Singleton registry for node configuration schemas
 */
class ConfigSchemaRegistry {
  private schemas: Map<string, NodeConfigSchema> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize registry with built-in schemas
   */
  initialize(schemas: NodeConfigSchema[]): void {
    if (this.initialized) {
      console.warn('ConfigSchemaRegistry already initialized, skipping');
      return;
    }

    // Zero-crash standard: one broken schema must never take down the registry.
    for (const schema of schemas) {
      try {
        const validation = this.validateSchema(schema);
        if (!validation.valid) {
          console.error(`Invalid schema for ${schema.nodeType}:`, validation.errors);
          continue;
        }

        if (validation.warnings && validation.warnings.length > 0) {
          console.warn(`Warnings for schema ${schema.nodeType}:`, validation.warnings);
        }

        this.schemas.set(schema.nodeType, schema);
      } catch (error) {
        console.error(`[Schema Registry] Failed to register schema for ${schema?.nodeType || 'unknown'}:`, error);
        continue;
      }
    }

    this.initialized = true;
    console.log(`ConfigSchemaRegistry initialized with ${this.schemas.size} schemas`);
  }

  /**
   * Register a single node configuration schema
   * 
   * @param schema - Node configuration schema to register
   * @param overwrite - Allow overwriting existing schema (default: false)
   */
  register(schema: NodeConfigSchema, overwrite: boolean = false): void {
    // Validate schema first
    const validation = this.validateSchema(schema);
    if (!validation.valid) {
      throw new Error(
        `Cannot register invalid schema for ${schema.nodeType}: ${validation.errors.join(', ')}`
      );
    }

    // Check for existing schema
    if (this.schemas.has(schema.nodeType) && !overwrite) {
      console.warn(
        `Schema for ${schema.nodeType} already registered. ` +
        `Use overwrite=true to replace existing schema.`
      );
      return;
    }

    this.schemas.set(schema.nodeType, schema);
    console.log(`Registered schema for node type: ${schema.nodeType}`);
  }

  /**
   * Get schema for a node type
   * 
   * @param nodeType - Node type identifier
   * @returns Schema (always returns a schema, using fallback if needed)
   */
  getSchema(nodeType: string): NodeConfigSchema {
    const schema = this.schemas.get(nodeType);
    if (!schema) {
      console.warn(`[Schema Registry] No schema found for node type: ${nodeType}, using fallback`);
      return this.createFallbackSchema(nodeType);
    }
    return schema;
  }
  
  /**
   * Create a fallback schema for node types without explicit schemas
   * Provides basic configuration fields that work for any node
   * 
   * @param nodeType - Node type identifier
   * @returns Basic configuration schema
   */
  private createFallbackSchema(nodeType: string): NodeConfigSchema {
    return {
      nodeType,
      displayName: this.formatNodeTypeName(nodeType),
      category: this.inferCategory(nodeType),
      description: `Configure ${this.formatNodeTypeName(nodeType)} node`,
      version: '1.0.0-fallback',
      sections: [
        {
          id: 'basic',
          title: 'Basic Configuration',
          fields: [
            {
              id: 'name',
              label: 'Node Name',
              type: 'text',
              placeholder: 'Enter node name',
              helpText: 'A descriptive name for this node',
              defaultValue: '',
              required: false,
            },
            {
              id: 'description',
              label: 'Description',
              type: 'textarea',
              placeholder: 'Enter description',
              helpText: 'Optional description of what this node does',
              defaultValue: '',
              required: false,
            },
            {
              id: 'notes',
              label: 'Notes',
              type: 'textarea',
              placeholder: 'Add notes or comments',
              helpText: 'Internal notes for documentation',
              defaultValue: '',
              required: false,
            },
          ],
        },

      ],
    };
  }
  
  /**
   * Format node type name for display
   */
  private formatNodeTypeName(nodeType: string): string {
    // Convert camelCase/PascalCase to Title Case
    return nodeType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  /**
   * Infer category from node type prefix
   */
  private inferCategory(nodeType: string): string {
    if (nodeType.startsWith('trigger')) return 'trigger';
    if (nodeType.startsWith('form')) return 'form';
    if (nodeType.startsWith('condition')) return 'logic';
    if (nodeType.startsWith('action')) return 'action';
    if (nodeType.startsWith('data')) return 'data';
    if (nodeType.startsWith('loop')) return 'loop';
    if (nodeType.startsWith('wait') || nodeType.startsWith('pending')) return 'wait';
    if (nodeType.startsWith('document')) return 'document';
    if (nodeType.startsWith('utility') || nodeType.startsWith('group') || nodeType.startsWith('note')) return 'utility';
    if (nodeType.startsWith('end') || nodeType.startsWith('terminal')) return 'terminal';
    return 'action'; // Default fallback
  }

  /**
   * Check if schema exists for a node type
   * 
   * @param nodeType - Node type identifier
   * @returns True if schema exists
   */
  hasSchema(nodeType: string): boolean {
    return this.schemas.has(nodeType);
  }

  /**
   * Get all registered node types
   * 
   * @returns Array of registered node type identifiers
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get all registered schemas
   * 
   * @returns Array of all registered schemas
   */
  getAllSchemas(): NodeConfigSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Unregister a schema
   * 
   * @param nodeType - Node type identifier
   * @returns True if schema was removed
   */
  unregister(nodeType: string): boolean {
    return this.schemas.delete(nodeType);
  }

  /**
   * Clear all registered schemas (use with caution!)
   */
  clear(): void {
    this.schemas.clear();
    this.initialized = false;
    console.log('ConfigSchemaRegistry cleared');
  }

  /**
   * Validate a schema definition
   * 
   * Checks for:
   * - Required fields (nodeType, displayName, sections)
   * - Section structure (id, title, fields)
   * - Field structure (id, type, label)
   * - Duplicate IDs
   * - Invalid references in conditional rules
   * 
   * @param schema - Schema to validate
   * @returns Validation result with errors and warnings
   */
  validateSchema(schema: NodeConfigSchema): SchemaValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required top-level fields
    if (!schema.nodeType) {
      errors.push('nodeType is required');
    }
    if (!schema.displayName) {
      errors.push('displayName is required');
    }
    if (!schema.sections || schema.sections.length === 0) {
      errors.push('At least one section is required');
      return { valid: false, errors, warnings };
    }

    // Track all field IDs for duplicate detection + dependency validation
    const fieldIds = new Set<string>();

    // First pass: collect ALL field IDs (ordering must not matter)
    schema.sections.forEach((section, sectionIndex) => {
      const sectionPrefix = `Section ${sectionIndex + 1} (${section.id || 'unnamed'})`;

      // Check required section fields
      if (!section.id) errors.push(`${sectionPrefix}: missing id`);
      if (!section.title) errors.push(`${sectionPrefix}: missing title`);
      if (!section.fields || section.fields.length === 0) {
        errors.push(`${sectionPrefix}: must have at least one field`);
        return;
      }

      section.fields.forEach((field, fieldIndex) => {
        const fieldPrefix = `${sectionPrefix}, Field ${fieldIndex + 1} (${field.id || 'unnamed'})`;
        if (!field.id) {
          errors.push(`${fieldPrefix}: missing id`);
          return;
        }
        if (fieldIds.has(field.id)) {
          errors.push(`${fieldPrefix}: duplicate field id '${field.id}'`);
        }
        fieldIds.add(field.id);
      });
    });

    // Second pass: validate fields using the complete fieldId set
    schema.sections.forEach((section, sectionIndex) => {
      const sectionPrefix = `Section ${sectionIndex + 1} (${section.id || 'unnamed'})`;
      if (!section.fields || section.fields.length === 0) return;

      section.fields.forEach((field, fieldIndex) => {
        const fieldPrefix = `${sectionPrefix}, Field ${fieldIndex + 1} (${field.id || 'unnamed'})`;

        if (!field.type) errors.push(`${fieldPrefix}: missing type`);

        // Labels are required for most field types, but not for info/button blocks
        const requiresLabel = field.type !== 'info' && field.type !== 'button';
        if (requiresLabel && !field.label) {
          errors.push(`${fieldPrefix}: missing label`);
        }

        // Validate field type specific requirements
        if (field.type === 'select' || field.type === 'multiselect') {
          if (!field.options || field.options.length === 0) {
            // Many select fields are populated dynamically (e.g., template pickers).
            // Treat missing/empty options as a warning to avoid blocking app load.
            warnings.push(`${fieldPrefix}: type '${field.type}' has no options; expected dynamic population`);
          }
        }

        if (field.type === 'custom' && !field.component) {
          errors.push(`${fieldPrefix}: type 'custom' requires component property`);
        }

        // Validate conditional rules
        if (field.conditional && field.id) {
          const conditionalErrors = this.validateConditionalRule(
            field.conditional,
            fieldIds,
            field.id
          );
          conditionalErrors.forEach(err =>
            errors.push(`${fieldPrefix}: conditional rule error - ${err}`)
          );
        }

        // Robustly normalize validation rules to an array
        // Handles cross-realm Array.isArray() issues and double-wrapped arrays
        let validationRules: any[] = [];
        if (field.validation) {
          if (Array.isArray(field.validation)) {
            // Standard array case
            validationRules = field.validation as any[];
          } else if (typeof field.validation === 'object' && field.validation !== null) {
            // Check if it's an array-like object (cross-realm issue)
            if (typeof (field.validation as any).length === 'number') {
              validationRules = Array.from(field.validation as any);
            } else {
              // Single object, wrap it
              validationRules = [field.validation];
            }
          } else {
            // Primitive or unexpected type, wrap it
            validationRules = [field.validation];
          }
          
          // Flatten to unwrap cross-realm double-wrapped arrays: [[{type: 'required'}]]
          // flat(Infinity) recursively flattens nested arrays
          validationRules = validationRules.flat(Infinity).filter(r => 
            r && typeof r === 'object' && !Array.isArray(r)
          );
        }

        // Validate validation rules
        validationRules.forEach((rule, ruleIndex) => {
          if (!rule.type) {
            errors.push(`${fieldPrefix}: validation rule ${ruleIndex + 1} missing type`);
          }
          if (!rule.message) {
            errors.push(`${fieldPrefix}: validation rule ${ruleIndex + 1} missing message`);
          }
          if (rule.type === 'custom' && !rule.validator) {
            errors.push(
              `${fieldPrefix}: validation rule ${ruleIndex + 1} type 'custom' requires validator function`
            );
          }
        });

        // Warnings for best practices
        if (field.required && !validationRules.some(r => r.type === 'required')) {
          warnings.push(
            `${fieldPrefix}: field is marked required but has no 'required' validation rule`
          );
        }

        if (field.type === 'textarea' && !field.placeholder) {
          warnings.push(`${fieldPrefix}: textarea fields should have placeholder text`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a conditional rule
   * 
   * @param rule - Conditional rule to validate
   * @param validFieldIds - Set of valid field IDs
   * @param currentFieldId - ID of field being validated (to prevent self-reference)
   * @returns Array of error messages
   */
  private validateConditionalRule(
    rule: import('./types').ConditionalRule,
    validFieldIds: Set<string>,
    currentFieldId: string
  ): string[] {
    const errors: string[] = [];

    // Nested conditions
    if (rule.conditions && rule.conditions.length > 0) {
      if (!rule.logic) {
        errors.push('logic operator required when using nested conditions');
      }
      rule.conditions.forEach((nestedRule, index) => {
        const nestedErrors = this.validateConditionalRule(
          nestedRule,
          validFieldIds,
          currentFieldId
        );
        nestedErrors.forEach(err => errors.push(`condition ${index + 1}: ${err}`));
      });
    } else {
      // Simple condition
      if (!rule.field) {
        errors.push('field is required for conditional rule');
      } else if (rule.field === currentFieldId) {
        errors.push(`field '${rule.field}' cannot reference itself`);
      } else if (!validFieldIds.has(rule.field)) {
        errors.push(`field '${rule.field}' does not exist in schema`);
      }

      if (!rule.operator) {
        errors.push('operator is required for conditional rule');
      }

      if (rule.value === undefined && !['isEmpty', 'isNotEmpty'].includes(rule.operator || '')) {
        errors.push('value is required for operator type');
      }
    }

    return errors;
  }

  /**
   * Get statistics about registered schemas
   */
  getStats(): {
    totalSchemas: number;
    totalSections: number;
    totalFields: number;
    nodeTypes: string[];
  } {
    let totalSections = 0;
    let totalFields = 0;

    this.schemas.forEach(schema => {
      totalSections += schema.sections.length;
      schema.sections.forEach(section => {
        totalFields += section.fields.length;
      });
    });

    return {
      totalSchemas: this.schemas.size,
      totalSections,
      totalFields,
      nodeTypes: this.getRegisteredTypes()
    };
  }
}

// Singleton instance
export const schemaRegistry = new ConfigSchemaRegistry();

// For testing/debugging
if (process.env.NODE_ENV === 'development') {
  (window as any).__schemaRegistry = schemaRegistry;
}
