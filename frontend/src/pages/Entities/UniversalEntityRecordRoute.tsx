import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import UniversalEntityRecordPage from './UniversalEntityRecordPage';
import { entityListPath } from '../../utils/entityTypeRegistry';

type RouteParams = {
  entityType?: string;
  id?: string;
};

type UniversalEntityRecordRouteProps = {
  mode?: 'view' | 'edit';
};

export const UniversalEntityRecordRoute: React.FC<UniversalEntityRecordRouteProps> = ({
  mode = 'view',
}) => {
  const { entityType } = useParams<RouteParams>();

  const basePath = useMemo(
    () => entityListPath(String(entityType || '')) ?? '/cockpit',
    [entityType]
  );

  return (
    <UniversalEntityRecordPage
      entityType={String(entityType || '')}
      basePath={basePath}
      mode={mode}
    />
  );
};

export default UniversalEntityRecordRoute;
