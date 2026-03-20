import React from 'react';
import { Palette } from 'lucide-react';
import { AdminPage, EmptyState } from '@/components/Admin';

const CustomizationsPage: React.FC = () => {
  return (
    <AdminPage
      title="Customizations"
      description="Tenant-specific UI preferences and extensibility."
      icon={<Palette size={18} />}
    >
      <EmptyState
        icon="🎨"
        title="Customizations coming soon"
        message="This area will provide tenant-level UI customization, custom fields, and template tooling."
      />
    </AdminPage>
  );
};

export default CustomizationsPage;
