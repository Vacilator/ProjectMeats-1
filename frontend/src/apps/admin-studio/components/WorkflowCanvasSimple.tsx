/**
 * WorkflowCanvasSimple Component
 * 
 * Simplified workflow designer with API integration.
 * Fetches and saves workflow_config from backend.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface WorkflowCanvasSimpleProps {
  blueprintId: string;
  csrfToken: string;
}

interface WorkflowStep {
  id: string;
  label: string;
  type: 'form' | 'approval' | 'notification' | 'action';
  config?: {
    // Form config
    form_fields?: string[];  // Field IDs from schema
    submit_button_text?: string;
    
    // Approval config
    approver_role?: string;
    approval_message?: string;
    auto_approve_after_hours?: number;
    
    // Notification config
    notification_type?: 'email' | 'sms' | 'in_app';
    recipients?: string[];
    subject?: string;
    message?: string;
    
    // Action config
    action_type?: 'create_record' | 'update_record' | 'send_webhook' | 'custom';
    target_model?: string;
    field_mappings?: Record<string, string>;
  };
}

const WorkflowCanvasSimple: React.FC<WorkflowCanvasSimpleProps> = ({ blueprintId, csrfToken }) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

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
        
        // Convert workflow_config to steps array
        const loadedSteps: WorkflowStep[] = Array.isArray(workflowConfig)
          ? workflowConfig.map((step: any, index: number) => ({
              id: step.id || `step_${index + 1}`,
              label: step.label || `Step ${index + 1}`,
              type: step.type || 'form',
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

      // Convert steps back to workflow_config format
      const workflowConfig = steps.map(step => ({
        id: step.id,
        label: step.label,
        type: step.type,
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
      config: {},
    };
    setSteps([...steps, newStep]);
  };

  // Update step
  const handleUpdateStep = (index: number, field: keyof WorkflowStep, value: any) => {
    const updatedSteps = [...steps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setSteps(updatedSteps);
  };

  // Delete step
  const handleDeleteStep = (index: number) => {
    if (confirm('Delete this workflow step?')) {
      setSteps(steps.filter((_, i) => i !== index));
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Workflow Designer</h2>
            <p className="text-sm text-gray-500 mt-1">
              Define the steps users will complete in this workflow
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

      {/* Workflow Steps */}
      <div className="space-y-4">
        {steps.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No workflow steps defined</h3>
            <p className="text-gray-500 mb-4">
              Get started by adding your first workflow step
            </p>
            <button
              onClick={handleAddStep}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              ➕ Add First Step
            </button>
          </div>
        ) : (
          steps.map((step, index) => (
            <div
              key={step.id}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              {/* Step Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveStep(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={() => handleMoveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ⬇️
                    </button>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-700 font-bold rounded-full">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={step.label}
                      onChange={(e) => handleUpdateStep(index, 'label', e.target.value)}
                      className="text-lg font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-full"
                      placeholder="Step name"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteStep(index)}
                  className="text-red-500 hover:text-red-700 p-2"
                  title="Delete step"
                >
                  🗑️
                </button>
              </div>

              {/* Step Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Step ID
                  </label>
                  <input
                    type="text"
                    value={step.id}
                    onChange={(e) => handleUpdateStep(index, 'id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="unique_step_id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Step Type
                  </label>
                  <select
                    value={step.type}
                    onChange={(e) => handleUpdateStep(index, 'type', e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="form">📝 Form (User Input)</option>
                    <option value="approval">✅ Approval</option>
                    <option value="notification">📧 Notification</option>
                    <option value="action">⚡ Action</option>
                  </select>
                </div>
              </div>

              {/* Type Badge */}
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    step.type === 'form'
                      ? 'bg-blue-100 text-blue-800'
                      : step.type === 'approval'
                      ? 'bg-green-100 text-green-800'
                      : step.type === 'notification'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {step.type === 'form' && '📝 User will fill a form'}
                  {step.type === 'approval' && '✅ Requires approval'}
                  {step.type === 'notification' && '📧 Sends notification'}
                  {step.type === 'action' && '⚡ Triggers automated action'}
                </span>
                <button
                  onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {expandedStep === index ? '▼ Hide Configuration' : '▶ Configure Step'}
                </button>
              </div>

              {/* Expandable Configuration Panel */}
              {expandedStep === index && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Step Configuration
                  </h4>

                  {/* Form Configuration */}
                  {step.type === 'form' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Submit Button Text
                        </label>
                        <input
                          type="text"
                          value={step.config?.submit_button_text || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            submit_button_text: e.target.value
                          })}
                          placeholder="Submit, Next, Continue..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Form Fields (comma-separated field IDs)
                        </label>
                        <input
                          type="text"
                          value={step.config?.form_fields?.join(', ') || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            form_fields: e.target.value.split(',').map(f => f.trim()).filter(Boolean)
                          })}
                          placeholder="customer_name, email, phone"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to show all fields from schema
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Approval Configuration */}
                  {step.type === 'approval' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Approver Role
                        </label>
                        <select
                          value={step.config?.approver_role || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            approver_role: e.target.value
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="">Select role...</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="director">Director</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Approval Message
                        </label>
                        <textarea
                          value={step.config?.approval_message || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            approval_message: e.target.value
                          })}
                          placeholder="Please review and approve this request..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auto-Approve After (hours)
                        </label>
                        <input
                          type="number"
                          value={step.config?.auto_approve_after_hours || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            auto_approve_after_hours: parseInt(e.target.value) || undefined
                          })}
                          placeholder="24, 48, 72..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to require manual approval
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Notification Configuration */}
                  {step.type === 'notification' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notification Type
                        </label>
                        <select
                          value={step.config?.notification_type || 'email'}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            notification_type: e.target.value as 'email' | 'sms' | 'in_app'
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="email">📧 Email</option>
                          <option value="sms">📱 SMS</option>
                          <option value="in_app">🔔 In-App Notification</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Recipients (comma-separated emails/phones)
                        </label>
                        <input
                          type="text"
                          value={step.config?.recipients?.join(', ') || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            recipients: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                          })}
                          placeholder="user@example.com, admin@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={step.config?.subject || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            subject: e.target.value
                          })}
                          placeholder="Workflow notification..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Message
                        </label>
                        <textarea
                          value={step.config?.message || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            message: e.target.value
                          })}
                          placeholder="Your notification message..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Configuration */}
                  {step.type === 'action' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Action Type
                        </label>
                        <select
                          value={step.config?.action_type || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            action_type: e.target.value
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="">Select action...</option>
                          <option value="create_record">➕ Create Record</option>
                          <option value="update_record">✏️ Update Record</option>
                          <option value="send_webhook">🌐 Send Webhook</option>
                          <option value="custom">⚡ Custom Script</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Model/Endpoint
                        </label>
                        <input
                          type="text"
                          value={step.config?.target_model || ''}
                          onChange={(e) => handleUpdateStep(index, 'config', {
                            ...step.config,
                            target_model: e.target.value
                          })}
                          placeholder="Customer, Order, https://api.example.com/webhook"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Field Mappings (JSON)
                        </label>
                        <textarea
                          value={JSON.stringify(step.config?.field_mappings || {}, null, 2)}
                          onChange={(e) => {
                            try {
                              handleUpdateStep(index, 'config', {
                                ...step.config,
                                field_mappings: JSON.parse(e.target.value)
                              });
                            } catch (err) {
                              // Invalid JSON, don't update
                            }
                          }}
                          placeholder='{"db_field": "form_field"}'
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Ghost Row */}
      {steps.length > 0 && (
        <button
          onClick={handleAddStep}
          className="w-full mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          ➕ Click to add another step
        </button>
      )}
    </div>
  );
};

export default WorkflowCanvasSimple;
