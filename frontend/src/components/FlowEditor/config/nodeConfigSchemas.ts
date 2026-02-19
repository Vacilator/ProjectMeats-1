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
import { Package, FileText, CheckSquare, Settings, Mail, Navigation, Database } from 'lucide-react';

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
// Form Process Container Schema
// ============================================================================

/**
 * Configuration schema for Form Process Container node
 * 
 * Defines a multi-step form container that groups Form Single Step nodes
 * into a cohesive workflow with navigation and behavior settings.
 */
export const formProcessSchema: NodeConfigSchema = {
  nodeType: 'formMultiStepContainer',
  displayName: 'Form Process',
  description: 'Container for multi-step forms with navigation controls',
  icon: Package,
  version: '1.0.0',
  tags: ['form', 'container', 'multi-step', 'workflow'],
  contextAware: false,

  sections: [
    // ========================================================================
    // Container Properties
    // ========================================================================
    {
      id: 'properties',
      title: 'Container Properties',
      icon: Package,
      defaultExpanded: true,
      description: 'Basic information about this form process',
      fields: [
        {
          id: 'containerName',
          type: 'text',
          label: 'Container Name',
          placeholder: 'e.g., Customer Onboarding Form',
          helpText: 'Display name for this form process',
          defaultValue: 'New Form Process',
          validation: {
            required: true,
            minLength: 3,
            maxLength: 100
          }
        },
        {
          id: 'containerDescription',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Brief description of this form process...',
          helpText: 'Optional description to explain the purpose of this form',
          rows: 3,
          validation: {
            maxLength: 500
          }
        }
      ]
    },

    // ========================================================================
    // Navigation & Behavior
    // ========================================================================
    {
      id: 'navigation',
      title: 'Navigation & Behavior',
      icon: Navigation,
      defaultExpanded: true,
      description: 'Control how users navigate through this form',
      fields: [
        {
          id: 'showProgressIndicator',
          type: 'toggle',
          label: 'Show Progress Indicator',
          helpText: 'Display step progress during execution',
          defaultValue: true
        },
        {
          id: 'allowBackNavigation',
          type: 'toggle',
          label: 'Allow Back Navigation',
          helpText: 'Users can return to previous steps',
          defaultValue: true
        },
        {
          id: 'allowSkipSteps',
          type: 'toggle',
          label: 'Allow Skip Steps',
          helpText: 'Users can skip optional steps',
          defaultValue: false
        },
        {
          id: 'autoAdvance',
          type: 'toggle',
          label: 'Auto-Advance',
          helpText: 'Automatically proceed to next step on completion',
          defaultValue: false
        },
        {
          id: 'confirmOnExit',
          type: 'toggle',
          label: 'Confirm on Exit',
          helpText: 'Require confirmation before exiting form',
          defaultValue: true
        }
      ]
    }
  ]
};

// ============================================================================
// Create Record Action Schema
// ============================================================================

/**
 * Configuration schema for Create Record node
 * 
 * Defines an action node that creates a new record in a selected entity
 * with field mappings from upstream workflow variables.
 */
export const createRecordSchema: NodeConfigSchema = {
  nodeType: 'createRecord',
  displayName: 'Create Record',
  description: 'Create a new record in the selected entity',
  icon: Database,
  version: '1.0.0',
  tags: ['action', 'database', 'create', 'entity'],
  contextAware: true,

  sections: [
    // ========================================================================
    // Basic Configuration
    // ========================================================================
    {
      id: 'basic',
      title: 'Basic Configuration',
      icon: Settings,
      defaultExpanded: true,
      description: 'Configure the target entity and record details',
      fields: [
        {
          id: 'label',
          type: 'text',
          label: 'Action Label',
          placeholder: 'e.g., Create Customer',
          helpText: 'Display name for this action',
          defaultValue: 'Create Record',
          validation: {
            required: true,
            minLength: 3,
            maxLength: 100
          }
        },
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Optional description...',
          helpText: 'Brief explanation of what this action does',
          rows: 2,
          validation: {
            maxLength: 300
          }
        },
        {
          id: 'entity',
          type: 'entity-selector',
          label: 'Target Entity',
          placeholder: 'Select entity to create...',
          helpText: 'Choose which entity type to create a record for',
          validation: {
            required: true
          }
        }
      ]
    },

    // ========================================================================
    // Field Mapping
    // ========================================================================
    {
      id: 'fieldMapping',
      title: 'Field Mapping',
      icon: CheckSquare,
      defaultExpanded: true,
      description: 'Map workflow variables to entity fields',
      conditionalLogic: {
        field: 'entity',
        condition: 'notEmpty'
      },
      fields: [
        {
          id: 'fieldMappings',
          type: 'field-mapping',
          label: 'Field Mappings',
          helpText: 'Map values from upstream nodes to target entity fields',
          entityFieldId: 'entity',
          showAutoSuggest: true,
          validation: {
            custom: (value: any) => {
              if (!value || value.length === 0) {
                return { valid: false, message: 'At least one field mapping is required' };
              }
              const hasMissingMappings = value.some((m: any) => !m.targetField || !m.sourceExpression);
              if (hasMissingMappings) {
                return { valid: false, message: 'All mappings must have both target field and source value' };
              }
              return { valid: true };
            }
          }
        }
      ]
    }
  ]
};

// ============================================================================
// Outlook Email Action Schema
// ============================================================================

/**
 * Configuration schema for Outlook Email node
 * 
 * Defines an action node that sends an email via Outlook
 * with support for variable insertion from workflow context.
 */
export const outlookEmailSchema: NodeConfigSchema = {
  nodeType: 'outlookEmail',
  displayName: 'Send Email (Outlook)',
  description: 'Send an email using Microsoft Outlook',
  icon: Mail,
  version: '1.0.0',
  tags: ['action', 'email', 'outlook', 'communication'],
  contextAware: true,

  sections: [
    // ========================================================================
    // Basic Configuration
    // ========================================================================
    {
      id: 'basic',
      title: 'Email Configuration',
      icon: Mail,
      defaultExpanded: true,
      description: 'Configure email recipients and content',
      fields: [
        {
          id: 'label',
          type: 'text',
          label: 'Node Label',
          placeholder: 'e.g., Send Welcome Email',
          helpText: 'Display name for this email action',
          defaultValue: 'Send Email',
          validation: {
            required: true,
            minLength: 3,
            maxLength: 100
          }
        },
        {
          id: 'to',
          type: 'text',
          label: 'To',
          placeholder: 'recipient@example.com',
          helpText: 'Email recipient(s). Separate multiple with commas or use variable picker.',
          validation: {
            required: true,
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Enter valid email address(es)'
          }
        },
        {
          id: 'cc',
          type: 'text',
          label: 'CC',
          placeholder: 'cc@example.com',
          helpText: 'Carbon copy recipients (optional)',
          validation: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Enter valid email address(es)'
          }
        },
        {
          id: 'bcc',
          type: 'text',
          label: 'BCC',
          placeholder: 'bcc@example.com',
          helpText: 'Blind carbon copy recipients (optional)',
          validation: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Enter valid email address(es)'
          }
        },
        {
          id: 'subject',
          type: 'text',
          label: 'Subject',
          placeholder: 'e.g., Welcome to {{customer.name}}',
          helpText: 'Email subject line. Use {{variable}} for dynamic content.',
          validation: {
            required: true,
            minLength: 1,
            maxLength: 200
          }
        },
        {
          id: 'body',
          type: 'textarea',
          label: 'Body',
          placeholder: 'Email content...\n\nUse {{variable}} for dynamic values.',
          helpText: 'Email body content. Supports plain text and variables.',
          rows: 10,
          validation: {
            required: true,
            minLength: 1
          }
        },
        {
          id: 'importance',
          type: 'select',
          label: 'Importance',
          helpText: 'Set email priority level',
          defaultValue: 'normal',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' }
          ]
        }
      ]
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
  formStepSingleSchema,
  formProcessSchema,
  createRecordSchema,
  outlookEmailSchema
];

// ============================================================================
// Auto-initialize registry
// ============================================================================

import { schemaRegistry } from './schemaRegistry';

// Initialize registry with all schemas on module load
schemaRegistry.initialize(allSchemas);
// Cache bust: 1771486119
