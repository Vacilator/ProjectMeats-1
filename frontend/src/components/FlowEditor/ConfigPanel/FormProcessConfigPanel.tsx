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
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(var(--color-border));

  svg {
    width: 18px;
    height: 18px;
    color: rgb(var(--color-primary));
  }
`;

const SectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const TextArea = styled.textarea`
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
`;

const SettingInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SettingLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const SettingDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const Toggle = styled.label`
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgb(var(--color-border));
    transition: 0.3s;
    border-radius: 24px;

    &:before {
      content: '';
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }

  input:checked + .slider {
    background-color: rgb(var(--color-primary));
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }
`;

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
  const data = node.data || {};

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
            value={data.containerName || data.label || ''}
            onChange={(e) => handleChange('containerName', e.target.value)}
            placeholder="e.g., Customer Onboarding Form"
          />
        </Field>

        <Field>
          <Label>Description</Label>
          <TextArea
            value={data.containerDescription || data.description || ''}
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
            <span className="slider"></span>
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
            <span className="slider"></span>
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
            <span className="slider"></span>
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
            <span className="slider"></span>
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
            <span className="slider"></span>
          </Toggle>
        </SettingRow>
      </Section>
    </Container>
  );
};
