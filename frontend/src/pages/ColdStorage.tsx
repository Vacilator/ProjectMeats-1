/**
 * Cold Storage Page
 *
 * Manages cold storage inventory and locations
 */
import React from 'react';
import { ComingSoon } from './ComingSoon';

const ColdStorage: React.FC = () => {
  return (
    <ComingSoon
      title="Cold Storage"
      icon="❄️"
      description="Track inventory in cold storage facilities, manage temperatures, and monitor stock levels across multiple locations."
      features={[
        'Multi-facility inventory tracking',
        'Temperature monitoring and alerts',
        'Stock level dashboards',
        'Location-based reporting',
      ]}
    />
  );
};

export default ColdStorage;
