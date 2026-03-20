/**
 * WorkForms Monitoring (alias)
 *
 * We intentionally reuse the Cockpit ProcessMonitor implementation to avoid
 * duplicating monitoring logic in multiple places.
 *
 * Route stability:
 * - WorkForms tab keeps using /workforms/monitoring
 * - Cockpit also exposes /cockpit/process-monitor
 */

import React from 'react';

import ProcessMonitor from '../Cockpit/ProcessMonitor';

export const Monitoring: React.FC = () => {
  return <ProcessMonitor />;
};

export default Monitoring;
