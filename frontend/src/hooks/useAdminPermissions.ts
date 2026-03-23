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
import { apiClient } from '../services/apiService';

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
  role: 'user' | 'manager' | 'admin' | 'owner' | 'superuser';
}

/**
 * Hook to fetch and manage admin permissions for the current user.
 */
export function useAdminPermissions() {
  const query = useQuery<AdminPermissions>({
    queryKey: ['admin', 'permissions'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/tenants/tenants/admin_permissions/');
        return response.data;
      } catch (error: any) {
        // If 401, let the axios interceptor handle it
        if (error.response?.status === 401) {
          throw error;
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
  return permissions.role === 'admin' || permissions.role === 'owner' || permissions.role === 'superuser';
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
    billing: 'Only tenant owners can manage billing and subscriptions',
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
