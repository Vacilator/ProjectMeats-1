import React, { useMemo } from 'react';
import styled from 'styled-components';

import { type Inquiry, type InquiryProduct } from '@/types';
import { formatCurrency, formatDateLocal } from '@/utils/formatters';

export interface InquiryEmbeddedViewProps {
  inquiry: Inquiry;
  onClose?: () => void;
}

const Panel = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const TitleBlock = styled.div``;

const Title = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const CloseButton = styled.button`
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: var(--radius-md);
  height: 32px;
  width: 32px;
  line-height: 1;

  &:hover {
    color: rgb(var(--color-text-primary));
    border-color: rgba(var(--color-primary), 0.55);
  }
`;

const Body = styled.div`
  padding: 1.25rem;
`;

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  font-weight: 800;
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

const Label = styled.div`
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 0.375rem;
`;

const ValueBox = styled.div`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
`;

const MultiValueBox = styled(ValueBox)`
  min-height: 90px;
  white-space: pre-wrap;
`;

const LinesTable = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const LinesHeader = styled.div`
  display: grid;
  grid-template-columns: 2.5fr 1fr 1fr 1fr 1fr 1.1fr 1.5fr;
  gap: 0;
  padding: 0.75rem 0.75rem;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  font-size: 0.75rem;
  font-weight: 900;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;

  @media (max-width: 900px) {
    display: none;
  }
`;

const LinesRow = styled.div`
  display: grid;
  grid-template-columns: 2.5fr 1fr 1fr 1fr 1fr 1.1fr 1.5fr;
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

const ProductCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  .code {
    font-weight: 800;
    color: rgb(var(--color-text-primary));
  }

  .desc {
    font-size: 0.8rem;
    color: rgb(var(--color-text-secondary));
  }
`;

const DeltaValue = styled.div<{ $tone: 'positive' | 'negative' | 'neutral' }>`
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

const Muted = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const computeDeltaTotal = (p: InquiryProduct) => {
  // Prefer explicit totals if present.
  const desiredTotal = toNumber(p.desired_total);
  const actualTotal = toNumber(p.actual_total);
  if (desiredTotal != null && actualTotal != null) return desiredTotal - actualTotal;

  const qty = toNumber(p.quantity) ?? 0;
  const desiredUnit = toNumber(p.desired_price_per_unit);
  const actualUnit = toNumber(p.actual_price_per_unit);
  if (desiredUnit == null || actualUnit == null) return null;
  return (desiredUnit - actualUnit) * qty;
};

const formatShippingType = (shippingType?: string) => {
  switch (shippingType) {
    case 'tenant':
      return 'Tenant';
    case 'customer_pickup':
      return 'Customer Pick-Up';
    case 'supplier_delivering':
      return 'Supplier Delivering';
    default:
      return shippingType || '-';
  }
};

export const InquiryEmbeddedView: React.FC<InquiryEmbeddedViewProps> = ({ inquiry, onClose }) => {
  const entityLabel = useMemo(() => {
    if (inquiry.entity_type === 'customer') return inquiry.customer_name || inquiry.customer || '-';
    if (inquiry.entity_type === 'supplier') return inquiry.supplier_name || inquiry.supplier || '-';
    return '-';
  }, [inquiry]);

  const products = inquiry.products || [];

  return (
    <Panel>
      <Header>
        <TitleBlock>
          <Title>Inquiry {inquiry.inquiry_number}</Title>
          <Subtitle>Read-only view (embedded) — continue searching without leaving Cockpit.</Subtitle>
        </TitleBlock>
        {onClose ? (
          <CloseButton type="button" onClick={onClose} aria-label="Close embedded inquiry">
            ×
          </CloseButton>
        ) : null}
      </Header>

      <Body>
        <Section>
          <SectionTitle>Context</SectionTitle>
          <Grid>
            <Field $span={3}>
              <Label>Entity Type</Label>
              <ValueBox>{inquiry.entity_type || '-'}</ValueBox>
            </Field>
            <Field $span={9}>
              <Label>{inquiry.entity_type === 'customer' ? 'Customer' : 'Supplier'}</Label>
              <ValueBox>{entityLabel}</ValueBox>
            </Field>
            <Field $span={6}>
              <Label>Contact</Label>
              <ValueBox>{inquiry.contact_snapshot_name || inquiry.contact_name || '-'}</ValueBox>
            </Field>
            <Field $span={6}>
              <Label>Company</Label>
              <ValueBox>{inquiry.contact_snapshot_company || entityLabel || '-'}</ValueBox>
            </Field>
          </Grid>
        </Section>

        <Section>
          <SectionTitle>Inquiry</SectionTitle>
          <Grid>
            <Field $span={4}>
              <Label>Shipping Type</Label>
              <ValueBox>{formatShippingType(inquiry.shipping_type)}</ValueBox>
            </Field>
            <Field $span={4}>
              <Label>Valid Until</Label>
              <ValueBox>{formatDateLocal(inquiry.valid_until)}</ValueBox>
            </Field>
            <Field $span={4}>
              <Label>Status</Label>
              <ValueBox>{inquiry.status || '-'}</ValueBox>
            </Field>
            <Field $span={12}>
              <Label>Notes</Label>
              <MultiValueBox>{inquiry.notes || '-'}</MultiValueBox>
            </Field>
          </Grid>
        </Section>

        <Section style={{ marginBottom: 0 }}>
          <SectionTitle>Products</SectionTitle>
          {products.length ? (
            <LinesTable>
              <LinesHeader>
                <div>Product</div>
                <div>Qty</div>
                <div>UOM</div>
                <div>Desired $/U</div>
                <div>Actual $/U</div>
                <div>Δ Total</div>
                <div>Notes</div>
              </LinesHeader>

              {products.map((p) => {
                const delta = computeDeltaTotal(p);
                const tone: 'positive' | 'negative' | 'neutral' =
                  delta == null ? 'neutral' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';

                return (
                  <LinesRow key={p.id}>
                    <LineCell>
                      <Label>Product</Label>
                      <ProductCell>
                        <div className="code">{p.product_code || '-'}</div>
                        <div className="desc">{p.product_description || ''}</div>
                      </ProductCell>
                    </LineCell>
                    <LineCell>
                      <Label>Qty</Label>
                      <ValueBox style={{ textAlign: 'right' }}>{p.quantity ?? '-'}</ValueBox>
                    </LineCell>
                    <LineCell>
                      <Label>UOM</Label>
                      <ValueBox>{p.desired_uom || p.actual_uom || '-'}</ValueBox>
                    </LineCell>
                    <LineCell>
                      <Label>Desired</Label>
                      <ValueBox style={{ textAlign: 'right' }}>
                        {p.desired_price_per_unit != null ? formatCurrency(Number(p.desired_price_per_unit)) : '-'}
                      </ValueBox>
                    </LineCell>
                    <LineCell>
                      <Label>Actual</Label>
                      <ValueBox style={{ textAlign: 'right' }}>
                        {p.actual_price_per_unit != null ? formatCurrency(Number(p.actual_price_per_unit)) : '-'}
                      </ValueBox>
                    </LineCell>
                    <LineCell>
                      <Label>Δ Total</Label>
                      <DeltaValue $tone={tone}>
                        {delta == null
                          ? '-'
                          : `${delta > 0 ? '+' : ''}${formatCurrency(delta)}`}
                      </DeltaValue>
                    </LineCell>
                    <LineCell>
                      <Label>Line Notes</Label>
                      <ValueBox>{p.notes || '-'}</ValueBox>
                    </LineCell>
                  </LinesRow>
                );
              })}
            </LinesTable>
          ) : (
            <Muted>No products found for this inquiry.</Muted>
          )}
        </Section>
      </Body>
    </Panel>
  );
};
