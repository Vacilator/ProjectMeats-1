/**
 * Quick Actions Widget
 * 
 * Provides one-click shortcuts to common actions.
 * Configurable based on user role and preferences.
 * 
 * Features:
 * - Frequently used actions
 * - Keyboard shortcut hints
 * - Role-based action visibility
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Plus, FileText, ShoppingCart, Package, 
  Users, Truck, Calculator, Search, Settings 
} from 'lucide-react';
import { WidgetCard } from './WidgetCard';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void;
  shortcut?: string;
  color: string;
}

export interface QuickActionsWidgetProps {
  onOpenSearch?: () => void;
  customActions?: QuickAction[];
}

// ============================================================================
// Styled Components
// ============================================================================

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

const ActionButton = styled.button<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${props => props.$color};
    background: ${props => props.$color}08;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ActionIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  flex-shrink: 0;
`;

const ActionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ActionShortcut = styled.div`
  font-size: 10px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 2px;
`;

// ============================================================================
// Default Actions
// ============================================================================

const defaultActions: QuickAction[] = [
  {
    id: 'new_po',
    label: 'New Purchase Order',
    icon: <ShoppingCart size={16} />,
    path: '/purchase-orders?action=create',
    shortcut: 'Alt + P',
    color: 'rgb(59, 130, 246)',
  },
  {
    id: 'new_so',
    label: 'New Sales Order',
    icon: <Package size={16} />,
    path: '/sales-orders?action=create',
    shortcut: 'Alt + S',
    color: 'rgb(34, 197, 94)',
  },
  {
    id: 'new_invoice',
    label: 'New Invoice',
    icon: <FileText size={16} />,
    path: '/accounting/receivables/invoices?action=create',
    shortcut: 'Alt + I',
    color: 'rgb(168, 85, 247)',
  },
  {
    id: 'new_customer',
    label: 'New Customer',
    icon: <Users size={16} />,
    path: '/customers?action=create',
    shortcut: 'Alt + C',
    color: 'rgb(236, 72, 153)',
  },
  {
    id: 'search',
    label: 'Universal Search',
    icon: <Search size={16} />,
    shortcut: 'Ctrl + K',
    color: 'rgb(234, 179, 8)',
  },
  {
    id: 'carriers',
    label: 'Manage Carriers',
    icon: <Truck size={16} />,
    path: '/carriers',
    color: 'rgb(244, 114, 182)',
  },
];

// ============================================================================
// Component
// ============================================================================

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  onOpenSearch,
  customActions,
}) => {
  const navigate = useNavigate();
  
  const actions = customActions || defaultActions;

  const handleAction = (action: QuickAction) => {
    if (action.id === 'search' && onOpenSearch) {
      onOpenSearch();
    } else if (action.onClick) {
      action.onClick();
    } else if (action.path) {
      // Path already includes query params if needed
      navigate(action.path);
    }
  };

  return (
    <WidgetCard
      title="Quick Actions"
      icon={<Zap size={16} />}
    >
      <ActionsGrid>
        {actions.map(action => (
          <ActionButton 
            key={action.id}
            $color={action.color}
            onClick={() => handleAction(action)}
          >
            <ActionIcon $color={action.color}>
              {action.icon}
            </ActionIcon>
            <ActionContent>
              <ActionLabel>{action.label}</ActionLabel>
              {action.shortcut && (
                <ActionShortcut>{action.shortcut}</ActionShortcut>
              )}
            </ActionContent>
          </ActionButton>
        ))}
      </ActionsGrid>
    </WidgetCard>
  );
};

export default QuickActionsWidget;
