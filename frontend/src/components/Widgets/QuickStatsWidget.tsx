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

const StatCard = styled.div<{ $color: string }>`
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
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

  // Format stats for display
  const statItems: StatItem[] = stats ? [
    {
      id: 'total_orders',
      label: 'Total Orders',
      value: stats.quick_stats.total_orders.toLocaleString(),
      icon: <Package size={16} />,
      color: 'rgb(59, 130, 246)',
    },
    {
      id: 'total_revenue',
      label: 'Total Revenue',
      value: `$${stats.quick_stats.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign size={16} />,
      color: 'rgb(34, 197, 94)',
    },
    {
      id: 'total_customers',
      label: 'Total Customers',
      value: stats.quick_stats.total_customers.toLocaleString(),
      icon: <Users size={16} />,
      color: 'rgb(168, 85, 247)',
    },
    {
      id: 'total_suppliers',
      label: 'Total Suppliers',
      value: stats.quick_stats.total_suppliers.toLocaleString(),
      icon: <Building size={16} />,
      color: 'rgb(234, 179, 8)',
    },
  ] : [];

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
          <StatCard key={stat.id} $color={stat.color}>
            <StatHeader>
              <StatIconWrapper $color={stat.color}>
                {stat.icon}
              </StatIconWrapper>
              <StatLabel>{stat.label}</StatLabel>
            </StatHeader>
            <StatValue>{stat.value}</StatValue>
          </StatCard>
        ))}
      </StatsGrid>
    </WidgetCard>
  );
};

export default QuickStatsWidget;
