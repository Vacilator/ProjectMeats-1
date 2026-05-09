/**
 * Workflow Context Integration Example
 * 
 * Phase 5: Context Inheritance
 * Demonstrates how to use workflow context for data inheritance between steps.
 * 
 * This file serves as:
 * 1. Documentation for developers
 * 2. Reference implementation
 * 3. Testing playground
 * 
 * Created: 2026-02-12 - Phase 5 Context Inheritance Implementation
 */

import React, { useState } from 'react';
import { useWorkflowContext } from '../FormSubmission/hooks/useWorkflowContext';
import { ContextBubble } from '../FormSubmission/ContextBubble';
import { FieldWithContext } from '../FlowEditor/ConfigPanel/FieldWithContext';
import { Node } from '@xyflow/react';

/**
 * Example 1: Basic Template Resolution
 * 
 * Shows how to resolve {{nodeId.fieldKey}} templates
 */
export function BasicTemplateExample() {
  // Mock workflow nodes
  const nodes: Node[] = [
    {
      id: 'step1',
      type: 'formStep',
      position: { x: 0, y: 0 },
      data: { label: 'Customer Information' },
    },
    {
      id: 'step2',
      type: 'formStep',
      position: { x: 0, y: 100 },
      data: { label: 'Order Details' },
    },
  ];

  // Initialize context
  const context = useWorkflowContext(nodes, 'step2');

  // Simulate data from step1
  React.useEffect(() => {
    context.setNodeData('step1', {
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '555-1234',
    });
  }, []);

  // Resolve templates
  const resolvedName = context.resolve('{{step1.customer_name}}');
  const resolvedEmail = context.resolve('{{step1.customer_email}}');

  return (
    <div>
      <h3>Basic Template Resolution</h3>
      <p>Template: {`{{step1.customer_name}}`}</p>
      <p>Resolved: {resolvedName}</p>
      <p>Template: {`{{step1.customer_email}}`}</p>
      <p>Resolved: {resolvedEmail}</p>
    </div>
  );
}

/**
 * All Examples Component
 */
export function WorkflowContextExamples() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Workflow Context - Phase 5 Examples</h2>
      <BasicTemplateExample />
    </div>
  );
}

export default WorkflowContextExamples;
