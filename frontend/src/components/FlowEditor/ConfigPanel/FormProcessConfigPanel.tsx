/**
 * FormProcessConfigPanel Component
 *
 * Configuration panel for Form Process container nodes.
 * Displays step management UI and container settings.
 *
 * Features:
 * - Step management (view, reorder, add, delete)
 * - Container properties (name, description)
 * - Navigation settings (back, skip, auto-advance)
 * - Behavior settings (progress indicator, confirm exit)
 *
 * Created: 2026-02-17 - Phase B.4: Step Management UI
 */

import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Package, Settings, Navigation } from 'lucide-react';
import { Node, Edge } from '@xyflow/react';
import { StepManagerPanel } from './StepManagerPanel';

// Import shared styled components
import {
  Section,
  SectionHeader,
  SectionTitle,
  FormField,
  Label,
  Input,
  TextArea,
  SettingRow,
  SettingInfo,
  SettingLabel,
  SettingDescription,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Types
// ============================================================================

export interface FormProcessConfigPanelProps {
  /** Current node */
  node: Node;
  /** All nodes in the flow */
  nodes: Node[];
  /** All edges in the flow */
  edges: Edge[];
  /** Callback to update node data */
  onUpdateNode: (nodeId: string, data: Partial<Node['data']>) => void;
  /** Callback to select a node */
  onSelectNode: (nodeId: string) => void;
  /** Callback to delete a node */
  onDeleteNode: (nodeId: string) => void;
  /** Callback to add a new step */
  onAddStep: () => void;
  /** Callback to reorder steps */
  onReorderSteps: (nodeIds: string[]) => void;
}

// ============================================================================
// Local Styled Components
// ============================================================================

// Simple container (no complex styling needed)
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
`;

// Toggle switch label
const Toggle = styled.label`
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  input:checked + span {
    background: rgb(var(--color-primary));
  }

  input:checked + span:before {
    transform: translateX(24px);
  }

  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgb(var(--color-border));
    transition: 0.2s;
    border-radius: 24px;

    &:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: rgb(var(--color-surface));
      transition: 0.2s;
      border-radius: 50%;
    }
  }
`;

// Field is actually FormField from shared
const Field = FormField;

// ============================================================================
// Component
// ============================================================================

export const FormProcessConfigPanel: React.FC<FormProcessConfigPanelProps> = ({
  node,
  nodes,
  edges,
  onUpdateNode,
  onSelectNode,
  onDeleteNode,
  onAddStep,
  onReorderSteps,
}) => {
  const data = (node.data ?? {}) as Record<string, any>;

  const containerName =
    typeof data.containerName === 'string'
      ? data.containerName
      : typeof data.label === 'string'
        ? data.label
        : '';

  const containerDescription =
    typeof data.containerDescription === 'string'
      ? data.containerDescription
      : typeof data.description === 'string'
        ? data.description
        : '';

  // Handle field changes
  const handleChange = useCallback((field: string, value: any) => {
    onUpdateNode(node.id, { [field]: value });
  }, [node.id, onUpdateNode]);

  return (
    <Container>
      {/* Container Properties */}
      <Section>
        <SectionHeader>
          <Package />
          <SectionTitle>Container Properties</SectionTitle>
        </SectionHeader>

        <Field>
          <Label>Container Name</Label>
          <Input
            type="text"
            value={containerName}
            onChange={(e) => handleChange('containerName', e.target.value)}
            placeholder="e.g., Customer Onboarding Form"
          />
        </Field>

        <Field>
          <Label>Description</Label>
          <TextArea
            value={containerDescription}
            onChange={(e) => handleChange('containerDescription', e.target.value)}
            placeholder="Brief description of this form process..."
          />
        </Field>
      </Section>

      {/* Step Management */}
      <Section>
        <StepManagerPanel
          containerId={node.id}
          nodes={nodes}
          edges={edges}
          onSelectNode={onSelectNode}
          onDeleteNode={onDeleteNode}
          onAddStep={onAddStep}
          onUpdateNode={onUpdateNode}
          onReorderSteps={onReorderSteps}
        />
      </Section>

      {/* Navigation Settings */}
      <Section>
        <SectionHeader>
          <Navigation />
          <SectionTitle>Navigation & Behavior</SectionTitle>
        </SectionHeader>

        <SettingRow>
          <SettingInfo>
            <SettingLabel>Show Progress Indicator</SettingLabel>
            <SettingDescription>Display step progress during execution</SettingDescription>
          </SettingInfo>
          <Toggle>
            <input
              type="checkbox"
              checked={data.showProgressIndicator !== false}
              onChange={(e) => handleChange('showProgressIndicator', e.target.checked)}
            />
            <span className="slider" />
          </Toggle>
        </SettingRow>

        <SettingRow>
          <SettingInfo>
            <SettingLabel>Allow Back Navigation</SettingLabel>
            <SettingDescription>Users can return to previous steps</SettingDescription>
          </SettingInfo>
          <Toggle>
            <input
              type="checkbox"
              checked={data.allowBackNavigation !== false}
              onChange={(e) => handleChange('allowBackNavigation', e.target.checked)}
            />
            <span className="slider" />
          </Toggle>
        </SettingRow>

        <SettingRow>
          <SettingInfo>
            <SettingLabel>Allow Skip Steps</SettingLabel>
            <SettingDescription>Users can skip optional steps</SettingDescription>
          </SettingInfo>
          <Toggle>
            <input
              type="checkbox"
              checked={data.allowSkipSteps === true}
              onChange={(e) => handleChange('allowSkipSteps', e.target.checked)}
            />
            <span className="slider" />
          </Toggle>
        </SettingRow>

        <SettingRow>
          <SettingInfo>
            <SettingLabel>Auto-Advance</SettingLabel>
            <SettingDescription>Automatically proceed to next step on completion</SettingDescription>
          </SettingInfo>
          <Toggle>
            <input
              type="checkbox"
              checked={data.autoAdvance === true}
              onChange={(e) => handleChange('autoAdvance', e.target.checked)}
            />
            <span className="slider" />
          </Toggle>
        </SettingRow>

        <SettingRow>
          <SettingInfo>
            <SettingLabel>Confirm on Exit</SettingLabel>
            <SettingDescription>Require confirmation before exiting form</SettingDescription>
          </SettingInfo>
          <Toggle>
            <input
              type="checkbox"
              checked={data.confirmOnExit !== false}
              onChange={(e) => handleChange('confirmOnExit', e.target.checked)}
            />
            <span className="slider" />
          </Toggle>
        </SettingRow>
      </Section>
    </Container>
  );
};
