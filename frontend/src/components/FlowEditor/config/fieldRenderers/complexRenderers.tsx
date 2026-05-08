/**
 * Complex Field Renderers for DynamicConfigPanel
 *
 * Wraps existing specialized components (EntityFieldPicker, FieldMappingPanel,
 * VariablePicker, ValidationRuleBuilder) into the schema-driven renderer system.
 *
 * Phase D.3 of WorkForm Editor Overhaul
 * Created: 2026-02-18
 * Updated: 2026-02-19 - Phase E.3: Added renderEntityFieldPicker for cascading fields
 */

import React from 'react';
import styled from 'styled-components';
import { ConfigField, FieldRenderProps } from '../types';
import EntityFieldPicker, { SelectedField } from '../../ConfigPanel/EntityFieldPicker';
import FieldMappingPanel from '../../ConfigPanel/FieldMappingPanel';
import { normalizeFieldMappings } from '../../utils/fieldMappingsAdapter';
import { VariablePicker, type Variable as VariableOption } from '../../components/VariablePicker';
import ValidationRuleBuilder from '../../ConfigPanel/ValidationRuleBuilder';

// ============================================================================
// Entity Field Picker Renderer (Phase E.3)
// ============================================================================

/**
 * Renders the EntityFieldPicker component for selecting fields from an entity
 *
 * This is the CORRECT component for Form nodes - it shows a list of entity fields
 * and allows users to select which ones to include in the form.
 *
 * Features:
 * - Dynamically fetches fields based on selected entityType
 * - Cascades field options when entity changes
 * - Multi-select with checkboxes
 * - Drag-and-drop field ordering
 * - Search and filter
 *
 * Phase E.3: Cascade field options based on entityType
 */
export function renderEntityFieldPicker(props: FieldRenderProps): React.ReactElement {
  const { field, value, onChange, error, data } = props;

  // EntityFieldPicker expects selectedFields and onFieldsChange
  const selectedFields = (value as SelectedField[]) || [];

  // Extract entity type from data (set by entityType field)
  const entityType = data?.entityType as string | undefined;

  if (!entityType) {
    return (
      <FieldContainer>
        <EmptyState>
          ℹ️ Select an entity type first to see available fields
        </EmptyState>
      </FieldContainer>
    );
  }

  const handleFieldsChange = (fields: SelectedField[]) => {
    onChange(fields);
  };

  // Note: EntityFieldPicker handles entityType changes internally,
  // but we also provide it as initialEntityType for proper cascade behavior
  return (
    <FieldContainer>
      <EntityFieldPicker
        selectedFields={selectedFields}
        onFieldsChange={handleFieldsChange}
        upstreamVariables={data?._upstreamVariables || []}
        entityType={entityType}
        hideEntitySelector
        multiSelectMode={field.multiple ?? true}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FieldContainer>
  );
}

// ============================================================================
// Entity Selector Renderer (DEPRECATED - Use renderEntityTypeSelect)
// ============================================================================

/**
 * Renders the EntityFieldPicker component for selecting entity fields
 * Used for Form Step nodes to select which fields to include in the form
 */
export function renderEntitySelector(props: FieldRenderProps): React.ReactElement {
  const { field, value, onChange, error } = props;

  // EntityFieldPicker expects selectedFields and onFieldsChange
  const selectedFields = (value as SelectedField[]) || [];

  // Extract entity type from data (should be set by entityType field)
  const entityType = props.data?.entityType as string | undefined;

  const handleFieldsChange = (fields: SelectedField[]) => {
    onChange(fields);
  };

  const handleEntityTypeChange = (newEntityType: string) => {
    // Update the entityType field in the parent data
    if (props.onFieldChange) {
      props.onFieldChange('entityType', newEntityType);
    }
  };

  return (
    <FieldContainer>
      <EntityFieldPicker
        selectedFields={selectedFields}
        onFieldsChange={handleFieldsChange}
        initialEntityType={entityType}
        onEntityTypeChange={handleEntityTypeChange}
        multiSelectMode={field.multiple}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FieldContainer>
  );
}

// ============================================================================
// Field Mapping Renderer
// ============================================================================

/**
 * Renders the FieldMappingPanel for mapping variables to entity fields
 * Used for Create Record nodes and other nodes that need to map data
 */
export function renderFieldMapping(props: FieldRenderProps): React.ReactElement {
  const { field, value, onChange, error, data } = props;

  // IMPORTANT:
  // - Schemas may store the "selected entity" under different keys (e.g., entityType vs entity).
  // - Schemas may specify the source key via field.entityFieldId.
  // - FieldMappingPanel expects (mappings: FieldMapping[], formFields, targetEntity, onChange).
  const entityFieldId = (field as any).entityFieldId as string | undefined;

  const entityType = (
    (entityFieldId ? (data as any)?.[entityFieldId] : undefined) ??
    (data as any)?.entityType ??
    (data as any)?.eventEntity ??
    (data as any)?.entity
  ) as string | undefined;

  if (!entityType) {
    return (
      <FieldContainer>
        <EmptyState>ℹ️ Select an entity type first to configure field mappings</EmptyState>
      </FieldContainer>
    );
  }

  // Build source field list from upstream variables (best-effort).
  const upstream = ((data as any)?._upstreamVariables as any[] | undefined) ?? [];
  const formFields = upstream.map((v) => ({
    id: String(v.template ?? `${v.nodeId}.${v.fieldName}`),
    label: String(v.fieldLabel ?? v.fieldName ?? ''),
    type: String(v.fieldType ?? 'string'),
  }));

  // Coerce mappings to the array shape expected by FieldMappingPanel.
  // Older nodes may store AutoMappingService suggestions directly; normalize them.
  const rawMappings = Array.isArray(value)
    ? value
    : Array.isArray(field.defaultValue)
      ? (field.defaultValue as any)
      : [];

  const mappings = normalizeFieldMappings(rawMappings);

  return (
    <FieldContainer>
      <FieldMappingPanel
        mappings={mappings as any}
        formFields={formFields}
        targetEntity={entityType}
        onChange={(newMappings) => onChange(newMappings)}
        availableSteps={[]}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FieldContainer>
  );
}

// ============================================================================
// Variable Picker Renderer
// ============================================================================

/**
 * Renders the VariablePickerWithUpstream for selecting variables from upstream nodes
 * Used for expression fields, conditional logic, and anywhere variables are needed
 */
export function renderVariablePicker(props: FieldRenderProps): React.ReactElement {
  const { field, value, onChange, error, data } = props;

  const upstream = (data as any)?._upstreamVariables as any[] | undefined;

  const variables: VariableOption[] = (upstream || []).map((v) => ({
    id: String(v.template ?? `${v.nodeId}.${v.fieldName}`),
    name: String(v.fieldName ?? ''),
    displayName: String(v.fieldLabel ?? v.fieldName ?? ''),
    type: String(v.fieldType ?? 'string'),
    nodeId: String(v.nodeId ?? ''),
    nodeName: String(v.nodeName ?? ''),
    nodeType: String(v.nodeType ?? ''),
    path: String(v.template ?? ''),
    description: undefined,
    sampleValue: undefined,
  }));

  const isMulti = field.multiple === true;

  const selectedTemplates: string[] = isMulti
    ? Array.isArray(value)
      ? value.map(String)
      : value
        ? [String(value)]
        : []
    : typeof value === 'string'
      ? [value]
      : [];

  const selectedVariables = variables.filter((v) => selectedTemplates.includes(v.path));

  const placeholder =
    typeof field.placeholder === 'string'
      ? field.placeholder
      : field.placeholder?.value ?? 'Select a variable...';

  return (
    <FieldContainer>
      <VariablePicker
        variables={variables}
        selectedVariables={selectedVariables}
        onSelect={(variable) => {
          if (!isMulti) {
            onChange(variable.path);
            return;
          }

          // Toggle selection in multi mode.
          const exists = selectedTemplates.includes(variable.path);
          const next = exists
            ? selectedTemplates.filter((t) => t !== variable.path)
            : [...selectedTemplates, variable.path];

          onChange(next);
        }}
        placeholder={placeholder}
        showSearch
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FieldContainer>
  );
}

// ============================================================================
// Validation Builder Renderer
// ============================================================================

/**
 * Renders a validation rule builder
 * Used for defining validation rules on form fields
 */
export function renderValidationBuilder(props: FieldRenderProps): React.ReactElement {
  const { field, value, onChange, error } = props;

  const rules = (value as any[]) || [];

  const handleRulesChange = (newRules: any[]) => {
    onChange(newRules);
  };

  return (
    <FieldContainer>
      <ValidationRuleBuilder
        rules={rules}
        onChange={handleRulesChange}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FieldContainer>
  );
}

// ============================================================================
// Styled Components
// ============================================================================

const FieldContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
  font-size: 13px;
  margin-top: 4px;
`;

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  background: rgb(var(--color-background));
  border: 1px dashed rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
`;
