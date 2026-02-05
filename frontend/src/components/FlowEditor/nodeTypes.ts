/**
 * Node Types Registry for Unified Flow Editor
 * 
 * Comprehensive node types combining forms and workflows.
 * Inspired by Make/n8n/Zapier patterns.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */

// ============================================================================
// Node Type Definitions
// ============================================================================

export type NodeCategory = 
  | 'trigger'
  | 'form'
  | 'logic'
  | 'action'
  | 'wait'
  | 'document'
  | 'utility'
  | 'terminal';

export interface NodeTypeDefinition {
  id: string;
  name: string;
  category: NodeCategory;
  icon: string;
  color: string;
  description: string;
  hasErrorRoute?: boolean;
  maxInputs?: number;
  maxOutputs?: number;
  requiresConfig?: boolean;
}

// ============================================================================
// Comprehensive Node Type Registry
// ============================================================================

export const NODE_TYPE_REGISTRY: Record<string, NodeTypeDefinition> = {
  // === TRIGGERS (Entry Points) ===
  triggerManual: {
    id: 'triggerManual',
    name: 'Manual Trigger',
    category: 'trigger',
    icon: '▶️',
    color: '#10b981', // green
    description: 'User clicks a button to start the flow',
    maxInputs: 0,
    maxOutputs: 1,
  },
  
  triggerSchedule: {
    id: 'triggerSchedule',
    name: 'Schedule Trigger',
    category: 'trigger',
    icon: '⏰',
    color: '#10b981',
    description: 'Runs on a schedule (cron/time-based)',
    maxInputs: 0,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  triggerWebhook: {
    id: 'triggerWebhook',
    name: 'Webhook Trigger',
    category: 'trigger',
    icon: '🔗',
    color: '#10b981',
    description: 'Receives data from external API calls',
    maxInputs: 0,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  triggerEvent: {
    id: 'triggerEvent',
    name: 'Event Trigger',
    category: 'trigger',
    icon: '⚡',
    color: '#10b981',
    description: 'Fires when a record is created/updated/deleted',
    maxInputs: 0,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  triggerForm: {
    id: 'triggerForm',
    name: 'Form Submit',
    category: 'trigger',
    icon: '📝',
    color: '#10b981',
    description: 'Triggered when a form is submitted',
    maxInputs: 0,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  // === FORM ELEMENTS ===
  formStep: {
    id: 'formStep',
    name: 'Form Step',
    category: 'form',
    icon: '📋',
    color: '#3b82f6', // blue
    description: 'Container for multiple form fields',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  formReference: {
    id: 'formReference',
    name: 'Form Reference',
    category: 'form',
    icon: '📄',
    color: '#3b82f6',
    description: 'Reference a reusable form from the library',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  formField: {
    id: 'formField',
    name: 'Form Field',
    category: 'form',
    icon: '📝',
    color: '#3b82f6',
    description: 'Individual input field (text, number, select, etc.)',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  formSection: {
    id: 'formSection',
    name: 'Form Section',
    category: 'form',
    icon: '📑',
    color: '#3b82f6',
    description: 'Visual grouping for related fields',
    maxInputs: 1,
    maxOutputs: 1,
  },
  
  formSignature: {
    id: 'formSignature',
    name: 'Signature Field',
    category: 'form',
    icon: '✍️',
    color: '#3b82f6',
    description: 'Electronic signature capture',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  formFileUpload: {
    id: 'formFileUpload',
    name: 'File Upload',
    category: 'form',
    icon: '📎',
    color: '#3b82f6',
    description: 'Document/file upload field',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  // === LOGIC & ROUTING ===
  conditionIf: {
    id: 'conditionIf',
    name: 'If/Else Condition',
    category: 'logic',
    icon: '🔀',
    color: '#f59e0b', // amber
    description: 'Branch flow based on a condition',
    maxInputs: 1,
    maxOutputs: 2, // true and false branches
    requiresConfig: true,
  },
  
  conditionSwitch: {
    id: 'conditionSwitch',
    name: 'Switch/Case',
    category: 'logic',
    icon: '🔀',
    color: '#f59e0b',
    description: 'Multi-branch routing based on value',
    maxInputs: 1,
    maxOutputs: -1, // unlimited
    requiresConfig: true,
  },
  
  conditionFilter: {
    id: 'conditionFilter',
    name: 'Filter Records',
    category: 'logic',
    icon: '🔍',
    color: '#f59e0b',
    description: 'Filter items based on criteria',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  loopForEach: {
    id: 'loopForEach',
    name: 'For Each Loop',
    category: 'logic',
    icon: '🔁',
    color: '#f59e0b',
    description: 'Iterate over a collection',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  loopWhile: {
    id: 'loopWhile',
    name: 'While Loop',
    category: 'logic',
    icon: '🔄',
    color: '#f59e0b',
    description: 'Repeat until condition is false',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  // === ACTIONS ===
  actionEmail: {
    id: 'actionEmail',
    name: 'Send Email',
    category: 'action',
    icon: '✉️',
    color: '#8b5cf6', // purple
    description: 'Send an email notification',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionNotify: {
    id: 'actionNotify',
    name: 'In-App Notification',
    category: 'action',
    icon: '🔔',
    color: '#8b5cf6',
    description: 'Send an in-app notification',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionSMS: {
    id: 'actionSMS',
    name: 'Send SMS',
    category: 'action',
    icon: '💬',
    color: '#8b5cf6',
    description: 'Send SMS message (future)',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionCreateRecord: {
    id: 'actionCreateRecord',
    name: 'Create Record',
    category: 'action',
    icon: '➕',
    color: '#8b5cf6',
    description: 'Create a new database record',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionUpdateRecord: {
    id: 'actionUpdateRecord',
    name: 'Update Record',
    category: 'action',
    icon: '✏️',
    color: '#8b5cf6',
    description: 'Update an existing record',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionDeleteRecord: {
    id: 'actionDeleteRecord',
    name: 'Delete Record',
    category: 'action',
    icon: '🗑️',
    color: '#8b5cf6',
    description: 'Delete a database record',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionHTTP: {
    id: 'actionHTTP',
    name: 'HTTP Request',
    category: 'action',
    icon: '🌐',
    color: '#8b5cf6',
    description: 'Make an external API call',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  actionScript: {
    id: 'actionScript',
    name: 'Run Script',
    category: 'action',
    icon: '💻',
    color: '#8b5cf6',
    description: 'Execute custom JavaScript/Python code',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  // === WAIT STATES (External Party Integration) ===
  pendingApproval: {
    id: 'pendingApproval',
    name: 'Approval Required',
    category: 'wait',
    icon: '✋',
    color: '#ef4444', // red
    description: 'Wait for internal approval',
    maxInputs: 1,
    maxOutputs: 2, // approved and rejected
    requiresConfig: true,
  },
  
  pendingDocument: {
    id: 'pendingDocument',
    name: 'Document Upload',
    category: 'wait',
    icon: '📄',
    color: '#ef4444',
    description: 'Wait for document upload',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  pendingResponse: {
    id: 'pendingResponse',
    name: 'External Response',
    category: 'wait',
    icon: '⏳',
    color: '#ef4444',
    description: 'Wait for external party response',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  pendingPayment: {
    id: 'pendingPayment',
    name: 'Payment Confirmation',
    category: 'wait',
    icon: '💳',
    color: '#ef4444',
    description: 'Wait for payment confirmation',
    maxInputs: 1,
    maxOutputs: 2, // paid and cancelled
    requiresConfig: true,
  },
  
  timerDelay: {
    id: 'timerDelay',
    name: 'Delay',
    category: 'wait',
    icon: '⏱️',
    color: '#ef4444',
    description: 'Wait for a specified duration',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  timerSchedule: {
    id: 'timerSchedule',
    name: 'Wait Until',
    category: 'wait',
    icon: '📅',
    color: '#ef4444',
    description: 'Wait until a specific date/time',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  // === DOCUMENTS ===
  documentGenerate: {
    id: 'documentGenerate',
    name: 'Generate Document',
    category: 'document',
    icon: '📄',
    color: '#06b6d4', // cyan
    description: 'Generate PDF/Word document from template',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  documentMerge: {
    id: 'documentMerge',
    name: 'Merge Documents',
    category: 'document',
    icon: '📑',
    color: '#06b6d4',
    description: 'Combine multiple documents',
    maxInputs: -1, // unlimited
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  documentSign: {
    id: 'documentSign',
    name: 'Request Signature',
    category: 'document',
    icon: '✍️',
    color: '#06b6d4',
    description: 'Request electronic signature',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  documentStore: {
    id: 'documentStore',
    name: 'Store Document',
    category: 'document',
    icon: '💾',
    color: '#06b6d4',
    description: 'Save document to storage',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  // === UTILITIES ===
  dataTransform: {
    id: 'dataTransform',
    name: 'Transform Data',
    category: 'utility',
    icon: '🔄',
    color: '#64748b', // slate
    description: 'Map and transform data fields',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  dataLookup: {
    id: 'dataLookup',
    name: 'Lookup Record',
    category: 'utility',
    icon: '🔍',
    color: '#64748b',
    description: 'Query related database records',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
    hasErrorRoute: true,
  },
  
  dataMerge: {
    id: 'dataMerge',
    name: 'Merge Data',
    category: 'utility',
    icon: '🔗',
    color: '#64748b',
    description: 'Combine data from multiple branches',
    maxInputs: -1, // unlimited
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  noteComment: {
    id: 'noteComment',
    name: 'Note',
    category: 'utility',
    icon: '📝',
    color: '#64748b',
    description: 'Add visual annotation (not executed)',
    maxInputs: 0,
    maxOutputs: 0,
  },
  
  groupSubflow: {
    id: 'groupSubflow',
    name: 'Sub-Workflow',
    category: 'utility',
    icon: '📦',
    color: '#64748b',
    description: 'Encapsulate reusable sub-workflow',
    maxInputs: 1,
    maxOutputs: 1,
    requiresConfig: true,
  },
  
  // === TERMINAL ===
  endSuccess: {
    id: 'endSuccess',
    name: 'Success End',
    category: 'terminal',
    icon: '✅',
    color: '#22c55e', // green
    description: 'Successful completion of workflow',
    maxInputs: 1,
    maxOutputs: 0,
  },
  
  endError: {
    id: 'endError',
    name: 'Error End',
    category: 'terminal',
    icon: '❌',
    color: '#ef4444', // red
    description: 'Error termination of workflow',
    maxInputs: 1,
    maxOutputs: 0,
  },
  
  endCancel: {
    id: 'endCancel',
    name: 'Cancel End',
    category: 'terminal',
    icon: '⛔',
    color: '#f59e0b', // amber
    description: 'User-initiated cancellation',
    maxInputs: 1,
    maxOutputs: 0,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getNodeTypesByCategory(category: NodeCategory): NodeTypeDefinition[] {
  return Object.values(NODE_TYPE_REGISTRY).filter(node => node.category === category);
}

export function getNodeTypeDefinition(nodeTypeId: string): NodeTypeDefinition | undefined {
  return NODE_TYPE_REGISTRY[nodeTypeId];
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  form: 'Form Elements',
  logic: 'Logic & Routing',
  action: 'Actions',
  wait: 'Wait States',
  document: 'Documents',
  utility: 'Utilities',
  terminal: 'End Points',
};

export const CATEGORY_ORDER: NodeCategory[] = [
  'trigger',
  'form',
  'logic',
  'action',
  'wait',
  'document',
  'utility',
  'terminal',
];
