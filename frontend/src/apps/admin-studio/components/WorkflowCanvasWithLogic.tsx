/**
 * WorkflowCanvasWithLogic Component
 * 
 * Enhanced workflow designer with data mapping, entity orchestration, and visual data ports.
 * The "Logic Panel" transforms this from a shape drawer into a workflow orchestrator.
 * 
 * Key Features:
 * - ReactFlow canvas with custom nodes
 * - Visual data ports (input/output handles) for each field
 * - Side panel for step configuration
 * - Entity selection per step
 * - Field mapping between steps
 * - Data flow visualization with connections
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  Background,
  Controls,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

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
  { value: 'customer', label: '👤 Customer', fields: ['id', 'name', 'email', 'phone', 'address'] },
  { value: 'supplier', label: '🏭 Supplier', fields: ['id', 'company_name', 'contact_person', 'tax_id'] },
  { value: 'sales_order', label: '📦 Sales Order', fields: ['id', 'order_number', 'customer_id', 'total_amount', 'delivery_date'] },
  { value: 'purchase_order', label: '🛒 Purchase Order', fields: ['id', 'po_number', 'supplier_id', 'items', 'payment_terms'] },
  { value: 'payment', label: '💰 Payment', fields: ['id', 'amount', 'payment_method', 'transaction_id', 'reference'] },
];

// Custom Entity Node with Input/Output Ports
interface EntityNodeData {
  label: string;
  entityType?: string;
  fields: string[];
  onClick?: () => void;
}

const EntityNode: React.FC<NodeProps<EntityNodeData>> = ({ data }) => {
  const entity = ENTITY_TYPES.find(e => e.value === data.entityType);
  const entityLabel = entity?.label || '📄 Generic';
  const fields = data.fields && data.fields.length > 0 ? data.fields : ['id', 'created_at'];

  return (
    <div
      onClick={data.onClick}
      className="bg-white rounded-lg shadow-lg border-2 border-gray-300 hover:border-blue-500 transition-all cursor-pointer min-w-[220px]"
      style={{ padding: 0 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-t-lg">
        <div className="text-sm font-semibold">{data.label}</div>
        <div className="text-xs opacity-90 mt-1">{entityLabel}</div>
      </div>

      {/* Body - Field List with Ports */}
      <div className="py-2">
        {fields.map((field, index) => (
          <div
            key={field}
            className="relative flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            {/* Input Port (Left) */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${field}-target`}
              className="!w-3 !h-3 !bg-green-500 !border-2 !border-white hover:!w-4 hover:!h-4 transition-all"
              style={{ left: -6 }}
            />

            {/* Field Name */}
            <span className="text-sm text-gray-700 font-mono select-none">
              {field}
            </span>

            {/* Output Port (Right) */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${field}-source`}
              className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white hover:!w-4 hover:!h-4 transition-all"
              style={{ right: -6 }}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 rounded-b-lg border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          {fields.length} field{fields.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

// Register custom node types
const nodeTypes = {
  entityNode: EntityNode,
};

const WorkflowCanvasWithLogic: React.FC<WorkflowCanvasWithLogicProps> = ({ blueprintId, csrfToken }) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

  // ReactFlow state for visual canvas
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync steps to ReactFlow nodes
  useEffect(() => {
    const reactFlowNodes: Node<EntityNodeData>[] = steps.map((step, index) => {
      const entity = ENTITY_TYPES.find(e => e.value === step.entityType);
      const fields = entity?.fields || ['id', 'created_at'];

      return {
        id: step.id,
        type: 'entityNode',
        position: { x: 100 + index * 280, y: 100 },
        data: {
          label: step.label,
          entityType: step.entityType,
          fields,
          onClick: () => setSelectedStepIndex(index),
        },
      };
    });

    setNodes(reactFlowNodes);
  }, [steps, setNodes]);

  // Handle ReactFlow connections (when user draws edges between ports)
  const onConnect = useCallback(
    (connection: Connection) => {
      // Extract field names from handle IDs
      const sourceField = connection.sourceHandle?.replace('-source', '');
      const targetField = connection.targetHandle?.replace('-target', '');

      if (!sourceField || !targetField) return;

      // Find target step index
      const targetStepIndex = steps.findIndex(s => s.id === connection.target);
      if (targetStepIndex === -1) return;

      // Add field mapping
      const newMapping: FieldMapping = {
        targetField,
        sourceStep: connection.source || '',
        sourceField,
      };

      const targetStep = steps[targetStepIndex];
      const updatedMappings = [...(targetStep.config?.field_mappings || []), newMapping];

      handleUpdateStep(targetStepIndex, {
        config: {
          ...targetStep.config,
          field_mappings: updatedMappings,
        },
      });

      // Add visual edge
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [steps, setEdges]
  );

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

  // Save workflow config and logic config to API
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

      // Extract field mappings from each step's config to build logic_config
      const logicConfig = {
        field_mappings: steps.map(step => ({
          step_id: step.id,
          entity_type: step.entityType,
          mappings: step.config?.field_mappings || [],
        })),
      };

      // Use the combined PATCH endpoint to update both configs at once
      await axios.patch(
        `/admin/system-config/api/studio/versions/${blueprintId}/`,
        { 
          workflow_config: workflowConfig,
          logic_config: logicConfig,
        },
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

        {/* ReactFlow Canvas with Visual Data Ports */}
        <div style={{ height: 'calc(100vh - 180px)' }} className="bg-gray-50 rounded-lg border-2 border-gray-200 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#ddd" />
            <Controls />
          </ReactFlow>

          {/* Empty State Overlay */}
          {steps.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-white/80 backdrop-blur-sm">
              <div className="text-center pointer-events-auto">
                <div className="text-gray-400 text-6xl mb-4">🔄</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No workflow steps defined</h3>
                <p className="text-gray-500 mb-4">
                  Create a multi-entity workflow by adding your first step
                </p>
                <button
                  onClick={handleAddStep}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  ➕ Add First Step
                </button>
              </div>
            </div>
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
