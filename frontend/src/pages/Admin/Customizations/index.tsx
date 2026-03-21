import React from 'react';
import { Palette } from 'lucide-react';
import { AdminGuard, AdminPage, EmptyState } from '@/components/Admin';

const CustomizationsPage: React.FC = () => {
  return (
    <AdminPage
      title="Customizations"
      description="Tenant-specific UI preferences and extensibility."
      icon={<Palette size={18} />}
    >
      <AdminGuard feature="customizations" allow={(p) => p.can_manage_customizations}>
        <EmptyState
          icon="🎨"
          title="Customizations coming soon"
          message="This area will provide tenant-level UI customization, custom fields, and template tooling."
        />
      </AdminGuard>
    </AdminPage>
  );
};

export default CustomizationsPage;
