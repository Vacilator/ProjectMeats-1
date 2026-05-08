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
  Zap,
  FileText,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Search,
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
  colorVar: string;
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

const ActionButton = styled.button<{ $colorVar: string }>`
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
    border-color: rgb(var(${props => props.$colorVar}));
    background: rgba(var(${props => props.$colorVar}), 0.08);
    box-shadow: var(--shadow-sm);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ActionIcon = styled.div<{ $colorVar: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: rgba(var(${props => props.$colorVar}), 0.15);
  color: rgb(var(${props => props.$colorVar}));
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
    path: '/purchase-orders',
    shortcut: 'Alt + P',
    colorVar: '--color-info',
  },
  {
    id: 'new_so',
    label: 'New Sales Order',
    icon: <Package size={16} />,
    path: '/sales-orders',
    shortcut: 'Alt + S',
    colorVar: '--color-success',
  },
  {
    id: 'new_invoice',
    label: 'New Invoice',
    icon: <FileText size={16} />,
    path: '/accounting/receivables/invoices',
    shortcut: 'Alt + I',
    colorVar: '--color-secondary',
  },
  {
    id: 'new_customer',
    label: 'New Customer',
    icon: <Users size={16} />,
    path: '/customers',
    shortcut: 'Alt + C',
    colorVar: '--color-primary',
  },
  {
    id: 'search',
    label: 'Universal Search',
    icon: <Search size={16} />,
    shortcut: 'Ctrl + K',
    colorVar: '--color-warning',
  },
  {
    id: 'carriers',
    label: 'Manage Carriers',
    icon: <Truck size={16} />,
    path: '/carriers',
    colorVar: '--color-primary',
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
      // Add ?action=create for "New X" actions
      const isCreateAction = action.label.toLowerCase().startsWith('new ');
      const path = isCreateAction ? `${action.path}?action=create` : action.path;
      navigate(path);
    }
  };

  return (
    <WidgetCard
      title="Quick Actions"
      icon={<Zap size={16} />}
      id="tour-quick-actions"
      data-testid="tour-quick-actions"
      data-tour="quick-actions"
    >
      <ActionsGrid>
        {actions.map(action => (
          <ActionButton
            key={action.id}
            $colorVar={action.colorVar}
            onClick={() => handleAction(action)}
          >
            <ActionIcon $colorVar={action.colorVar}>
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
