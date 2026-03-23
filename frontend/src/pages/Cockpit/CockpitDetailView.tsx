import React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { CustomerDetailView } from '@/cockpit/views/CustomerDetailView';

type LocationState = {
  initialLabel?: string;
};

export const CockpitDetailViewPage: React.FC = () => {
  const { entityType = '', entityId = '' } = useParams();
  const location = useLocation();

  const state = (location.state ?? {}) as LocationState;

  return (
    <CustomerDetailView entityType={entityType} entityId={entityId} initialLabel={state.initialLabel} />
  );
};

export default CockpitDetailViewPage;
