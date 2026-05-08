/**
 * DataMappingPanel Component
 *
 * UI for mapping form field outputs to workflow node inputs.
 * Provides visual interface for creating, editing, and validating data connections.
 *
 * Features:
 * - Drag-and-drop field mapping
 * - Auto-complete for field selection
 * - Transformation expression editor
 * - Validation feedback
 * - Preview of mapped data
 *
 * Created: 2026-02-21 - Phase 1: Hybrid Functionality
 */

import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Node } from '@xyflow/react';
import { ArrowRight, Plus, Trash2, AlertCircle, CheckCircle, Code } from 'lucide-react';
import { useFormDataMapping, FormDataMapping, FormOutputField } from '../hooks/useFormDataMapping';

/**
 * Props for DataMappingPanel
 */
interface DataMappingPanelProps {
  /** Current node being configured */
  node: Node;
  /** Callback when mappings change */
  onMappingsChange?: (mappings: FormDataMapping[]) => void;
}

/**
 * Styled Components
 */
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: rgb(var(--color-surface));
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AddButton = styled.button`
  padding: 8px 12px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MappingsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MappingRow = styled.div<{ hasError?: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-background-secondary));
  border-radius: 6px;
  border: 1px solid ${props =>
    props.hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'
  };
`;

const FieldBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FieldSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const FieldInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const ArrowIcon = styled(ArrowRight)`
  color: rgb(var(--color-text-secondary));
  flex-shrink: 0;
`;

const DeleteButton = styled.button`
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgb(var(--color-error));
    color: rgb(var(--color-text-inverse));
  }
`;

const TransformRow = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgb(var(--color-border));
`;

const TransformInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  font-family: 'Monaco', 'Courier New', monospace;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const ValidationMessage = styled.div<{ type: 'error' | 'success' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${props =>
    props.type === 'error'
      ? 'rgb(var(--color-error))'
      : 'rgb(var(--color-success))'
  };
  padding: 8px 12px;
  background: ${props =>
    props.type === 'error'
      ? 'rgba(var(--color-error), 0.1)'
      : 'rgba(var(--color-success), 0.1)'
  };
  border-radius: 6px;
  margin-top: 8px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const InfoBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--color-info), 0.1);
  border: 1px solid rgba(var(--color-info), 0.3);
  border-radius: 6px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

/**
 * DataMappingPanel Component
 */
export const DataMappingPanel: React.FC<DataMappingPanelProps> = React.memo(({
  node,
  onMappingsChange,
}) => {
  const {
    getUpstreamFormFields,
    getMappingsForNode,
    setMapping,
    removeMapping,
    validateMapping,
  } = useFormDataMapping();

  const [showTransform, setShowTransform] = useState<Record<string, boolean>>({});

  // Get available upstream form fields
  const availableFields = useMemo(() =>
    getUpstreamFormFields(node.id),
    [node.id, getUpstreamFormFields]
  );

  // Get current mappings for this node
  const currentMappings = useMemo(() =>
    getMappingsForNode(node.id),
    [node.id, getMappingsForNode]
  );

  /**
   * Handle adding a new mapping
   */
  const handleAddMapping = useCallback(() => {
    if (availableFields.length === 0) return;

    const newMapping: FormDataMapping = {
      formNodeId: '', // Will be filled on selection
      fieldId: '',
      fieldName: '',
      fieldType: '',
      targetNodeId: node.id,
      targetProperty: '',
    };

    // Trigger mapping change with placeholder
    const updatedMappings = [...currentMappings, newMapping];
    onMappingsChange?.(updatedMappings);
  }, [availableFields, currentMappings, node.id, onMappingsChange]);

  /**
   * Handle field selection
   */
  const handleFieldSelect = useCallback((index: number, fieldId: string) => {
    const field = availableFields.find(f => f.id === fieldId);
    if (!field) return;

    const updatedMapping: FormDataMapping = {
      ...currentMappings[index],
      fieldId: field.id,
      fieldName: field.name,
      fieldType: field.type,
      // Extract formNodeId from handleId pattern
      formNodeId: field.handleId.split('-')[0],
    };

    setMapping(updatedMapping);
    onMappingsChange?.(getMappingsForNode(node.id));
  }, [availableFields, currentMappings, node.id, setMapping, getMappingsForNode, onMappingsChange]);

  /**
   * Handle target property change
   */
  const handleTargetPropertyChange = useCallback((index: number, property: string) => {
    const updatedMapping: FormDataMapping = {
      ...currentMappings[index],
      targetProperty: property,
    };

    setMapping(updatedMapping);
    onMappingsChange?.(getMappingsForNode(node.id));
  }, [currentMappings, node.id, setMapping, getMappingsForNode, onMappingsChange]);

  /**
   * Handle transformation expression change
   */
  const handleTransformChange = useCallback((index: number, transform: string) => {
    const updatedMapping: FormDataMapping = {
      ...currentMappings[index],
      transform,
    };

    setMapping(updatedMapping);
    onMappingsChange?.(getMappingsForNode(node.id));
  }, [currentMappings, node.id, setMapping, getMappingsForNode, onMappingsChange]);

  /**
   * Handle removing a mapping
   */
  const handleRemoveMapping = useCallback((index: number) => {
    const mapping = currentMappings[index];
    removeMapping(mapping.formNodeId, mapping.targetNodeId, mapping.fieldId);
    onMappingsChange?.(getMappingsForNode(node.id));
  }, [currentMappings, node.id, removeMapping, getMappingsForNode, onMappingsChange]);

  /**
   * Validate a mapping and get errors
   */
  const getMappingValidation = useCallback((mapping: FormDataMapping) => {
    return validateMapping(mapping);
  }, [validateMapping]);

  return (
    <Container>
      <Header>
        <Title>
          <ArrowRight size={18} />
          Data Mapping
        </Title>
        <AddButton
          onClick={handleAddMapping}
          disabled={availableFields.length === 0}
          aria-label="Add new data mapping"
        >
          <Plus size={16} />
          Add Mapping
        </AddButton>
      </Header>

      {availableFields.length === 0 && (
        <InfoBox>
          <AlertCircle size={16} />
          <span>
            No form fields available. Connect a form node to this workflow node to enable data mapping.
          </span>
        </InfoBox>
      )}

      {currentMappings.length === 0 && availableFields.length > 0 && (
        <EmptyState>
          Click "Add Mapping" to connect form data to this workflow step
        </EmptyState>
      )}

      <MappingsList>
        {currentMappings.map((mapping, index) => {
          const validation = getMappingValidation(mapping);
          const hasError = !validation.valid;

          return (
            <MappingRow key={`${mapping.fieldId}-${index}`} hasError={hasError}>
              <FieldBox>
                <FieldLabel>Source Field</FieldLabel>
                <FieldSelect
                  value={mapping.fieldId}
                  onChange={(e) => handleFieldSelect(index, e.target.value)}
                  aria-label="Select source form field"
                >
                  <option value="">Select field...</option>
                  {availableFields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.label} ({field.type})
                    </option>
                  ))}
                </FieldSelect>
              </FieldBox>

              <ArrowIcon size={20} />

              <FieldBox>
                <FieldLabel>Target Property</FieldLabel>
                <FieldInput
                  type="text"
                  value={mapping.targetProperty}
                  onChange={(e) => handleTargetPropertyChange(index, e.target.value)}
                  placeholder="e.g., customerName"
                  aria-label="Enter target property name"
                />
              </FieldBox>

              <DeleteButton
                onClick={() => handleRemoveMapping(index)}
                aria-label="Remove mapping"
              >
                <Trash2 size={16} />
              </DeleteButton>

              {/* Optional Transform Expression */}
              {showTransform[index] && (
                <TransformRow>
                  <Code size={16} style={{ color: 'rgb(var(--color-text-secondary))' }} />
                  <TransformInput
                    type="text"
                    value={mapping.transform || ''}
                    onChange={(e) => handleTransformChange(index, e.target.value)}
                    placeholder="e.g., value.toUpperCase()"
                    aria-label="Enter transformation expression"
                  />
                </TransformRow>
              )}

              {/* Validation Messages */}
              {hasError && validation.errors.length > 0 && (
                <ValidationMessage type="error">
                  <AlertCircle size={14} />
                  {validation.errors[0]}
                </ValidationMessage>
              )}

              {!hasError && mapping.fieldId && mapping.targetProperty && (
                <ValidationMessage type="success">
                  <CheckCircle size={14} />
                  Mapping configured successfully
                </ValidationMessage>
              )}
            </MappingRow>
          );
        })}
      </MappingsList>
    </Container>
  );
});

DataMappingPanel.displayName = 'DataMappingPanel';
