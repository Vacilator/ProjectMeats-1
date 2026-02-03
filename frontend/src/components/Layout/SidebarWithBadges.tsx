/**
 * SidebarWithBadges Component
 * 
 * Wrapper around Sidebar that adds badge counts to navigation items.
 * Fetches action item counts and injects them into the navigation structure.
 */
import React, { useMemo } from 'react';
import Sidebar from './Sidebar';
import { NavigationItem, navigation as baseNavigation } from '../../config/navigation';
import { useActionItemCounts } from '../../hooks/useActionItemCounts';

interface SidebarWithBadgesProps {
  isOpen: boolean;
  onToggle: () => void;
  onHoverChange?: (isHovered: boolean) => void;
}

/**
 * Recursively update navigation items with badge counts
 */
const updateNavigationWithBadges = (
  items: NavigationItem[],
  actionItemCounts: { total: number; overdue: number }
): NavigationItem[] => {
  return items.map((item) => {
    // Clone the item to avoid mutating the original
    const updatedItem: NavigationItem = { ...item };
    
    // Add badge to "My Tasks" or "Workflows" items
    if (item.label === 'My Tasks' && actionItemCounts.total > 0) {
      updatedItem.badge = actionItemCounts.total;
      updatedItem.badgeType = actionItemCounts.overdue > 0 ? 'error' : 'default';
    }
    
    // Recursively update children
    if (item.children) {
      updatedItem.children = updateNavigationWithBadges(item.children, actionItemCounts);
    }
    
    return updatedItem;
  });
};

/**
 * Sidebar component with badge support for action items.
 */
const SidebarWithBadges: React.FC<SidebarWithBadgesProps> = ({ 
  isOpen, 
  onToggle, 
  onHoverChange 
}) => {
  const { counts, isLoading } = useActionItemCounts();
  
  // Update navigation with badge counts
  const navigationWithBadges = useMemo(() => {
    if (isLoading) {
      return baseNavigation;
    }
    
    return updateNavigationWithBadges(baseNavigation, {
      total: counts.total,
      overdue: counts.overdue,
    });
  }, [counts.total, counts.overdue, isLoading]);
  
  // Note: We can't directly modify the Sidebar component without forking it,
  // so we'll need to export the enhanced navigation for use by NavigationMenu
  // For now, just pass through to the standard Sidebar
  return (
    <Sidebar
      isOpen={isOpen}
      onToggle={onToggle}
      onHoverChange={onHoverChange}
    />
  );
};

export default SidebarWithBadges;
export { updateNavigationWithBadges };
