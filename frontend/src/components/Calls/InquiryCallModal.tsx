/**
 * InquiryCallModal
 *
 * "New" flow for Calls → purpose = Inquiry.
 * Creates a ScheduledCall (call_purpose=inquiry) and then creates an Inquiry linked to that call.
 *
 * Requirements:
 * - Multi-product lines
 * - Desired vs actual pricing fields
 * - Units + quantity
 */

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import { getChoices, type ChoiceOption } from '../../services/choicesService';
import { formatCurrency } from '../../utils/formatters';
import { SmartProductAutocomplete } from '../Inquiry/SmartProductAutocomplete';
import type { Product } from '../../types';

type EntityType = 'supplier' | 'customer';

type EntityOption = { id: number; name: string };

type LineItem = {
  key: string;
  productId: string;
  product?: Product;
  quantity: string;
  desiredUom: string;
  desiredPricePerUnit: string;
  actualPricePerUnit: string;
  notes: string;
};

interface InquiryCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Optional preselection when launched from an entity surface (e.g. Cockpit customer detail). */
  initialEntityType?: EntityType;
  initialEntityId?: string | number;
}

const Overlay = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? 'flex' : 'none')};
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.5);
  z-index: 1100;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(var(--color-overlay), 0.3);
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const TitleBlock = styled.div``;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const Body = styled.div`
  padding: 1.25rem 1.5rem;
  overflow: auto;
`;

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.h3`
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0.75rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(6, 1fr);
  }

  @media (max-width: 560px) {
    grid-template-columns: repeat(1, 1fr);
  }
`;

const Field = styled.div<{ $span?: number }>`
  grid-column: span ${(p) => p.$span ?? 12};

  @media (max-width: 900px) {
    grid-column: span ${(p) => Math.min(p.$span ?? 12, 6)};
  }

  @media (max-width: 560px) {
    grid-column: span 1;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 0.375rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  min-height: 90px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Muted = styled.div`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
`;

const Error = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(var(--color-error), 0.35);
  background: rgba(var(--color-error), 0.08);
  border-radius: var(--radius-md);
  color: rgb(var(--color-error));
  font-size: 0.875rem;
`;

const LinesTable = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  /* Allow SmartProductAutocomplete dropdown to render outside the table bounds */
  overflow: visible;
`;

const LinesHeader = styled.div`
  display: grid;
  grid-template-columns: 3fr 0.9fr 1.1fr 1.1fr 1.1fr 1.1fr 2fr 44px;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(var(--color-primary), 0.05);
  border-bottom: 1px solid rgb(var(--color-border));
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    display: none;
  }
`;

const LinesRow = styled.div`
  display: grid;
  grid-template-columns: 3fr 0.9fr 1.1fr 1.1fr 1.1fr 1.1fr 2fr 44px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgb(var(--color-border));
  align-items: start;

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const RowCell = styled.div``;

const ComputedValue = styled.div<{ $tone?: 'positive' | 'negative' | 'neutral' }>`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgba(var(--color-primary), 0.03);
  color: ${(p) =>
    p.$tone === 'positive'
      ? 'rgb(var(--color-success))'
      : p.$tone === 'negative'
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-text-secondary))'};
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const RemoveButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(var(--color-error), 0.35);
  background: rgba(var(--color-error), 0.08);
  color: rgb(var(--color-error));
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-error), 0.12);
  }
`;

const AddLineButton = styled.button`
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  border: 1px dashed rgb(var(--color-border));
  background: rgba(var(--color-primary), 0.04);
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const Footer = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: rgb(var(--color-surface));
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 0.65rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;

  ${(p) =>
    p.$variant === 'primary'
      ? `
    background: rgb(var(--color-primary));
    color: rgb(var(--color-text-inverse));
    border: none;

    &:hover { opacity: 0.92; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  `
      : `
    background: transparent;
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));

    &:hover { background: rgba(var(--color-primary), 0.04); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  `}
`;

const newLine = (): LineItem => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  productId: '',
  quantity: '1',
  desiredUom: '',
  desiredPricePerUnit: '',
  actualPricePerUnit: '',
  notes: '',
});

export const InquiryCallModal: React.FC<InquiryCallModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEntityType,
  initialEntityId,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Call fields
  const [title, setTitle] = useState('');
  const [callDescription, setCallDescription] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('customer');
  const [entityId, setEntityId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');

  // Inquiry fields
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  // Options
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [uomOptions, setUomOptions] = useState<ChoiceOption[]>([]);

  const canSubmit = useMemo(() => !submitting, [submitting]);

  const computeVarianceTotal = (line: LineItem): number | null => {
    const qty = Number(line.quantity);
    const desired = Number(line.desiredPricePerUnit);
    const actual = Number(line.actualPricePerUnit);

    if (!Number.isFinite(qty) || !Number.isFinite(desired) || !Number.isFinite(actual)) return null;
    return (actual - desired) * qty;
  };

  const reset = () => {
    setSubmitting(false);
    setError(null);
    setTitle('');
    setCallDescription('');
    setEntityType('customer');
    setEntityId('');
    setScheduledFor('');
    setDurationMinutes('30');
    setInquiryNotes('');
    setLines([newLine()]);
    setEntityOptions([]);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Apply entity defaults when opened.
    if (initialEntityType) {
      setEntityType(initialEntityType);
    }
    if (initialEntityId !== undefined && initialEntityId !== null && String(initialEntityId).trim() !== '') {
      setEntityId(String(initialEntityId));
    }

    // Load weight unit choices (best-effort)
    void (async () => {
      try {
        const opts = await getChoices('weight_unit');
        setUomOptions(opts);
      } catch {
        setUomOptions([]);
      }
    })();
  }, [initialEntityId, initialEntityType, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      setLoadingEntities(true);
      try {
        const endpoint = entityType === 'supplier' ? '/suppliers/' : '/customers/';
        const resp = await businessApi.get(endpoint, { params: { page_size: 500 } });
        const rows = (resp.data?.results ?? resp.data) as any[];
        setEntityOptions(
          (Array.isArray(rows) ? rows : []).map((r: any) => ({
            id: r.id,
            name: r.name || r.company_name || r.title || `${entityType} #${r.id}`,
          }))
        );
      } catch {
        setEntityOptions([]);
      } finally {
        setLoadingEntities(false);
      }
    })();
  }, [entityType, isOpen]);

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const updateLine = (key: string, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length ? next : [newLine()];
    });
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required';
    if (!entityId || Number.isNaN(Number(entityId))) return 'Please select a valid customer/supplier';
    if (!scheduledFor) return 'Scheduled date and time is required';

    const cleanLines = lines.filter((l) => l.productId || l.quantity || l.desiredPricePerUnit || l.actualPricePerUnit);
    if (!cleanLines.length) return 'Add at least one product line';

    for (const l of cleanLines) {
      if (!l.productId) return 'Each line must have a product';
      const qty = Number(l.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return 'Each line must have a quantity > 0';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setSubmitting(true);

    try {
      // 1) Create the scheduled call (so inquiry can reference it)
      const callPayload = {
        title: title.trim(),
        description: callDescription.trim(),
        entity_type: entityType,
        entity_id: Number(entityId),
        scheduled_for: scheduledFor,
        duration_minutes: Number(durationMinutes),
        call_purpose: 'inquiry',
      };

      const callResp = await businessApi.post('/workspace/scheduled-calls/', callPayload);
      const createdCall = callResp.data as { id: number };

      // 2) Prefill inquiry defaults from the call (backend builds contact snapshot fields)
      const prefillResp = await businessApi.get(`/inquiries/from-call/${createdCall.id}/`);
      const prefill = (prefillResp.data ?? {}) as Record<string, any>;

      // 3) Create inquiry with nested products
      const products = lines
        .filter((l) => l.productId)
        .map((l) => ({
          product: l.productId,
          quantity: Number(l.quantity),
          desired_uom: l.desiredUom || undefined,
          desired_price_per_unit: l.desiredPricePerUnit ? Number(l.desiredPricePerUnit) : undefined,
          actual_price_per_unit: l.actualPricePerUnit ? Number(l.actualPricePerUnit) : undefined,
          notes: l.notes?.trim() || undefined,
        }));

      const mergedNotes = [prefill.notes, inquiryNotes.trim()].filter(Boolean).join('\n\n');

      await businessApi.post('/inquiries/', {
        ...prefill,
        notes: mergedNotes || undefined,
        products,
      });

      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      const apiMsg = (typeof data.detail === 'string' ? data.detail : '') || (typeof data.error === 'string' ? data.error : '') || (typeof errObj.message === 'string' ? errObj.message : '');
      setError(typeof apiMsg === 'string' && apiMsg ? apiMsg : 'Failed to create inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay $open={isOpen} onClick={close}>
      <Modal onClick={(ev) => ev.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <Header>
            <TitleBlock>
              <Title>New Inquiry</Title>
              <Subtitle>Schedule a call + capture products, desired vs actual pricing, and units.</Subtitle>
            </TitleBlock>
            <CloseButton type="button" onClick={close} aria-label="Close">
              ×
            </CloseButton>
          </Header>

          <Body>
            <Section>
              <SectionTitle>Call</SectionTitle>
              <Grid>
                <Field $span={6}>
                  <Label>Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canSubmit} />
                </Field>
                <Field $span={3}>
                  <Label>Scheduled For *</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    step="900"
                    disabled={!canSubmit}
                  />
                  <Muted>15-minute increments</Muted>
                </Field>
                <Field $span={3}>
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    disabled={!canSubmit}
                  />
                </Field>

                <Field $span={3}>
                  <Label>Entity Type *</Label>
                  <Select
                    value={entityType}
                    onChange={(e) => {
                      setEntityType(e.target.value as EntityType);
                      setEntityId('');
                    }}
                    disabled={!canSubmit}
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </Select>
                </Field>
                <Field $span={9}>
                  <Label>{entityType === 'supplier' ? 'Supplier' : 'Customer'} *</Label>
                  <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} disabled={!canSubmit || loadingEntities}>
                    <option value="">{loadingEntities ? 'Loading…' : `Select ${entityType}`}</option>
                    {entityOptions.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field $span={12}>
                  <Label>Call Notes</Label>
                  <TextArea
                    value={callDescription}
                    onChange={(e) => setCallDescription(e.target.value)}
                    placeholder="Optional notes for the call…"
                    disabled={!canSubmit}
                  />
                </Field>
              </Grid>
            </Section>

            <Section>
              <SectionTitle>Inquiry Products</SectionTitle>
              <LinesTable>
                <LinesHeader>
                  <div>Product</div>
                  <div>Qty</div>
                  <div>Unit</div>
                  <div>Desired $/Unit</div>
                  <div>Actual $/Unit</div>
                  <div>Δ Total</div>
                  <div>Notes</div>
                  <div />
                </LinesHeader>

                {lines.map((l) => (
                  <LinesRow key={l.key}>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Product *</Label>
                      <SmartProductAutocomplete
                        value={l.productId}
                        onChange={(productId, product) => updateLine(l.key, { productId, product })}
                        placeholder="Search products…"
                        disabled={!canSubmit}
                      />
                    </RowCell>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Qty *</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={l.quantity}
                        onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                        disabled={!canSubmit}
                      />
                    </RowCell>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Unit</Label>
                      <Select
                        value={l.desiredUom}
                        onChange={(e) => updateLine(l.key, { desiredUom: e.target.value })}
                        disabled={!canSubmit}
                      >
                        <option value="">Select…</option>
                        {uomOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </RowCell>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Desired</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={l.desiredPricePerUnit}
                        onChange={(e) => updateLine(l.key, { desiredPricePerUnit: e.target.value })}
                        disabled={!canSubmit}
                      />
                    </RowCell>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Actual</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={l.actualPricePerUnit}
                        onChange={(e) => updateLine(l.key, { actualPricePerUnit: e.target.value })}
                        disabled={!canSubmit}
                      />
                    </RowCell>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Δ Total</Label>
                      {(() => {
                        const delta = computeVarianceTotal(l);
                        const tone: 'positive' | 'negative' | 'neutral' =
                          delta == null ? 'neutral' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
                        const text = delta == null ? '-' : `${delta > 0 ? '+' : ''}${formatCurrency(delta)}`;
                        return <ComputedValue $tone={tone}>{text}</ComputedValue>;
                      })()}
                    </RowCell>
                    <RowCell>
                      <Label style={{ marginBottom: 6 }}>Line Notes</Label>
                      <Input
                        value={l.notes}
                        onChange={(e) => updateLine(l.key, { notes: e.target.value })}
                        disabled={!canSubmit}
                      />
                    </RowCell>
                    <RowCell style={{ paddingTop: 26 }}>
                      <RemoveButton type="button" onClick={() => removeLine(l.key)} disabled={!canSubmit} aria-label="Remove line">
                        ×
                      </RemoveButton>
                    </RowCell>
                  </LinesRow>
                ))}
              </LinesTable>

              <AddLineButton type="button" onClick={() => setLines((p) => [...p, newLine()])} disabled={!canSubmit}>
                + Add product
              </AddLineButton>
            </Section>

            <Section>
              <SectionTitle>Inquiry Notes</SectionTitle>
              <TextArea
                value={inquiryNotes}
                onChange={(e) => setInquiryNotes(e.target.value)}
                placeholder="Optional notes to attach to the inquiry…"
                disabled={!canSubmit}
              />
            </Section>

            {error && <Error>{error}</Error>}
          </Body>

          <Footer>
            <Button type="button" onClick={close} disabled={!canSubmit} $variant="secondary">
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} $variant="primary">
              {submitting ? 'Creating…' : 'Create Inquiry'}
            </Button>
          </Footer>
        </form>
      </Modal>
    </Overlay>
  );
};
