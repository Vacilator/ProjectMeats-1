/**
 * ExecutionFormStep
 *
 * Runtime renderer for FlowEditor formStep nodes.
 *
 * Key feature: supports FlowEditor config-time "cascadeFrom" by pre-filling
 * field values from upstream workflow context templates (e.g. {{step1.email}}).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import FormField, { FieldConfig } from './FormField';
import type { WorkflowContext } from './hooks/useWorkflowContext';

type SelectedFieldLike = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  related_entity_type?: string;
  related_model?: { app: string; model: string; label: string };
  cascadeFrom?: string;
};

type FormStepNodeData = {
  label?: string;
  name?: string;
  entity_type?: string;
  entityType?: string;
  fields?: SelectedFieldLike[];
};

export interface ExecutionFormStepProps {
  node: { id: string; type: string; data: FormStepNodeData };
  context: WorkflowContext;
  onComplete: (data: Record<string, any>) => void;
  readOnly?: boolean;
}

const Container = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 20px;
`;

const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  text-transform: capitalize;
`;

const Fields = styled.div`
  display: flex;
  flex-direction: column;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 8px 14px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  cursor: pointer;
  font-weight: 600;

  background: ${(p) => (p.$variant === 'primary' ? 'rgb(var(--color-primary))' : 'transparent')};
  color: ${(p) => (p.$variant === 'primary' ? 'rgb(var(--color-text-on-primary, 255 255 255))' : 'rgb(var(--color-text-primary))')};

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

function isEmptyValue(value: any): boolean {
  return value === undefined || value === null || value === '';
}

export const ExecutionFormStep: React.FC<ExecutionFormStepProps> = ({
  node,
  context,
  onComplete,
  readOnly = false,
}) => {
  const nodeData = node.data || {};

  const stepTitle = nodeData.label || nodeData.name || 'Form Step';
  const entityType = nodeData.entity_type || nodeData.entityType;

  const fields: FieldConfig[] = useMemo(() => {
    const selected = Array.isArray(nodeData.fields) ? nodeData.fields : [];
    return selected.map((f) => {
      const autoPopulateSource = f.cascadeFrom;
      return {
        key: String(f.key),
        label: f.label || String(f.key),
        type: f.type || 'text',
        required: Boolean(f.required),
        placeholder: f.placeholder,
        helpText: f.helpText,
        options: f.options,
        min: f.min,
        max: f.max,
        step: f.step,
        rows: f.rows,
        related_entity_type: f.related_entity_type,
        related_model: f.related_model,
        autoPopulateSource,
      };
    });
  }, [nodeData.fields]);

  const [values, setValues] = useState<Record<string, any>>({});

  // Track which fields the user has manually edited to avoid clobbering input
  const touchedRef = useRef<Set<string>>(new Set());

  // Initialize/refresh field values from context (resume) and cascadeFrom (prefill).
  // This can run multiple times (e.g., when execution data hydrates) but will only
  // fill in missing/untouched values.
  useEffect(() => {
    setValues((prev) => {
      const next: Record<string, any> = { ...prev };

      // 1) Resume existing values for this node (if present)
      const existing = context.data?.[node.id];
      if (existing && typeof existing === 'object') {
        Object.entries(existing).forEach(([k, v]) => {
          if (!k) return;
          if (touchedRef.current.has(k)) return;
          if (isEmptyValue(next[k]) && !isEmptyValue(v)) {
            next[k] = v;
          }
        });
      }

      // 2) Prefill cascadeFrom templates when empty
      for (const f of fields) {
        if (!f.autoPopulateSource) continue;
        if (touchedRef.current.has(f.key)) continue;
        if (!isEmptyValue(next[f.key])) continue;

        const resolved = context.resolve(f.autoPopulateSource);
        if (!isEmptyValue(resolved)) {
          next[f.key] = resolved;
        }
      }

      return next;
    });
  }, [context.data, context.resolve, fields, node.id]);

  const handleFieldChange = useCallback(
    (fieldKey: string, value: any) => {
      touchedRef.current.add(fieldKey);
      setValues((prev) => ({ ...prev, [fieldKey]: value }));

      // Make values available for downstream resolves even before completion.
      // This is safe because the "complete" action persists the step state.
      context.setValue(fieldKey, value);
    },
    [context]
  );

  const handleComplete = useCallback(() => {
    onComplete(values);
  }, [onComplete, values]);

  return (
    <Container>
      <Header>
        <Title>{stepTitle}</Title>
        {entityType ? <Subtitle>{entityType}</Subtitle> : null}
      </Header>

      <Fields>
        {fields.length === 0 ? (
          <Subtitle>No fields configured for this step.</Subtitle>
        ) : (
          fields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(v) => handleFieldChange(field.key, v)}
              onBlur={() => undefined}
              disabled={readOnly}
              error={undefined}
              isSaving={false}
            />
          ))
        )}
      </Fields>

      <Footer>
        <Button onClick={handleComplete} $variant="primary" disabled={readOnly}>
          Complete Step
        </Button>
      </Footer>
    </Container>
  );
};

export default ExecutionFormStep;
