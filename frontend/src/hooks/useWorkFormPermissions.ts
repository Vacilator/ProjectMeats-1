/**
 * WorkForms Permissions Hook
 * 
 * Phase 4.2: Role-based permission system for WorkForms editor.
 * 
 * Usage:
 * ```typescript
 * const { permissions, isLoading } = useWorkFormPermissions();
 * 
 * if (permissions.can_create) {
 *   // Show create button
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { adminClient } from '../services/apiService';

export interface WorkFormPermissions {
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_archive: boolean;
  can_delete: boolean;
  allowed_modes: ('wizard' | 'visual' | 'expert')[];
  allowed_node_categories: string[];
  can_access_system_templates: boolean;
  can_create_global_templates: boolean;
  max_active_flows: number | null;
  role: 'anonymous' | 'readonly' | 'user' | 'manager' | 'admin' | 'owner' | 'superuser';
}

/**
 * Hook to fetch and manage WorkForms permissions for the current user.
 */
export function useWorkFormPermissions() {
  const query = useQuery<WorkFormPermissions>({
    queryKey: ['workforms', 'permissions'],
    queryFn: async () => {
      console.log('[useWorkFormPermissions] Fetching permissions...');
      try {
        const response = await adminClient.get('/workflows/permissions/');
        console.log('[useWorkFormPermissions] SUCCESS - Response:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('[useWorkFormPermissions] FAILED - Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          error
        });
        // Return default permissions on error
        const defaults = getDefaultPermissions();
        console.warn('[useWorkFormPermissions] Returning default permissions:', defaults);
        return defaults;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    retry: 1,
    // Ensure we always have valid permissions
    placeholderData: getDefaultPermissions(),
  });

  console.log('[useWorkFormPermissions] Query state:', {
    isLoading: query.isLoading,
    isError: query.isError,
    data: query.data,
    error: query.error
  });

  return {
    permissions: query.data || getDefaultPermissions(),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get default (anonymous) permissions as fallback.
 */
function getDefaultPermissions(): WorkFormPermissions {
  return {
    can_create: false,
    can_edit: false,
    can_publish: false,
    can_archive: false,
    can_delete: false,
    allowed_modes: [],
    allowed_node_categories: [],
    can_access_system_templates: false,
    can_create_global_templates: false,
    max_active_flows: 0,
    role: 'anonymous',
  };
}

/**
 * Helper function to check if a specific editor mode is allowed.
 */
export function canUseEditorMode(
  permissions: WorkFormPermissions | undefined,
  mode: 'wizard' | 'visual' | 'expert'
): boolean {
  if (!permissions || !permissions.allowed_modes) {
    return false; // Defensive: if permissions not loaded, deny access
  }
  return permissions.allowed_modes.includes(mode);
}

/**
 * Helper function to check if a specific node category is allowed.
 */
export function canUseNodeCategory(
  permissions: WorkFormPermissions | undefined,
  category: string
): boolean {
  if (!permissions || !permissions.allowed_node_categories) {
    return false; // Defensive: if permissions not loaded, deny access
  }
  // If allowed_node_categories is empty, allow all categories
  if (permissions.allowed_node_categories.length === 0) {
    return true;
  }
  return permissions.allowed_node_categories.includes(category);
}

/**
 * Helper function to get upgrade message for restricted features.
 */
export function getUpgradeMessage(
  feature: 'create' | 'edit' | 'publish' | 'expert_mode' | 'system_templates',
  currentRole: string
): string {
  const messages: Record<string, string> = {
    create: 'Contact your tenant administrator to get form creation permissions',
    edit: 'You can only edit forms you created. Contact an administrator for full access.',
    publish: 'Only tenant administrators can publish forms',
    expert_mode: 'Expert mode requires administrator privileges',
    system_templates: 'System template creation requires administrator privileges',
  };

  if (currentRole === 'readonly') {
    return 'Your account is read-only. Contact an administrator to upgrade your role.';
  }

  if (currentRole === 'user') {
    return 'Contact your tenant administrator to upgrade to manager or admin role for editing permissions.';
  }

  return messages[feature] || 'Contact your tenant administrator for access';
}
