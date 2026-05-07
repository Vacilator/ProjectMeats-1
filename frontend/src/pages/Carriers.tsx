/**
 * Carriers Page
 *
 * Manages shipping carriers and logistics partners.
 */
import React from 'react';
import { ComingSoon } from './ComingSoon';

const Carriers: React.FC = () => {
  return (
    <ComingSoon
      title="Carrier Management"
      icon="🚛"
      description="Manage shipping carriers and logistics partners for your supply chain."
      features={[
        'Carrier database and profiles',
        'Service area and capability tracking',
        'Rate management and comparison',
        'Performance metrics and reporting',
      ]}
    />
  );
};

export default Carriers;
