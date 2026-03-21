/**
 * Admin Components - Index
 * 
 * Barrel export for all admin workspace components.
 */

export { AdminPage } from './AdminPage';
export type { AdminPageProps } from './AdminPage';
export { AdminSection } from './AdminSection';
export type { AdminSectionProps } from './AdminSection';

export { AdminTable } from './AdminTable';
export { ConfirmDialog } from './ConfirmDialog';
export { EmptyState } from './EmptyState';
export { LoadingSkeleton } from './LoadingSkeleton';
export { RoleBadge } from './RoleBadge';
export { StatusBadge } from './StatusBadge';

export { AdminGuard } from './AdminGuard';
export type { AdminFeature } from './AdminGuard';

// Phase 3: Tiered Choice Engine & Virtual Schema UI
export { default as SystemChoiceManager } from './SystemChoiceManager';
export { default as TenantChoiceOverride } from './TenantChoiceOverride';
export { default as VirtualFieldManager } from './VirtualFieldManager';
