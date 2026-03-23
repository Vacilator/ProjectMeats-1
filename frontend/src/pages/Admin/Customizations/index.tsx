import React, { useMemo } from 'react';
import { Palette } from 'lucide-react';
import { AdminGuard, AdminPage, EmptyState } from '@/components/Admin';
import { TenantChoiceOverride } from '@/components/Admin/TenantChoiceOverride';

const CustomizationsPage: React.FC = () => {
  const tenantId = useMemo(() => localStorage.getItem('tenantId') || '', []);

  return (
    <AdminPage
      title="Customizations"
      description="Tenant-specific UI preferences and extensibility."
      icon={<Palette size={18} />}
    >
      <AdminGuard feature="customizations" allow={(p) => p.can_manage_customizations}>
        {!tenantId ? (
          <EmptyState
            icon="🏢"
            title="Select a tenant"
            message="Choose a tenant to manage choice list customizations."
          />
        ) : (
          <TenantChoiceOverride tenantId={tenantId} />
        )}
      </AdminGuard>
    </AdminPage>
  );
};

export default CustomizationsPage;
