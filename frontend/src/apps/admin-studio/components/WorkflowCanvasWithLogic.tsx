/**
 * WorkflowCanvasWithLogic Component
 * 
 * Enhanced workflow designer with data mapping and entity orchestration.
 * The "Logic Panel" transforms this from a shape drawer into a workflow orchestrator.
 * 
 * Key Features:
 * - Node-based workflow visualization
 * - Side panel for step configuration
 * - Entity selection per step
 * - Field mapping between steps
 * - Data flow visualization
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface WorkflowCanvasWithLogicProps {
  blueprintId: string;
  csrfToken: string;
}

interface WorkflowStep {
  id: string;
  label: string;
  type: 'form' | 'approval' | 'notification' | 'action';
  entityType?: string;  // NEW: Entity this step operates on (Customer, Order, etc.)
  config?: {
    form_fields?: string[];
    field_mappings?: FieldMapping[];  // NEW: Data flow between steps
    [key: string]: any;
  };
}

interface FieldMapping {
  targetField: string;      // Field in current step
  sourceStep: string;        // ID of source step
  sourceField: string;       // Field from source step
  transformFunction?: string; // Optional: data transformation
}

// Mock entity definitions (will come from backend later)
const ENTITY_TYPES = [
  { value: 'customer', label: '👤 Customer', fields: ['name', 'email', 'phone', 'address'] },
  { value: 'supplier', label: '🏭 Supplier', fields: ['company_name', 'contact_person', 'tax_id'] },
  { value: 'sales_order', label: '📦 Sales Order', fields: ['order_number', 'customer_id', 'total_amount', 'delivery_date'] },
  { value: 'purchase_order', label: '🛒 Purchase Order', fields: ['po_number', 'supplier_id', 'items', 'payment_terms'] },
  { value: 'payment', label: '💰 Payment', fields: ['amount', 'payment_method', 'transaction_id', 'reference'] },
];

const WorkflowCanvasWithLogic: React.FC<WorkflowCanvasWithLogicProps> = ({ blueprintId, csrfToken }) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

  // Fetch workflow config from API
  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `/admin/system-config/api/studio/versions/${blueprintId}/`,
          {
            headers: {
              'X-CSRFToken': csrfToken,
              'Content-Type': 'application/json',
            },
          }
        );

        const workflowConfig = response.data.workflow_config || [];
        
        const loadedSteps: WorkflowStep[] = Array.isArray(workflowConfig)
          ? workflowConfig.map((step: any, index: number) => ({
              id: step.id || `step_${index + 1}`,
              label: step.label || `Step ${index + 1}`,
              type: step.type || 'form',
              entityType: step.entityType,
              config: step.config || {},
            }))
          : [];

        setSteps(loadedSteps);
        setMessage({ type: 'success', text: 'Workflow loaded successfully' });
      } catch (error: any) {
        console.error('Error fetching workflow:', error);
        setMessage({ type: 'error', text: `Failed to load workflow: ${error.message}` });
      } finally {
        setLoading(false);
        setTimeout(() => setMessage(null), 3000);
      }
    };

    fetchWorkflow();
  }, [blueprintId, csrfToken]);

  // Save workflow config to API
  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const workflowConfig = steps.map(step => ({
        id: step.id,
        label: step.label,
        type: step.type,
        entityType: step.entityType,
        config: step.config,
      }));

      await axios.patch(
        `/admin/system-config/api/studio/versions/${blueprintId}/workflow/`,
        { workflow_config: workflowConfig },
        {
          headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json',
          },
        }
      );

      setMessage({ type: 'success', text: '✅ Workflow saved successfully!' });
    } catch (error: any) {
      console.error('Error saving workflow:', error);
      setMessage({ type: 'error', text: `❌ Failed to save: ${error.message}` });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Add new step
  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      label: `New Step ${steps.length + 1}`,
      type: 'form',
      config: {
        field_mappings: [],
      },
    };
    setSteps([...steps, newStep]);
    setSelectedStepIndex(steps.length); // Auto-select new step
  };

  // Update step
  const handleUpdateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const updatedSteps = [...steps];
    updatedSteps[index] = { ...updatedSteps[index], ...updates };
    setSteps(updatedSteps);
  };

  // Delete step
  const handleDeleteStep = (index: number) => {
    if (confirm('Delete this workflow step?')) {
      setSteps(steps.filter((_, i) => i !== index));
      if (selectedStepIndex === index) {
        setSelectedStepIndex(null);
      }
    }
  };

  // Move step up/down
  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
    
    // Update selected index
    if (selectedStepIndex === index) {
      setSelectedStepIndex(targetIndex);
    } else if (selectedStepIndex === targetIndex) {
      setSelectedStepIndex(index);
    }
  };

  // Add field mapping
  const handleAddFieldMapping = (stepIndex: number) => {
    const step = steps[stepIndex];
    const newMapping: FieldMapping = {
      targetField: '',
      sourceStep: '',
      sourceField: '',
    };
    
    const updatedConfig = {
      ...step.config,
      field_mappings: [...(step.config?.field_mappings || []), newMapping],
    };
    
    handleUpdateStep(stepIndex, { config: updatedConfig });
  };

  // Update field mapping
  const handleUpdateFieldMapping = (
    stepIndex: number,
    mappingIndex: number,
    updates: Partial<FieldMapping>
  ) => {
    const step = steps[stepIndex];
    const updatedMappings = [...(step.config?.field_mappings || [])];
    updatedMappings[mappingIndex] = { ...updatedMappings[mappingIndex], ...updates };
    
    const updatedConfig = {
      ...step.config,
      field_mappings: updatedMappings,
    };
    
    handleUpdateStep(stepIndex, { config: updatedConfig });
  };

  // Remove field mapping
  const handleRemoveFieldMapping = (stepIndex: number, mappingIndex: number) => {
    const step = steps[stepIndex];
    const updatedMappings = (step.config?.field_mappings || []).filter((_, i) => i !== mappingIndex);
    
    const updatedConfig = {
      ...step.config,
      field_mappings: updatedMappings,
    };
    
    handleUpdateStep(stepIndex, { config: updatedConfig });
  };

  // Get entity fields for selected entity type
  const getEntityFields = (entityType: string | undefined) => {
    if (!entityType) return [];
    const entity = ENTITY_TYPES.find(e => e.value === entityType);
    return entity?.fields || [];
  };

  // Get available source steps (all steps before current)
  const getAvailableSourceSteps = (currentIndex: number) => {
    return steps.slice(0, currentIndex);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  const selectedStep = selectedStepIndex !== null ? steps[selectedStepIndex] : null;
  const selectedEntity = selectedStep?.entityType ? ENTITY_TYPES.find(e => e.value === selectedStep.entityType) : null;

  return (
    <div className="relative h-full flex">
      {/* Main Canvas Area */}
      <div className={`flex-1 p-8 overflow-auto transition-all duration-300 ${selectedStep ? 'mr-[450px]' : ''}`}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Workflow Orchestrator</h2>
              <p className="text-sm text-gray-500 mt-1">
                Define steps and map data flow between entities
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddStep}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                ➕ Add Step
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '💾 Saving...' : '💾 Save Workflow'}
              </button>
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`mt-4 px-4 py-3 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Workflow Steps as Cards */}
        <div className="space-y-6">
          {steps.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🔄</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No workflow steps defined</h3>
              <p className="text-gray-500 mb-4">
                Create a multi-entity workflow by adding your first step
              </p>
              <button
                onClick={handleAddStep}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                ➕ Add First Step
              </button>
            </div>
          ) : (
            steps.map((step, index) => {
              const entity = ENTITY_TYPES.find(e => e.value === step.entityType);
              const isSelected = selectedStepIndex === index;
              
              return (
                <div key={step.id}>
                  {/* Step Card */}
                  <div
                    onClick={() => setSelectedStepIndex(index)}
                    className={`bg-white border-2 rounded-lg p-6 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {/* Step Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveStep(index, 'up');
                            }}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ⬆️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveStep(index, 'down');
                            }}
                            disabled={index === steps.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ⬇️
                          </button>
                        </div>
                        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-700 font-bold rounded-full text-lg">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-xl font-semibold text-gray-900">{step.label}</div>
                          {entity && (
                            <div className="text-sm text-gray-600 mt-1">
                              {entity.label}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStep(index);
                        }}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Step Info */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`px-3 py-1 rounded-full font-medium ${
                        step.type === 'form'
                          ? 'bg-blue-100 text-blue-800'
                          : step.type === 'approval'
                          ? 'bg-green-100 text-green-800'
                          : step.type === 'notification'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {step.type === 'form' && '📝 Form'}
                        {step.type === 'approval' && '✅ Approval'}
                        {step.type === 'notification' && '📧 Notification'}
                        {step.type === 'action' && '⚡ Action'}
                      </span>
                      
                      {step.config?.field_mappings && step.config.field_mappings.length > 0 && (
                        <span className="text-gray-600">
                          🔗 {step.config.field_mappings.length} field mapping{step.config.field_mappings.length > 1 ? 's' : ''}
                        </span>
                      )}
                      
                      {!step.entityType && (
                        <span className="text-orange-600">⚠️ No entity selected</span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-4 text-sm text-blue-600 font-medium">
                        👉 Configure this step in the Logic Panel →
                      </div>
                    )}
                  </div>

                  {/* Connector Arrow */}
                  {index < steps.length - 1 && (
                    <div className="flex justify-center py-4">
                      <div className="text-3xl text-gray-400">↓</div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Logic Panel (Side Panel) */}
      {selectedStep !== null && selectedStepIndex !== null && (
        <div className="fixed right-0 top-0 h-full w-[450px] bg-white border-l-2 border-gray-300 shadow-2xl z-50 overflow-y-auto">
          {/* Panel Header */}
          <div className="sticky top-0 bg-blue-600 text-white p-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Step Configuration</h3>
                <p className="text-sm text-blue-100 mt-1">
                  Step {selectedStepIndex + 1}: {selectedStep.label}
                </p>
              </div>
              <button
                onClick={() => setSelectedStepIndex(null)}
                className="text-white hover:bg-blue-700 p-2 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="p-6 space-y-6">
            {/* Section 1: Identity */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-lg border-b pb-2">📋 Step Identity</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step Name
                </label>
                <input
                  type="text"
                  value={selectedStep.label}
                  onChange={(e) => handleUpdateStep(selectedStepIndex, { label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Customer Information"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step Type
                </label>
                <select
                  value={selectedStep.type}
                  onChange={(e) => handleUpdateStep(selectedStepIndex, { type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="form">📝 Form (User Input)</option>
                  <option value="approval">✅ Approval</option>
                  <option value="notification">📧 Notification</option>
                  <option value="action">⚡ Action</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entity Context <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStep.entityType || ''}
                  onChange={(e) => handleUpdateStep(selectedStepIndex, { entityType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select Entity --</option>
                  {ENTITY_TYPES.map(entity => (
                    <option key={entity.value} value={entity.value}>
                      {entity.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Which entity does this step operate on?
                </p>
              </div>
            </div>

            {/* Section 2: Field Mapping */}
            {selectedStep.entityType && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-semibold text-gray-900 text-lg">🔗 Field Mapping</h4>
                  <button
                    onClick={() => handleAddFieldMapping(selectedStepIndex)}
                    className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                  >
                    + Add Mapping
                  </button>
                </div>

                {selectedEntity && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Available Fields in {selectedEntity.label}:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntity.fields.map(field => (
                        <span key={field} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Mappings List */}
                <div className="space-y-3">
                  {(selectedStep.config?.field_mappings || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                      <div className="text-4xl mb-2">🔗</div>
                      <p className="text-sm">No field mappings yet</p>
                      <p className="text-xs mt-1">Add mappings to link data from previous steps</p>
                    </div>
                  ) : (
                    (selectedStep.config?.field_mappings || []).map((mapping, mapIndex) => {
                      const sourceStep = steps.find(s => s.id === mapping.sourceStep);
                      const sourceEntity = sourceStep?.entityType ? ENTITY_TYPES.find(e => e.value === sourceStep.entityType) : null;
                      
                      return (
                        <div key={mapIndex} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                              Mapping #{mapIndex + 1}
                            </span>
                            <button
                              onClick={() => handleRemoveFieldMapping(selectedStepIndex, mapIndex)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          {/* Target Field */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Target Field (in this step)
                            </label>
                            <select
                              value={mapping.targetField}
                              onChange={(e) => handleUpdateFieldMapping(selectedStepIndex, mapIndex, { targetField: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            >
                              <option value="">-- Select Field --</option>
                              {getEntityFields(selectedStep.entityType).map(field => (
                                <option key={field} value={field}>{field}</option>
                              ))}
                            </select>
                          </div>

                          {/* Source Step */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Source Step
                            </label>
                            <select
                              value={mapping.sourceStep}
                              onChange={(e) => handleUpdateFieldMapping(selectedStepIndex, mapIndex, { sourceStep: e.target.value, sourceField: '' })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            >
                              <option value="">-- Select Step --</option>
                              {getAvailableSourceSteps(selectedStepIndex).map((step, idx) => (
                                <option key={step.id} value={step.id}>
                                  Step {idx + 1}: {step.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Source Field */}
                          {mapping.sourceStep && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Source Field
                              </label>
                              <select
                                value={mapping.sourceField}
                                onChange={(e) => handleUpdateFieldMapping(selectedStepIndex, mapIndex, { sourceField: e.target.value })}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              >
                                <option value="">-- Select Field --</option>
                                {getEntityFields(sourceStep?.entityType).map(field => (
                                  <option key={field} value={field}>{field}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Preview */}
                          {mapping.targetField && mapping.sourceStep && mapping.sourceField && (
                            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                              <div className="font-mono text-blue-700">
                                {mapping.targetField} = {sourceStep?.label}.{mapping.sourceField}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Data Flow Visualization */}
            {selectedStep.config?.field_mappings && selectedStep.config.field_mappings.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-lg border-b pb-2">📊 Data Flow</h4>
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    {selectedStep.config.field_mappings.map((mapping, idx) => {
                      const sourceStep = steps.find(s => s.id === mapping.sourceStep);
                      return (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <div className="flex-1 bg-white p-2 rounded border">
                            <span className="font-medium text-gray-700">{sourceStep?.label || '?'}</span>
                            <span className="text-gray-500 mx-1">→</span>
                            <span className="text-blue-600">{mapping.sourceField}</span>
                          </div>
                          <div className="text-xl">→</div>
                          <div className="flex-1 bg-white p-2 rounded border">
                            <span className="font-medium text-gray-700">{selectedStep.label}</span>
                            <span className="text-gray-500 mx-1">→</span>
                            <span className="text-purple-600">{mapping.targetField}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t p-4">
            <button
              onClick={() => setSelectedStepIndex(null)}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
            >
              ✓ Done Configuring
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowCanvasWithLogic;
