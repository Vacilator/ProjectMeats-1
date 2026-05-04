/**
 * Admin Permissions Hook
 * 
 * Provides role-based permission checks for tenant admin workspace.
 * Similar pattern to useWorkFormPermissions but for admin operations.
 * 
 * Usage:
 * ```typescript
 * const { permissions, isLoading } = useAdminPermissions();
 * 
 * if (permissions.can_manage_users) {
 *   // Show user management UI
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthState } from '@/contexts/AuthContext';
import { apiClient } from '../services/apiService';
import { withTenantQueryKey } from '../utils/queryKeys';

export interface AdminPermissions {
  can_manage_users: boolean;
  can_invite_users: boolean;
  can_change_roles: boolean;
  can_manage_profile: boolean;
  can_manage_billing: boolean;
  can_manage_configurations: boolean;
  can_manage_customizations: boolean;
  can_view_audit_logs: boolean;
  can_manage_option_lists: boolean;
  role: 'user' | 'readonly' | 'manager' | 'admin' | 'owner' | 'superuser';

  /** Resolved tenant context (used to persist X-Tenant-ID for admin calls). */
  tenant_id?: string | null;
  tenant_name?: string | null;
  tenant_slug?: string | null;
}

/**
 * Hook to fetch and manage admin permissions for the current user.
 */
export function useAdminPermissions() {
  const { isAuthenticated, loading: authLoading } = useAuthState();

  const query = useQuery<AdminPermissions>({
    queryKey: withTenantQueryKey('admin', 'permissions'),
    queryFn: async () => {
      try {
        // NOTE: TenantViewSet is registered at /api/v1/tenants/
        // so the admin permissions action is /api/v1/tenants/admin_permissions/
        const response = await apiClient.get('/tenants/admin_permissions/');

        // Ensure tenant context is persisted for downstream Admin Workspace calls.
        // This avoids "admin pages not working" when localStorage.tenantId is missing/stale.
        const tenantIdFromApi = response.data?.tenant_id;
        if (tenantIdFromApi) {
          localStorage.setItem('tenantId', String(tenantIdFromApi));
          if (response.data?.tenant_name) localStorage.setItem('tenantName', String(response.data.tenant_name));
          if (response.data?.tenant_slug) localStorage.setItem('tenantSlug', String(response.data.tenant_slug));
        }

        return response.data;
      } catch (error: any) {
        // If 401, let the axios interceptor handle it
        if (error.response?.status === 401) {
          throw error;
        }

        // Common failure mode: stale/missing tenant context (X-Tenant-ID) can cause a 404.
        // Repair tenant context by resolving /tenants/current/ (which has a server-side fallback)
        // and retry once.
        if (error.response?.status === 404) {
          try {
            const current = await apiClient.get('/tenants/current/');
            const currentTenantId = current.data?.id;

            if (currentTenantId) {
              localStorage.setItem('tenantId', String(currentTenantId));
              if (current.data?.name) localStorage.setItem('tenantName', String(current.data.name));
              if (current.data?.slug) localStorage.setItem('tenantSlug', String(current.data.slug));

              const retry = await apiClient.get('/tenants/admin_permissions/');
              return retry.data;
            }
          } catch (retryError) {
            // ignore; fall through to default permissions
          }
        }

        console.error('[useAdminPermissions] Failed to fetch permissions:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });

        // For other errors, return default permissions
        return getDefaultPermissions();
      }
    },
    enabled: !authLoading && isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    placeholderData: getDefaultPermissions(),
  });

  return {
    permissions: query.data || getDefaultPermissions(),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get default (user) permissions as fallback.
 */
function getDefaultPermissions(): AdminPermissions {
  return {
    can_manage_users: false,
    can_invite_users: false,
    can_change_roles: false,
    can_manage_profile: false,
    can_manage_billing: false,
    can_manage_configurations: false,
    can_manage_customizations: false,
    can_view_audit_logs: false,
    can_manage_option_lists: false,
    role: 'user',
  };
}

/**
 * Helper function to check if user is admin or owner.
 */
export function isAdminOrOwner(permissions: AdminPermissions | undefined): boolean {
  if (!permissions) return false;
  // Managers have limited Admin Workspace access (e.g., invitations, view-only areas).
  // Page-level guards still enforce fine-grained permissions.
  return (
    permissions.role === 'admin' ||
    permissions.role === 'owner' ||
    permissions.role === 'superuser' ||
    permissions.role === 'manager'
  );
}

/**
 * Helper function to get upgrade message for restricted features.
 */
export function getAdminUpgradeMessage(
  feature:
    | 'manage_users'
    | 'billing'
    | 'configurations'
    | 'audit_logs'
    | 'option_lists'
    | 'profile'
    | 'customizations'
    | 'workspace',
  currentRole: string
): string {
  const messages: Record<string, string> = {
    manage_users: 'Only tenant administrators and owners can manage users',
    billing: 'Only tenant owners and admins can manage billing and subscriptions',
    configurations: 'Only tenant administrators can manage configurations',
    audit_logs: 'Only tenant administrators can view audit logs',
    option_lists: 'Only tenant administrators can manage option lists',
    profile: 'Only tenant administrators and owners can manage organization profile',
    customizations: 'Only tenant administrators can manage customizations',
    workspace: 'Only tenant administrators and owners can access the Admin Workspace',
  };

  if (currentRole === 'user') {
    return 'Contact your tenant administrator to upgrade your role for admin access.';
  }

  if (currentRole === 'manager') {
    return 'Managers have limited admin access. Contact the tenant owner for full privileges.';
  }

  return messages[feature] || 'Contact your tenant administrator for access';
}
