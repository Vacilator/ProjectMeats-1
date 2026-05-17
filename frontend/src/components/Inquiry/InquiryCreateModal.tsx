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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { useZodForm } from '@/hooks/useZodForm';
import styled from 'styled-components';

import { businessApi } from '@/services/businessApi';
import { getChoices, type ChoiceOption } from '@/services/choicesService';
import { formatCurrency } from '@/utils/formatters';
import { SmartProductAutocomplete } from './SmartProductAutocomplete';
import { logger } from '@/utils/logger';

type EntityType = 'supplier' | 'customer';

type EntityOption = { id: number; name: string };

type LineItem = {
  key: string;
  productId: string;
  supplierId: string;
  plantId: string;
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
  initialValues?: Record<string, unknown>;
  onValuesChange?: (values: Record<string, unknown>) => void;

  /**
   * When enabled, customer inquiries can select a supplier + plant per product line.
   * (Used for Cockpit → customer inquiry creation.)
   */
  enableSupplierPlantSelection?: boolean;

  /** Optional: link the inquiry to a scheduled call (e.g., created from ScheduleCallModal). */
  sourceCallId?: string | number;
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
  max-width: 940px;
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

const FieldError = styled.div`
  margin-top: 0.5rem;
  color: rgb(var(--color-error));
  font-size: 0.8rem;
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

const LinesHeader = styled.div<{ $withSourcing?: boolean }>`
  display: grid;
  grid-template-columns: ${(p) =>
    p.$withSourcing
      ? '2.2fr 1.6fr 1.6fr 0.9fr 0.9fr 1fr 1fr 1fr 1.2fr 44px'
      : '2.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr 44px'};
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

const LinesRow = styled.div<{ $withSourcing?: boolean }>`
  display: grid;
  grid-template-columns: ${(p) =>
    p.$withSourcing
      ? '2.2fr 1.6fr 1.6fr 0.9fr 0.9fr 1fr 1fr 1fr 1.2fr 44px'
      : '2.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr 44px'};
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
  supplierId: '',
  plantId: '',
  quantity: '',
  desiredUom: 'LBS',
  desiredPricePerUnit: '',
  actualPricePerUnit: '',
  notes: '',
});

const inquiryCreateSchema = z.object({
  entityType: z.enum(['customer', 'supplier']),
  entityId: z.string().trim().regex(/^\d+$/, 'Please select a valid customer/supplier'),
  validUntil: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

type InquiryCreateValues = z.infer<typeof inquiryCreateSchema>;

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
};

const buildInitialLines = (initialValues?: Record<string, unknown>): LineItem[] => {
  const sourceRows = Array.isArray(initialValues?.products)
    ? initialValues.products
    : Array.isArray(initialValues?.items)
      ? initialValues.items
      : [];

  const rows = sourceRows
    .map((row, index) => {
      const record =
        row && typeof row === 'object' && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : null;

      if (!record) {
        return null;
      }

      const productId = normalizeOptionalString(record.productId ?? record.product);
      const quantity = normalizeOptionalString(record.quantity);
      const desiredPricePerUnit = normalizeOptionalString(
        record.desiredPricePerUnit ?? record.desired_price_per_unit,
      );
      const actualPricePerUnit = normalizeOptionalString(
        record.actualPricePerUnit ?? record.actual_price_per_unit,
      );

      if (!productId && !quantity && !desiredPricePerUnit && !actualPricePerUnit) {
        return null;
      }

      return {
        key: `line-${Date.now()}-${index}`,
        productId,
        supplierId: normalizeOptionalString(record.supplierId ?? record.supplier),
        plantId: normalizeOptionalString(record.plantId ?? record.plant),
        quantity,
        desiredUom: normalizeOptionalString(record.desiredUom ?? record.desired_uom) || 'LBS',
        desiredPricePerUnit,
        actualPricePerUnit,
        notes: normalizeOptionalString(record.notes),
      } satisfies LineItem;
    })
    .filter((row): row is LineItem => row !== null);

  return rows.length ? rows : [newLine()];
};

const buildInquiryCreateDefaults = (opts: {
  initialEntityType?: EntityType;
  initialEntityId?: string | number;
  initialValues?: Record<string, unknown>;
}): InquiryCreateValues => ({
  entityType:
    (normalizeOptionalString(
      opts.initialValues?.entityType ?? opts.initialValues?.entity_type,
    ) as EntityType) ||
    (opts.initialValues?.supplier != null ? 'supplier' : undefined) ||
    opts.initialEntityType ||
    'customer',
  entityId:
    normalizeOptionalString(
      opts.initialValues?.entityId ??
        opts.initialValues?.customer ??
        opts.initialValues?.supplier,
    ) ||
    (opts.initialEntityId != null ? String(opts.initialEntityId) : ''),
  validUntil: normalizeOptionalString(
    opts.initialValues?.validUntil ?? opts.initialValues?.valid_until,
  ),
  notes: normalizeOptionalString(opts.initialValues?.notes),
});

export const InquiryCreateModal: React.FC<InquiryCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEntityType,
  initialEntityId,
  initialValues,
  onValuesChange,
  enableSupplierPlantSelection = false,
  sourceCallId,
}) => {
  const defaultValues = useMemo(
    () => buildInquiryCreateDefaults({ initialEntityType, initialEntityId, initialValues }),
    [initialEntityId, initialEntityType, initialValues],
  );
  const form = useZodForm<InquiryCreateValues>(inquiryCreateSchema, {
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: save previous focus and restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const firstInput = modalRef.current?.querySelector<HTMLElement>('input, select, textarea');
        firstInput?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  const entityType = form.watch('entityType');
  const entityId = form.watch('entityId');
  const validUntil = form.watch('validUntil');
  const notes = form.watch('notes');

  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const [lines, setLines] = useState<LineItem[]>(() => buildInitialLines(initialValues));
  const [uomOptions, setUomOptions] = useState<ChoiceOption[]>([]);

  const canSubmit = useMemo(() => !submitting, [submitting]);

  const showSupplierPlantSelection = enableSupplierPlantSelection && entityType === 'customer';

  type SupplierChoice = { id: number; name: string; has_product?: boolean };
  type PlantChoice = { id: number; name: string; code?: string; has_product?: boolean };

  const [supplierChoicesByProduct, setSupplierChoicesByProduct] = useState<Record<string, SupplierChoice[]>>({});
  const [plantChoicesBySupplierProduct, setPlantChoicesBySupplierProduct] = useState<Record<string, PlantChoice[]>>({});

  const computeVarianceTotal = (line: LineItem): number | null => {
    const qty = Number(line.quantity);
    const desired = Number(line.desiredPricePerUnit);
    const actual = Number(line.actualPricePerUnit);

    if (!Number.isFinite(qty) || !Number.isFinite(desired) || !Number.isFinite(actual)) return null;
    return (actual - desired) * qty;
  };

  // Initialize from context on open.
  useEffect(() => {
    if (!isOpen) return;

    form.reset(defaultValues);
    setLines(buildInitialLines(initialValues));
  }, [defaultValues, form, initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      try {
        const opts = await getChoices('weight_unit');
        setUomOptions(opts);
      } catch (err) {
        logger.warn('Failed to fetch weight unit choices', { err });
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
        const rows = (resp.data?.results ?? resp.data) as Record<string, unknown>[];
        setEntityOptions(
          (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
            id: Number(r.id),
            name: String(r.name || r.company_name || r.title || `${entityType} #${r.id}`),
          }))
        );
      } catch (err) {
        logger.warn('Failed to fetch entity options', { err });
        setEntityOptions([]);
      } finally {
        setLoadingEntities(false);
      }
    })();
  }, [entityType, isOpen]);

  // Supplier + plant option loading (customer inquiries only)
  useEffect(() => {
    if (!isOpen || !showSupplierPlantSelection) return;

    const productIds = Array.from(new Set(lines.map((l) => l.productId).filter(Boolean)));

    void (async () => {
      for (const productId of productIds) {
        if (supplierChoicesByProduct[productId]) continue;
        try {
          const resp = await businessApi.get('/suppliers/for-product/', { params: { product: productId } });
          const rows = (resp.data?.results ?? resp.data) as Record<string, unknown>[];
          setSupplierChoicesByProduct((prev) => ({
            ...prev,
            [productId]: (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
              id: Number(r.id),
              name: String(r.name ?? '').trim() || `Supplier #${r.id}`,
              has_product: Boolean(r.has_product),
            })),
          }));
        } catch (err) {
          logger.warn('Failed to fetch supplier choices for product', { err, productId });
          setSupplierChoicesByProduct((prev) => ({ ...prev, [productId]: [] }));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supplierChoicesByProduct is a cache; including it would cause infinite re-fetch
  }, [isOpen, lines, showSupplierPlantSelection]);

  useEffect(() => {
    if (!isOpen || !showSupplierPlantSelection) return;

    const keys = Array.from(
      new Set(
        lines
          .filter((l) => l.productId && l.supplierId)
          .map((l) => `${l.supplierId}::${l.productId}`)
      )
    );

    void (async () => {
      for (const key of keys) {
        if (plantChoicesBySupplierProduct[key]) continue;
        const [supplierId, productId] = key.split('::');
        try {
          const resp = await businessApi.get('/plants/for-supplier-product/', {
            params: { supplier: supplierId, product: productId },
          });
          const rows = (resp.data?.results ?? resp.data) as Record<string, unknown>[];
          setPlantChoicesBySupplierProduct((prev) => ({
            ...prev,
            [key]: (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
              id: Number(r.id),
              name: String(r.name ?? '').trim() || `Plant #${r.id}`,
              has_product: Boolean(r.has_product),
            })),
          }));
        } catch (err) {
          logger.warn('Failed to fetch plant choices for supplier-product', { err, key });
          setPlantChoicesBySupplierProduct((prev) => ({ ...prev, [key]: [] }));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plantChoicesBySupplierProduct is a cache; including it would cause infinite re-fetch
  }, [isOpen, lines, showSupplierPlantSelection]);

  useEffect(() => {
    if (!isOpen || !onValuesChange) {
      return;
    }

    onValuesChange({
      entityType,
      entityId,
      validUntil,
      notes,
      products: lines.map((line) => ({
        product: line.productId,
        supplier: line.supplierId || undefined,
        plant: line.plantId || undefined,
        quantity: line.quantity,
        desired_uom: line.desiredUom,
        desired_price_per_unit: line.desiredPricePerUnit,
        actual_price_per_unit: line.actualPricePerUnit,
        notes: line.notes,
      })),
    });
  }, [entityId, entityType, isOpen, lines, notes, onValuesChange, validUntil]);

  const reset = () => {
    setError(null);
    form.reset(defaultValues);
    setLines(buildInitialLines(initialValues));
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

  const handleSubmit = form.handleSubmit(async (values) => {
    setError(null);

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

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
        entity_type: values.entityType,
        source_type: sourceCallId ? 'scheduled_call' : 'other',
        ...(sourceCallId ? { source_call: Number(sourceCallId) } : {}),
        valid_until: values.validUntil || undefined,
        notes: values.notes.trim() || undefined,
        products,
      };

      if (values.entityType === 'customer') payload.customer = Number(values.entityId);
      if (values.entityType === 'supplier') payload.supplier = Number(values.entityId);

      const resp = await businessApi.post('/inquiries/', payload);
      reset();
      onSuccess(resp.data);
      onClose();
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = resp.data as Record<string, unknown> | undefined;
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
        (typeof errObj.message === 'string' ? errObj.message : null);
      setError(typeof apiMsg === 'string' && apiMsg ? apiMsg : 'Failed to create inquiry. Please try again.');
    }
  });

  if (!isOpen) return null;

  const entityTypeField = form.register('entityType');
  const entityIdField = form.register('entityId');

  return (
    <Overlay $open={isOpen} onClick={close} role="dialog" aria-modal="true" aria-label="Create new inquiry">
      <Modal ref={modalRef} onClick={(ev) => ev.stopPropagation()}>
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
                    {...entityTypeField}
                    onChange={(e) => {
                      entityTypeField.onChange(e);
                      form.setValue('entityId', '', { shouldValidate: true, shouldDirty: true });
                      setEntityOptions([]);
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
                    {...entityIdField}
                    disabled={!canSubmit || loadingEntities || Boolean(initialEntityId)}
                  >
                    <option value="">Select…</option>
                    {entityOptions.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.entityId?.message && (
                    <FieldError role="alert">{String(form.formState.errors.entityId.message)}</FieldError>
                  )}
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
                    disabled={!canSubmit}
                    {...form.register('validUntil')}
                  />
                </Field>
                <Field $span={8}>
                  <Label>Notes</Label>
                  <TextArea
                    placeholder="Optional context, requirements, competitor notes…"
                    disabled={!canSubmit}
                    {...form.register('notes')}
                  />
                </Field>
              </Grid>
            </Section>

            <Section>
              <SectionTitle>Products</SectionTitle>
              <LinesTable>
                <LinesHeader $withSourcing={showSupplierPlantSelection}>
                  <div>Product</div>
                  {showSupplierPlantSelection && <div>Supplier</div>}
                  {showSupplierPlantSelection && <div>Plant</div>}
                  <div>Qty</div>
                  <div>UOM</div>
                  <div>Desired $/U</div>
                  <div>Actual $/U</div>
                  <div>Δ Total</div>
                  <div>Notes</div>
                  <div />
                </LinesHeader>

                {lines.map((line) => (
                  <LinesRow key={line.key} $withSourcing={showSupplierPlantSelection}>
                    <LineCell>
                      <Label>Product *</Label>
                      <SmartProductAutocomplete
                        value={line.productId}
                        onChange={(productId) =>
                          updateLine(line.key, { productId, supplierId: '', plantId: '' })
                        }
                        disabled={!canSubmit}
                      />
                    </LineCell>
                    {showSupplierPlantSelection && (
                      <LineCell>
                        <Label>Supplier</Label>
                        <Select
                          value={line.supplierId}
                          onChange={(e) =>
                            updateLine(line.key, { supplierId: e.target.value, plantId: '' })
                          }
                          disabled={!canSubmit || !line.productId}
                        >
                          <option value="">Select…</option>
                          {(supplierChoicesByProduct[line.productId] || []).map((s) => (
                            <option key={String(s.id)} value={String(s.id)}>
                              {s.has_product ? '✓ ' : ''}{s.name}
                            </option>
                          ))}
                        </Select>
                      </LineCell>
                    )}

                    {showSupplierPlantSelection && (
                      <LineCell>
                        <Label>Plant</Label>
                        <Select
                          value={line.plantId}
                          onChange={(e) => updateLine(line.key, { plantId: e.target.value })}
                          disabled={!canSubmit || !line.productId || !line.supplierId}
                        >
                          <option value="">Select…</option>
                          {(plantChoicesBySupplierProduct[`${line.supplierId}::${line.productId}`] || []).map((p) => (
                            <option key={String(p.id)} value={String(p.id)}>
                              {p.has_product ? '✓ ' : ''}{p.code ? `${p.code} - ` : ''}{p.name}
                            </option>
                          ))}
                        </Select>
                      </LineCell>
                    )}

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
                      <Label>Δ Total</Label>
                      {(() => {
                        const delta = computeVarianceTotal(line);
                        const tone: 'positive' | 'negative' | 'neutral' =
                          delta == null ? 'neutral' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
                        const text =
                          delta == null ? '-' : `${delta > 0 ? '+' : ''}${formatCurrency(delta)}`;
                        return <ComputedValue $tone={tone}>{text}</ComputedValue>;
                      })()}
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
