/**
 * Quick Stats Widget
 * 
 * Displays key performance metrics in a compact grid.
 * Shows business stats: orders, revenue, customers, suppliers.
 * 
 * Features:
 * - Real-time stat updates from backend API
 * - Auto-refresh every 5 minutes
 * - Loading and error states
 * 
 * Updated: 2026-02-04 - Phase 1.3 - Connected to real API
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Package, DollarSign, Users, Building } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { useCockpitStats } from '../../hooks/useCockpitStats';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

export interface QuickStatsWidgetProps {
  // Props for potential future customization
}

// ============================================================================
// Styled Components
// ============================================================================

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
`;

const StatButton = styled.button<{ $color: string }>`
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${props => props.$color};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.8;
  }
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const StatIconWrapper = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm, 4px);
  background: ${props => props.$color}20;
  color: ${props => props.$color};
`;

const StatLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.span`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

// ============================================================================
// Component
// ============================================================================

export const QuickStatsWidget: React.FC<QuickStatsWidgetProps> = () => {
  const { stats, isLoading, error, refetch } = useCockpitStats();
  const navigate = useNavigate();

  // Format stats for display
  const statItems: Array<StatItem & { href?: string }> = stats ? [
    {
      id: 'total_orders',
      label: 'Total Orders',
      value: stats.quick_stats.total_orders.toLocaleString(),
      icon: <Package size={16} />,
      color: 'rgb(var(--color-info))',
      href: '/purchase-orders',
    },
    {
      id: 'total_revenue',
      label: 'Total Revenue',
      value: `$${stats.quick_stats.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign size={16} />,
      color: 'rgb(var(--color-success))',
      href: '/cockpit/dashboard',
    },
    {
      id: 'total_customers',
      label: 'Total Customers',
      value: stats.quick_stats.total_customers.toLocaleString(),
      icon: <Users size={16} />,
      color: 'rgb(168, 85, 247)',
      href: '/customers',
    },
    {
      id: 'total_suppliers',
      label: 'Total Suppliers',
      value: stats.quick_stats.total_suppliers.toLocaleString(),
      icon: <Building size={16} />,
      color: 'rgb(var(--color-warning))',
      href: '/suppliers',
    },
  ] : [];

  const handleStatClick = (href?: string) => {
    if (!href) return;
    navigate(href);
  };

  return (
    <WidgetCard
      title="Quick Stats"
      icon={<BarChart3 size={16} />}
      loading={isLoading}
      error={error || undefined}
      onRefresh={refetch}
    >
      <StatsGrid>
        {statItems.map(stat => (
          <StatButton
            key={stat.id}
            type="button"
            $color={stat.color}
            onClick={() => handleStatClick(stat.href)}
            disabled={!stat.href}
            aria-label={stat.href ? `Open ${stat.label}` : undefined}
          >
            <StatHeader>
              <StatIconWrapper $color={stat.color}>
                {stat.icon}
              </StatIconWrapper>
              <StatLabel>{stat.label}</StatLabel>
            </StatHeader>
            <StatValue>{stat.value}</StatValue>
          </StatButton>
        ))}
      </StatsGrid>
    </WidgetCard>
  );
};

export default QuickStatsWidget;
