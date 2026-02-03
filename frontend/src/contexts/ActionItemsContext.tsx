/**
 * ActionItemsContext
 * 
 * Provides action item counts throughout the application.
 * Used by NavigationMenu to display badges and by Forms & Flows pages.
 * 
 * Created: 2026-02-03 - Phase 2 Forms & Flows Enhancement
 */
import React, { createContext, useContext, ReactNode } from 'react';
import { useActionItemCounts, ActionItemCounts, POLL_INTERVAL_BACKGROUND } from '../hooks/useActionItemCounts';

// ============================================================================
// Types
// ============================================================================

interface ActionItemsContextValue {
  counts: ActionItemCounts;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ActionItemsContext = createContext<ActionItemsContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface ActionItemsProviderProps {
  children: ReactNode;
  pollingInterval?: number;
}

export const ActionItemsProvider: React.FC<ActionItemsProviderProps> = ({ 
  children,
  pollingInterval = POLL_INTERVAL_BACKGROUND 
}) => {
  const { counts, loading, error, refetch } = useActionItemCounts(pollingInterval, true);

  return (
    <ActionItemsContext.Provider value={{ counts, loading, error, refetch }}>
      {children}
    </ActionItemsContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useActionItems(): ActionItemsContextValue {
  const context = useContext(ActionItemsContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      counts: {
        total: 0,
        overdue: 0,
        due_today: 0,
        due_this_week: 0,
        by_priority: {},
        by_form: [],
      },
      loading: false,
      error: null,
      refetch: () => {},
    };
  }
  return context;
}

// ============================================================================
// Badge Value Selector
// ============================================================================

/**
 * Gets the badge value for a given badge key from counts
 */
export function getBadgeValue(
  counts: ActionItemCounts | undefined,
  badgeKey: 'actionRequired' | 'waiting' | 'overdue' | 'total' | undefined
): number | undefined {
  if (!counts || !badgeKey) return undefined;
  
  switch (badgeKey) {
    case 'actionRequired':
    case 'total':
      return counts.total > 0 ? counts.total : undefined;
    case 'overdue':
      return counts.overdue > 0 ? counts.overdue : undefined;
    case 'waiting':
      return counts.due_today > 0 ? counts.due_today : undefined;
    default:
      return undefined;
  }
}

export default ActionItemsContext;
