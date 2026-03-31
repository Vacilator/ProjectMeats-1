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

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import ProcessMonitor from '../Cockpit/ProcessMonitor';

export const Monitoring: React.FC = () => {
  return (
    <ErrorBoundary>
      <ProcessMonitor />
    </ErrorBoundary>
  );
};

export default Monitoring;
