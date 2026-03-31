import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';

import { EntityFormSurface } from '@/components/Shared';
import type { EntityFormMode } from '@/components/Shared/EntityFormSurface';
import { apiClient } from '@/services/apiService';

type RouteParams = {
  id?: string;
};

export interface UniversalEntityRecordPageProps {
  entityType: string;

  /** Base path for this entity section (e.g. "/customers" or "/suppliers"). */
  basePath: string;

  mode: 'create' | 'view' | 'edit';
}

const extractId = (result: unknown): string | null => {
  const row = (result && typeof result === 'object' ? (result as Record<string, unknown>) : {}) || {};
  const id = row.id ?? row.uuid ?? row.pk;
  const s = String(id ?? '').trim();
  return s ? s : null;
};

export const UniversalEntityRecordPage: React.FC<UniversalEntityRecordPageProps> = ({
  entityType,
  basePath,
  mode,
}) => {
  const navigate = useNavigate();
  const { id } = useParams<RouteParams>();

  const entityId = id ? String(id) : undefined;

  const normalizedEntityType = String(entityType || '').trim().toLowerCase();
  const isSupplier = normalizedEntityType === 'supplier';
  const isCustomer = normalizedEntityType === 'customer';

  const showHierarchySection = mode === 'view' && Boolean(entityId) && (isSupplier || isCustomer);

  const childEntityType = isSupplier ? 'plant' : 'location';
  const childEntityDisplayName = isSupplier ? 'Plant' : 'Location';
  const childLabel = isSupplier ? 'Plants' : 'Locations';
  const childEndpoint = isSupplier ? 'plants/' : 'locations/';
  const childFilterKey = isSupplier ? 'supplier' : 'customer';
  const childDetailRouteBase = isSupplier ? '/plants' : '/locations';

  const [childRows, setChildRows] = useState<Record<string, unknown>[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [childCreateOpen, setChildCreateOpen] = useState(false);

  const loadChildRows = useCallback(async () => {
    if (!entityId || !showHierarchySection) return;
    setChildLoading(true);
    try {
      const resp = await apiClient.get(childEndpoint, {
        params: {
          [childFilterKey]: entityId,
          page_size: 50,
          limit: 50,
        },
      });

      const payload = resp.data as unknown;
      const payloadObj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const rows = Array.isArray(payloadObj?.results) ? (payloadObj?.results as unknown[]) : (payload as unknown[]);

      setChildRows((Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object') as Record<string, unknown>[]);
    } finally {
      setChildLoading(false);
    }
  }, [childEndpoint, childFilterKey, entityId, showHierarchySection]);

  useEffect(() => {
    void loadChildRows();
  }, [loadChildRows]);

  const formMode: EntityFormMode = useMemo(() => {
    if (mode === 'create') return 'create';
    if (mode === 'edit') return 'edit';
    return 'view';
  }, [mode]);

  const title = useMemo(() => {
    if (mode === 'create') return `New ${entityType}`;
    if (mode === 'edit') return `Edit ${entityType}`;
    return `${entityType}`;
  }, [entityType, mode]);

  const childColumns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    if (isSupplier) {
      return [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Code', dataIndex: 'code', key: 'code' },
        { title: 'Type', dataIndex: 'plant_type', key: 'plant_type' },
        { title: 'Establishment #', dataIndex: 'plant_est_num', key: 'plant_est_num' },
        { title: 'City', dataIndex: 'city', key: 'city' },
        { title: 'State', dataIndex: 'state', key: 'state' },
      ];
    }

    return [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      { title: 'Code', dataIndex: 'code', key: 'code' },
      { title: 'Type', dataIndex: 'location_type', key: 'location_type' },
      { title: 'Establishment #', dataIndex: 'plant_est_num', key: 'plant_est_num' },
      { title: 'City', dataIndex: 'city', key: 'city' },
      { title: 'State', dataIndex: 'state', key: 'state' },
    ];
  }, [isSupplier]);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button onClick={() => navigate(basePath)}>Back</Button>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-text-primary))' }}>
            {title}
          </div>
        </div>

        {mode === 'view' && entityId && (
          <Button type="primary" onClick={() => navigate(`${basePath}/${encodeURIComponent(entityId)}/edit`)}>
            Edit
          </Button>
        )}

        {mode === 'edit' && entityId && (
          <Button onClick={() => navigate(`${basePath}/${encodeURIComponent(entityId)}`)}>Cancel</Button>
        )}
      </div>

      <EntityFormSurface
        entityType={entityType}
        mode={formMode}
        variant="inline"
        isOpen={true}
        entityId={formMode === 'create' ? undefined : entityId}
        onClose={() => navigate(basePath)}
        onSuccess={(result) => {
          const nextId = extractId(result);

          if (mode === 'create' && nextId) {
            navigate(`${basePath}/${encodeURIComponent(nextId)}`);
            return;
          }

          if (mode === 'edit' && entityId) {
            navigate(`${basePath}/${encodeURIComponent(entityId)}`);
            return;
          }
        }}
      />

      {showHierarchySection && (
        <Card
          style={{ marginTop: 16 }}
          title={childLabel}
          extra={
            <Button type="primary" onClick={() => setChildCreateOpen(true)}>
              New {childEntityDisplayName}
            </Button>
          }
        >
          {childLoading ? (
            <div style={{ padding: 12 }}>
              <Spin />
            </div>
          ) : (
            <Table
              rowKey={(row) => String(row.id ?? '')}
              columns={childColumns}
              dataSource={childRows}
              pagination={false}
              size="small"
              onRow={(row) => ({
                onClick: () => {
                  const rowId = String(row.id ?? '').trim();
                  if (!rowId) return;
                  navigate(`${childDetailRouteBase}/${encodeURIComponent(rowId)}`);
                },
              })}
            />
          )}
        </Card>
      )}

      {showHierarchySection && (
        <EntityFormSurface
          entityType={childEntityType}
          mode="create"
          variant="modal"
          isOpen={childCreateOpen}
          onClose={() => setChildCreateOpen(false)}
          onSuccess={() => {
            setChildCreateOpen(false);
            void loadChildRows();
          }}
          initialValues={{ [childFilterKey]: entityId }}
        />
      )}
    </div>
  );
};

export default UniversalEntityRecordPage;
