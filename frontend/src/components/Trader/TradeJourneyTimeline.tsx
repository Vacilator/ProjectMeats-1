/**
 * TradeJourneyTimeline
 *
 * Compact horizontal stepper showing the full trade chain for a record.
 * Fetches related records and shows the chain:
 * Inquiry → PO → SO → Carrier PO → Fulfillment → Invoice
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Tooltip } from 'antd';
import {
  FileSearch,
  ShoppingCart,
  FileText,
  Truck,
  Package,
  Receipt,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface TradeJourneyTimelineProps {
  entityType: string;
  entityId: string | number;
}

interface TimelineStep {
  key: string;
  label: string;
  icon: React.ReactNode;
  entityType: string;
  linkedId: string | null;
  isCurrent: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TRADE_ENTITY_TYPES = new Set([
  'inquiry',
  'purchase_order',
  'sales_order',
  'carrier_purchase_order',
  'fulfillment',
  'invoice',
]);

const STEP_DEFS: Array<{
  key: string;
  label: string;
  entityType: string;
  icon: React.ReactNode;
  relationshipKeys: string[];
}> = [
  {
    key: 'inquiry',
    label: 'Inquiry',
    entityType: 'inquiry',
    icon: <FileSearch size={14} />,
    relationshipKeys: ['inquiry', 'inquiries'],
  },
  {
    key: 'purchase_order',
    label: 'PO',
    entityType: 'purchase_order',
    icon: <ShoppingCart size={14} />,
    relationshipKeys: ['purchase_order', 'purchase_orders', 'recent_orders'],
  },
  {
    key: 'sales_order',
    label: 'SO',
    entityType: 'sales_order',
    icon: <FileText size={14} />,
    relationshipKeys: ['sales_order', 'sales_orders', 'recent_orders'],
  },
  {
    key: 'carrier_purchase_order',
    label: 'Carrier PO',
    entityType: 'carrier_purchase_order',
    icon: <Truck size={14} />,
    relationshipKeys: ['carrier_purchase_order', 'carrier_purchase_orders', 'freight_orders'],
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    entityType: 'fulfillment',
    icon: <Package size={14} />,
    relationshipKeys: ['fulfillment', 'fulfillments'],
  },
  {
    key: 'invoice',
    label: 'Invoice',
    entityType: 'invoice',
    icon: <Receipt size={14} />,
    relationshipKeys: ['invoice', 'invoices'],
  },
];

// ============================================================================
// Styled Components
// ============================================================================

const TimelineContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  height: 48px;
  overflow-x: auto;
  padding: 4px 0;
`;

const StepNode = styled.button<{
  $variant: 'current' | 'linked' | 'inactive';
}>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.15s;
  cursor: ${(p) => (p.$variant === 'inactive' ? 'default' : 'pointer')};

  background: ${(p) =>
    p.$variant === 'current'
      ? 'rgba(var(--color-primary), 0.12)'
      : p.$variant === 'linked'
        ? 'rgba(var(--color-success), 0.06)'
        : 'transparent'};

  color: ${(p) =>
    p.$variant === 'current'
      ? 'rgb(var(--color-primary))'
      : p.$variant === 'linked'
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-text-tertiary, 156 163 175))'};

  border-color: ${(p) =>
    p.$variant === 'current'
      ? 'rgba(var(--color-primary), 0.25)'
      : p.$variant === 'linked'
        ? 'rgba(var(--color-success), 0.15)'
        : 'transparent'};

  opacity: ${(p) => (p.$variant === 'inactive' ? 0.5 : 1)};

  &:hover {
    background: ${(p) =>
      p.$variant !== 'inactive'
        ? 'rgba(var(--color-primary), 0.08)'
        : 'transparent'};
  }
`;

const StepDot = styled.div<{ $variant: 'current' | 'linked' | 'inactive' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  background: ${(p) =>
    p.$variant === 'current'
      ? 'rgb(var(--color-primary))'
      : p.$variant === 'linked'
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-border, 229 231 235))'};
`;

const StepConnector = styled.div<{ $active: boolean }>`
  width: 20px;
  height: 2px;
  flex-shrink: 0;
  background: ${(p) =>
    p.$active
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-border, 229 231 235))'};
`;

// ============================================================================
// Helpers
// ============================================================================

type RelationshipsPayload = {
  relationships?: Record<string, unknown[]>;
  counts?: Record<string, number>;
};

function findLinkedId(
  relationships: Record<string, unknown[]>,
  keys: string[],
  entityType: string,
): string | null {
  for (const key of keys) {
    const items = relationships[key];
    if (!Array.isArray(items) || items.length === 0) continue;

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const recType = String(rec.type ?? rec.entity_type ?? '').toLowerCase();

      if (recType === entityType || recType === '' || key === entityType) {
        const id = rec.id ?? rec.pk ?? rec.uuid;
        if (id != null) return String(id);
      }
    }
  }
  return null;
}

// ============================================================================
// Component
// ============================================================================

export const TradeJourneyTimeline: React.FC<TradeJourneyTimelineProps> = ({
  entityType,
  entityId,
}) => {
  const navigate = useNavigate();
  const normalizedType = String(entityType || '').trim().toLowerCase();
  const normalizedId = String(entityId);

  const queryKey = useMemo(
    () => withTenantQueryKey('trade-journey', normalizedType, normalizedId),
    [normalizedType, normalizedId],
  );

  const { data: relationshipsData } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const res = await businessApi.get(
          `/system/entities/${normalizedType}/${encodeURIComponent(normalizedId)}/relationships/`,
        );
        return (res.data || {}) as RelationshipsPayload;
      } catch {
        return {} as RelationshipsPayload;
      }
    },
    enabled: TRADE_ENTITY_TYPES.has(normalizedType) && Boolean(normalizedId),
    staleTime: 30_000,
    retry: 1,
  });

  const steps = useMemo<TimelineStep[]>(() => {
    const rels = relationshipsData?.relationships ?? {};

    return STEP_DEFS.map((def) => {
      const isCurrent = def.entityType === normalizedType;
      const linkedId = isCurrent
        ? normalizedId
        : findLinkedId(rels, def.relationshipKeys, def.entityType);

      return {
        key: def.key,
        label: def.label,
        icon: def.icon,
        entityType: def.entityType,
        linkedId,
        isCurrent,
      };
    });
  }, [relationshipsData, normalizedType, normalizedId]);

  if (!TRADE_ENTITY_TYPES.has(normalizedType)) {
    return null;
  }

  const handleStepClick = (step: TimelineStep) => {
    if (step.linkedId && !step.isCurrent) {
      navigate(`/records/${step.entityType}/${step.linkedId}`);
    }
  };

  return (
    <TimelineContainer>
      {steps.map((step, idx) => {
        const variant: 'current' | 'linked' | 'inactive' = step.isCurrent
          ? 'current'
          : step.linkedId
            ? 'linked'
            : 'inactive';

        const tooltipText = step.isCurrent
          ? `${step.label} (current)`
          : step.linkedId
            ? `View ${step.label}`
            : `No linked ${step.label}`;

        return (
          <React.Fragment key={step.key}>
            {idx > 0 && (
              <StepConnector
                $active={Boolean(step.linkedId || steps[idx - 1]?.linkedId)}
              />
            )}
            <Tooltip title={tooltipText}>
              <StepNode
                $variant={variant}
                onClick={() => handleStepClick(step)}
                type="button"
                tabIndex={variant === 'inactive' ? -1 : 0}
              >
                <StepDot $variant={variant} />
                {step.icon}
                {step.label}
              </StepNode>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </TimelineContainer>
  );
};

export default TradeJourneyTimeline;
