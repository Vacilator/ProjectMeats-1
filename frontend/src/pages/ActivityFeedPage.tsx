import React from 'react';

import { ActivityFeed } from '@/components/Shared';
import { PageContainer } from '@/components/ui/PageContainer';

export const ActivityFeedPage: React.FC = () => {
  return (
    <PageContainer title="Activity Feed">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: 'rgb(var(--color-text-secondary))',
        }}
      >
        <div>
          Review tenant-wide audit, AI, workflow, and note activity in one place. Use the
          filters to narrow by entity, source, or date range.
        </div>
        <ActivityFeed title="Tenant Activity" showFilters maxHeight="none" />
      </div>
    </PageContainer>
  );
};

export default ActivityFeedPage;
