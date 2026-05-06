import React, { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import StandalonePlantEditForm from './StandalonePlantEditForm';

type PlantEditRouteParams = {
  id?: string;
};

export const StandalonePlantEditRoute: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<PlantEditRouteParams>();

  const plantId = String(id || '').trim();
  const handleClose = useCallback(() => {
    if (!plantId) {
      navigate('/plants');
      return;
    }

    navigate(`/plants/${encodeURIComponent(plantId)}`);
  }, [navigate, plantId]);

  return (
    <StandalonePlantEditForm
      plantId={plantId}
      onCancel={handleClose}
      onSaved={handleClose}
    />
  );
};

export default StandalonePlantEditRoute;
