/**
 * Form Builder Store
 * 
 * Zustand store for managing FormBuilder state.
 * Handles steps, fields, rules, mappings, and UI state.
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import { create } from 'zustand';
import { FormBuilderState, FormStep, FormField, FormRule, FieldMapping } from './types';
import { logger } from '../../utils/logger';

/**
 * Generate unique ID
 */
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create default step
 */
const createDefaultStep = (order: number): FormStep => ({
  id: generateId(),
  name: `Step ${order + 1}`,
  description: '',
  displayTitle: '',
  displayDescription: '',
  order,
  fields: [],
  rules: [],
  mappings: []
});

/**
 * Form Builder Store
 */
export const useFormBuilderStore = create<FormBuilderState>((set, get) => ({
  // Initial state
  formId: undefined,
  formName: 'Untitled Form',
  formDescription: '',
  steps: [createDefaultStep(0)],
  activeStepId: null,
  activeTab: 'steps',
  isDirty: false,
  
  isFieldModalOpen: false,
  isRuleModalOpen: false,
  isMappingModalOpen: false,
  isPreviewModalOpen: false,
  
  editingField: null,
  editingRule: null,
  
  // Form metadata actions
  setFormName: (name: string) => {
    set({ formName: name, isDirty: true });
  },
  
  setFormDescription: (description: string) => {
    set({ formDescription: description, isDirty: true });
  },
  
  setActiveTab: (tab: 'steps' | 'settings' | 'preview') => {
    set({ activeTab: tab });
  },
  
  // Step actions
  addStep: () => {
    const { steps } = get();
    const newStep = createDefaultStep(steps.length);
    set({ 
      steps: [...steps, newStep],
      activeStepId: newStep.id,
      isDirty: true 
    });
  },
  
  removeStep: (stepId: string) => {
    const { steps, activeStepId } = get();
    const filteredSteps = steps.filter(s => s.id !== stepId);
    const reorderedSteps = filteredSteps.map((step, index) => ({
      ...step,
      order: index
    }));
    
    set({ 
      steps: reorderedSteps,
      activeStepId: activeStepId === stepId ? (reorderedSteps[0]?.id || null) : activeStepId,
      isDirty: true 
    });
  },
  
  updateStep: (stepId: string, updates: Partial<FormStep>) => {
    const { steps } = get();
    set({
      steps: steps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      ),
      isDirty: true
    });
  },
  
  reorderSteps: (startIndex: number, endIndex: number) => {
    const { steps } = get();
    const result = Array.from(steps);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    // Update order property
    const reorderedSteps = result.map((step, index) => ({
      ...step,
      order: index
    }));
    
    set({ steps: reorderedSteps, isDirty: true });
  },
  
  setActiveStep: (stepId: string | null) => {
    set({ activeStepId: stepId });
  },
  
  // Field actions
  openFieldModal: (stepId: string, field?: FormField) => {
    set({ 
      isFieldModalOpen: true,
      activeStepId: stepId,
      editingField: field || null
    });
  },
  
  closeFieldModal: () => {
    set({ 
      isFieldModalOpen: false,
      editingField: null
    });
  },
  
  saveField: (stepId: string, field: FormField) => {
    const { steps } = get();
    const updatedSteps = steps.map(step => {
      if (step.id === stepId) {
        // Check if editing existing field or adding new
        const existingIndex = step.fields.findIndex(f => f.id === field.id);
        const updatedFields = existingIndex >= 0
          ? step.fields.map(f => f.id === field.id ? field : f)
          : [...step.fields, field];
        
        return { ...step, fields: updatedFields };
      }
      return step;
    });
    
    set({ 
      steps: updatedSteps,
      isFieldModalOpen: false,
      editingField: null,
      isDirty: true
    });
  },
  
  removeField: (stepId: string, fieldId: string) => {
    const { steps } = get();
    set({
      steps: steps.map(step =>
        step.id === stepId
          ? { ...step, fields: step.fields.filter(f => f.id !== fieldId) }
          : step
      ),
      isDirty: true
    });
  },
  
  // Rule actions
  openRuleModal: (stepId: string, rule?: FormRule) => {
    set({ 
      isRuleModalOpen: true,
      activeStepId: stepId,
      editingRule: rule || null
    });
  },
  
  closeRuleModal: () => {
    set({ 
      isRuleModalOpen: false,
      editingRule: null
    });
  },
  
  saveRule: (stepId: string, rule: FormRule) => {
    const { steps } = get();
    const updatedSteps = steps.map(step => {
      if (step.id === stepId) {
        const existingIndex = step.rules.findIndex(r => r.id === rule.id);
        const updatedRules = existingIndex >= 0
          ? step.rules.map(r => r.id === rule.id ? rule : r)
          : [...step.rules, rule];
        
        return { ...step, rules: updatedRules };
      }
      return step;
    });
    
    set({ 
      steps: updatedSteps,
      isRuleModalOpen: false,
      editingRule: null,
      isDirty: true
    });
  },
  
  removeRule: (stepId: string, ruleId: string) => {
    const { steps } = get();
    set({
      steps: steps.map(step =>
        step.id === stepId
          ? { ...step, rules: step.rules.filter(r => r.id !== ruleId) }
          : step
      ),
      isDirty: true
    });
  },
  
  // Mapping actions
  openMappingModal: (stepId: string) => {
    set({ 
      isMappingModalOpen: true,
      activeStepId: stepId
    });
  },
  
  closeMappingModal: () => {
    set({ isMappingModalOpen: false });
  },
  
  saveMapping: (stepId: string, mapping: FieldMapping) => {
    const { steps } = get();
    const updatedSteps = steps.map(step => {
      if (step.id === stepId) {
        const existingIndex = step.mappings.findIndex(m => m.id === mapping.id);
        const updatedMappings = existingIndex >= 0
          ? step.mappings.map(m => m.id === mapping.id ? mapping : m)
          : [...step.mappings, mapping];
        
        return { ...step, mappings: updatedMappings };
      }
      return step;
    });
    
    set({ 
      steps: updatedSteps,
      isDirty: true
    });
  },
  
  removeMapping: (stepId: string, mappingId: string) => {
    const { steps } = get();
    set({
      steps: steps.map(step =>
        step.id === stepId
          ? { ...step, mappings: step.mappings.filter(m => m.id !== mappingId) }
          : step
      ),
      isDirty: true
    });
  },
  
  autoMapFields: (_stepId: string) => {
    // TODO: Implement Auto-Map algorithm in Phase 5
    logger.debug('Auto-Map not yet implemented - Phase 5', { component: 'FormBuilderStore' });
  },
  
  // Preview actions
  openPreviewModal: () => {
    set({ isPreviewModalOpen: true });
  },
  
  closePreviewModal: () => {
    set({ isPreviewModalOpen: false });
  },
  
  // Persistence
  loadForm: (formData: unknown) => {
    const fd = formData as Record<string, unknown>;
    set({
      formId: String(fd.id ?? ''),
      formName: String(fd.name || 'Untitled Form'),
      formDescription: String(fd.description || ''),
      steps: (Array.isArray(fd.steps) ? fd.steps : null) || [createDefaultStep(0)],
      activeStepId: (Array.isArray(fd.steps) && fd.steps[0]?.id) || null,
      isDirty: false
    });
  },
  
  resetForm: () => {
    set({
      formId: undefined,
      formName: 'Untitled Form',
      formDescription: '',
      steps: [createDefaultStep(0)],
      activeStepId: null,
      activeTab: 'steps',
      isDirty: false,
      isFieldModalOpen: false,
      isRuleModalOpen: false,
      isMappingModalOpen: false,
      isPreviewModalOpen: false,
      editingField: null,
      editingRule: null
    });
  },
  
  getFormData: () => {
    const state = get();
    return {
      id: state.formId,
      name: state.formName,
      description: state.formDescription,
      steps: state.steps
    };
  }
}));
