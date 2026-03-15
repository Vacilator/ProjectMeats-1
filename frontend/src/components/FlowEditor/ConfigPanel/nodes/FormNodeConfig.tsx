import React, { useEffect, useMemo, useState } from 'react';
import { Node, Edge } from '@xyflow/react';

import EntityFieldPicker, { type SelectedField } from '../EntityFieldPicker';
import { useEntityList } from '../../../../services/schemaService';
import { useUpstreamVariables } from '../../hooks/useUpstreamVariables';

import {
  FormField,
  Label,
  RequiredIndicator,
  Input,
  TextArea,
  Select,
  HelpText,
} from '../shared/StyledComponents';

export interface FormNodeConfigProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onUpdateNode: (nodeId: string, data: Record<string, any>) => void;
}

/**
 * Hybrid config: specialized, resilient Form node configuration.
 *
 * Rationale: entityType → field cascade is core workflow behavior and must not
 * depend on schema formatting or conditional-render fragility.
 */
export const FormNodeConfig: React.FC<FormNodeConfigProps> = ({
  node,
  nodes,
  edges,
  onUpdateNode,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(node.data || {});

  // Keep local state in sync when node changes.
  useEffect(() => {
    setFormData(node.data || {});
  }, [node.id, node.data]);

  const entityType = (formData.entityType as string) || '';
  const selectedFields = (formData.fields as SelectedField[]) || [];

  const { data: entities = [] } = useEntityList();

  const { variables: upstreamVariables } = useUpstreamVariables({
    currentNodeId: node.id,
    nodes,
    edges,
  });

  const entityOptions = useMemo(
    () =>
      (entities || [])
        .map((e) => ({ value: e.id, label: e.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [entities]
  );

  const update = (patch: Record<string, any>) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    onUpdateNode(node.id, next);
  };

  return (
    <>
      <FormField>
        <Label>
          Step Name <RequiredIndicator>*</RequiredIndicator>
        </Label>
        <Input
          value={formData.name || ''}
          placeholder="e.g., Supplier Information"
          onChange={(e) => update({ name: e.target.value })}
        />
      </FormField>

      <FormField>
        <Label>Description</Label>
        <TextArea
          value={formData.description || ''}
          placeholder="Describe what this form collects…"
          onChange={(e) => update({ description: e.target.value })}
        />
      </FormField>

      <FormField>
        <Label>
          Entity Type <RequiredIndicator>*</RequiredIndicator>
        </Label>
        <Select
          value={entityType}
          onChange={(e) => {
            const nextEntityType = e.target.value;
            // Critical: reset selected fields when switching entity.
            update({ entityType: nextEntityType, fields: [] });
          }}
        >
          <option value="">Select an entity…</option>
          {entityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <HelpText>Select the entity this form will create or update.</HelpText>
      </FormField>

      <FormField>
        <Label>Fields</Label>
        <EntityFieldPicker
          selectedFields={selectedFields}
          onFieldsChange={(fields) => update({ fields })}
          upstreamVariables={upstreamVariables}
          entityType={entityType}
          hideEntitySelector
          multiSelectMode
        />
      </FormField>
    </>
  );
};
