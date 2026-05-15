/**
 * TradeLineageActions
 *
 * Contextual action buttons for creating downstream trade records
 * (e.g. create Sales Order from Inquiry, create Fulfillment from Inquiry).
 *
 * Self-fetches entity record to determine status and linked records.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Button, message } from 'antd';
import { FilePlus2, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { getDocumentEntityConfig } from '@/components/Operations/documentOperations';
import { withTenantQueryKey } from '@/utils/queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface TradeLineageActionsProps {
  entityType: string;
  entityId: string | number;
  status?: string;
  record?: Record<string, unknown>;
  onRecordCreated?: () => void;
}

interface ActionDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  handler: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const TRADE_ENTITY_TYPES = new Set([
  'inquiry',
  'purchase_order',
]);

// ============================================================================
// Styled Components
// ============================================================================

const ActionsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const ActionButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  border-color: rgb(var(--color-border));

  &:hover {
    color: rgb(var(--color-primary));
    border-color: rgb(var(--color-primary));
  }
`;

// ============================================================================
// Component
// ============================================================================

export const TradeLineageActions: React.FC<TradeLineageActionsProps> = ({
  entityType,
  entityId,
  status: statusProp,
  record: recordProp,
  onRecordCreated,
}) => {
  const navigate = useNavigate();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const normalizedType = String(entityType || '').trim().toLowerCase();
  const normalizedId = String(entityId);
  const config = useMemo(() => getDocumentEntityConfig(normalizedType), [normalizedType]);
  const endpoint = config?.endpoint ?? normalizedType;

  const queryKey = useMemo(
    () => withTenantQueryKey('trade-lineage-record', normalizedType, normalizedId),
    [normalizedType, normalizedId],
  );

  const { data: fetchedRecord } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const res = await businessApi.get(`${endpoint}/${encodeURIComponent(normalizedId)}/`);
        return (res.data ?? {}) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    },
    enabled: TRADE_ENTITY_TYPES.has(normalizedType) && Boolean(normalizedId) && !recordProp,
    staleTime: 30_000,
    retry: 1,
  });

  const record = recordProp ?? fetchedRecord ?? {};
  const normalizedStatus = String(statusProp || record.status || '').trim().toLowerCase();

  const handleCreateSOFromInquiry = useCallback(async () => {
    setLoadingKey('inquiry-so');
    try {
      const res = await businessApi.post(`inquiries/${entityId}/create-sales-order-draft/`);
      const data = res.data as Record<string, unknown>;
      const so = data.sales_order as Record<string, unknown> | undefined;
      message.success('Sales Order draft created');
      onRecordCreated?.();
      if (so?.id) {
        navigate(`/records/sales_order/${so.id}`);
      }
    } catch {
      message.error('Failed to create Sales Order');
    } finally {
      setLoadingKey(null);
    }
  }, [entityId, navigate, onRecordCreated]);

  const handleCreateFulfillmentFromInquiry = useCallback(async () => {
    setLoadingKey('inquiry-fulfillment');
    try {
      const res = await businessApi.post(`inquiries/${entityId}/create-fulfillment/`);
      const data = res.data as Record<string, unknown>;
      const id = data.id;
      message.success('Fulfillment created');
      onRecordCreated?.();
      if (id) {
        navigate(`/records/fulfillment/${id}`);
      }
    } catch {
      message.error('Failed to create Fulfillment');
    } finally {
      setLoadingKey(null);
    }
  }, [entityId, navigate, onRecordCreated]);

  const handleCreateSOFromPO = useCallback(async () => {
    setLoadingKey('po-so');
    try {
      const res = await businessApi.post(`purchase-orders/${entityId}/create-sales-order-draft/`);
      const data = res.data as Record<string, unknown>;
      const so = data.sales_order as Record<string, unknown> | undefined;
      message.success('Sales Order draft created');
      onRecordCreated?.();
      if (so?.id) {
        navigate(`/records/sales_order/${so.id}`);
      }
    } catch {
      message.error('Failed to create Sales Order');
    } finally {
      setLoadingKey(null);
    }
  }, [entityId, navigate, onRecordCreated]);

  const actions = useMemo<ActionDef[]>(() => {
    const result: ActionDef[] = [];

    if (normalizedType === 'inquiry') {
      const hasSalesOrder = Boolean(
        record.sales_order || record.sales_order_id,
      );
      const hasFulfillments = Boolean(
        record.fulfillments &&
          Array.isArray(record.fulfillments) &&
          (record.fulfillments as unknown[]).length > 0,
      );

      if (
        (normalizedStatus === 'accepted' || normalizedStatus === 'quoted') &&
        !hasSalesOrder
      ) {
        result.push({
          key: 'inquiry-so',
          label: 'Create Sales Order',
          icon: <FilePlus2 size={14} />,
          handler: handleCreateSOFromInquiry,
        });
      }

      if (
        (normalizedStatus === 'accepted' || normalizedStatus === 'fulfilled') &&
        !hasFulfillments
      ) {
        result.push({
          key: 'inquiry-fulfillment',
          label: 'Create Fulfillment',
          icon: <Package size={14} />,
          handler: handleCreateFulfillmentFromInquiry,
        });
      }
    }

    if (normalizedType === 'purchase_order') {
      const hasLinkedSO = Boolean(
        record.sales_order || record.sales_order_id,
      );

      if (
        (normalizedStatus === 'approved' || normalizedStatus === 'sent') &&
        !hasLinkedSO
      ) {
        result.push({
          key: 'po-so',
          label: 'Create Sales Order',
          icon: <FilePlus2 size={14} />,
          handler: handleCreateSOFromPO,
        });
      }
    }

    return result;
  }, [
    normalizedType,
    normalizedStatus,
    record,
    handleCreateSOFromInquiry,
    handleCreateFulfillmentFromInquiry,
    handleCreateSOFromPO,
  ]);

  if (!TRADE_ENTITY_TYPES.has(normalizedType) || actions.length === 0) {
    return null;
  }

  return (
    <ActionsBar>
      {actions.map((action) => (
        <ActionButton
          key={action.key}
          size="small"
          icon={action.icon}
          loading={loadingKey === action.key}
          disabled={loadingKey !== null}
          onClick={action.handler}
        >
          {action.label}
        </ActionButton>
      ))}
    </ActionsBar>
  );
};

export default TradeLineageActions;
