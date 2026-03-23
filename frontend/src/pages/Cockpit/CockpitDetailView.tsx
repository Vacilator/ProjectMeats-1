import React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { CockpitDetailViewTemplate } from '@/cockpit/templates/Cockpit-Detail-View-Template';

type LocationState = {
  initialLabel?: string;
};

export const CockpitDetailViewPage: React.FC = () => {
  const { entityType = '', entityId = '' } = useParams();
  const location = useLocation();

  const state = (location.state ?? {}) as LocationState;

  return (
    <CockpitDetailViewTemplate
      entityType={entityType}
      entityId={entityId}
      initialLabel={state.initialLabel}
    />
  );
};

export default CockpitDetailViewPage;
