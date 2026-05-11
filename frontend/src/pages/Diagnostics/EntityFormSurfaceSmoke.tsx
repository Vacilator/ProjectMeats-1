import React, { useCallback } from 'react';

import { Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';

import { EntityFormSurface } from '../../components/Shared/EntityFormSurface';

const { Paragraph, Title } = Typography;

export const EntityFormSurfaceSmoke: React.FC = () => {
  const [searchParams] = useSearchParams();
  const handleClose = useCallback(() => {}, []);
  const mode = searchParams.get('mode') === 'create' ? 'create' : 'edit';
  const isCreateMode = mode === 'create';
  const supplierChildSeed = searchParams.get('seed') === 'supplier-child';

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 16px 48px',
      }}
    >
      <Title level={2} data-testid="entity-form-smoke-title">
        Entity form smoke
      </Title>
      <Paragraph style={{ color: 'rgb(var(--color-text-secondary))' }}>
        Production-preview smoke harness for the Plant create/edit loader boundary.
      </Paragraph>

      <EntityFormSurface
        entityType="plant"
        entityId={isCreateMode ? undefined : '2769'}
        mode={mode}
        variant="inline"
        isOpen
        onClose={handleClose}
        initialValues={
          isCreateMode
            ? supplierChildSeed
              ? { supplier: '123', plant_type: 'processing', country: 'USA' }
              : {
                  supplier: '123',
                  plant_type: 'processing',
                  country: 'USA',
                  export_approved: false,
                }
            : { export_approved: false }
        }
      />
    </div>
  );
};

export default EntityFormSurfaceSmoke;
