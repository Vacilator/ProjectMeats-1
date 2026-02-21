/**
 * Form Builder Types
 * 
 * Type definitions for the FormBuilder component suite.
 * Supports multi-step forms with fields, rules, and mappings.
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

/**
 * Field Types
 */
export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'email' 
  | 'phone' 
  | 'date' 
  | 'datetime' 
  | 'select' 
  | 'multiSelect' 
  | 'radio' 
  | 'checkbox' 
  | 'file' 
  | 'signature' 
  | 'rating' 
  | 'slider';

/**
 * Validation Rule Types
 */
export type ValidationType = 
  | 'required' 
  | 'minLength' 
  | 'maxLength' 
  | 'min' 
  | 'max' 
  | 'pattern' 
  | 'email' 
  | 'phone' 
  | 'custom';

/**
 * Validation Rule
 */
export interface ValidationRule {
  type: ValidationType;
  value?: string | number;
  message: string;
  customValidator?: string; // JavaScript expression
}

/**
 * Field Configuration
 */
export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  validation: ValidationRule[];
  options?: string[]; // For select, radio, checkbox
  defaultValue?: any;
  width?: 'full' | 'half' | 'third'; // Layout hint
  
  // Auto-populate configuration
  autoPopulate?: {
    enabled: boolean;
    sourceStep?: string;
    sourceField?: string;
    mode: 'copy' | 'transform' | 'calculate';
    transformation?: string; // JavaScript expression
  };
  
  // Conditional visibility
  conditional?: {
    enabled: boolean;
    conditions: RuleCondition[];
  };
}

/**
 * Form Step
 */
export interface FormStep {
  id: string;
  name: string;
  description?: string;
  displayTitle?: string;
  displayDescription?: string;
  order: number;
  fields: FormField[];
  
  // Step-level rules
  rules: FormRule[];
  
  // Field mappings (for data inheritance)
  mappings: FieldMapping[];
}

/**
 * Rule Condition Operators
 */
export type RuleOperator = 
  | 'equals' 
  | 'notEquals' 
  | 'greaterThan' 
  | 'lessThan' 
  | 'contains' 
  | 'notContains' 
  | 'isEmpty' 
  | 'isNotEmpty';

/**
 * Rule Condition
 */
export interface RuleCondition {
  id: string;
  field: string; // Field ID
  operator: RuleOperator;
  value?: any;
  logicalOperator?: 'AND' | 'OR'; // For chaining multiple conditions
}

/**
 * Rule Action Types
 */
export type RuleActionType = 
  | 'show' 
  | 'hide' 
  | 'enable' 
  | 'disable' 
  | 'require' 
  | 'setValue' 
  | 'showError';

/**
 * Rule Action
 */
export interface RuleAction {
  id: string;
  type: RuleActionType;
  targetField: string; // Field ID
  value?: any; // For setValue actions
  message?: string; // For showError actions
}

/**
 * Form Rule (Conditional Logic)
 */
export interface FormRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

/**
 * Field Mapping (Data Inheritance)
 */
export interface FieldMapping {
  id: string;
  sourceStep?: string; // Upstream node ID
  sourceField: string;
  targetField: string;
  transformation?: string; // JavaScript expression
  autoMapped: boolean; // True if created by Auto-Map algorithm
}

/**
 * Auto-Populate Suggestion
 */
export interface AutoPopulateSuggestion {
  sourceStep: string;
  sourceField: string;
  targetField: string;
  score: number; // 0-100
  reason: string; // e.g., "Same field name", "Similar type"
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Form Builder State
 */
export interface FormBuilderState {
  // Form metadata
  formId?: string;
  formName: string;
  formDescription?: string;
  
  // Steps
  steps: FormStep[];
  activeStepId: string | null;
  
  // UI State
  activeTab: 'steps' | 'settings' | 'preview';
  isDirty: boolean;
  
  // Modal states
  isFieldModalOpen: boolean;
  isRuleModalOpen: boolean;
  isMappingModalOpen: boolean;
  isPreviewModalOpen: boolean;
  
  // Editing contexts
  editingField: FormField | null;
  editingRule: FormRule | null;
  
  // Actions
  setFormName: (name: string) => void;
  setFormDescription: (description: string) => void;
  setActiveTab: (tab: 'steps' | 'settings' | 'preview') => void;
  
  // Step actions
  addStep: () => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, updates: Partial<FormStep>) => void;
  reorderSteps: (startIndex: number, endIndex: number) => void;
  setActiveStep: (stepId: string | null) => void;
  
  // Field actions
  openFieldModal: (stepId: string, field?: FormField) => void;
  closeFieldModal: () => void;
  saveField: (stepId: string, field: FormField) => void;
  removeField: (stepId: string, fieldId: string) => void;
  
  // Rule actions
  openRuleModal: (stepId: string, rule?: FormRule) => void;
  closeRuleModal: () => void;
  saveRule: (stepId: string, rule: FormRule) => void;
  removeRule: (stepId: string, ruleId: string) => void;
  
  // Mapping actions
  openMappingModal: (stepId: string) => void;
  closeMappingModal: () => void;
  saveMapping: (stepId: string, mapping: FieldMapping) => void;
  removeMapping: (stepId: string, mappingId: string) => void;
  autoMapFields: (stepId: string) => void;
  
  // Preview actions
  openPreviewModal: () => void;
  closePreviewModal: () => void;
  
  // Persistence
  loadForm: (formData: any) => void;
  resetForm: () => void;
  getFormData: () => any;
}

/**
 * Test Data for Preview
 */
export interface PreviewTestData {
  [fieldId: string]: any;
}
