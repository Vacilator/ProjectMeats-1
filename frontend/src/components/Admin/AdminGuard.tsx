import React from 'react';

import { useAdminPermissions, getAdminUpgradeMessage } from '@/hooks/useAdminPermissions';
import type { AdminPermissions } from '@/hooks/useAdminPermissions';

import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';

export type AdminFeature =
  | 'manage_users'
  | 'billing'
  | 'configurations'
  | 'audit_logs'
  | 'option_lists'
  | 'profile'
  | 'customizations'
  | 'workspace';

interface AdminGuardProps {
  feature: AdminFeature;
  allow: (permissions: AdminPermissions) => boolean;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({
  feature,
  allow,
  loadingFallback,
  children,
}) => {
  const { permissions, isLoading } = useAdminPermissions();

  if (isLoading) {
    return (loadingFallback ?? <LoadingSkeleton type="card" rows={2} />) as React.ReactElement;
  }

  if (!allow(permissions)) {
    return (
      <EmptyState
        icon="🔒"
        title="Access restricted"
        message={getAdminUpgradeMessage(feature, permissions.role)}
      />
    );
  }

  return children as React.ReactElement;
};
