/**
 * Node Configuration Schemas
 * 
 * Declarative configuration schemas for all node types.
 * Each schema defines the structure, fields, validation, and behavior
 * of a node's configuration panel.
 * 
 * Created: 2026-02-18
 * Phase: D.1 - Foundation
 * Updated: 2026-02-21 - Removed window.dispatchEvent (use FormBuilderContext instead)
 */

import { NodeConfigSchema } from './types';
import { schemaRegistry } from './schemaRegistry';
import { logger } from '@/utils/logger';

import { Package, FileText, CheckSquare, Settings, Mail, Navigation, Database, Zap, Calendar, Webhook, Clock, FileSignature, Upload, Archive, AlertCircle } from 'lucide-react';

/**
 * IMPORTANT: FormBuilder Integration
 * 
 * The onClick handlers for FormBuilder buttons should NOT dispatch window events.
 * Instead, they should use FormBuilderContext from the component consuming these schemas.
 * 
 * Pattern:
 * ```tsx
 * const { openFormBuilder } = useFormBuilderContext();
 * 
 * // In DynamicConfigPanel or NodeConfigPanelWithShadow:
 * if (field.type === 'button' && field.onClick) {
 *   field.onClick(nodeId, nodeData); // This will call the function below
 * }
 * ```
 * 
 * The onClick functions below are factories that RETURN a function expecting context.
 * The consuming component must wrap them to inject the FormBuilderContext.
 */

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
  displayName: 'Form Step',
  description: 'Single form step (page) for data collection',
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
          id: 'showCancelButton',
          type: 'toggle',
          label: 'Show Cancel Button',
          helpText: 'Display a cancel button alongside submit',
          defaultValue: false
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
          // METADATA for FormBuilder integration (processed by DynamicConfigPanel)
          metadata: {
            action: 'openFormBuilder',
            nodeType: 'form'
          },
          onClick: (nodeId: string, nodeData: any) => {
            // This onClick will be wrapped by DynamicConfigPanel to inject FormBuilderContext
            // See: DynamicConfigPanel.tsx for context injection
            logger.debug('[FormBuilder] Button clicked - context injection required');
            return { nodeId, nodeData, nodeType: 'form' };
          }
        },
        {
          id: '_formBuilderInfo',
          type: 'info',
          label: 'Information',
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
          required: true,
          validation: [
            { type: 'required', message: 'Container name is required' },
            { type: 'minLength', value: 3, message: 'Container name must be at least 3 characters' },
            { type: 'maxLength', value: 100, message: 'Container name must be at most 100 characters' }
          ]
        },
        {
          id: 'containerDescription',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Brief description of this form process...',
          helpText: 'Optional description to explain the purpose of this form',
          rows: 3,
          validation: [
            { type: 'maxLength', value: 500, message: 'Description must be at most 500 characters' }
          ]
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
          // METADATA for FormBuilder integration (processed by DynamicConfigPanel)
          metadata: {
            action: 'openFormBuilder',
            nodeType: 'formProcessGroup'
          },
          onClick: (nodeId: string, nodeData: any) => {
            // This onClick will be wrapped by DynamicConfigPanel to inject FormBuilderContext
            // See: DynamicConfigPanel.tsx for context injection
            logger.debug('[FormBuilder] Button clicked - context injection required');
            return { nodeId, nodeData, nodeType: 'formProcessGroup' };
          }
        },
        {
          id: '_formBuilderInfo',
          type: 'info',
          label: 'Information',
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
  displayName: 'Form Process (Legacy)',
  description: '[DEPRECATED] Legacy container type. Use Form (Book).',
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
          required: true,
          validation: [
            { type: 'required', message: 'Group name is required' },
            { type: 'minLength', value: 3, message: 'Group name must be at least 3 characters' },
            { type: 'maxLength', value: 100, message: 'Group name must be at most 100 characters' }
          ]
        },
        {
          id: 'containerDescription',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Brief description of this form group...',
          helpText: 'Optional description to explain the purpose',
          rows: 3,
          validation: [
            { type: 'maxLength', value: 500, message: 'Description must be at most 500 characters' }
          ]
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
// Singular Form (Book) Container Schema
// ============================================================================

/**
 * Schema for the singular Form container (Book & Pages).
 *
 * This is the canonical container type going forward.
 */
export const formBookSchema: NodeConfigSchema = {
  ...formProcessGroupSchema,
  nodeType: 'formBook',
  displayName: 'Form',
  description: 'Multi-step form container (Book) that groups Form Steps (Pages)',
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
          required: true,
          validation: [
            { type: 'required', message: 'Action label is required' },
            { type: 'minLength', value: 3, message: 'Action label must be at least 3 characters' },
            { type: 'maxLength', value: 100, message: 'Action label must be at most 100 characters' }
          ]
        },
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Optional description...',
          helpText: 'Brief explanation of what this action does',
          rows: 2,
          validation: [
            { type: 'maxLength', value: 300, message: 'Description must be at most 300 characters' }
          ]
        },
        {
          id: 'entity',
          type: 'entity-selector',
          label: 'Target Entity',
          placeholder: 'Select entity to create...',
          helpText: 'Choose which entity type to create a record for',
          required: true,
          validation: [
            { type: 'required', message: 'Target entity is required' }
          ]
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
      conditional: {
        field: 'entity',
        operator: 'isNotEmpty'
      },
      fields: [
        {
          id: 'fieldMappings',
          type: 'field-mapping',
          label: 'Field Mappings',
          helpText: 'Map values from upstream nodes to target entity fields',
          entityFieldId: 'entity',
          showAutoSuggest: true,
          required: true,
          validation: [
            { type: 'required', message: 'At least one field mapping is required' },
            {
              type: 'custom',
              message: 'All mappings must have both target field and source value',
              validator: (value: any) => {
                if (!value || value.length === 0) return true;
                const hasMissingMappings = value.some((m: any) => !m.targetField || !m.sourceExpression);
                return !hasMissingMappings;
              },
            },
          ]
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
          required: true,
          validation: [
            { type: 'required', message: 'Node label is required' },
            { type: 'minLength', value: 3, message: 'Node label must be at least 3 characters' },
            { type: 'maxLength', value: 100, message: 'Node label must be at most 100 characters' }
          ]
        },
        {
          id: 'to',
          type: 'text',
          label: 'To',
          placeholder: 'recipient@example.com',
          helpText: 'Email recipient(s). Separate multiple with commas or use variable picker.',
          required: true,
          validation: [
            { type: 'required', message: 'Recipient is required' },
            { type: 'regex', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter valid email address(es)' }
          ]
        },
        {
          id: 'cc',
          type: 'text',
          label: 'CC',
          placeholder: 'cc@example.com',
          helpText: 'Carbon copy recipients (optional)',
          validation: [
            { type: 'regex', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter valid email address(es)' }
          ]
        },
        {
          id: 'bcc',
          type: 'text',
          label: 'BCC',
          placeholder: 'bcc@example.com',
          helpText: 'Blind carbon copy recipients (optional)',
          validation: [
            { type: 'regex', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter valid email address(es)' }
          ]
        },
        {
          id: 'subject',
          type: 'text',
          label: 'Subject',
          placeholder: 'e.g., Welcome to {{customer.name}}',
          helpText: 'Email subject line. Use {{variable}} for dynamic content.',
          required: true,
          validation: [
            { type: 'required', message: 'Subject is required' },
            { type: 'minLength', value: 1, message: 'Subject must not be empty' },
            { type: 'maxLength', value: 200, message: 'Subject must be at most 200 characters' }
          ]
        },
        {
          id: 'body',
          type: 'textarea',
          label: 'Body',
          placeholder: 'Email content...\n\nUse {{variable}} for dynamic values.',
          helpText: 'Email body content. Supports plain text and variables.',
          rows: 10,
          required: true,
          validation: [
            { type: 'required', message: 'Body is required' },
            { type: 'minLength', value: 1, message: 'Body must not be empty' }
          ]
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
const buildAllSchemas = (): NodeConfigSchema[] => [
  // === CORE SCHEMAS (Phase 1-3) ===
  formSchema,  // NEW: Primary form step schema (Phase E - 2026-02-19)
  formProcessSchema,
  formBookSchema,
  formProcessGroupSchema,
  createRecordSchema,
  outlookEmailSchema,
  // Phase 2: Trigger and Document schemas (2026-02-21)
  // NOTE: These are registered later in this module. They are intentionally
  // excluded from this early list to avoid TDZ (const-before-init) issues.
  // Phase 3: Logic & Control Flow schemas (2026-02-21 - Quick Wins)
  conditionIfSchema,
  actionEmailSchema,
  endSuccessSchema,
  endErrorSchema,
  timerDelaySchema,
  
  // === EXTENDED SCHEMAS (Phase 4 - Agent C: Complete Config Coverage) ===
  // Form nodes
  formStepSchema,
  formFieldSchema,
  formSectionSchema,
  formReferenceSchema,
  formSignatureSchema,
  formFileUploadSchema,
  
  // Trigger nodes
  triggerManualSchema,
  triggerScheduleSchema,
  triggerWebhookSchema,
  triggerEventSchema,
  triggerFormSchema,
  
  // Logic nodes
  conditionSwitchSchema,
  conditionFilterSchema,
  
  // Action nodes
  actionHTTPSchema,
  actionSMSSchema,
  actionNotifySchema,
  actionScriptSchema,
  actionCreateRecordSchema,
  actionUpdateRecordSchema,
  actionDeleteRecordSchema,
  
  // Data nodes
  dataLookupSchema,
  dataMergeSchema,
  dataTransformSchema,
  
  // Variable nodes
  setVariableSchema,
  
  // Loop nodes
  loopForEachSchema,
  loopWhileSchema,
  
  // Wait/Pending nodes
  timerScheduleSchema,
  pendingApprovalSchema,
  pendingDocumentSchema,
  pendingPaymentSchema,
  pendingResponseSchema,
  
  // Document nodes
  documentMergeSchema,
  
  // Utility nodes
  groupSubflowSchema,
  noteCommentSchema,
  
  // Terminal nodes
  endCancelSchema,
  
  // Phase 7.4: Advanced Node Types (2026-02-27)
  parallelPathSchema,
  subWorkflowSchema,
];

// Export formStepSingleSchema as alias for backward compatibility
export const formStepSingleSchema = formSchema;

// ============================================================================
// Registry initialization
// ============================================================================

// NOTE: Registry initialization is deferred until end-of-module to avoid TDZ
// errors from schema constants declared later in this file.

// CRITICAL HOTFIX (2026-03-18): Defer all registry calls to bypass Vite/Rollup ES Module TDZ
// When index.ts re-exports cause evaluation order issues, schemaRegistry may not be
// instantiated yet. setTimeout pushes execution to next macro-task after all modules link.
setTimeout(() => {
  if (typeof schemaRegistry !== 'undefined') {
    // Phase E Fix (2026-02-19): Register backward compatibility aliases
    // formStepSingle nodes should use the same schema as 'form' nodes
    schemaRegistry.register({
      ...formSchema,
      nodeType: 'formStepSingle',
      displayName: 'Form (Legacy)',
      description: '[DEPRECATED] Use the "Form" node instead. This exists for backward compatibility only.',
    }, true); // Allow overwrite

    logger.debug('[Schema Registry] Registered backward compatibility: formStepSingle → formSchema');
  } else {
    console.error('[Schema Registry] CRITICAL: schemaRegistry still undefined after deferral at line 1013');
  }
}, 0);

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
      conditional: {
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
          conditional: {
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
      conditional: {
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
          conditional: {
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
          conditional: {
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
          conditional: {
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
      conditional: {
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
      conditional: {
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
      conditional: {
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
logger.debug('[Schema Registry] Registered triggerSchema');

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
          options: [
            {
              value: '__loading__',
              label: 'Loading Templates...',
              disabled: true,
            },
          ],
          conditional: {
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
          conditional: {
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
          conditional: {
            field: 'relatedEntity',
            operator: 'isNotEmpty',
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

logger.debug('[Schema Registry] Registered document schemas (generate, sign, upload, store)');

// ============================================================================
// Logic & Control Flow Schemas (2026-02-21 - Quick Wins)
// ============================================================================

/**
 * Condition If Schema
 * Simple if/then branching logic
 */
export const conditionIfSchema: NodeConfigSchema = {
  nodeType: 'conditionIf',
  displayName: 'Condition: If',
  description: 'Branch workflow based on condition (if/then/else)',
  icon: Zap,
  version: '1.0.0',
  tags: ['logic', 'condition', 'branching', 'if-then'],
  contextAware: true,

  sections: [
    {
      id: 'condition',
      title: 'Condition',
      icon: Zap,
      defaultExpanded: true,
      description: 'Define the condition to evaluate',
      fields: [
        {
          id: 'leftOperand',
          type: 'variablePicker',
          label: 'Left Value',
          placeholder: 'Select value or variable...',
          helpText: 'Value to compare (supports variables)',
          required: true,
          validation: [{ type: 'required', message: 'Left value is required' }]
        },
        {
          id: 'operator',
          type: 'select',
          label: 'Operator',
          required: true,
          options: [
            { value: 'equals', label: 'Equals (=)' },
            { value: 'notEquals', label: 'Not Equals (≠)' },
            { value: 'greaterThan', label: 'Greater Than (>)' },
            { value: 'lessThan', label: 'Less Than (<)' },
            { value: 'greaterThanOrEqual', label: 'Greater Than or Equal (≥)' },
            { value: 'lessThanOrEqual', label: 'Less Than or Equal (≤)' },
            { value: 'contains', label: 'Contains' },
            { value: 'notContains', label: 'Does Not Contain' },
            { value: 'startsWith', label: 'Starts With' },
            { value: 'endsWith', label: 'Ends With' },
            { value: 'isEmpty', label: 'Is Empty' },
            { value: 'isNotEmpty', label: 'Is Not Empty' },
          ],
          validation: [{ type: 'required', message: 'Operator is required' }]
        },
        {
          id: 'rightOperand',
          type: 'variablePicker',
          label: 'Right Value',
          placeholder: 'Select value or enter text...',
          helpText: 'Value to compare against',
          conditional: {
            field: 'operator',
            operator: 'notIn',
            value: ['isEmpty', 'isNotEmpty']
          }
        },
      ]
    },
    {
      id: 'paths',
      title: 'Execution Paths',
      icon: Navigation,
      defaultExpanded: false,
      description: 'Labels for true/false branches',
      fields: [
        {
          id: 'trueBranchLabel',
          type: 'text',
          label: 'True Branch Label',
          placeholder: 'e.g., Approved',
          defaultValue: 'True',
          helpText: 'Label for the "true" output connection'
        },
        {
          id: 'falseBranchLabel',
          type: 'text',
          label: 'False Branch Label',
          placeholder: 'e.g., Rejected',
          defaultValue: 'False',
          helpText: 'Label for the "false" output connection'
        },
      ]
    },
  ]
};

/**
 * Action Email Schema
 * Send email notifications
 */
export const actionEmailSchema: NodeConfigSchema = {
  nodeType: 'actionEmail',
  displayName: 'Action: Send Email',
  description: 'Send email notification or message',
  icon: Mail,
  version: '1.0.0',
  tags: ['action', 'email', 'notification', 'communication'],
  contextAware: true,

  sections: [
    {
      id: 'recipients',
      title: 'Recipients',
      icon: Mail,
      defaultExpanded: true,
      description: 'Email recipients configuration',
      fields: [
        {
          id: 'to',
          type: 'text',
          label: 'To',
          placeholder: 'user@example.com, {{customer.email}}',
          helpText: 'Recipient email addresses (comma-separated, supports variables)',
          required: true,
          validation: [{ type: 'required', message: 'At least one recipient is required' }]
        },
        {
          id: 'cc',
          type: 'text',
          label: 'CC',
          placeholder: 'Optional CC addresses',
          helpText: 'Carbon copy recipients (comma-separated)'
        },
        {
          id: 'bcc',
          type: 'text',
          label: 'BCC',
          placeholder: 'Optional BCC addresses',
          helpText: 'Blind carbon copy recipients (comma-separated)'
        },
      ]
    },
    {
      id: 'content',
      title: 'Message Content',
      icon: FileText,
      defaultExpanded: true,
      description: 'Email subject and body',
      fields: [
        {
          id: 'subject',
          type: 'text',
          label: 'Subject',
          placeholder: 'e.g., Order Confirmation {{order.id}}',
          helpText: 'Email subject line (supports variables)',
          required: true,
          validation: [{ type: 'required', message: 'Subject is required' }]
        },
        {
          id: 'body',
          type: 'textarea',
          label: 'Body',
          placeholder: 'Email body text (supports HTML and variables)...',
          helpText: 'Email message body (supports HTML and template variables)',
          required: true,
          rows: 10,
          validation: [{ type: 'required', message: 'Body is required' }]
        },
        {
          id: 'bodyType',
          type: 'select',
          label: 'Body Format',
          options: [
            { value: 'html', label: 'HTML' },
            { value: 'plain', label: 'Plain Text' },
          ],
          defaultValue: 'html',
          helpText: 'Email body format'
        },
      ]
    },
    {
      id: 'attachments',
      title: 'Attachments (Optional)',
      icon: Upload,
      defaultExpanded: false,
      description: 'Add file attachments',
      fields: [
        {
          id: 'attachments',
          type: 'variablePicker',
          label: 'Attachments',
          placeholder: 'Select files from previous steps...',
          helpText: 'Files to attach (from document nodes or file uploads)',
          multiple: true,
        },
      ]
    },
  ]
};

/**
 * End Success Schema
 * Successful workflow termination
 */
export const endSuccessSchema: NodeConfigSchema = {
  nodeType: 'endSuccess',
  displayName: 'End: Success',
  description: 'Mark workflow as successfully completed',
  icon: CheckSquare,
  version: '1.0.0',
  tags: ['terminal', 'end', 'success', 'completion'],
  contextAware: true,

  sections: [
    {
      id: 'completion',
      title: 'Completion Details',
      icon: CheckSquare,
      defaultExpanded: true,
      description: 'Success message and status',
      fields: [
        {
          id: 'successMessage',
          type: 'textarea',
          label: 'Success Message',
          placeholder: 'Workflow completed successfully',
          helpText: 'Message to display or log on completion',
          defaultValue: 'Workflow completed successfully',
          rows: 3,
        },
        {
          id: 'notifyUser',
          type: 'boolean',
          label: 'Notify User',
          helpText: 'Send success notification to workflow initiator',
          defaultValue: true,
        },
        {
          id: 'returnData',
          type: 'variablePicker',
          label: 'Return Data (Optional)',
          placeholder: 'Select data to return...',
          helpText: 'Data to return as workflow result',
          multiple: true,
        },
      ]
    },
  ]
};

/**
 * End Error Schema
 * Failed workflow termination
 */
export const endErrorSchema: NodeConfigSchema = {
  nodeType: 'endError',
  displayName: 'End: Error',
  description: 'Mark workflow as failed with error',
  icon: AlertCircle,
  version: '1.0.0',
  tags: ['terminal', 'end', 'error', 'failure'],
  contextAware: true,

  sections: [
    {
      id: 'error',
      title: 'Error Details',
      icon: AlertCircle,
      defaultExpanded: true,
      description: 'Error message and handling',
      fields: [
        {
          id: 'errorMessage',
          type: 'textarea',
          label: 'Error Message',
          placeholder: 'Workflow failed: ...',
          helpText: 'Error message to display or log',
          required: true,
          rows: 3,
          validation: [{ type: 'required', message: 'Error message is required' }]
        },
        {
          id: 'errorCode',
          type: 'text',
          label: 'Error Code (Optional)',
          placeholder: 'e.g., ERR_VALIDATION_001',
          helpText: 'Unique error code for tracking and debugging',
        },
        {
          id: 'notifyAdmin',
          type: 'boolean',
          label: 'Notify Administrator',
          helpText: 'Send error notification to system administrators',
          defaultValue: true,
        },
        {
          id: 'retryable',
          type: 'boolean',
          label: 'Retryable',
          helpText: 'Allow workflow to be retried after failure',
          defaultValue: false,
        },
      ]
    },
  ]
};

/**
 * Timer Delay Schema
 * Wait/sleep for specified duration
 */
export const timerDelaySchema: NodeConfigSchema = {
  nodeType: 'timerDelay',
  displayName: 'Timer: Delay',
  description: 'Wait for a specified duration before continuing',
  icon: Clock,
  version: '1.0.0',
  tags: ['timer', 'delay', 'wait', 'sleep', 'pause'],
  contextAware: true,

  sections: [
    {
      id: 'delay',
      title: 'Delay Configuration',
      icon: Clock,
      defaultExpanded: true,
      description: 'Set wait duration',
      fields: [
        {
          id: 'duration',
          type: 'number',
          label: 'Duration',
          placeholder: '5',
          helpText: 'How long to wait',
          required: true,
          min: 1,
          validation: [
            { type: 'required', message: 'Duration is required' },
            { type: 'min', value: 1, message: 'Duration must be at least 1' }
          ]
        },
        {
          id: 'unit',
          type: 'select',
          label: 'Unit',
          options: [
            { value: 'seconds', label: 'Seconds' },
            { value: 'minutes', label: 'Minutes' },
            { value: 'hours', label: 'Hours' },
            { value: 'days', label: 'Days' },
          ],
          defaultValue: 'minutes',
          required: true,
        },
        {
          id: 'skipOnRetry',
          type: 'boolean',
          label: 'Skip on Retry',
          helpText: 'Skip this delay if workflow is retried',
          defaultValue: false,
        },
      ]
    },
  ]
};

// ============================================================================
// Phase 4: Universal Schemas for All Remaining Node Types (2026-02-23)
// ============================================================================

/**
 * CRITICAL FIX: Register schemas for ALL node types to prevent
 * "No configuration schema found" errors.
 * 
 * This section provides basic schemas for node types that don't have
 * dedicated advanced schemas yet. Each schema provides:
 * - Name and description fields (minimum viable config)
 * - Consistent UI (prevents errors)
 * - Extensible structure (can be enhanced later)
 */

// === FORM NODES ===

const formStepSchema: NodeConfigSchema = {
  nodeType: 'formStep',
  displayName: 'Form Step',
  description: 'Single step within a multi-step form. Fully supported for new and existing workflows.',
  icon: FileText,
  version: '1.1.1',
  tags: ['form', 'step'],
  contextAware: true,
  sections: [
    {
      id: 'basic',
      title: 'Basic Properties',
      icon: Package,
      defaultExpanded: true,
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Step Name',
          placeholder: 'e.g., Customer Information',
          required: true,
          validation: [
            { type: 'required', message: 'Step name is required' },
            { type: 'minLength', value: 3, message: 'Name must be at least 3 characters' }
          ]
        },
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Describe this form step...',
          helpText: 'Optional description for documentation'
        },
      ]
    },
    {
      id: 'entity',
      title: 'Entity Configuration',
      icon: FileText,
      defaultExpanded: true,
      description: 'Select the entity type this step will create or edit',
      fields: [
        {
          id: 'entityType',
          type: 'entity-selector',
          label: 'Entity Type',
          placeholder: 'Select an entity...',
          helpText: 'Choose the data model this step interacts with',
          required: true,
          validation: [
            { type: 'required', message: 'Entity type is required' }
          ]
        },
      ]
    },
    {
      id: 'fields',
      title: 'Form Fields',
      icon: FileText,
      defaultExpanded: true,
      description: 'Select which fields appear in this step',
      conditional: {
        field: 'entityType',
        operator: 'isNotEmpty'
      },
      fields: [
        {
          id: 'fields',
          type: 'entity-field-picker',
          label: 'Fields',
          helpText: 'Select fields from the entity to include in your form step.',
          defaultValue: []
        },
        {
          id: 'fieldLayout',
          type: 'select',
          label: 'Field Layout',
          helpText: 'How should fields be arranged visually?',
          defaultValue: 'single-column',
          options: [
            { value: 'single-column', label: 'Single Column' },
            { value: 'two-column', label: 'Two Columns' },
            { value: 'auto', label: 'Auto' }
          ]
        }
      ]
    }
  ]
};

const formFieldSchema: NodeConfigSchema = {
  nodeType: 'formField',
  displayName: 'Form Field',
  description: 'Individual form field element with advanced validation and conditional logic',
  icon: FileText,
  version: '2.0.0',
  tags: ['form', 'field', 'input'],
  contextAware: false,
  sections: [
    {
      id: 'field',
      title: 'Field Configuration',
      icon: Settings,
      defaultExpanded: true,
      fields: [
        {
          id: 'label',
          type: 'text',
          label: 'Field Label',
          placeholder: 'e.g., Email Address',
          required: true,
          validation: [
            { type: 'required', message: 'Field label is required' },
            { type: 'minLength', value: 2, message: 'Label must be at least 2 characters' }
          ]
        },
        {
          id: 'fieldName',
          type: 'text',
          label: 'Field Name (Key)',
          placeholder: 'e.g., email',
          helpText: 'Internal field name used for data storage (no spaces, lowercase)',
          required: true,
          validation: [
            { type: 'required', message: 'Field name is required' },
            { type: 'pattern', value: '^[a-z][a-z0-9_]*$', message: 'Must start with lowercase letter, only lowercase, numbers, and underscores allowed' }
          ]
        },
        {
          id: 'fieldType',
          type: 'select',
          label: 'Field Type',
          options: [
            { value: 'text', label: 'Text', description: 'Single line text input' },
            { value: 'email', label: 'Email', description: 'Email address with validation' },
            { value: 'number', label: 'Number', description: 'Numeric input' },
            { value: 'tel', label: 'Phone', description: 'Phone number input' },
            { value: 'url', label: 'URL', description: 'Website URL' },
            { value: 'date', label: 'Date', description: 'Date picker' },
            { value: 'datetime', label: 'Date & Time', description: 'Date and time picker' },
            { value: 'time', label: 'Time', description: 'Time picker' },
            { value: 'select', label: 'Dropdown', description: 'Single selection dropdown' },
            { value: 'multiselect', label: 'Multi-select', description: 'Multiple selection dropdown' },
            { value: 'radio', label: 'Radio Buttons', description: 'Single selection from list' },
            { value: 'checkbox', label: 'Checkbox', description: 'Single checkbox' },
            { value: 'checkbox-group', label: 'Checkbox Group', description: 'Multiple checkboxes' },
            { value: 'textarea', label: 'Text Area', description: 'Multi-line text input' },
            { value: 'file', label: 'File Upload', description: 'File upload field' },
            { value: 'color', label: 'Color Picker', description: 'Color selection' },
          ],
          defaultValue: 'text',
          required: true,
        },
        {
          id: 'placeholder',
          type: 'text',
          label: 'Placeholder',
          placeholder: 'e.g., Enter your email...',
          helpText: 'Hint text shown when field is empty'
        },
        {
          id: 'helpText',
          type: 'textarea',
          label: 'Help Text',
          placeholder: 'Additional guidance for users...',
          helpText: 'Helpful instructions displayed below the field'
        },
        {
          id: 'defaultValue',
          type: 'text',
          label: 'Default Value',
          placeholder: 'Default value',
          helpText: 'Pre-filled value when form loads'
        }
      ]
    },
    {
      id: 'validation',
      title: 'Validation Rules',
      icon: CheckSquare,
      collapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: 'required',
          type: 'toggle',
          label: 'Required Field',
          helpText: 'User must fill this field before submitting',
          defaultValue: false,
        },
        {
          id: 'minLength',
          type: 'number',
          label: 'Minimum Length',
          placeholder: 'e.g., 3',
          helpText: 'Minimum number of characters',
          conditional: {
            field: 'fieldType',
            operator: 'in',
            value: ['text', 'textarea', 'email', 'url', 'tel']
          }
        },
        {
          id: 'maxLength',
          type: 'number',
          label: 'Maximum Length',
          placeholder: 'e.g., 100',
          helpText: 'Maximum number of characters',
          conditional: {
            field: 'fieldType',
            operator: 'in',
            value: ['text', 'textarea', 'email', 'url', 'tel']
          }
        },
        {
          id: 'min',
          type: 'number',
          label: 'Minimum Value',
          placeholder: 'e.g., 0',
          helpText: 'Minimum numeric value',
          conditional: {
            field: 'fieldType',
            operator: 'equals',
            value: 'number'
          }
        },
        {
          id: 'max',
          type: 'number',
          label: 'Maximum Value',
          placeholder: 'e.g., 100',
          helpText: 'Maximum numeric value',
          conditional: {
            field: 'fieldType',
            operator: 'equals',
            value: 'number'
          }
        },
        {
          id: 'pattern',
          type: 'text',
          label: 'Custom Pattern (Regex)',
          placeholder: 'e.g., ^[A-Z]{2}[0-9]{4}$',
          helpText: 'Regular expression for custom validation'
        },
        {
          id: 'customValidationMessage',
          type: 'text',
          label: 'Custom Error Message',
          placeholder: 'e.g., Please enter a valid format',
          helpText: 'Error message shown when validation fails'
        }
      ]
    },
    {
      id: 'options',
      title: 'Field Options',
      icon: Package,
      collapsible: true,
      defaultExpanded: false,
      description: 'Configure options for dropdown, radio, and checkbox fields',
      conditional: {
        field: 'fieldType',
        operator: 'in',
        value: ['select', 'multiselect', 'radio', 'checkbox-group']
      },
      fields: [
        {
          id: 'options',
          type: 'nested-children',
          label: 'Options',
          helpText: 'Add options for this field',
          defaultValue: [],
          itemSchema: {
            fields: [
              { id: 'value', type: 'text', label: 'Value', required: true },
              { id: 'label', type: 'text', label: 'Label', required: true },
              { id: 'disabled', type: 'toggle', label: 'Disabled', defaultValue: false }
            ]
          }
        },
        {
          id: 'allowCustomOption',
          type: 'toggle',
          label: 'Allow Custom Input',
          helpText: 'Let users enter their own value',
          defaultValue: false
        }
      ]
    },
    {
      id: 'advanced',
      title: 'Advanced Settings',
      icon: Settings,
      collapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: 'disabled',
          type: 'toggle',
          label: 'Disabled',
          helpText: 'Field is visible but not editable',
          defaultValue: false
        },
        {
          id: 'hidden',
          type: 'toggle',
          label: 'Hidden',
          helpText: 'Field is not visible to users',
          defaultValue: false
        },
        {
          id: 'readonly',
          type: 'toggle',
          label: 'Read Only',
          helpText: 'Field is visible and selectable but not editable',
          defaultValue: false
        },
        {
          id: 'autoComplete',
          type: 'text',
          label: 'Auto Complete',
          placeholder: 'e.g., email, tel, name',
          helpText: 'Browser autocomplete hint'
        }
      ]
    }
  ]
};

const formSectionSchema: NodeConfigSchema = {
  nodeType: 'formSection',
  displayName: 'Form Section',
  description: 'Group form fields into sections',
  icon: Package,
  version: '1.0.0',
  tags: ['form', 'layout'],
  contextAware: false,
  sections: [
    {
      id: 'section',
      title: 'Section Properties',
      icon: Package,
      defaultExpanded: true,
      fields: [
        {
          id: 'title',
          type: 'text',
          label: 'Section Title',
          placeholder: 'e.g., Contact Information',
          required: true,
        },
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Optional section description...',
        },
      ]
    }
  ]
};

const formReferenceSchema: NodeConfigSchema = {
  nodeType: 'formReference',
  displayName: 'Form Reference',
  description: 'Reference to another form definition',
  icon: Navigation,
  version: '1.0.0',
  tags: ['form', 'reference'],
  contextAware: true,
  sections: [
    {
      id: 'reference',
      title: 'Form Reference',
      icon: Navigation,
      defaultExpanded: true,
      fields: [
        {
          id: 'formId',
          type: 'text',
          label: 'Form ID',
          placeholder: 'Enter form ID to reference...',
          required: true,
        },
        {
          id: 'passData',
          type: 'boolean',
          label: 'Pass Data to Referenced Form',
          defaultValue: true,
        },
      ]
    }
  ]
};

const formSignatureSchema: NodeConfigSchema = {
  nodeType: 'formSignature',
  displayName: 'Signature Field',
  description: 'Capture digital signature',
  icon: FileSignature,
  version: '1.0.0',
  tags: ['form', 'signature'],
  contextAware: false,
  sections: [
    {
      id: 'signature',
      title: 'Signature Configuration',
      icon: FileSignature,
      defaultExpanded: true,
      fields: [
        {
          id: 'label',
          type: 'text',
          label: 'Signature Label',
          placeholder: 'e.g., Customer Signature',
          required: true,
        },
        {
          id: 'required',
          type: 'boolean',
          label: 'Required',
          defaultValue: true,
        },
      ]
    }
  ]
};

const formFileUploadSchema: NodeConfigSchema = {
  nodeType: 'formFileUpload',
  displayName: 'File Upload',
  description: 'Upload file(s) in form',
  icon: Upload,
  version: '1.0.0',
  tags: ['form', 'upload'],
  contextAware: false,
  sections: [
    {
      id: 'upload',
      title: 'Upload Configuration',
      icon: Upload,
      defaultExpanded: true,
      fields: [
        {
          id: 'label',
          type: 'text',
          label: 'Upload Label',
          placeholder: 'e.g., Attach Documents',
          required: true,
        },
        {
          id: 'multiple',
          type: 'boolean',
          label: 'Allow Multiple Files',
          defaultValue: false,
        },
        {
          id: 'maxSize',
          type: 'text',
          label: 'Max File Size (MB)',
          placeholder: 'e.g., 10',
          defaultValue: '10',
        },
      ]
    }
  ]
};

const formMultiStepContainerSchema: NodeConfigSchema = {
  nodeType: 'formMultiStepContainer',
  displayName: 'Multi-Step Form Container',
  description: 'Container for multi-page forms',
  icon: Package,
  version: '1.0.0',
  tags: ['form', 'container'],
  contextAware: false,
  sections: [
    {
      id: 'container',
      title: 'Container Properties',
      icon: Package,
      defaultExpanded: true,
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Container Name',
          placeholder: 'e.g., Customer Onboarding',
          required: true,
        },
        {
          id: 'showProgress',
          type: 'boolean',
          label: 'Show Progress Indicator',
          defaultValue: true,
        },
      ]
    }
  ]
};

// === TRIGGER NODES ===

const triggerManualSchema: NodeConfigSchema = {
  nodeType: 'triggerManual',
  displayName: 'Manual Trigger',
  description: 'User clicks button to start workflow',
  icon: Zap,
  version: '1.0.0',
  tags: ['trigger', 'manual'],
  contextAware: false,
  sections: [
    {
      id: 'trigger',
      title: 'Trigger Configuration',
      icon: Zap,
      defaultExpanded: true,
      fields: [
        {
          id: 'buttonLabel',
          type: 'text',
          label: 'Button Label',
          placeholder: 'e.g., Start Workflow',
          defaultValue: 'Start',
        },
        {
          id: 'confirmationRequired',
          type: 'boolean',
          label: 'Require Confirmation',
          defaultValue: false,
        },
      ]
    }
  ]
};

const triggerScheduleSchema: NodeConfigSchema = {
  nodeType: 'triggerSchedule',
  displayName: 'Schedule Trigger',
  description: 'Run workflow on a schedule',
  icon: Clock,
  version: '2.0.0',
  tags: ['trigger', 'schedule'],
  contextAware: false,
  sections: [
    {
      id: 'schedule',
      title: 'Schedule Configuration',
      icon: Clock,
      defaultExpanded: true,
      fields: [
        {
          id: 'scheduleMode',
          type: 'select',
          label: 'Mode',
          options: [
            { value: 'friendly', label: 'Simple (Recommended)' },
            { value: 'cron', label: 'Cron (Advanced)' },
          ],
          defaultValue: 'friendly',
          helpText: 'Use the simple scheduler unless you need a custom cron expression.',
          validation: [{ type: 'required', message: 'Select a mode' }],
        },
        {
          id: 'frequency',
          type: 'select',
          label: 'Frequency',
          options: [
            { value: 'hourly', label: 'Hourly' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ],
          defaultValue: 'daily',
          required: true,
          conditional: { field: 'scheduleMode', operator: 'equals', value: 'friendly' },
          validation: [{ type: 'required', message: 'Select a frequency' }],
        },
        {
          id: 'atTime',
          type: 'time',
          label: 'Time',
          placeholder: '09:00',
          defaultValue: '09:00',
          required: true,
          conditional: { field: 'scheduleMode', operator: 'equals', value: 'friendly' },
          helpText: 'For hourly schedules, only the minutes are used.',
          validation: [{ type: 'required', message: 'Time is required' }],
        },
        {
          id: 'daysOfWeek',
          type: 'multiselect',
          label: 'Days of Week',
          options: [
            { value: 'MON', label: 'Monday' },
            { value: 'TUE', label: 'Tuesday' },
            { value: 'WED', label: 'Wednesday' },
            { value: 'THU', label: 'Thursday' },
            { value: 'FRI', label: 'Friday' },
            { value: 'SAT', label: 'Saturday' },
            { value: 'SUN', label: 'Sunday' },
          ],
          defaultValue: ['MON'],
          required: true,
          conditional: {
            logic: 'AND',
            conditions: [
              { field: 'scheduleMode', operator: 'equals', value: 'friendly' },
              { field: 'frequency', operator: 'equals', value: 'weekly' },
            ],
          },
          validation: [{ type: 'required', message: 'Select at least one day' }],
        },
        {
          id: 'dayOfMonth',
          type: 'number',
          label: 'Day of Month',
          placeholder: '1',
          defaultValue: 1,
          required: true,
          conditional: {
            logic: 'AND',
            conditions: [
              { field: 'scheduleMode', operator: 'equals', value: 'friendly' },
              { field: 'frequency', operator: 'equals', value: 'monthly' },
            ],
          },
          validation: [
            { type: 'required', message: 'Day of month is required' },
            { type: 'min', value: 1, message: 'Minimum is 1' },
            { type: 'max', value: 31, message: 'Maximum is 31' },
          ],
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
          helpText: 'Used for display; actual execution timezone depends on scheduler support.',
        },
        {
          id: 'cronExpression',
          type: 'text',
          label: 'Cron Expression',
          placeholder: '0 9 * * 1-5',
          helpText: 'Generated automatically in Simple mode. In Cron mode, you can edit directly.',
          conditional: {
            logic: 'OR',
            conditions: [
              { field: 'scheduleMode', operator: 'equals', value: 'cron' },
              { field: 'showAdvancedCron', operator: 'equals', value: true },
            ],
          },
          validation: [
            { type: 'required', message: 'Cron expression is required' },
            { type: 'pattern', value: '^[^\n\r]+$', message: 'Invalid cron expression' },
          ],
        },
        {
          id: 'showAdvancedCron',
          type: 'toggle',
          label: 'Show Cron Preview',
          defaultValue: false,
          conditional: { field: 'scheduleMode', operator: 'equals', value: 'friendly' },
        },
      ],
    },
  ],
};

const triggerWebhookSchema: NodeConfigSchema = {
  nodeType: 'triggerWebhook',
  displayName: 'Webhook Trigger',
  description: 'Receive data from external API',
  icon: Webhook,
  version: '1.0.0',
  tags: ['trigger', 'webhook'],
  contextAware: false,
  sections: [
    {
      id: 'webhook',
      title: 'Webhook Configuration',
      icon: Webhook,
      defaultExpanded: true,
      fields: [
        {
          id: 'path',
          type: 'text',
          label: 'Webhook Path',
          placeholder: '/webhooks/my-webhook',
          required: true,
        },
        {
          id: 'authentication',
          type: 'select',
          label: 'Authentication',
          options: [
            { value: 'none', label: 'None' },
            { value: 'token', label: 'Bearer Token' },
            { value: 'basic', label: 'Basic Auth' },
          ],
          defaultValue: 'none',
        },
      ]
    }
  ]
};

const triggerEventSchema: NodeConfigSchema = {
  nodeType: 'triggerEvent',
  displayName: 'Event Trigger',
  description: 'Trigger on database events',
  icon: Zap,
  version: '1.1.0',
  tags: ['trigger', 'event'],
  contextAware: false,
  sections: [
    {
      id: 'event',
      title: 'Event Configuration',
      icon: Zap,
      defaultExpanded: true,
      fields: [
        {
          id: 'entityType',
          type: 'entityType',
          label: 'Entity',
          placeholder: 'Select entity...',
          helpText: 'Select which business entity should trigger this workflow',
          required: true,
          validation: [{ type: 'required', message: 'Entity is required' }],
        },
        {
          id: 'eventType',
          type: 'select',
          label: 'Event Type',
          options: [
            { value: 'create', label: 'Created' },
            { value: 'update', label: 'Updated' },
            { value: 'delete', label: 'Deleted' },
            // Backward compatibility for older saved workflows
            { value: 'created', label: 'Created (legacy)' },
            { value: 'updated', label: 'Updated (legacy)' },
            { value: 'deleted', label: 'Deleted (legacy)' },
          ],
          required: true,
          validation: [{ type: 'required', message: 'Event type is required' }],
        },
      ]
    }
  ]
};

const triggerFormSchema: NodeConfigSchema = {
  nodeType: 'triggerForm',
  displayName: 'Form Submit Trigger',
  description: 'Trigger on form submission',
  icon: FileText,
  version: '1.0.0',
  tags: ['trigger', 'form'],
  contextAware: false,
  sections: [
    {
      id: 'form',
      title: 'Form Trigger',
      icon: FileText,
      defaultExpanded: true,
      fields: [
        {
          id: 'formId',
          type: 'text',
          label: 'Form ID',
          placeholder: 'ID of form to watch...',
          required: true,
        },
      ]
    }
  ]
};

// === LOGIC & CONDITION NODES ===

const conditionSwitchSchema: NodeConfigSchema = {
  nodeType: 'conditionSwitch',
  displayName: 'Condition (If/Then)',
  description: 'Branch workflow based on conditional logic with visual rule builder',
  icon: Navigation,
  version: '2.0.0',
  tags: ['logic', 'condition', 'if', 'branching'],
  contextAware: true,
  sections: [
    {
      id: 'condition-rules',
      title: 'Condition Rules',
      icon: Navigation,
      defaultExpanded: true,
      description: 'Define conditions using visual rule builder',
      fields: [
        {
          id: 'rules',
          type: 'ruleBuilder',
          label: 'If...',
          helpText: 'Build conditions using AND/OR logic. Supports upstream field selection.',
          required: true,
          config: {
            operators: [
              { value: 'equals', label: 'equals', symbol: '=' },
              { value: 'notEquals', label: 'does not equal', symbol: '≠' },
              { value: 'contains', label: 'contains', symbol: '∋' },
              { value: 'notContains', label: 'does not contain', symbol: '∌' },
              { value: 'startsWith', label: 'starts with', symbol: '⊳' },
              { value: 'endsWith', label: 'ends with', symbol: '⊲' },
              { value: 'greaterThan', label: 'greater than', symbol: '>' },
              { value: 'lessThan', label: 'less than', symbol: '<' },
              { value: 'greaterThanOrEqual', label: 'greater than or equal', symbol: '≥' },
              { value: 'lessThanOrEqual', label: 'less than or equal', symbol: '≤' },
              { value: 'isEmpty', label: 'is empty', symbol: '∅' },
              { value: 'isNotEmpty', label: 'is not empty', symbol: '≠∅' },
              { value: 'isTrue', label: 'is true', symbol: '✓' },
              { value: 'isFalse', label: 'is false', symbol: '✗' },
            ],
            allowGroups: true,
            allowUpstreamFields: true,
            defaultLogic: 'AND',
          }
        },
        {
          id: 'logic',
          type: 'select',
          label: 'Logic Type',
          options: [
            { value: 'AND', label: 'AND - All conditions must be true' },
            { value: 'OR', label: 'OR - At least one condition must be true' },
          ],
          defaultValue: 'AND',
          helpText: 'How to combine multiple conditions'
        },
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Describe what this condition checks...',
          helpText: 'Optional description for documentation',
          rows: 2,
        },
      ]
    },
    {
      id: 'condition-branches',
      title: 'Branch Paths',
      icon: Navigation,
      defaultExpanded: true,
      description: 'Configure what happens when condition is true or false',
      fields: [
        {
          id: 'trueBranchLabel',
          type: 'text',
          label: 'True Branch Label',
          placeholder: 'When condition is true',
          defaultValue: 'True',
          helpText: 'Label for the true path (shown on edge)'
        },
        {
          id: 'falseBranchLabel',
          type: 'text',
          label: 'False Branch Label',
          placeholder: 'When condition is false',
          defaultValue: 'False',
          helpText: 'Label for the false path (shown on edge)'
        },
        {
          id: 'elseBranchEnabled',
          type: 'checkbox',
          label: 'Enable Else Branch',
          defaultValue: true,
          helpText: 'Allow alternative path when condition is false'
        },
      ]
    }
  ]
};

const conditionFilterSchema: NodeConfigSchema = {
  nodeType: 'conditionFilter',
  displayName: 'Filter Condition',
  description: 'Filter items based on criteria',
  icon: Navigation,
  version: '1.0.0',
  tags: ['logic', 'filter'],
  contextAware: true,
  sections: [
    {
      id: 'filter',
      title: 'Filter Configuration',
      icon: Navigation,
      defaultExpanded: true,
      fields: [
        {
          id: 'criteria',
          type: 'textarea',
          label: 'Filter Criteria',
          placeholder: 'Define filter rules...',
          required: true,
        },
      ]
    }
  ]
};

// === ACTION NODES ===

const actionHTTPSchema: NodeConfigSchema = {
  nodeType: 'actionHTTP',
  displayName: 'HTTP Request',
  description: 'Make HTTP API call with full control over headers, body, and authentication',
  icon: Webhook,
  version: '2.0.0',
  tags: ['action', 'http', 'webhook', 'api'],
  contextAware: true,
  sections: [
    {
      id: 'http-request',
      title: 'Request Configuration',
      icon: Webhook,
      defaultExpanded: true,
      description: 'Configure HTTP request details',
      fields: [
        {
          id: 'url',
          type: 'text',
          label: 'URL',
          placeholder: 'https://api.example.com/endpoint',
          helpText: 'Full URL including protocol. Supports {{variable}} substitution.',
          required: true,
          validation: [
            {
              type: 'required',
              message: 'URL is required'
            },
            {
              type: 'pattern',
              value: '^https?://.+',
              message: 'URL must start with http:// or https://'
            }
          ]
        },
        {
          id: 'method',
          type: 'select',
          label: 'HTTP Method',
          options: [
            { value: 'GET', label: 'GET - Retrieve data' },
            { value: 'POST', label: 'POST - Create new resource' },
            { value: 'PUT', label: 'PUT - Update entire resource' },
            { value: 'PATCH', label: 'PATCH - Update partial resource' },
            { value: 'DELETE', label: 'DELETE - Remove resource' },
          ],
          defaultValue: 'GET',
          required: true,
        },
        {
          id: 'headers',
          type: 'keyValue',
          label: 'Headers',
          helpText: 'HTTP headers to send with the request',
          placeholder: { key: 'Header name', value: 'Header value' },
          defaultValue: [
            { key: 'Content-Type', value: 'application/json' }
          ],
          addButtonText: '+ Add Header',
        },
        {
          id: 'body',
          type: 'codeEditor',
          label: 'Request Body',
          language: 'json',
          placeholder: '{\n  "key": "value"\n}',
          helpText: 'Request body for POST/PUT/PATCH. Supports {{variable}} substitution.',
          conditional: {
            field: 'method',
            operator: 'in',
            value: ['POST', 'PUT', 'PATCH']
          }
        },
        {
          id: 'timeout',
          type: 'number',
          label: 'Timeout (seconds)',
          defaultValue: 30,
          min: 1,
          max: 300,
          helpText: 'Request timeout in seconds'
        },
      ]
    },
    {
      id: 'http-auth',
      title: 'Authentication',
      icon: Settings,
      defaultExpanded: false,
      description: 'Configure API authentication',
      fields: [
        {
          id: 'authType',
          type: 'select',
          label: 'Authentication Type',
          options: [
            { value: 'none', label: 'None' },
            { value: 'bearer', label: 'Bearer Token' },
            { value: 'basic', label: 'Basic Auth (Username/Password)' },
            { value: 'apiKey', label: 'API Key' },
          ],
          defaultValue: 'none',
        },
        {
          id: 'bearerToken',
          type: 'text',
          label: 'Bearer Token',
          placeholder: 'your-api-token',
          helpText: 'Token will be sent as "Authorization: Bearer {token}"',
          conditional: {
            field: 'authType',
            operator: 'equals',
            value: 'bearer'
          }
        },
        {
          id: 'basicUsername',
          type: 'text',
          label: 'Username',
          placeholder: 'username',
          conditional: {
            field: 'authType',
            operator: 'equals',
            value: 'basic'
          }
        },
        {
          id: 'basicPassword',
          type: 'password',
          label: 'Password',
          placeholder: 'password',
          conditional: {
            field: 'authType',
            operator: 'equals',
            value: 'basic'
          }
        },
        {
          id: 'apiKeyHeader',
          type: 'text',
          label: 'API Key Header Name',
          placeholder: 'X-API-Key',
          conditional: {
            field: 'authType',
            operator: 'equals',
            value: 'apiKey'
          }
        },
        {
          id: 'apiKeyValue',
          type: 'text',
          label: 'API Key Value',
          placeholder: 'your-api-key',
          conditional: {
            field: 'authType',
            operator: 'equals',
            value: 'apiKey'
          }
        },
      ]
    },
    {
      id: 'http-response',
      title: 'Response Handling',
      icon: Database,
      defaultExpanded: false,
      description: 'Extract and map response data',
      fields: [
        {
          id: 'responseVariable',
          type: 'text',
          label: 'Save Response As',
          placeholder: 'apiResponse',
          helpText: 'Variable name to store the response data',
          defaultValue: 'response',
        },
        {
          id: 'extractFields',
          type: 'keyValue',
          label: 'Extract Specific Fields',
          helpText: 'JSONPath expressions to extract data (e.g., $.data.id)',
          placeholder: { key: 'Field name', value: 'JSONPath expression' },
          addButtonText: '+ Add Extraction',
        },
        {
          id: 'errorHandling',
          type: 'select',
          label: 'On Error',
          options: [
            { value: 'fail', label: 'Fail workflow' },
            { value: 'continue', label: 'Continue with empty response' },
            { value: 'retry', label: 'Retry request' },
          ],
          defaultValue: 'fail',
        },
        {
          id: 'retryCount',
          type: 'number',
          label: 'Retry Count',
          defaultValue: 3,
          min: 1,
          max: 10,
          conditional: {
            field: 'errorHandling',
            operator: 'equals',
            value: 'retry'
          }
        },
      ]
    }
  ]
};

const actionSMSSchema: NodeConfigSchema = {
  nodeType: 'actionSMS',
  displayName: 'Send SMS',
  description: 'Send SMS message',
  icon: Mail,
  version: '1.0.0',
  tags: ['action', 'sms'],
  contextAware: true,
  sections: [
    {
      id: 'sms',
      title: 'SMS Configuration',
      icon: Mail,
      defaultExpanded: true,
      fields: [
        {
          id: 'recipient',
          type: 'text',
          label: 'Recipient Phone',
          placeholder: '+1234567890',
          required: true,
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Message',
          placeholder: 'SMS message content...',
          required: true,
        },
      ]
    }
  ]
};

const actionNotifySchema: NodeConfigSchema = {
  nodeType: 'actionNotify',
  displayName: 'Send Notification',
  description: 'Send in-app notification',
  icon: AlertCircle,
  version: '1.0.0',
  tags: ['action', 'notification'],
  contextAware: true,
  sections: [
    {
      id: 'notify',
      title: 'Notification Configuration',
      icon: AlertCircle,
      defaultExpanded: true,
      fields: [
        {
          id: 'title',
          type: 'text',
          label: 'Title',
          placeholder: 'Notification title...',
          required: true,
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Message',
          placeholder: 'Notification message...',
          required: true,
        },
      ]
    }
  ]
};

const actionScriptSchema: NodeConfigSchema = {
  nodeType: 'actionScript',
  displayName: 'Run Script',
  description: 'Execute custom JavaScript',
  icon: Settings,
  version: '1.0.0',
  tags: ['action', 'script'],
  contextAware: true,
  sections: [
    {
      id: 'script',
      title: 'Script Configuration',
      icon: Settings,
      defaultExpanded: true,
      fields: [
        {
          id: 'code',
          type: 'textarea',
          label: 'JavaScript Code',
          placeholder: '// Your code here...',
          required: true,
        },
      ]
    }
  ]
};

const actionCreateRecordSchema: NodeConfigSchema = {
  nodeType: 'actionCreateRecord',
  displayName: 'Create Record',
  description: 'Create database record',
  icon: Database,
  version: '1.0.0',
  tags: ['action', 'database'],
  contextAware: true,
  sections: [
    {
      id: 'create',
      title: 'Create Record',
      icon: Database,
      defaultExpanded: true,
      fields: [
        {
          id: 'entityType',
          type: 'text',
          label: 'Entity Type',
          placeholder: 'e.g., PurchaseOrder',
          required: true,
        },
      ]
    }
  ]
};

const actionUpdateRecordSchema: NodeConfigSchema = {
  nodeType: 'actionUpdateRecord',
  displayName: 'Update Record',
  description: 'Update database record',
  icon: Database,
  version: '1.0.0',
  tags: ['action', 'database'],
  contextAware: true,
  sections: [
    {
      id: 'update',
      title: 'Update Record',
      icon: Database,
      defaultExpanded: true,
      fields: [
        {
          id: 'entityType',
          type: 'text',
          label: 'Entity Type',
          placeholder: 'e.g., PurchaseOrder',
          required: true,
        },
        {
          id: 'recordId',
          type: 'text',
          label: 'Record ID',
          placeholder: 'ID of record to update',
          required: true,
        },
      ]
    }
  ]
};

const actionDeleteRecordSchema: NodeConfigSchema = {
  nodeType: 'actionDeleteRecord',
  displayName: 'Delete Record',
  description: 'Delete database record',
  icon: Database,
  version: '1.0.0',
  tags: ['action', 'database'],
  contextAware: true,
  sections: [
    {
      id: 'delete',
      title: 'Delete Record',
      icon: Database,
      defaultExpanded: true,
      fields: [
        {
          id: 'entityType',
          type: 'text',
          label: 'Entity Type',
          placeholder: 'e.g., PurchaseOrder',
          required: true,
        },
        {
          id: 'recordId',
          type: 'text',
          label: 'Record ID',
          placeholder: 'ID of record to delete',
          required: true,
        },
      ]
    }
  ]
};

// === DATA TRANSFORMATION NODES ===

const dataLookupSchema: NodeConfigSchema = {
  nodeType: 'dataLookup',
  displayName: 'Data Lookup',
  description: 'Look up data from database',
  icon: Database,
  version: '1.0.0',
  tags: ['data', 'lookup'],
  contextAware: true,
  sections: [
    {
      id: 'lookup',
      title: 'Lookup Configuration',
      icon: Database,
      defaultExpanded: true,
      fields: [
        {
          id: 'entityType',
          type: 'text',
          label: 'Entity Type',
          placeholder: 'e.g., Customer',
          required: true,
        },
        {
          id: 'searchField',
          type: 'text',
          label: 'Search Field',
          placeholder: 'Field to search by',
          required: true,
        },
      ]
    }
  ]
};

const dataMergeSchema: NodeConfigSchema = {
  nodeType: 'dataMerge',
  displayName: 'Merge Data',
  description: 'Merge multiple data sources',
  icon: Database,
  version: '1.0.0',
  tags: ['data', 'merge'],
  contextAware: true,
  sections: [
    {
      id: 'merge',
      title: 'Merge Configuration',
      icon: Database,
      defaultExpanded: true,
      fields: [
        {
          id: 'mergeStrategy',
          type: 'select',
          label: 'Merge Strategy',
          options: [
            { value: 'concat', label: 'Concatenate' },
            { value: 'union', label: 'Union' },
            { value: 'intersect', label: 'Intersect' },
          ],
          defaultValue: 'concat',
        },
      ]
    }
  ]
};

const dataTransformSchema: NodeConfigSchema = {
  nodeType: 'dataTransform',
  displayName: 'Transform Data',
  description: 'Transform, map, filter, or format data with visual builder',
  icon: Settings,
  version: '2.0.0',
  tags: ['data', 'transform', 'map', 'filter'],
  contextAware: true,
  sections: [
    {
      id: 'transform-input',
      title: 'Input Configuration',
      icon: Database,
      defaultExpanded: true,
      description: 'Select data to transform',
      fields: [
        {
          id: 'inputSource',
          type: 'text',
          label: 'Input Data',
          placeholder: 'e.g., {{apiResponse.data}} or {{customers}}',
          helpText: 'Source data to transform. Supports {{variable}} syntax.',
          required: true,
        },
        {
          id: 'inputType',
          type: 'select',
          label: 'Input Type',
          options: [
            { value: 'object', label: 'Object - Single item' },
            { value: 'array', label: 'Array - List of items' },
          ],
          defaultValue: 'object',
        },
      ]
    },
    {
      id: 'transform-operation',
      title: 'Transformation',
      icon: Settings,
      defaultExpanded: true,
      description: 'Define how to transform the data',
      fields: [
        {
          id: 'operation',
          type: 'select',
          label: 'Operation Type',
          options: [
            { value: 'map', label: 'Map - Transform each item' },
            { value: 'filter', label: 'Filter - Remove items by condition' },
            { value: 'format', label: 'Format - Change data structure' },
            { value: 'extract', label: 'Extract - Pull specific fields' },
            { value: 'custom', label: 'Custom - JavaScript expression' },
          ],
          defaultValue: 'map',
          required: true,
        },
        {
          id: 'mapTemplate',
          type: 'keyValue',
          label: 'Field Mapping',
          helpText: 'Map input fields to output fields',
          placeholder: { key: 'Output field', value: 'Input field (e.g., {{item.name}})' },
          addButtonText: '+ Add Mapping',
          conditional: {
            field: 'operation',
            operator: 'equals',
            value: 'map'
          }
        },
        {
          id: 'filterCondition',
          type: 'textarea',
          label: 'Filter Expression',
          placeholder: 'e.g., {{item.status}} == "active"',
          helpText: 'Items matching this condition will be included',
          rows: 3,
          conditional: {
            field: 'operation',
            operator: 'equals',
            value: 'filter'
          }
        },
        {
          id: 'customScript',
          type: 'codeEditor',
          label: 'Custom JavaScript',
          language: 'javascript',
          placeholder: '// Transform logic\nreturn data.map(item => ({\n  id: item.id,\n  name: item.name.toUpperCase()\n}));',
          helpText: 'Full JavaScript control. Input available as "data" variable.',
          rows: 8,
          conditional: {
            field: 'operation',
            operator: 'equals',
            value: 'custom'
          }
        },
      ]
    },
    {
      id: 'transform-output',
      title: 'Output',
      icon: Database,
      defaultExpanded: false,
      description: 'Configure output variable',
      fields: [
        {
          id: 'outputVariable',
          type: 'text',
          label: 'Save Result As',
          placeholder: 'transformedData',
          defaultValue: 'transformed',
          helpText: 'Variable name to store the transformation result',
          required: true,
        },
      ]
    }
  ]
};

// === LOOP NODES ===

// Variable Set Node (NEW - Phase 4)
const setVariableSchema: NodeConfigSchema = {
  nodeType: 'setVariable',
  displayName: 'Set Variable',
  description: 'Create or update a variable with static value, upstream data, or expression',
  icon: Settings,
  version: '2.0.0',
  tags: ['variable', 'data', 'set'],
  contextAware: true,
  sections: [
    {
      id: 'variable-config',
      title: 'Variable Configuration',
      icon: Settings,
      defaultExpanded: true,
      description: 'Define the variable',
      fields: [
        {
          id: 'variableName',
          type: 'text',
          label: 'Variable Name',
          placeholder: 'myVariable',
          helpText: 'Name to reference this variable (e.g., {{myVariable}})',
          required: true,
          validation: [
            {
              type: 'pattern',
              value: '^[a-zA-Z_][a-zA-Z0-9_]*$',
              message: 'Must be valid variable name (letters, numbers, underscore)'
            }
          ]
        },
        {
          id: 'valueType',
          type: 'select',
          label: 'Value Type',
          options: [
            { value: 'static', label: 'Static Value - Enter manually' },
            { value: 'upstream', label: 'From Upstream - Select field from previous node' },
            { value: 'expression', label: 'Expression - Calculate using formula' },
          ],
          defaultValue: 'static',
          required: true,
        },
        {
          id: 'staticValue',
          type: 'text',
          label: 'Value',
          placeholder: 'Enter value...',
          helpText: 'Static value to assign',
          conditional: {
            field: 'valueType',
            operator: 'equals',
            value: 'static'
          }
        },
        {
          id: 'upstreamValue',
          type: 'text',
          label: 'Upstream Field',
          placeholder: 'e.g., {{customer.email}} or {{response.data.id}}',
          helpText: 'Select field from previous node output',
          conditional: {
            field: 'valueType',
            operator: 'equals',
            value: 'upstream'
          }
        },
        {
          id: 'expressionValue',
          type: 'codeEditor',
          label: 'Expression',
          language: 'javascript',
          placeholder: '// Calculate value\nreturn {{quantity}} * {{price}};',
          helpText: 'JavaScript expression to calculate value. Return the result.',
          rows: 4,
          conditional: {
            field: 'valueType',
            operator: 'equals',
            value: 'expression'
          }
        },
        {
          id: 'dataType',
          type: 'select',
          label: 'Data Type',
          options: [
            { value: 'string', label: 'String (text)' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Boolean (true/false)' },
            { value: 'object', label: 'Object' },
            { value: 'array', label: 'Array' },
            { value: 'auto', label: 'Auto-detect' },
          ],
          defaultValue: 'auto',
          helpText: 'Expected data type (for validation)',
        },
      ]
    },
    {
      id: 'variable-scope',
      title: 'Variable Scope',
      icon: Settings,
      defaultExpanded: false,
      description: 'Control where this variable is accessible',
      fields: [
        {
          id: 'scope',
          type: 'select',
          label: 'Scope',
          options: [
            { value: 'step', label: 'Step - Only this step and downstream' },
            { value: 'workflow', label: 'Workflow - Entire workflow execution' },
            { value: 'global', label: 'Global - All workflows (persistent)' },
          ],
          defaultValue: 'workflow',
          helpText: 'How long and where this variable is available',
        },
        {
          id: 'persistent',
          type: 'checkbox',
          label: 'Persist to Database',
          defaultValue: false,
          helpText: 'Save variable value to database for future workflow runs',
          conditional: {
            field: 'scope',
            operator: 'equals',
            value: 'global'
          }
        },
      ]
    }
  ]
};

const loopForEachSchema: NodeConfigSchema = {
  nodeType: 'loopForEach',
  displayName: 'Loop (For Each)',
  description: 'Iterate over array or list with enhanced controls',
  icon: Navigation,
  version: '2.0.0',
  tags: ['loop', 'iteration', 'foreach'],
  contextAware: true,
  sections: [
    {
      id: 'loop-config',
      title: 'Loop Configuration',
      icon: Navigation,
      defaultExpanded: true,
      description: 'Configure iteration behavior',
      fields: [
        {
          id: 'arrayVariable',
          type: 'text',
          label: 'Array to Loop Over',
          placeholder: 'e.g., {{customers}} or {{response.data.items}}',
          helpText: 'Array or list variable. Supports {{variable}} syntax.',
          required: true,
        },
        {
          id: 'itemVariable',
          type: 'text',
          label: 'Item Variable Name',
          placeholder: 'item',
          defaultValue: 'item',
          helpText: 'Name to reference each item (e.g., {{item.name}})',
          required: true,
        },
        {
          id: 'indexVariable',
          type: 'text',
          label: 'Index Variable Name (Optional)',
          placeholder: 'index',
          helpText: 'Name to reference iteration number (starts at 0)',
        },
        {
          id: 'maxIterations',
          type: 'number',
          label: 'Max Iterations',
          defaultValue: 1000,
          min: 1,
          max: 10000,
          helpText: 'Safety limit to prevent infinite loops',
        },
      ]
    }
  ]
};

const loopWhileSchema: NodeConfigSchema = {
  nodeType: 'loopWhile',
  displayName: 'While Loop',
  description: 'Loop while condition is true',
  icon: Navigation,
  version: '1.0.0',
  tags: ['loop', 'condition'],
  contextAware: true,
  sections: [
    {
      id: 'loop',
      title: 'Loop Configuration',
      icon: Navigation,
      defaultExpanded: true,
      fields: [
        {
          id: 'condition',
          type: 'textarea',
          label: 'Loop Condition',
          placeholder: 'Continue while this is true...',
          required: true,
        },
        {
          id: 'maxIterations',
          type: 'text',
          label: 'Max Iterations',
          placeholder: '100',
          defaultValue: '100',
        },
      ]
    }
  ]
};

// === WAIT/PENDING NODES ===

const timerScheduleSchema: NodeConfigSchema = {
  nodeType: 'timerSchedule',
  displayName: 'Wait Until Time',
  description: 'Wait until specific date/time',
  icon: Calendar,
  version: '1.0.0',
  tags: ['wait', 'timer'],
  contextAware: true,
  sections: [
    {
      id: 'schedule',
      title: 'Schedule Configuration',
      icon: Calendar,
      defaultExpanded: true,
      fields: [
        {
          id: 'targetDateTime',
          type: 'text',
          label: 'Target Date/Time',
          placeholder: '2026-12-31T23:59:59Z',
          required: true,
        },
      ]
    }
  ]
};

const pendingApprovalSchema: NodeConfigSchema = {
  nodeType: 'pendingApproval',
  displayName: 'Pending Approval',
  description: 'Wait for user approval',
  icon: CheckSquare,
  version: '1.0.0',
  tags: ['wait', 'approval'],
  contextAware: true,
  sections: [
    {
      id: 'approval',
      title: 'Approval Configuration',
      icon: CheckSquare,
      defaultExpanded: true,
      fields: [
        {
          id: 'approverUserId',
          type: 'text',
          label: 'Approver User ID',
          placeholder: 'ID of user who can approve',
          required: true,
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Approval Message',
          placeholder: 'Please review and approve...',
        },
      ]
    }
  ]
};

const pendingDocumentSchema: NodeConfigSchema = {
  nodeType: 'pendingDocument',
  displayName: 'Pending Document',
  description: 'Wait for document upload',
  icon: FileText,
  version: '1.0.0',
  tags: ['wait', 'document'],
  contextAware: true,
  sections: [
    {
      id: 'document',
      title: 'Document Configuration',
      icon: FileText,
      defaultExpanded: true,
      fields: [
        {
          id: 'documentType',
          type: 'text',
          label: 'Required Document Type',
          placeholder: 'e.g., Invoice',
          required: true,
        },
      ]
    }
  ]
};

const pendingPaymentSchema: NodeConfigSchema = {
  nodeType: 'pendingPayment',
  displayName: 'Pending Payment',
  description: 'Wait for payment confirmation',
  icon: CheckSquare,
  version: '1.0.0',
  tags: ['wait', 'payment'],
  contextAware: true,
  sections: [
    {
      id: 'payment',
      title: 'Payment Configuration',
      icon: CheckSquare,
      defaultExpanded: true,
      fields: [
        {
          id: 'amount',
          type: 'text',
          label: 'Expected Amount',
          placeholder: '0.00',
          required: true,
        },
        {
          id: 'currency',
          type: 'text',
          label: 'Currency',
          placeholder: 'USD',
          defaultValue: 'USD',
        },
      ]
    }
  ]
};

const pendingResponseSchema: NodeConfigSchema = {
  nodeType: 'pendingResponse',
  displayName: 'Pending Response',
  description: 'Wait for user response',
  icon: Mail,
  version: '1.0.0',
  tags: ['wait', 'response'],
  contextAware: true,
  sections: [
    {
      id: 'response',
      title: 'Response Configuration',
      icon: Mail,
      defaultExpanded: true,
      fields: [
        {
          id: 'recipientUserId',
          type: 'text',
          label: 'Recipient User ID',
          placeholder: 'User to respond',
          required: true,
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Request Message',
          placeholder: 'Please respond to...',
        },
      ]
    }
  ]
};

// === DOCUMENT NODES ===

const documentMergeSchema: NodeConfigSchema = {
  nodeType: 'documentMerge',
  displayName: 'Merge Documents',
  description: 'Combine multiple documents',
  icon: FileText,
  version: '1.0.0',
  tags: ['document', 'merge'],
  contextAware: true,
  sections: [
    {
      id: 'merge',
      title: 'Merge Configuration',
      icon: FileText,
      defaultExpanded: true,
      fields: [
        {
          id: 'documentIds',
          type: 'textarea',
          label: 'Document IDs',
          placeholder: 'Comma-separated list of document IDs',
          required: true,
        },
      ]
    }
  ]
};

// === UTILITY NODES ===

const groupSubflowSchema: NodeConfigSchema = {
  nodeType: 'groupSubflow',
  displayName: 'Subflow',
  description: 'Reusable workflow component',
  icon: Package,
  version: '1.0.0',
  tags: ['utility', 'subflow'],
  contextAware: true,
  sections: [
    {
      id: 'subflow',
      title: 'Subflow Configuration',
      icon: Package,
      defaultExpanded: true,
      fields: [
        {
          id: 'subflowId',
          type: 'text',
          label: 'Subflow ID',
          placeholder: 'ID of subflow to execute',
          required: true,
        },
        {
          id: 'passData',
          type: 'boolean',
          label: 'Pass Data to Subflow',
          defaultValue: true,
        },
      ]
    }
  ]
};

const noteCommentSchema: NodeConfigSchema = {
  nodeType: 'noteComment',
  displayName: 'Note/Comment',
  description: 'Add documentation notes',
  icon: FileText,
  version: '1.0.0',
  tags: ['utility', 'documentation'],
  contextAware: false,
  sections: [
    {
      id: 'note',
      title: 'Note Content',
      icon: FileText,
      defaultExpanded: true,
      fields: [
        {
          id: 'title',
          type: 'text',
          label: 'Note Title',
          placeholder: 'Short title...',
        },
        {
          id: 'content',
          type: 'textarea',
          label: 'Note Content',
          placeholder: 'Add your notes here...',
          required: true,
        },
      ]
    }
  ]
};

// === TERMINAL NODES ===

const endCancelSchema: NodeConfigSchema = {
  nodeType: 'endCancel',
  displayName: 'End (Cancel)',
  description: 'Cancel workflow execution',
  icon: AlertCircle,
  version: '1.0.0',
  tags: ['terminal', 'end'],
  contextAware: false,
  sections: [
    {
      id: 'end',
      title: 'Cancel Configuration',
      icon: AlertCircle,
      defaultExpanded: true,
      fields: [
        {
          id: 'message',
          type: 'textarea',
          label: 'Cancel Message',
          placeholder: 'Workflow was cancelled because...',
        },
      ]
    }
  ]
};

// ============================================================================
// PHASE 7.4: ADVANCED NODE TYPES (2026-02-27)
// ============================================================================

/**
 * Parallel Path Node Schema
 * 
 * Enables parallel execution branches for concurrent processing.
 */
export const parallelPathSchema: NodeConfigSchema = {
  nodeType: 'parallelPath',
  displayName: 'Parallel Paths',
  description: 'Execute multiple branches concurrently',
  icon: Zap,
  version: '1.0.0',
  tags: ['logic', 'parallel', 'concurrent'],
  contextAware: true,
  sections: [
    {
      id: 'paths',
      title: 'Parallel Paths Configuration',
      icon: Zap,
      defaultExpanded: true,
      fields: [
        {
          id: 'pathCount',
          type: 'number',
          label: 'Number of Paths',
          min: 2,
          max: 10,
          defaultValue: 2,
          required: true,
        },
        {
          id: 'waitStrategy',
          type: 'select',
          label: 'Wait Strategy',
          options: [
            { value: 'all', label: 'Wait for All (AND)' },
            { value: 'any', label: 'Wait for Any (OR)' },
            { value: 'none', label: 'Fire & Forget' },
          ],
          defaultValue: 'all',
          required: true,
        },
        {
          id: 'errorStrategy',
          type: 'select',
          label: 'Error Handling',
          options: [
            { value: 'stop', label: 'Stop All on Error' },
            { value: 'continue', label: 'Continue Other Paths' },
          ],
          defaultValue: 'stop',
          required: true,
        },
        {
          id: 'timeout',
          type: 'number',
          label: 'Timeout (seconds)',
          min: 0,
          placeholder: 'No timeout',
        },
      ]
    }
  ]
};

/**
 * Sub-Workflow Node Schema
 * 
 * Executes another workflow as a reusable sub-process.
 */
export const subWorkflowSchema: NodeConfigSchema = {
  nodeType: 'subWorkflow',
  displayName: 'Sub-Workflow',
  description: 'Execute another workflow as a sub-process',
  icon: Package,
  version: '1.0.0',
  tags: ['logic', 'subflow', 'reusable'],
  contextAware: true,
  sections: [
    {
      id: 'workflow',
      title: 'Workflow Selection',
      icon: Package,
      defaultExpanded: true,
      fields: [
        {
          id: 'workflowId',
          type: 'text',
          label: 'Workflow ID',
          placeholder: 'Select workflow...',
          required: true,
        },
        {
          id: 'workflowName',
          type: 'text',
          label: 'Workflow Name',
          placeholder: 'Display name',
        },
        {
          id: 'version',
          type: 'text',
          label: 'Version',
          placeholder: 'latest',
        },
      ]
    },
    {
      id: 'execution',
      title: 'Execution Options',
      icon: Settings,
      defaultExpanded: true,
      fields: [
        {
          id: 'waitForCompletion',
          type: 'boolean',
          label: 'Wait for Completion',
          defaultValue: true,
        },
        {
          id: 'inheritContext',
          type: 'boolean',
          label: 'Inherit Parent Context',
          defaultValue: false,
        },
        {
          id: 'timeout',
          type: 'number',
          label: 'Timeout (seconds)',
          min: 0,
          placeholder: 'No timeout',
        },
      ]
    },
    {
      id: 'errorHandling',
      title: 'Error Handling',
      icon: AlertCircle,
      defaultExpanded: false,
      fields: [
        {
          id: 'errorHandling',
          type: 'select',
          label: 'On Error',
          options: [
            { value: 'fail', label: 'Fail Parent Workflow' },
            { value: 'continue', label: 'Continue Parent Workflow' },
            { value: 'retry', label: 'Retry Sub-Workflow' },
          ],
          defaultValue: 'fail',
          required: true,
        },
        {
          id: 'retryCount',
          type: 'number',
          label: 'Retry Attempts',
          min: 1,
          max: 10,
          defaultValue: 3,
          conditional: { field: 'errorHandling', operator: 'equals', value: 'retry' },
        },
      ]
    }
  ]
};

// ============================================================================
// SCHEMA REGISTRATION COMPLETE
// ============================================================================

// Build + initialize schemas at end-of-module to avoid TDZ errors.
export const allSchemas: NodeConfigSchema[] = buildAllSchemas();

// CRITICAL HOTFIX (2026-03-18): Defer initialization to bypass Vite/Rollup ES Module TDZ
setTimeout(() => {
  if (typeof schemaRegistry !== 'undefined') {
    schemaRegistry.initialize(allSchemas);
    logger.debug(`[Schema Registry] Complete config coverage: ${allSchemas.length} node schemas registered`);
  } else {
    console.error('[Schema Registry] CRITICAL: schemaRegistry still undefined after deferral at line 4171');
  }
}, 0);

// Cache bust: 1771875847
