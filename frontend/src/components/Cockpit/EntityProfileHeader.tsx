import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Spin, Typography, message, Tag } from 'antd';
import debounce from 'lodash/debounce';
import { businessApi } from '../../services/businessApi';

const { Text } = Typography;

export interface EntityReference {
  id: string | number;
  type?: string | null;
  title?: string | null;
}

export interface EntityDetailResponse {
  id: string | number;
  type: string;
  title: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  fields?: Record<string, unknown>;
  can_edit?: boolean;
}

export interface EntityProfileHeaderProps {
  entityType: string;
  entityId: string;
  onNavigateToEntity: (entityType: string, entityId: string, label: string) => void;
  /**
   * When set to "compact", only the most important fields are shown.
   * Defaults to "full" for backward compatibility.
   */
  variant?: 'full' | 'compact';
}

const Container = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const TitleBlock = styled.div`
  min-width: 0;
`;

const Title = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Subtitle = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 16px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const FieldLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FieldValue = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  min-width: 0;
`;

const LinkButton = styled.button`
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(var(--color-primary));
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
`;

const formatScalar = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const isEntityReference = (value: unknown): value is EntityReference => {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return 'id' in v && (typeof v.id === 'string' || typeof v.id === 'number');
};

export const EntityProfileHeader: React.FC<EntityProfileHeaderProps> = ({
  entityType,
  entityId,
  onNavigateToEntity,
  variant = 'full',
}) => {
  const [data, setData] = useState<EntityDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await businessApi.get(`/system/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/`);
      setData(resp.data as EntityDetailResponse);
    } catch (err: any) {
      console.error('[EntityProfileHeader] Failed to load entity:', err);
      message.error('Failed to load record details');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = Boolean(data?.can_edit);

  const debouncedPatch = useMemo(
    () => debounce(async (field: string, value: unknown) => {
      try {
        await businessApi.patch(
          `/system/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/`,
          { field, value }
        );
      } catch (err: any) {
        console.error('[EntityProfileHeader] Failed to update field:', err);
        message.error('Failed to update field');
        void load();
      }
    }, 300),
    [entityType, entityId, load]
  );

  useEffect(() => {
    return () => debouncedPatch.cancel();
  }, [debouncedPatch]);

  const fieldEntries = useMemo(() => {
    const fields = data?.fields ?? {};
    const entries = Object.entries(fields).filter(([key]) => !['id'].includes(key));

    if (variant !== 'compact') {
      return entries.sort(([a], [b]) => a.localeCompare(b));
    }

    const type = String(entityType || '').toLowerCase();
    const preferredByType: Record<string, string[]> = {
      customer: [
        'company_name', 'company', 'name',
        'phone', 'phone_number',
        'email', 'contact_email',
        'status',
      ],
      supplier: [
        'company_name', 'company', 'name',
        'phone', 'phone_number',
        'email', 'contact_email',
        'status',
      ],
      contact: ['first_name', 'last_name', 'email', 'phone', 'status'],
      sales_order: ['our_sales_order_num', 'delivery_po_num', 'status', 'due_date', 'delivery_date'],
      purchase_order: ['order_number', 'our_purchase_order_num', 'status', 'due_date', 'delivery_date'],
      invoice: ['invoice_number', 'status', 'due_date', 'total_amount', 'payment_status'],
    };

    const preferred = preferredByType[type] ?? [];
    const preferredIndex = new Map(preferred.map((key, idx) => [key, idx] as const));

    const sorted = entries.sort(([a], [b]) => {
      const ai = preferredIndex.has(a) ? preferredIndex.get(a)! : Number.POSITIVE_INFINITY;
      const bi = preferredIndex.has(b) ? preferredIndex.get(b)! : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });

    return sorted.slice(0, 6);
  }, [data, entityType, variant]);

  return (
    <Container>
      <TitleRow>
        <TitleBlock>
          <Title title={data?.title || ''}>{data?.title || 'Record'}</Title>
          <Subtitle>
            <Tag color="blue">{variant === 'compact' ? `${entityType} · key fields` : entityType}</Tag>
            <span style={{ marginLeft: 8 }}>ID: {entityId}</span>
          </Subtitle>
        </TitleBlock>
      </TitleRow>

      {loading ? (
        <div style={{ padding: 12 }}><Spin /></div>
      ) : (
        <FieldsGrid>
          {fieldEntries.map(([key, value]) => {
            if (isEntityReference(value) && value.type && value.id !== null && value.id !== undefined) {
              const label = value.title || `${value.type} ${value.id}`;
              return (
                <FieldRow key={key}>
                  <FieldLabel>{key}</FieldLabel>
                  <FieldValue>
                    <LinkButton
                      onClick={() => onNavigateToEntity(String(value.type), String(value.id), label)}
                      title="Navigate"
                    >
                      {label}
                    </LinkButton>
                  </FieldValue>
                </FieldRow>
              );
            }

            const scalar = formatScalar(value);
            const isEditable = canEdit && typeof value === 'string' && scalar.length <= 200;

            return (
              <FieldRow key={key}>
                <FieldLabel>{key}</FieldLabel>
                <FieldValue>
                  {isEditable ? (
                    <Text
                      editable={{
                        onChange: (next) => debouncedPatch(key, next),
                        tooltip: 'Click to edit',
                      }}
                    >
                      {scalar || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>}
                    </Text>
                  ) : (
                    scalar || <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>—</span>
                  )}
                </FieldValue>
              </FieldRow>
            );
          })}
        </FieldsGrid>
      )}
    </Container>
  );
};

export default EntityProfileHeader;
