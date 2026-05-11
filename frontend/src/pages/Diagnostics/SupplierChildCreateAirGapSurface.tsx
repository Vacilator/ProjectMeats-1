import React from 'react';

import { EntityFormSurface } from '../../components/Shared/EntityFormSurface';

type SupplierChildCreateAirGapSurfaceProps = {
  onClose: () => void;
};

export const SupplierChildCreateAirGapSurface: React.FC<SupplierChildCreateAirGapSurfaceProps> = ({
  onClose,
}) => (
  <EntityFormSurface
    entityType="plant"
    mode="create"
    variant="inline"
    isOpen
    onClose={onClose}
    initialValues={{
      supplier: '123',
      plant_type: 'processing',
      country: 'USA',
    }}
  />
);

export default SupplierChildCreateAirGapSurface;
