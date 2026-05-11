import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface LegacyCommandCenterTabRedirectProps {
  tab: string;
}

export const LegacyCommandCenterTabRedirect: React.FC<LegacyCommandCenterTabRedirectProps> = ({
  tab,
}) => {
  const location = useLocation();

  const target = React.useMemo(() => {
    const next = new URLSearchParams(location.search);
    next.set('tab', tab);

    const suffix = next.toString();
    return suffix ? `/command-center?${suffix}` : '/command-center';
  }, [location.search, tab]);

  return <Navigate to={target} replace />;
};

export default LegacyCommandCenterTabRedirect;
