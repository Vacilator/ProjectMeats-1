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
import { Package, FileText, CheckSquare, Settings, Mail, Navigation, Database, Zap, Calendar, Webhook, Clock, FileSignature, Upload, Archive } from 'lucide-react';

// ============================================================================
// Form Node Schema (Phase E - 2026-02-19)
// ============================================================================

/**
 * Configuration schema for Form node (renamed from Form Step: Single)
 * 
 * Defines a single-page form for data collection that can be used standalone
 * or inside a Form Process container.
 * 
 * **Phase E Update (2026-02-19):**
 * - Renamed from 'formStepSingle' to 'form' for simplified naming
 * - Updated displayName from 'Form Step: Single' to 'Form'
 * - Backward compatibility maintained via schema registry aliases
 */
export const formSchema: NodeConfigSchema = {
  nodeType: 'form',
  displayName: 'Form',
  description: 'Single-page form for data collection',
  icon: FileText,
  version: '2.0.0',  // Updated for Phase E rename
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
    // Form Fields (Phase E.3: Cascade based on entity type)
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
          type: 'entity-field-picker',  // Phase E.3: Changed from 'field-mapping' to 'entity-field-picker'
          label: 'Fields',
          helpText: 'Select fields from the entity to include in your form. Fields will cascade based on the selected entity type.',
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
    },

    // ========================================================================
    // Form Builder (Phase 6)
    // ========================================================================
    {
      id: 'formBuilder',
      title: 'Form Builder',
      icon: Settings,
      defaultExpanded: false,
      description: 'Open the visual form builder for advanced field configuration',
      fields: [
        {
          id: '_formBuilderButton',
          type: 'button',
          label: '🛠️ Open Full Form Builder',
          helpText: 'Open the visual form builder to configure fields, validations, and field mappings',
          variant: 'primary',
          onClick: (nodeId: string, nodeData: any) => {
            // Dispatch custom event to open FormBuilder modal
            window.dispatchEvent(new CustomEvent('openFormBuilder', {
              detail: { nodeId, nodeData, nodeType: 'form' }
            }));
          }
        },
        {
          id: '_formBuilderInfo',
          type: 'info',
          content: 'The Form Builder provides a visual interface to configure fields, add validation rules, set up conditional logic, and define field mappings from upstream nodes.'
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
    },

    // ========================================================================
    // Form Builder (Phase 6)
    // ========================================================================
    {
      id: 'formBuilder',
      title: 'Form Builder',
      icon: Settings,
      defaultExpanded: false,
      description: 'Manage child form steps and configure the form process',
      fields: [
        {
          id: '_formBuilderButton',
          type: 'button',
          label: '🛠️ Open Full Form Builder',
          helpText: 'Open the visual form builder to manage form steps, configure navigation, and set up data flow',
          variant: 'primary',
          onClick: (nodeId: string, nodeData: any) => {
            // Dispatch custom event to open FormBuilder modal
            window.dispatchEvent(new CustomEvent('openFormBuilder', {
              detail: { nodeId, nodeData, nodeType: 'formProcessGroup' }
            }));
          }
        },
        {
          id: '_formBuilderInfo',
          type: 'info',
          content: 'The Form Builder allows you to visually manage all form steps within this container, set up navigation flow, and configure data mappings between steps.'
        }
      ]
    }
  ]
};

// ============================================================================
// Form Process Group Schema (Phase E.3)
// ============================================================================

/**
 * Configuration schema for Form Process Group node
 * 
 * Labeled container with vertical auto-layout for child steps.
 * Uses React Flow's native parent-child grouping pattern.
 * 
 * Phase E.3: Auto-layout, expand/collapse, selection grouping
 */
export const formProcessGroupSchema: NodeConfigSchema = {
  nodeType: 'formProcessGroup',
  displayName: 'Form Process Group',
  description: 'Labeled container with auto-layout for multi-step forms',
  icon: Package,
  version: '1.0.0',
  tags: ['form', 'container', 'group', 'multi-step', 'layout'],
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
      description: 'Basic information about this form group',
      fields: [
        {
          id: 'containerName',
          type: 'text',
          label: 'Group Name',
          placeholder: 'e.g., Customer Information Section',
          helpText: 'Display name for this form group',
          defaultValue: 'New Form Group',
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
          placeholder: 'Brief description of this form group...',
          helpText: 'Optional description to explain the purpose',
          rows: 3,
          validation: {
            maxLength: 500
          }
        },
        {
          id: 'isExpanded',
          type: 'toggle',
          label: 'Expanded by Default',
          helpText: 'Show child steps by default (vs. collapsed)',
          defaultValue: true
        }
      ]
    },

    // ========================================================================
    // Navigation & Behavior (shared with formProcess)
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
          id: 'skipOptionalSteps',
          type: 'toggle',
          label: 'Allow Skip Optional Steps',
          helpText: 'Users can skip steps marked as optional',
          defaultValue: false
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
 * 
 * Phase E Update (2026-02-19):
 * - Updated to use 'formSchema' as primary schema
 * - formStepSingleSchema exported as alias for backward compatibility
 */
export const allSchemas: NodeConfigSchema[] = [
  formSchema,  // NEW: Primary form schema (Phase E - 2026-02-19)
  formProcessSchema,
  formProcessGroupSchema,
  createRecordSchema,
  outlookEmailSchema,
  // Phase 2: Trigger and Document schemas (2026-02-21)
  triggerSchema,
  documentGenerateSchema,
  documentSignSchema,
  documentUploadSchema,
  documentStoreSchema,
];

// Export formStepSingleSchema as alias for backward compatibility
export const formStepSingleSchema = formSchema;

// ============================================================================
// Auto-initialize registry
// ============================================================================

import { schemaRegistry } from './schemaRegistry';

// Initialize registry with all schemas on module load
schemaRegistry.initialize(allSchemas);

// Phase E Fix (2026-02-19): Register backward compatibility aliases
// formStepSingle nodes should use the same schema as 'form' nodes
schemaRegistry.register({
  ...formSchema,
  nodeType: 'formStepSingle',
  displayName: 'Form (Legacy)',
  description: '[DEPRECATED] Use the "Form" node instead. This exists for backward compatibility only.',
}, true); // Allow overwrite

console.log('[Schema Registry] Registered backward compatibility: formStepSingle → formSchema');

// ============================================================================
// Phase 2: Trigger Node Schema (Unified Entry Point)
// ============================================================================

/**
 * Unified Trigger Node Schema
 * 
 * Single trigger node with cascading configuration based on selected type.
 * Supports: webhook, schedule, manual/quick-action, event, form-submit.
 * 
 * Created: 2026-02-21 - Phase 2: Trigger + Documents + Palette
 */
export const triggerSchema: NodeConfigSchema = {
  nodeType: 'trigger',
  displayName: 'Trigger',
  description: 'Start a workflow automatically or manually',
  icon: Zap,
  version: '1.0.0',
  tags: ['trigger', 'entry-point', 'automation'],
  contextAware: false, // Triggers are entry points, no upstream context

  sections: [
    {
      id: 'triggerType',
      title: 'Trigger Type',
      icon: Zap,
      defaultExpanded: true,
      description: 'Choose how this workflow should start',
      fields: [
        {
          id: 'type',
          type: 'select',
          label: 'Trigger Type',
          placeholder: 'Select trigger type...',
          helpText: 'How should this workflow be triggered?',
          required: true,
          options: [
            { value: 'manual', label: 'Manual / Quick Action', description: 'User clicks a button to start' },
            { value: 'webhook', label: 'Webhook', description: 'Receive data from external API' },
            { value: 'schedule', label: 'Schedule / Cron', description: 'Run on a time-based schedule' },
            { value: 'event', label: 'Database Event', description: 'Trigger on record create/update/delete' },
            { value: 'formSubmit', label: 'Form Submission', description: 'Start when a form is submitted' },
          ],
          defaultValue: 'manual',
          validation: [
            {
              type: 'required',
              message: 'Please select a trigger type'
            }
          ]
        },
      ]
    },
    
    // Webhook Configuration (conditional)
    {
      id: 'webhookConfig',
      title: 'Webhook Configuration',
      icon: Webhook,
      defaultExpanded: true,
      description: 'Configure webhook endpoint and authentication',
      visibilityCondition: {
        field: 'type',
        operator: 'equals',
        value: 'webhook'
      },
      fields: [
        {
          id: 'webhookUrl',
          type: 'text',
          label: 'Webhook URL',
          placeholder: 'Auto-generated on save',
          helpText: 'Unique URL for receiving webhook calls (generated automatically)',
          readOnly: true,
        },
        {
          id: 'webhookAuth',
          type: 'select',
          label: 'Authentication',
          options: [
            { value: 'none', label: 'None (Public)' },
            { value: 'token', label: 'Bearer Token' },
            { value: 'hmac', label: 'HMAC Signature' },
            { value: 'basic', label: 'Basic Auth' },
          ],
          defaultValue: 'token',
          helpText: 'Security method for incoming webhook requests',
          validation: [{ type: 'required', message: 'Select authentication method' }]
        },
        {
          id: 'webhookSecret',
          type: 'text',
          label: 'Secret / Token',
          placeholder: 'Auto-generated',
          helpText: 'Secret key for validating incoming requests (auto-generated)',
          readOnly: true,
          visibilityCondition: {
            field: 'webhookAuth',
            operator: 'notEquals',
            value: 'none'
          }
        },
        {
          id: 'webhookMethod',
          type: 'multiSelect',
          label: 'Allowed HTTP Methods',
          options: [
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'PATCH', label: 'PATCH' },
          ],
          defaultValue: ['POST'],
          helpText: 'Which HTTP methods should trigger the workflow',
        },
      ]
    },
    
    // Schedule Configuration (conditional)
    {
      id: 'scheduleConfig',
      title: 'Schedule Configuration',
      icon: Calendar,
      defaultExpanded: true,
      description: 'Configure when the workflow should run',
      visibilityCondition: {
        field: 'type',
        operator: 'equals',
        value: 'schedule'
      },
      fields: [
        {
          id: 'scheduleType',
          type: 'select',
          label: 'Schedule Type',
          options: [
            { value: 'simple', label: 'Simple (Every X minutes/hours/days)' },
            { value: 'cron', label: 'Cron Expression (Advanced)' },
          ],
          defaultValue: 'simple',
          validation: [{ type: 'required', message: 'Select schedule type' }]
        },
        {
          id: 'scheduleInterval',
          type: 'number',
          label: 'Interval',
          placeholder: 'e.g., 15',
          helpText: 'How often to run',
          defaultValue: 15,
          visibilityCondition: {
            field: 'scheduleType',
            operator: 'equals',
            value: 'simple'
          },
          validation: [
            { type: 'required', message: 'Interval is required' },
            { type: 'min', value: 1, message: 'Minimum interval is 1' }
          ]
        },
        {
          id: 'scheduleUnit',
          type: 'select',
          label: 'Unit',
          options: [
            { value: 'minutes', label: 'Minutes' },
            { value: 'hours', label: 'Hours' },
            { value: 'days', label: 'Days' },
            { value: 'weeks', label: 'Weeks' },
          ],
          defaultValue: 'minutes',
          visibilityCondition: {
            field: 'scheduleType',
            operator: 'equals',
            value: 'simple'
          },
        },
        {
          id: 'cronExpression',
          type: 'text',
          label: 'Cron Expression',
          placeholder: '0 0 * * *',
          helpText: 'Unix cron syntax (minute hour day month weekday)',
          visibilityCondition: {
            field: 'scheduleType',
            operator: 'equals',
            value: 'cron'
          },
          validation: [
            { type: 'required', message: 'Cron expression is required' },
            { type: 'pattern', value: '^[\\d\\*\\,\\-\\/\\s]+$', message: 'Invalid cron syntax' }
          ]
        },
        {
          id: 'timezone',
          type: 'select',
          label: 'Timezone',
          options: [
            { value: 'UTC', label: 'UTC' },
            { value: 'America/New_York', label: 'Eastern Time (US)' },
            { value: 'America/Chicago', label: 'Central Time (US)' },
            { value: 'America/Denver', label: 'Mountain Time (US)' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
            { value: 'Europe/London', label: 'London (GMT/BST)' },
            { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
          ],
          defaultValue: 'UTC',
          helpText: 'Timezone for schedule execution',
        },
      ]
    },
    
    // Event Configuration (conditional)
    {
      id: 'eventConfig',
      title: 'Event Configuration',
      icon: Database,
      defaultExpanded: true,
      description: 'Configure database event triggers',
      visibilityCondition: {
        field: 'type',
        operator: 'equals',
        value: 'event'
      },
      fields: [
        {
          id: 'eventEntity',
          type: 'entityType',
          label: 'Entity',
          placeholder: 'Select entity...',
          helpText: 'Which entity should trigger this workflow',
          required: true,
          validation: [{ type: 'required', message: 'Entity is required' }]
        },
        {
          id: 'eventTrigger',
          type: 'multiSelect',
          label: 'Trigger On',
          options: [
            { value: 'create', label: 'Record Created' },
            { value: 'update', label: 'Record Updated' },
            { value: 'delete', label: 'Record Deleted' },
          ],
          defaultValue: ['create'],
          helpText: 'Which actions should trigger the workflow',
          validation: [{ type: 'required', message: 'Select at least one trigger' }]
        },
        {
          id: 'eventCondition',
          type: 'conditionBuilder',
          label: 'Conditions (Optional)',
          helpText: 'Only trigger if record matches these conditions',
        },
      ]
    },
    
    // Form Submit Configuration (conditional)
    {
      id: 'formSubmitConfig',
      title: 'Form Submit Configuration',
      icon: FileText,
      defaultExpanded: true,
      description: 'Configure form submission trigger',
      visibilityCondition: {
        field: 'type',
        operator: 'equals',
        value: 'formSubmit'
      },
      fields: [
        {
          id: 'formId',
          type: 'formReference',
          label: 'Form',
          placeholder: 'Select form...',
          helpText: 'Which form submission should trigger this workflow',
          required: true,
          validation: [{ type: 'required', message: 'Form is required' }]
        },
      ]
    },
    
    // Manual/Quick Action Configuration (conditional)
    {
      id: 'manualConfig',
      title: 'Quick Action Configuration',
      icon: Zap,
      defaultExpanded: true,
      description: 'Configure manual trigger button',
      visibilityCondition: {
        field: 'type',
        operator: 'equals',
        value: 'manual'
      },
      fields: [
        {
          id: 'buttonLabel',
          type: 'text',
          label: 'Button Label',
          placeholder: 'e.g., Start Workflow',
          helpText: 'Label for the quick action button',
          defaultValue: 'Start Workflow',
          validation: [{ type: 'required', message: 'Button label is required' }]
        },
        {
          id: 'showInQuickActions',
          type: 'boolean',
          label: 'Show in Quick Actions Menu',
          helpText: 'Display this workflow in the top navigation quick actions dropdown',
          defaultValue: true,
        },
        {
          id: 'requireConfirmation',
          type: 'boolean',
          label: 'Require Confirmation',
          helpText: 'Ask user to confirm before starting the workflow',
          defaultValue: false,
        },
      ]
    },
  ]
};

// Register trigger schema
schemaRegistry.register(triggerSchema);
console.log('[Schema Registry] Registered triggerSchema');

// ============================================================================
// Phase 2: Document Node Schemas
// ============================================================================

/**
 * Generate Document Schema (PDF/Word from template)
 */
export const documentGenerateSchema: NodeConfigSchema = {
  nodeType: 'documentGenerate',
  displayName: 'Generate Document',
  description: 'Generate PDF or Word document from template',
  icon: FileText,
  version: '1.0.0',
  tags: ['document', 'pdf', 'template', 'generation'],
  contextAware: true,

  sections: [
    {
      id: 'template',
      title: 'Template Settings',
      icon: FileText,
      defaultExpanded: true,
      description: 'Configure document template and output format',
      fields: [
        {
          id: 'templateSource',
          type: 'select',
          label: 'Template Source',
          options: [
            { value: 'library', label: 'Template Library' },
            { value: 'upload', label: 'Upload Template' },
            { value: 'url', label: 'Template URL' },
          ],
          defaultValue: 'library',
          helpText: 'Where to load the document template from',
          validation: [{ type: 'required', message: 'Select template source' }]
        },
        {
          id: 'templateId',
          type: 'select',
          label: 'Template',
          placeholder: 'Select template...',
          helpText: 'Pre-configured document template',
          required: true,
          visibilityCondition: {
            field: 'templateSource',
            operator: 'equals',
            value: 'library'
          },
          // Options loaded dynamically from API
          validation: [{ type: 'required', message: 'Template is required' }]
        },
        {
          id: 'outputFormat',
          type: 'select',
          label: 'Output Format',
          options: [
            { value: 'pdf', label: 'PDF' },
            { value: 'docx', label: 'Word (DOCX)' },
            { value: 'html', label: 'HTML' },
          ],
          defaultValue: 'pdf',
          helpText: 'Format for generated document',
          validation: [{ type: 'required', message: 'Select output format' }]
        },
        {
          id: 'fileName',
          type: 'text',
          label: 'File Name',
          placeholder: 'e.g., invoice-{{orderId}}.pdf',
          helpText: 'Name for the generated file (supports variables)',
          validation: [
            { type: 'required', message: 'File name is required' },
            { type: 'pattern', value: '^[\\w\\-\\.\\{\\}]+$', message: 'Invalid file name format' }
          ]
        },
      ]
    },
    {
      id: 'dataBinding',
      title: 'Data Binding',
      icon: Database,
      defaultExpanded: false,
      description: 'Map workflow data to template fields',
      fields: [
        {
          id: 'fieldMappings',
          type: 'fieldMapping',
          label: 'Field Mappings',
          helpText: 'Map template variables to workflow data',
        },
      ]
    },
  ]
};

/**
 * Document Sign/Request Signature Schema
 */
export const documentSignSchema: NodeConfigSchema = {
  nodeType: 'documentSign',
  displayName: 'Request Signature',
  description: 'Request electronic signature on a document',
  icon: FileSignature,
  version: '1.0.0',
  tags: ['document', 'signature', 'e-sign', 'approval'],
  contextAware: true,

  sections: [
    {
      id: 'document',
      title: 'Document Settings',
      icon: FileText,
      defaultExpanded: true,
      description: 'Configure document to be signed',
      fields: [
        {
          id: 'documentSource',
          type: 'select',
          label: 'Document Source',
          options: [
            { value: 'upstream', label: 'From Previous Step' },
            { value: 'library', label: 'Document Library' },
            { value: 'url', label: 'Document URL' },
          ],
          defaultValue: 'upstream',
          helpText: 'Where to get the document for signing',
          validation: [{ type: 'required', message: 'Select document source' }]
        },
        {
          id: 'documentId',
          type: 'variablePicker',
          label: 'Document',
          placeholder: 'Select document from previous step...',
          helpText: 'Document to be signed',
          required: true,
          visibilityCondition: {
            field: 'documentSource',
            operator: 'equals',
            value: 'upstream'
          },
          validation: [{ type: 'required', message: 'Document is required' }]
        },
      ]
    },
    {
      id: 'signers',
      title: 'Signers',
      icon: FileSignature,
      defaultExpanded: true,
      description: 'Configure who needs to sign',
      fields: [
        {
          id: 'signerEmail',
          type: 'text',
          label: 'Signer Email',
          placeholder: 'e.g., {{customerEmail}}',
          helpText: 'Email address of person who needs to sign (supports variables)',
          required: true,
          validation: [
            { type: 'required', message: 'Signer email is required' },
            { type: 'email', message: 'Must be a valid email or variable' }
          ]
        },
        {
          id: 'signerName',
          type: 'text',
          label: 'Signer Name',
          placeholder: 'e.g., {{customerName}}',
          helpText: 'Full name of signer (supports variables)',
        },
        {
          id: 'deadline',
          type: 'number',
          label: 'Deadline (Days)',
          placeholder: '7',
          helpText: 'Number of days until signature request expires',
          defaultValue: 7,
          validation: [
            { type: 'min', value: 1, message: 'Minimum 1 day' },
            { type: 'max', value: 365, message: 'Maximum 365 days' }
          ]
        },
        {
          id: 'reminderFrequency',
          type: 'select',
          label: 'Reminder Frequency',
          options: [
            { value: 'none', label: 'No Reminders' },
            { value: 'daily', label: 'Daily' },
            { value: 'every3days', label: 'Every 3 Days' },
            { value: 'weekly', label: 'Weekly' },
          ],
          defaultValue: 'every3days',
          helpText: 'How often to send reminder emails',
        },
      ]
    },
  ]
};

/**
 * Document Upload Schema
 */
export const documentUploadSchema: NodeConfigSchema = {
  nodeType: 'documentUpload',
  displayName: 'Upload Document',
  description: 'Upload document to external service or storage',
  icon: Upload,
  version: '1.0.0',
  tags: ['document', 'upload', 'storage', 'integration'],
  contextAware: true,

  sections: [
    {
      id: 'source',
      title: 'Document Source',
      icon: FileText,
      defaultExpanded: true,
      description: 'Select document to upload',
      fields: [
        {
          id: 'documentSource',
          type: 'variablePicker',
          label: 'Document',
          placeholder: 'Select document from previous step...',
          helpText: 'Document to upload',
          required: true,
          validation: [{ type: 'required', message: 'Document is required' }]
        },
      ]
    },
    {
      id: 'destination',
      title: 'Upload Destination',
      icon: Upload,
      defaultExpanded: true,
      description: 'Configure where to upload the document',
      fields: [
        {
          id: 'service',
          type: 'select',
          label: 'Service',
          options: [
            { value: 's3', label: 'Amazon S3' },
            { value: 'gcs', label: 'Google Cloud Storage' },
            { value: 'azure', label: 'Azure Blob Storage' },
            { value: 'dropbox', label: 'Dropbox' },
            { value: 'onedrive', label: 'OneDrive' },
            { value: 'internal', label: 'Internal Storage' },
          ],
          defaultValue: 'internal',
          helpText: 'Storage service to upload to',
          validation: [{ type: 'required', message: 'Select service' }]
        },
        {
          id: 'folderPath',
          type: 'text',
          label: 'Folder Path',
          placeholder: 'e.g., /documents/{{year}}/',
          helpText: 'Destination folder (supports variables)',
        },
        {
          id: 'makePublic',
          type: 'boolean',
          label: 'Make Public',
          helpText: 'Generate public URL for the uploaded document',
          defaultValue: false,
        },
      ]
    },
  ]
};

/**
 * Document Store/Archive Schema
 */
export const documentStoreSchema: NodeConfigSchema = {
  nodeType: 'documentStore',
  displayName: 'Store Document',
  description: 'Save document to internal archive with metadata',
  icon: Archive,
  version: '1.0.0',
  tags: ['document', 'storage', 'archive', 'records'],
  contextAware: true,

  sections: [
    {
      id: 'document',
      title: 'Document Settings',
      icon: FileText,
      defaultExpanded: true,
      description: 'Configure document storage',
      fields: [
        {
          id: 'documentSource',
          type: 'variablePicker',
          label: 'Document',
          placeholder: 'Select document from previous step...',
          helpText: 'Document to store',
          required: true,
          validation: [{ type: 'required', message: 'Document is required' }]
        },
        {
          id: 'category',
          type: 'select',
          label: 'Category',
          options: [
            { value: 'invoice', label: 'Invoices' },
            { value: 'contract', label: 'Contracts' },
            { value: 'quote', label: 'Quotes' },
            { value: 'report', label: 'Reports' },
            { value: 'other', label: 'Other' },
          ],
          defaultValue: 'other',
          helpText: 'Document category for organization',
          validation: [{ type: 'required', message: 'Select category' }]
        },
        {
          id: 'tags',
          type: 'multiSelect',
          label: 'Tags',
          placeholder: 'Add tags...',
          helpText: 'Tags for searchability and filtering',
        },
        {
          id: 'relatedEntity',
          type: 'entityType',
          label: 'Related Entity (Optional)',
          placeholder: 'Link to entity...',
          helpText: 'Associate document with a specific entity record',
        },
        {
          id: 'relatedRecordId',
          type: 'variablePicker',
          label: 'Record ID',
          placeholder: 'Select record ID...',
          helpText: 'ID of the related entity record',
          visibilityCondition: {
            field: 'relatedEntity',
            operator: 'notEmpty',
          }
        },
      ]
    },
  ]
};

// Register document schemas
schemaRegistry.register(documentGenerateSchema);
schemaRegistry.register(documentSignSchema);
schemaRegistry.register(documentUploadSchema);
schemaRegistry.register(documentStoreSchema);

console.log('[Schema Registry] Registered document schemas (generate, sign, upload, store)');

// Cache bust: 1771488534
