import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';

type LocationState = {
  initialLabel?: string;
};

/**
 * Legacy route handler.
 *
 * We no longer want Cockpit entity selection to navigate to /cockpit/entity/...
 * (the Cockpit UX is breadcrumb/state-driven on /cockpit), but we keep this
 * route as a redirect for old links/bookmarks.
 */
export const CockpitEntityRedirect: React.FC = () => {
  const { entityType = '', entityId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cockpitNavigation = useCockpitNavigation();

  useEffect(() => {
    const rawType = String(entityType ?? '').toLowerCase();
    const canonicalType = rawType === 'customer' || rawType === 'customers'
      ? 'customer'
      : rawType === 'supplier' || rawType === 'suppliers'
        ? 'supplier'
        : null;

    if (!canonicalType || !entityId) {
      navigate('/cockpit', { replace: true });
      return;
    }

    const state = (location.state ?? {}) as LocationState;
    const label = state.initialLabel || `${canonicalType === 'customer' ? 'Customer' : 'Supplier'} ${entityId}`;

    cockpitNavigation.clearPath();
    cockpitNavigation.addStep({
      id: String(entityId),
      type: canonicalType,
      label,
    });

    navigate('/cockpit', { replace: true });
  }, [cockpitNavigation, entityId, entityType, location.state, navigate]);

  return null;
};

export default CockpitEntityRedirect;
