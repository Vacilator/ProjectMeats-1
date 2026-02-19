/**
 * Node Configuration Schemas
 * 
 * Declarative configuration schemas for all node types.
 * Each schema defines the structure, fields, validation, and behavior
 * of a node's configuration panel.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
 */

import { NodeConfigSchema } from './types';
import { Package, FileText, CheckSquare, Settings } from 'lucide-react';

// ============================================================================
// Form Step: Single Node Schema
// ============================================================================

/**
 * Configuration schema for Form Step: Single node
 * 
 * Defines a single-page form step that can be used standalone or inside
 * a Form Process container.
 */
export const formStepSingleSchema: NodeConfigSchema = {
  nodeType: 'formStepSingle',
  displayName: 'Form Step: Single',
  description: 'A single-page form for data collection',
  icon: FileText,
  version: '1.0.0',
  tags: ['form', 'data-collection', 'user-input'],
  contextAware: true,

  sections: [
    // ========================================================================
    // Basic Properties
    // ========================================================================
    {
      id: 'basic',
      title: 'Basic Properties',
      icon: Package,
      defaultExpanded: true,
      description: 'Core configuration for this form step',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Step Name',
          placeholder: 'e.g., Customer Information',
          helpText: 'Internal name for this step (shown in workflow editor)',
          required: true,
          validation: [
            {
              type: 'required',
              message: 'Step name is required'
            },
            {
              type: 'minLength',
              value: 3,
              message: 'Name must be at least 3 characters'
            },
            {
              type: 'maxLength',
              value: 100,
              message: 'Name must be less than 100 characters'
            }
          ]
        },
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Describe what this form collects...',
          helpText: 'Optional description for documentation and user guidance',
          validation: [
            {
              type: 'maxLength',
              value: 500,
              message: 'Description must be less than 500 characters'
            }
          ]
        },
        {
          id: 'displayTitle',
          type: 'text',
          label: 'Display Title',
          placeholder: 'e.g., Tell us about yourself',
          helpText: 'Title shown to end users when filling out the form',
          validation: [
            {
              type: 'maxLength',
              value: 200,
              message: 'Display title must be less than 200 characters'
            }
          ]
        }
      ]
    },

    // ========================================================================
    // Entity Configuration
    // ========================================================================
    {
      id: 'entity',
      title: 'Entity Configuration',
      icon: FileText,
      defaultExpanded: true,
      description: 'Select the entity type this form will create or edit',
      fields: [
        {
          id: 'entityType',
          type: 'entity-selector',
          label: 'Entity Type',
          placeholder: 'Select an entity...',
          helpText: 'Choose the data model this form will interact with',
          required: true,
          validation: [
            {
              type: 'required',
              message: 'Entity type is required'
            }
          ]
        },
        {
          id: 'entityAction',
          type: 'select',
          label: 'Action',
          helpText: 'What action should this form perform?',
          defaultValue: 'create',
          options: [
            {
              value: 'create',
              label: 'Create New Record',
              description: 'Create a new entity instance'
            },
            {
              value: 'update',
              label: 'Update Existing Record',
              description: 'Update an existing entity instance'
            },
            {
              value: 'collect',
              label: 'Collect Data Only',
              description: 'Collect data without creating/updating a record'
            }
          ],
          conditional: {
            field: 'entityType',
            operator: 'isNotEmpty'
          }
        },
        {
          id: 'entityId',
          type: 'variable-picker',
          label: 'Record ID',
          placeholder: 'Select variable containing record ID',
          helpText: 'Variable from previous steps containing the ID of the record to update',
          required: true,
          conditional: {
            field: 'entityAction',
            operator: 'equals',
            value: 'update'
          },
          validation: [
            {
              type: 'required',
              message: 'Record ID is required for update action'
            }
          ]
        }
      ]
    },

    // ========================================================================
    // Form Fields
    // ========================================================================
    {
      id: 'fields',
      title: 'Form Fields',
      icon: FileText,
      defaultExpanded: true,
      description: 'Configure which fields appear in the form',
      conditional: {
        field: 'entityType',
        operator: 'isNotEmpty'
      },
      fields: [
        {
          id: 'fields',
          type: 'field-mapping',
          label: 'Fields',
          helpText: 'Click "Open Field Picker" to select and configure fields',
          defaultValue: []
        },
        {
          id: 'fieldLayout',
          type: 'select',
          label: 'Field Layout',
          helpText: 'How should fields be arranged visually?',
          defaultValue: 'single-column',
          options: [
            {
              value: 'single-column',
              label: 'Single Column',
              description: 'One field per row (mobile-friendly)'
            },
            {
              value: 'two-column',
              label: 'Two Columns',
              description: 'Two fields per row (desktop optimized)'
            },
            {
              value: 'auto',
              label: 'Auto',
              description: 'Responsive layout based on screen size'
            }
          ]
        }
      ]
    },

    // ========================================================================
    // Validation Rules
    // ========================================================================
    {
      id: 'validation',
      title: 'Validation Rules',
      icon: CheckSquare,
      collapsible: true,
      defaultExpanded: false,
      description: 'Configure validation rules for form fields',
      conditional: {
        logic: 'AND',
        conditions: [
          { field: 'entityType', operator: 'isNotEmpty' },
          { field: 'fields', operator: 'isNotEmpty' }
        ]
      },
      fields: [
        {
          id: 'validationRules',
          type: 'validation-builder',
          label: 'Field Validation',
          helpText: 'Add custom validation rules for individual fields',
          defaultValue: []
        },
        {
          id: 'showValidationSummary',
          type: 'toggle',
          label: 'Show Validation Summary',
          helpText: 'Display all validation errors at the top of the form',
          defaultValue: true
        },
        {
          id: 'validateOnBlur',
          type: 'toggle',
          label: 'Validate on Blur',
          helpText: 'Run validation when user leaves a field',
          defaultValue: true
        },
        {
          id: 'validateOnChange',
          type: 'toggle',
          label: 'Validate on Change',
          helpText: 'Run validation as user types (may be distracting)',
          defaultValue: false
        }
      ]
    },

    // ========================================================================
    // Advanced Settings
    // ========================================================================
    {
      id: 'advanced',
      title: 'Advanced Settings',
      icon: Settings,
      collapsible: true,
      defaultExpanded: false,
      description: 'Advanced configuration options',
      fields: [
        {
          id: 'allowMultipleSubmissions',
          type: 'toggle',
          label: 'Allow Multiple Submissions',
          helpText: 'Allow users to submit this form multiple times',
          defaultValue: false
        },
        {
          id: 'saveAsDraft',
          type: 'toggle',
          label: 'Enable Save as Draft',
          helpText: 'Allow users to save progress and return later',
          defaultValue: false
        },
        {
          id: 'redirectOnSubmit',
          type: 'text',
          label: 'Redirect URL',
          placeholder: '/thank-you',
          helpText: 'URL to redirect to after successful submission (leave empty to stay on page)',
          conditional: {
            field: 'allowMultipleSubmissions',
            operator: 'equals',
            value: false
          }
        },
        {
          id: 'submitButtonText',
          type: 'text',
          label: 'Submit Button Text',
          placeholder: 'Submit',
          helpText: 'Custom text for the submit button',
          defaultValue: 'Submit'
        },
        {
          id: 'cancelButtonText',
          type: 'text',
          label: 'Cancel Button Text',
          placeholder: 'Cancel',
          helpText: 'Custom text for the cancel button (if enabled)',
          conditional: {
            field: 'showCancelButton',
            operator: 'equals',
            value: true
          }
        },
        {
          id: 'showCancelButton',
          type: 'toggle',
          label: 'Show Cancel Button',
          helpText: 'Display a cancel button alongside submit',
          defaultValue: false
        }
      ]
    }
  ],

  // Default presets (optional)
  presets: [
    {
      id: 'customer-info',
      name: 'Customer Information',
      description: 'Standard customer data collection form',
      values: {
        name: 'Customer Information',
        displayTitle: 'Tell us about yourself',
        entityType: 'customer',
        entityAction: 'create',
        fieldLayout: 'two-column',
        showValidationSummary: true,
        validateOnBlur: true,
        submitButtonText: 'Continue'
      },
      isDefault: true
    },
    {
      id: 'product-details',
      name: 'Product Details',
      description: 'Product information collection',
      values: {
        name: 'Product Details',
        displayTitle: 'Product Information',
        entityType: 'product',
        entityAction: 'create',
        fieldLayout: 'single-column',
        showValidationSummary: true,
        submitButtonText: 'Save Product'
      }
    }
  ]
};

// ============================================================================
// Export all schemas
// ============================================================================

/**
 * All registered node configuration schemas
 * Add new schemas to this array to register them
 */
export const allSchemas: NodeConfigSchema[] = [
  formStepSingleSchema
  // Add more schemas here as they're created:
  // formProcessSchema,
  // createRecordSchema,
  // outlookEmailSchema,
  // etc.
];

// ============================================================================
// Auto-initialize registry
// ============================================================================

import { schemaRegistry } from './schemaRegistry';

// Initialize registry with all schemas on module load
schemaRegistry.initialize(allSchemas);
