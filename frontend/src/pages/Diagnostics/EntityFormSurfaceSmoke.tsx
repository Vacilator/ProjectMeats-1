import React, { useCallback } from 'react';

import { Typography } from 'antd';

import { EntityFormSurface } from '../../components/Shared/EntityFormSurface';

const { Paragraph, Title } = Typography;

export const EntityFormSurfaceSmoke: React.FC = () => {
  const handleClose = useCallback(() => {}, []);

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
        Production-preview smoke harness for the Plant edit loader boundary.
      </Paragraph>

      <EntityFormSurface
        entityType="plant"
        entityId="2769"
        mode="edit"
        variant="inline"
        isOpen
        onClose={handleClose}
        initialValues={{ export_approved: false }}
      />
    </div>
  );
};

export default EntityFormSurfaceSmoke;
