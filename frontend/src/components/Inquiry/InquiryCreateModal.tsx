/**
 * InquiryCreateModal
 *
 * Single, reusable Inquiry create form surface (used across Cockpit + Inquiries page).
 *
 * Goals:
 * - Provide the "nice" inquiry creation UX (multi-product lines, desired vs actual pricing, UOM/qty)
 * - Work from any entry point (modal today; inline/panel later via EntityFormSurface)
 * - Actually create an Inquiry on save
 */

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { businessApi } from '@/services/businessApi';
import { getChoices, type ChoiceOption } from '@/services/choicesService';
import { SmartProductAutocomplete } from './SmartProductAutocomplete';

type EntityType = 'supplier' | 'customer';

type EntityOption = { id: number; name: string };

type LineItem = {
  key: string;
  productId: string;
  quantity: string;
  desiredUom: string;
  desiredPricePerUnit: string;
  actualPricePerUnit: string;
  notes: string;
};

export interface InquiryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (created?: unknown) => void;
  initialEntityType?: EntityType;
  initialEntityId?: string | number;

  /** Optional: link the inquiry to a scheduled call (e.g., created from ScheduleCallModal). */
  sourceCallId?: string | number;
}

const Overlay = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? 'flex' : 'none')};
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1100;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 940px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-md);
  color: rgb(239, 68, 68);
  font-size: 0.875rem;
`;

const LinesTable = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const LinesHeader = styled.div`
  display: grid;
  grid-template-columns: 2.5fr 1fr 1fr 1fr 1fr 1.5fr 44px;
  gap: 0;
  padding: 0.75rem 0.75rem;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  font-size: 0.75rem;
  font-weight: 800;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;

  @media (max-width: 900px) {
    display: none;
  }
`;

const LinesRow = styled.div`
  display: grid;
  grid-template-columns: 2.5fr 1fr 1fr 1fr 1fr 1.5fr 44px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgb(var(--color-border));
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const LineCell = styled.div``;

const RowActions = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const IconButton = styled.button`
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  border-radius: var(--radius-md);
  height: 36px;
  width: 36px;
  cursor: pointer;

  &:hover {
    color: rgb(var(--color-text-primary));
    border-color: rgba(var(--color-primary), 0.55);
  }
`;

const Footer = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  border: 1px solid
    ${(p) =>
      p.$variant === 'primary' ? 'rgba(var(--color-primary), 0.75)' : 'rgb(var(--color-border))'};
  background: ${(p) =>
    p.$variant === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))'};
  color: ${(p) => (p.$variant === 'primary' ? 'white' : 'rgb(var(--color-text-primary))')};
  border-radius: var(--radius-md);
  padding: 0.65rem 0.9rem;
  font-weight: 800;
  cursor: pointer;

  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
  pointer-events: ${(p) => (p.disabled ? 'none' : 'auto')};

  &:hover {
    filter: brightness(0.98);
  }
`;

const newLine = (): LineItem => ({
  key: `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  productId: '',
  quantity: '',
  desiredUom: 'LBS',
  desiredPricePerUnit: '',
  actualPricePerUnit: '',
  notes: '',
});

export const InquiryCreateModal: React.FC<InquiryCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEntityType,
  initialEntityId,
  sourceCallId,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityType, setEntityType] = useState<EntityType>(initialEntityType ?? 'customer');
  const [entityId, setEntityId] = useState<string>(
    initialEntityId != null ? String(initialEntityId) : ''
  );
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [uomOptions, setUomOptions] = useState<ChoiceOption[]>([]);

  const canSubmit = useMemo(() => !submitting, [submitting]);

  // Initialize from context on open.
  useEffect(() => {
    if (!isOpen) return;

    if (initialEntityType) setEntityType(initialEntityType);
    if (initialEntityId != null) setEntityId(String(initialEntityId));
  }, [initialEntityId, initialEntityType, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      try {
        const opts = await getChoices('weight_unit');
        setUomOptions(opts);
      } catch {
        setUomOptions([]);
      }
    })();
  }, [isOpen]);

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

  const reset = () => {
    setError(null);
    setValidUntil('');
    setNotes('');
    setLines([newLine()]);
    setEntityOptions([]);
  };

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
    if (!entityId || Number.isNaN(Number(entityId)))
      return 'Please select a valid customer/supplier';

    const cleanLines = lines.filter(
      (l) => l.productId || l.quantity || l.desiredPricePerUnit || l.actualPricePerUnit
    );
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

      const payload: Record<string, unknown> = {
        entity_type: entityType,
        source_type: sourceCallId ? 'scheduled_call' : 'other',
        ...(sourceCallId ? { source_call: Number(sourceCallId) } : {}),
        valid_until: validUntil || undefined,
        notes: notes.trim() || undefined,
        products,
      };

      if (entityType === 'customer') payload.customer = Number(entityId);
      if (entityType === 'supplier') payload.supplier = Number(entityId);

      const resp = await businessApi.post('/inquiries/', payload);
      reset();
      onSuccess(resp.data);
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      const apiMsg =
        (typeof data?.detail === 'string' && data.detail) ||
        (typeof data?.error === 'string' && data.error) ||
        (data && typeof data === 'object'
          ? (() => {
              const first = Object.entries(data).find(([, v]) => Array.isArray(v) || typeof v === 'string');
              if (!first) return null;
              return Array.isArray(first[1]) ? String(first[1][0] ?? 'Invalid value') : String(first[1]);
            })()
          : null) ||
        err?.message;
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
              <Subtitle>Capture products, desired vs actual pricing, and units.</Subtitle>
            </TitleBlock>
            <CloseButton type="button" onClick={close} aria-label="Close">
              ×
            </CloseButton>
          </Header>

          <Body>
            <Section>
              <SectionTitle>Context</SectionTitle>
              <Grid>
                <Field $span={3}>
                  <Label>Entity Type *</Label>
                  <Select
                    value={entityType}
                    onChange={(e) => {
                      setEntityType(e.target.value as EntityType);
                      setEntityId('');
                    }}
                    disabled={!canSubmit || Boolean(initialEntityType)}
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </Select>
                </Field>
                <Field $span={9}>
                  <Label>{entityType === 'customer' ? 'Customer' : 'Supplier'} *</Label>
                  <Select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    disabled={!canSubmit || loadingEntities || Boolean(initialEntityId)}
                  >
                    <option value="">Select…</option>
                    {entityOptions.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                  {loadingEntities && <Muted>Loading…</Muted>}
                </Field>
              </Grid>
            </Section>

            <Section>
              <SectionTitle>Inquiry</SectionTitle>
              <Grid>
                <Field $span={4}>
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    disabled={!canSubmit}
                  />
                </Field>
                <Field $span={8}>
                  <Label>Notes</Label>
                  <TextArea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional context, requirements, competitor notes…"
                    disabled={!canSubmit}
                  />
                </Field>
              </Grid>
            </Section>

            <Section>
              <SectionTitle>Products</SectionTitle>
              <LinesTable>
                <LinesHeader>
                  <div>Product</div>
                  <div>Qty</div>
                  <div>UOM</div>
                  <div>Desired $/U</div>
                  <div>Actual $/U</div>
                  <div>Notes</div>
                  <div />
                </LinesHeader>

                {lines.map((line) => (
                  <LinesRow key={line.key}>
                    <LineCell>
                      <Label>Product *</Label>
                      <SmartProductAutocomplete
                        value={line.productId}
                        onChange={(productId) => updateLine(line.key, { productId })}
                        disabled={!canSubmit}
                      />
                    </LineCell>
                    <LineCell>
                      <Label>Qty *</Label>
                      <Input
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        placeholder="e.g., 100"
                        disabled={!canSubmit}
                      />
                    </LineCell>
                    <LineCell>
                      <Label>UOM</Label>
                      <Select
                        value={line.desiredUom}
                        onChange={(e) => updateLine(line.key, { desiredUom: e.target.value })}
                        disabled={!canSubmit}
                      >
                        {(uomOptions.length ? uomOptions : [{ value: 'LBS', label: 'LBS' }]).map(
                          (o) => (
                            <option key={String(o.value)} value={String(o.value)}>
                              {o.label}
                            </option>
                          )
                        )}
                      </Select>
                    </LineCell>
                    <LineCell>
                      <Label>Desired</Label>
                      <Input
                        value={line.desiredPricePerUnit}
                        onChange={(e) =>
                          updateLine(line.key, { desiredPricePerUnit: e.target.value })
                        }
                        placeholder="e.g., 5.25"
                        disabled={!canSubmit}
                      />
                    </LineCell>
                    <LineCell>
                      <Label>Actual</Label>
                      <Input
                        value={line.actualPricePerUnit}
                        onChange={(e) =>
                          updateLine(line.key, { actualPricePerUnit: e.target.value })
                        }
                        placeholder="e.g., 5.55"
                        disabled={!canSubmit}
                      />
                    </LineCell>
                    <LineCell>
                      <Label>Line Notes</Label>
                      <Input
                        value={line.notes}
                        onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                        placeholder="Optional"
                        disabled={!canSubmit}
                      />
                    </LineCell>
                    <RowActions>
                      <IconButton
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={!canSubmit}
                        aria-label="Remove line"
                        title="Remove line"
                      >
                        ×
                      </IconButton>
                    </RowActions>
                  </LinesRow>
                ))}
              </LinesTable>

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  $variant="secondary"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                  disabled={!canSubmit}
                >
                  + Add Line
                </Button>
              </div>
            </Section>

            {error && <Error>{error}</Error>}
          </Body>

          <Footer>
            <Button type="button" $variant="secondary" onClick={close} disabled={!canSubmit}>
              Cancel
            </Button>
            <Button type="submit" $variant="primary" disabled={!canSubmit}>
              {submitting ? 'Creating…' : 'Create Inquiry'}
            </Button>
          </Footer>
        </form>
      </Modal>
    </Overlay>
  );
};

export default InquiryCreateModal;
