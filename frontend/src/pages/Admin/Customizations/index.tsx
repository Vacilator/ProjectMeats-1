import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Palette } from 'lucide-react';
import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { TenantChoiceOverride } from '@/components/Admin/TenantChoiceOverride';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { withTenantQueryKey } from '@/utils/queryKeys';

interface TenantCurrent {
  id: string;
  name: string;
}

const CustomizationsPage: React.FC = () => {
  useDocumentTitle('Customizations');
  const currentTenantQuery = useQuery<TenantCurrent>({
    queryKey: withTenantQueryKey('tenants', 'current'),
    queryFn: async () => {
      const res = await apiClient.get('/tenants/current/');
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <AdminPage
      title="Customizations"
      description="Tenant-specific UI preferences and extensibility."
      icon={<Palette size={18} />}
    >
      <AdminGuard
        feature="customizations"
        allow={(p) => p.can_manage_customizations}
        loadingFallback={<LoadingSkeleton type="card" rows={2} />}
      >
        {currentTenantQuery.isLoading ? (
          <LoadingSkeleton type="card" rows={2} />
        ) : currentTenantQuery.isError ? (
          <EmptyState
            icon="🏢"
            title="Tenant unavailable"
            message="We couldn't resolve the current tenant. Please select a tenant and try again."
          />
        ) : !currentTenantQuery.data?.id ? (
          <EmptyState
            icon="🏢"
            title="Select a tenant"
            message="Choose a tenant to manage choice list customizations."
          />
        ) : (
          <TenantChoiceOverride tenantId={currentTenantQuery.data.id} />
        )}
      </AdminGuard>
    </AdminPage>
  );
};

export default CustomizationsPage;
