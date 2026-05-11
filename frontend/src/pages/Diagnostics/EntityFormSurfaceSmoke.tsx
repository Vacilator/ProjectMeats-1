import React, { useCallback, useState } from 'react';

import { Button, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';

import { EntityFormSurface } from '../../components/Shared/EntityFormSurface';

const { Paragraph, Title } = Typography;

export const EntityFormSurfaceSmoke: React.FC = () => {
  const [searchParams] = useSearchParams();
  const scenario = searchParams.get('scenario');
  const handleClose = useCallback(() => {}, []);
  const mode = searchParams.get('mode') === 'create' ? 'create' : 'edit';
  const isCreateMode = mode === 'create';
  const [supplierChildModalOpen, setSupplierChildModalOpen] = useState(false);
  const openSupplierChildModal = useCallback(() => {
    setSupplierChildModalOpen(true);
  }, []);
  const closeSupplierChildModal = useCallback(() => {
    setSupplierChildModalOpen(false);
  }, []);

  if (scenario === 'supplier-child') {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '24px 16px 48px',
        }}
      >
        <Title level={2} data-testid="entity-form-smoke-title">
          Supplier child create smoke
        </Title>
        <Paragraph style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Production-preview smoke harness for the supplier record New Plant modal path.
        </Paragraph>

        <Button type="primary" data-testid="supplier-child-open" onClick={openSupplierChildModal}>
          New Plant
        </Button>

        <EntityFormSurface
          entityType="plant"
          mode="create"
          variant="modal"
          isOpen={supplierChildModalOpen}
          onClose={closeSupplierChildModal}
          initialValues={{
            supplier: '123',
            plant_type: 'processing',
            country: 'USA',
          }}
        />
      </div>
    );
  }

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
            ? { supplier: '123', plant_type: 'processing', country: 'USA', export_approved: false }
            : { export_approved: false }
        }
      />
    </div>
  );
};

export default EntityFormSurfaceSmoke;
