import React, { useMemo } from 'react';
import { Button } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { EntityFormSurface } from '@/components/Shared';
import type { EntityFormMode } from '@/components/Shared/EntityFormSurface';

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
    </div>
  );
};

export default UniversalEntityRecordPage;
