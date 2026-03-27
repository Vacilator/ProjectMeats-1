import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Handle,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { Plus, Save, Trash2 } from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SmartWorkFormField = {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'multi-select' | 'date' | 'datetime' | 'url' | 'email' | 'boolean';
  required?: boolean;
  options?: string[];
};

export type SmartWorkFormStep = {
  id: string;
  /** UI label */
  title: string;
  /** Backend snapshot compatibility (serialize_step shape #2 uses name) */
  name?: string;

  /**
   * Internal UI grouping key.
   * 
   * NOTE: We also persist this as `entity_type` for backend snapshot compatibility.
   */
  entityKey:
    | 'customer_inquiry'
    | 'supplier_inquiry'
    | 'logistics_inquiry'
    | 'purchase_order_pre_approval';

  /** Backend snapshot compatibility (container_versioning.serialize_step shape #2) */
  entity_type?: string;

  fields: SmartWorkFormField[];
};

export type SmartWorkFormCascadeRule = {
  targetStepId: string;
  targetFieldId: string;
  sourceStepId: string;
  sourceFieldId: string;
};

export type SmartWorkFormBackendCalcs = {
  showInquiryNetProfitOrLoss?: boolean;
};

export type SmartWorkFormNodeData = {
  label?: string;
  description?: string;
  steps?: SmartWorkFormStep[];
  cascadeRules?: SmartWorkFormCascadeRule[];
  backendCalcs?: SmartWorkFormBackendCalcs;

  // injected by UnifiedFlowEditor
  isSaving?: boolean;
  onDelete?: () => void;
  onSave?: () => void;
} & Record<string, unknown>;

export type SmartWorkFormFlowNode = Node<SmartWorkFormNodeData, 'smartWorkForm'>;

type FieldLibraryGroup = {
  title: string;
  stepEntityKey: SmartWorkFormStep['entityKey'];
  fields: SmartWorkFormField[];
};

const PO_PREAPPROVAL_TEMPLATE_ID = 'po-pre-approval' as const;

type TemplateId = typeof PO_PREAPPROVAL_TEMPLATE_ID;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const makeField = (
  entityKey: SmartWorkFormStep['entityKey'],
  label: string,
  overrides: Partial<SmartWorkFormField> = {}
): SmartWorkFormField => ({
  id: `${entityKey}.${slug(label)}`,
  label,
  type: 'text',
  required: false,
  ...overrides,
});

const PO_FIELD_LIBRARY: FieldLibraryGroup[] = [
  {
    title: 'Customer Inquiry',
    stepEntityKey: 'customer_inquiry',
    fields: [
      makeField('customer_inquiry', 'Customer(s)', { type: 'multi-select' }),
      makeField('customer_inquiry', 'Load Type(s)', { type: 'multi-select' }),
      makeField('customer_inquiry', 'Product(s)', { type: 'multi-select' }),
      makeField('customer_inquiry', 'Prices', { type: 'number' }),
      makeField('customer_inquiry', 'Price Type(s)', {
        type: 'select',
        options: ['Flexible', 'We deliver', 'Supplier delivers', 'Customer PU'],
      }),
      makeField('customer_inquiry', 'Delivery Type(s)', { type: 'multi-select' }),
      makeField('customer_inquiry', 'Price Objective', { type: 'number' }),
      makeField('customer_inquiry', 'Price Actual', { type: 'number' }),
      makeField('customer_inquiry', 'Product Cost', { type: 'number' }),
      makeField('customer_inquiry', 'Transportation Cost', { type: 'number' }),
      makeField('customer_inquiry', 'Plant(s)', { type: 'multi-select' }),
      makeField('customer_inquiry', 'Backend Calcs (Inquiry net profit or Loss)', { type: 'text' }),
    ],
  },
  {
    title: 'Supplier Inquiry',
    stepEntityKey: 'supplier_inquiry',
    fields: [
      makeField('supplier_inquiry', 'Supplier Name'),
      makeField('supplier_inquiry', 'Plant'),
      makeField('supplier_inquiry', 'Plant ##'),
      makeField('supplier_inquiry', 'Plant location'),
      makeField('supplier_inquiry', 'Product Item ##'),
      makeField('supplier_inquiry', 'Price', { type: 'number' }),
      makeField('supplier_inquiry', 'Type of Package', { type: 'select', options: ['Boxes', 'Cardboard', 'Wood'] }),
      makeField('supplier_inquiry', 'Lbs of Package', { type: 'number' }),
      makeField('supplier_inquiry', 'Date of PU', { type: 'date' }),
      makeField('supplier_inquiry', 'Our PO ##'),
      makeField('supplier_inquiry', 'Our Customer ## / Name'),
      makeField('supplier_inquiry', 'Fresh or Frozen', { type: 'select', options: ['Fresh', 'Frozen'] }),
      makeField('supplier_inquiry', 'Age of product'),
      makeField('supplier_inquiry', 'Edible or Inedible', { type: 'select', options: ['Edible', 'Inedible'] }),
      makeField('supplier_inquiry', 'Tested or Not tested', { type: 'select', options: ['Tested', 'Not tested'] }),
    ],
  },
  {
    title: 'Logistics Inquiry',
    stepEntityKey: 'logistics_inquiry',
    fields: [
      makeField('logistics_inquiry', 'Carrier Name'),
      makeField('logistics_inquiry', 'Commodity Value $', { type: 'number' }),
      makeField('logistics_inquiry', 'Quoted All-in Rate', { type: 'number' }),
      makeField('logistics_inquiry', 'Time/Date Quote Received', { type: 'datetime' }),
      makeField('logistics_inquiry', 'Reefer Temp', { type: 'number' }),
      makeField('logistics_inquiry', 'Type of Pallet'),
      makeField('logistics_inquiry', 'Cost', { type: 'number' }),
    ],
  },
  {
    title: 'Purchase Order Pre-Approval',
    stepEntityKey: 'purchase_order_pre_approval',
    fields: [
      makeField('purchase_order_pre_approval', 'Supplier(s)', { type: 'multi-select' }),
      makeField('purchase_order_pre_approval', 'Net Total', { type: 'number' }),
      makeField('purchase_order_pre_approval', 'Product Cost(s)', { type: 'number' }),
      makeField('purchase_order_pre_approval', 'Transportation Cost (if applicable)', { type: 'number' }),
      makeField('purchase_order_pre_approval', 'Cost of each item (price per Net lb)', { type: 'number' }),
      makeField('purchase_order_pre_approval', 'Customer PU / We deliver / Supplier deliver', {
        type: 'select',
        options: ['Customer PU', 'We deliver', 'Supplier deliver'],
      }),
      makeField('purchase_order_pre_approval', 'URL / Email % setup', { type: 'text' }),
      makeField('purchase_order_pre_approval', 'Send S.O. out', { type: 'boolean' }),
    ],
  },
];

const buildPoTemplate = (): { label: string; description: string; steps: SmartWorkFormStep[] } => {
  const steps: SmartWorkFormStep[] = PO_FIELD_LIBRARY.map((g, idx) => {
    const title = `${idx + 1}. ${g.title}`;
    return {
      id: `step_${idx + 1}`,
      title,
      name: title,
      entityKey: g.stepEntityKey,
      entity_type: g.stepEntityKey,
      fields: g.fields,
    };
  });

  return {
    label: 'P.O. Pre-Approval',
    description: '4-step pre-approval workflow from inquiry → supplier → logistics → PO',
    steps,
  };
};

const ENTITY_LABEL: Record<SmartWorkFormStep['entityKey'], string> = {
  customer_inquiry: 'Customer Inquiry',
  supplier_inquiry: 'Supplier Inquiry',
  logistics_inquiry: 'Logistics Inquiry',
  purchase_order_pre_approval: 'Purchase Order Pre-Approval',
};

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const Root = styled.div<{ $selected: boolean }>`
  width: 820px;
  height: 420px;
  border-radius: 14px;
  overflow: hidden;

  background:
    radial-gradient(1100px 420px at 50% 0%, rgb(var(--color-primary) / 0.10), transparent 60%),
    rgb(var(--color-surface));

  border: 1px solid rgb(var(--color-border));
  box-shadow: ${(p) =>
    p.$selected
      ? '0 16px 40px rgb(0 0 0 / 0.16), 0 0 0 6px rgb(var(--color-primary) / 0.10)'
      : '0 10px 26px rgb(0 0 0 / 0.12)'};
`;

const TopBar = styled.div`
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 900;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SubTitle = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Select = styled.select`
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
`;

const Button = styled.button<{ $primary?: boolean }>`
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$primary ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))')};
  color: ${(p) => (p.$primary ? 'white' : 'rgb(var(--color-text-primary))')};
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Body = styled.div`
  height: calc(100% - 52px);
  display: grid;
  grid-template-columns: 240px 1fr 280px;
`;

const Panel = styled.div`
  height: 100%;
  overflow: auto;
  padding: 12px;
  background: rgb(var(--color-background));
`;

const Center = styled.div`
  height: 100%;
  overflow: auto;
  padding: 12px;
  background: rgb(var(--color-surface));
`;

const PanelTitle = styled.div`
  font-size: 12px;
  font-weight: 900;
  color: rgb(var(--color-text-primary));
  margin: 4px 0 10px;
`;

const GroupTitle = styled.div`
  font-size: 11px;
  font-weight: 900;
  color: rgb(var(--color-text-secondary));
  margin-top: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const FieldChip = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  margin-top: 8px;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.06);
  }
`;

const StepCard = styled.div<{ $active?: boolean; $isDrop?: boolean }>`
  border-radius: 14px;
  border: 1px solid ${(p) => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))')};
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.06)' : 'rgb(var(--color-background))')};
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: ${(p) => (p.$active ? '0 10px 22px rgb(0 0 0 / 0.10)' : 'none')};

  ${(p) =>
    p.$isDrop
      ? `
    outline: 2px dashed rgb(34, 197, 94);
    outline-offset: 2px;
  `
      : ''}
`;

const StepHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const StepTitle = styled.button<{ $active?: boolean }>`
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;

  font-size: 13px;
  font-weight: 900;
  color: ${(p) => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))')};
`;

const StepMeta = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const FieldList = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const FieldLabel = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FieldType = styled.div`
  font-size: 11px;
  font-weight: 800;
  color: rgb(var(--color-text-secondary));
`;

const MiniButton = styled.button`
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const Divider = styled.div`
  height: 1px;
  background: rgb(var(--color-border));
  margin: 12px 0;
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  background: rgb(var(--color-surface));

  font-size: 12px;
  font-weight: 900;
  color: rgb(var(--color-text-primary));
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
`;

const CascadeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  margin-top: 10px;
`;

const CascadeLabel = styled.div`
  font-size: 12px;
  font-weight: 900;
  color: rgb(var(--color-text-primary));
`;

const CascadeHelp = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const CascadeSelect = styled.select`
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
`;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SmartWorkFormNode = React.memo<NodeProps<SmartWorkFormFlowNode>>(({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const label = (data.label || (data as any).containerName || 'Smart WorkForm') as string;
  const description = (data.description || (data as any).containerDescription || 'Click template to preload steps & fields') as string;

  const steps: SmartWorkFormStep[] = useMemo(() => {
    const incoming = data.steps;
    if (Array.isArray(incoming) && incoming.length) return incoming as SmartWorkFormStep[];
    return [];
  }, [data.steps]);

  const [activeStepId, setActiveStepId] = useState<string | null>(steps[0]?.id ?? null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!steps.length) {
      setActiveStepId(null);
      return;
    }
    if (!activeStepId || !steps.some((s) => s.id === activeStepId)) {
      setActiveStepId(steps[0].id);
    }
  }, [activeStepId, steps]);

  const activeStep = useMemo(
    () => steps.find((s) => s.id === activeStepId) ?? null,
    [steps, activeStepId]
  );

  const normalizeEntityKey = useCallback(
    (s: SmartWorkFormStep): SmartWorkFormStep['entityKey'] => {
      const candidate = (s.entityKey || (s as any).entity_type) as SmartWorkFormStep['entityKey'];
      if (candidate && candidate in ENTITY_LABEL) return candidate;
      return 'customer_inquiry';
    },
    []
  );

  const applyTemplate = useCallback(
    (templateId: TemplateId) => {
      if (templateId !== PO_PREAPPROVAL_TEMPLATE_ID) return;
      const tmpl = buildPoTemplate();

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: {
              ...(n.data || {}),
              label: tmpl.label,
              description: tmpl.description,
              steps: tmpl.steps,
              cascadeRules: [],
              backendCalcs: {
                ...(n.data as any)?.backendCalcs,
                showInquiryNetProfitOrLoss: true,
              },
            },
          };
        })
      );

      // ensure handles render correctly after heavy in-node UI updates
      requestAnimationFrame(() => updateNodeInternals(id));
    },
    [id, setNodes, updateNodeInternals]
  );

  const upsertFieldInStep = useCallback(
    (stepId: string, field: SmartWorkFormField) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const currentSteps = ((n.data as any)?.steps || []) as SmartWorkFormStep[];
          const nextSteps = currentSteps.map((s) => {
            if (s.id !== stepId) return s;
            const exists = s.fields?.some((f) => f.id === field.id);
            return {
              ...s,
              fields: exists ? s.fields : [...(s.fields || []), field],
            };
          });
          return { ...n, data: { ...(n.data || {}), steps: nextSteps } };
        })
      );
    },
    [id, setNodes]
  );

  const removeFieldFromStep = useCallback(
    (stepId: string, fieldId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const currentSteps = ((n.data as any)?.steps || []) as SmartWorkFormStep[];
          const nextSteps = currentSteps.map((s) => {
            if (s.id !== stepId) return s;
            return { ...s, fields: (s.fields || []).filter((f) => f.id !== fieldId) };
          });
          return { ...n, data: { ...(n.data || {}), steps: nextSteps } };
        })
      );
    },
    [id, setNodes]
  );

  const addStep = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const currentSteps = ((n.data as any)?.steps || []) as SmartWorkFormStep[];
        const nextIndex = currentSteps.length + 1;
        const title = `${nextIndex}. New Step`;
        const nextStep: SmartWorkFormStep = {
          id: `step_${nextIndex}`,
          title,
          name: title,
          entityKey: 'customer_inquiry',
          entity_type: 'customer_inquiry',
          fields: [],
        };
        return {
          ...n,
          data: {
            ...(n.data || {}),
            steps: [...currentSteps, nextStep],
          },
        };
      })
    );
  }, [id, setNodes]);

  const toggleBackendCalc = useCallback(
    (key: keyof SmartWorkFormBackendCalcs, next: boolean) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const current = ((n.data as any)?.backendCalcs || {}) as SmartWorkFormBackendCalcs;
          return {
            ...n,
            data: {
              ...(n.data || {}),
              backendCalcs: {
                ...current,
                [key]: next,
              },
            },
          };
        })
      );
    },
    [id, setNodes]
  );

  const allCascadeTargets = useMemo(() => {
    const items: Array<{ step: SmartWorkFormStep; field: SmartWorkFormField; stepIndex: number }> = [];
    steps.forEach((s, stepIndex) => {
      (s.fields || []).forEach((f) => items.push({ step: s, field: f, stepIndex }));
    });
    return items;
  }, [steps]);

  const cascadeRules: SmartWorkFormCascadeRule[] = Array.isArray(data.cascadeRules)
    ? (data.cascadeRules as SmartWorkFormCascadeRule[])
    : [];

  const setCascadeRule = useCallback(
    (targetStepId: string, targetFieldId: string, sourceStepId: string, sourceFieldId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const current = Array.isArray((n.data as any)?.cascadeRules)
            ? (((n.data as any).cascadeRules || []) as SmartWorkFormCascadeRule[])
            : [];

          const without = current.filter(
            (r) => !(r.targetStepId === targetStepId && r.targetFieldId === targetFieldId)
          );

          const nextRules = sourceStepId && sourceFieldId ? [...without, { targetStepId, targetFieldId, sourceStepId, sourceFieldId }] : without;

          return {
            ...n,
            data: {
              ...(n.data || {}),
              cascadeRules: nextRules,
            },
          };
        })
      );
    },
    [id, setNodes]
  );

  const getCascadeSelection = useCallback(
    (targetStepId: string, targetFieldId: string) => {
      const found = cascadeRules.find((r) => r.targetStepId === targetStepId && r.targetFieldId === targetFieldId);
      if (!found) return '';
      return `${found.sourceStepId}::${found.sourceFieldId}`;
    },
    [cascadeRules]
  );

  const handleDropField = useCallback(
    (stepId: string, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverStepId(null);
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (!raw) return;
        const parsed = JSON.parse(raw) as SmartWorkFormField;
        if (!parsed?.id) return;
        upsertFieldInStep(stepId, parsed);
      } catch {
        // ignore
      }
    },
    [upsertFieldInStep]
  );

  const onDragOverStep = useCallback((stepId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStepId(stepId);
  }, []);

  const onDragLeaveStep = useCallback((stepId: string) => {
    setDragOverStepId((current) => (current === stepId ? null : current));
  }, []);

  const isSaving = Boolean(data.isSaving);

  return (
    <Root $selected={!!selected}>
      <NodeToolbar isVisible={!!selected} position={Position.Top}>
        <Button type="button" onClick={addStep} disabled={isSaving}>
          <Plus size={14} /> Add Step
        </Button>
        <Button type="button" onClick={data.onSave} disabled={isSaving || !data.onSave} $primary>
          <Save size={14} /> Save
        </Button>
        <Button type="button" onClick={data.onDelete} disabled={isSaving || !data.onDelete}>
          <Trash2 size={14} /> Delete
        </Button>
      </NodeToolbar>

      <Handle
        type="target"
        position={Position.Top}
        id="in"
        style={{
          left: '50%',
          width: 14,
          height: 14,
          background: 'rgb(var(--color-primary))',
          border: '2px solid rgb(var(--color-surface))',
          borderRadius: 6,
          transform: 'translateX(-50%)',
        }}
        aria-label="Smart WorkForm input"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          left: '50%',
          width: 14,
          height: 14,
          background: 'rgb(var(--color-primary))',
          border: '2px solid rgb(var(--color-surface))',
          borderRadius: 6,
          transform: 'translateX(-50%)',
        }}
        aria-label="Smart WorkForm output"
      />

      <TopBar>
        <TitleBlock>
          <Title>{label}</Title>
          <SubTitle>{description}</SubTitle>
        </TitleBlock>

        <BarActions>
          <Select
            aria-label="Template picker"
            onChange={(e) => {
              const value = e.target.value as TemplateId | '';
              if (!value) return;
              applyTemplate(value);
              e.target.value = '';
            }}
            defaultValue=""
          >
            <option value="">Template…</option>
            <option value={PO_PREAPPROVAL_TEMPLATE_ID}>P.O. Pre-Approval</option>
          </Select>

          <Button type="button" onClick={addStep} disabled={isSaving}>
            <Plus size={14} /> Add Step
          </Button>

          <Button type="button" onClick={data.onSave} disabled={isSaving || !data.onSave} $primary>
            <Save size={14} /> Save
          </Button>
        </BarActions>
      </TopBar>

      <Body>

        <Center>
          <PanelTitle>Steps (live preview)</PanelTitle>
          {!steps.length ? (
            <div style={{
              padding: 14,
              borderRadius: 14,
              border: '1px dashed rgb(var(--color-border))',
              background: 'rgb(var(--color-background))',
              color: 'rgb(var(--color-text-secondary))',
              fontSize: 12,
              fontWeight: 800,
            }}>
              Pick the “P.O. Pre-Approval” template (top right) to preload the full 4-step flow.
            </div>
          ) : null}

          {steps.map((s) => (
            <StepCard
              key={s.id}
              $active={s.id === activeStepId}
              $isDrop={dragOverStepId === s.id}
              onDragOver={(e) => onDragOverStep(s.id, e)}
              onDrop={(e) => handleDropField(s.id, e)}
              onDragLeave={() => onDragLeaveStep(s.id)}
            >
              <StepHeader>
                <div style={{ minWidth: 0 }}>
                  <StepTitle type="button" $active={s.id === activeStepId} onClick={() => setActiveStepId(s.id)}>
                    {s.title}
                  </StepTitle>
                  <StepMeta>{ENTITY_LABEL[normalizeEntityKey(s)]}</StepMeta>
                </div>

                <MiniButton
                  type="button"
                  onClick={() => {
                    setActiveStepId(s.id);
                    addStep();
                  }}
                  title="Add a new step (appends to end)"
                >
                  +
                </MiniButton>
              </StepHeader>

              <FieldList>
                {(s.fields || []).length === 0 ? (
                  <div style={{
                    fontSize: 11,
                    color: 'rgb(var(--color-text-secondary))',
                    fontWeight: 800,
                    padding: 10,
                    borderRadius: 10,
                    border: '1px dashed rgb(var(--color-border))',
                    background: 'rgb(var(--color-surface))',
                  }}>
                    Drag fields here, or click fields in the left library.
                  </div>
                ) : null}

                {(s.fields || []).map((f) => (
                  <FieldRow key={f.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <FieldLabel title={f.label}>{f.label}</FieldLabel>
                      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                        <FieldType>{f.type || 'text'}</FieldType>
                        {f.required ? (
                          <FieldType style={{ color: 'rgb(239, 68, 68)' }}>required</FieldType>
                        ) : null}
                      </div>
                    </div>
                    <MiniButton type="button" onClick={() => removeFieldFromStep(s.id, f.id)} title="Remove field">
                      ✕
                    </MiniButton>
                  </FieldRow>
                ))}
              </FieldList>
            </StepCard>
          ))}
        </Center>

        <Panel>
          <PanelTitle>Cascades & Calcs</PanelTitle>

          <ToggleRow>
            <span>Show Inquiry Net Profit/Loss</span>
            <Checkbox
              type="checkbox"
              checked={Boolean((data.backendCalcs as SmartWorkFormBackendCalcs | undefined)?.showInquiryNetProfitOrLoss)}
              onChange={(e) => toggleBackendCalc('showInquiryNetProfitOrLoss', e.target.checked)}
            />
          </ToggleRow>

          <div style={{ marginTop: 10, fontSize: 11, color: 'rgb(var(--color-text-secondary))', fontWeight: 700 }}>
            This toggles a backend-calculated field shown live during form submission.
          </div>

          <Divider />

          <PanelTitle>Auto-pull rules</PanelTitle>
          <div style={{ fontSize: 11, color: 'rgb(var(--color-text-secondary))', fontWeight: 700 }}>
            Map downstream fields to earlier-step sources (e.g., Supplier from Step 2 → Step 4).
          </div>

          {allCascadeTargets
            .filter((t) => t.stepIndex > 0)
            .slice(0, 12)
            .map(({ step, field, stepIndex }) => {
              const availableSources = steps
                .slice(0, stepIndex)
                .flatMap((s) => (s.fields || []).map((f) => ({
                  value: `${s.id}::${f.id}`,
                  label: `${s.title} → ${f.label}`,
                  stepId: s.id,
                  fieldId: f.id,
                })));

              const selectedValue = getCascadeSelection(step.id, field.id);

              return (
                <CascadeRow key={`${step.id}:${field.id}`}>
                  <CascadeLabel>{step.title}: {field.label}</CascadeLabel>
                  <CascadeHelp>Auto-pull from:</CascadeHelp>
                  <CascadeSelect
                    value={selectedValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setCascadeRule(step.id, field.id, '', '');
                        return;
                      }
                      const [sourceStepId, sourceFieldId] = v.split('::');
                      setCascadeRule(step.id, field.id, sourceStepId, sourceFieldId);
                    }}
                  >
                    <option value="">(none)</option>
                    {availableSources.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </CascadeSelect>
                </CascadeRow>
              );
            })}

          {allCascadeTargets.filter((t) => t.stepIndex > 0).length > 12 ? (
            <div style={{ marginTop: 10, fontSize: 11, color: 'rgb(var(--color-text-secondary))' }}>
              Showing first 12 mappings. (This is a preview-focused node UI.)
            </div>
          ) : null}
        </Panel>
      </Body>
    </Root>
  );
});

SmartWorkFormNode.displayName = 'SmartWorkFormNode';
