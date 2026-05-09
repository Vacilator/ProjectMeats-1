/**
 * Today's Numbers Widget
 * 
 * Enhanced KPI dashboard showing detailed business metrics for today.
 * Fetches real-time data from cockpit stats API.
 * 
 * Features:
 * - Real-time KPI updates
 * - Trend indicators
 * - Clickable metrics to drill down
 * 
 * Updated: 2026-02-04 - Phase 1.3 - Connected to real API
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React from 'react';
import styled from 'styled-components';
import { 
  Activity, Package, 
  CheckCircle, Clock, Users 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WidgetCard } from './WidgetCard';
import { useCockpitStats } from '../../hooks/useCockpitStats';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface KPIMetric {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  icon: React.ReactNode;
  color: string;
  link?: string;
}

export interface TodaysNumbersWidgetProps {
  // Props for potential future customization
}

// ============================================================================
// Styled Components
// ============================================================================

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const MetricCard = styled.div<{ $color: string; $clickable: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 14px;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};
  transition: all 0.15s ease;

  ${props => props.$clickable && `
    &:hover {
      border-color: ${props.$color};
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
  `}
`;

const MetricHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const MetricIconWrapper = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm, 4px);
  background: ${props => props.$color}20;
  color: ${props => props.$color};
`;

const MetricLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetricValue = styled.span`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  line-height: 1;
  margin-bottom: 6px;
`;

// ============================================================================
// Component
// ============================================================================

export const TodaysNumbersWidget: React.FC<TodaysNumbersWidgetProps> = () => {
  const navigate = useNavigate();
  const { stats, isLoading, error, refetch } = useCockpitStats();

  const handleMetricClick = (link?: string) => {
    if (link) {
      navigate(link);
    }
  };

  // Format metrics for display
  const metrics: KPIMetric[] = stats ? [
    {
      id: 'orders_today',
      label: 'Orders Today',
      value: stats.todays_numbers.orders_today,
      formattedValue: stats.todays_numbers.orders_today.toLocaleString(),
      icon: <Package size={18} />,
      color: 'rgb(var(--color-info))',
      link: '/purchase-orders',
    },
    {
      id: 'pending_orders',
      label: 'Pending Orders',
      value: stats.todays_numbers.pending_orders,
      formattedValue: stats.todays_numbers.pending_orders.toLocaleString(),
      icon: <Clock size={18} />,
      color: 'rgb(var(--color-warning))',
      link: '/purchase-orders',
    },
    {
      id: 'completed_today',
      label: 'Completed Today',
      value: stats.todays_numbers.completed_today,
      formattedValue: stats.todays_numbers.completed_today.toLocaleString(),
      icon: <CheckCircle size={18} />,
      color: 'rgb(var(--color-success))',
      link: '/purchase-orders',
    },
    {
      id: 'active_customers',
      label: 'Active Customers',
      value: stats.todays_numbers.active_customers,
      formattedValue: stats.todays_numbers.active_customers.toLocaleString(),
      icon: <Users size={18} />,
      color: 'rgb(168, 85, 247)',
      link: '/customers',
    },
  ] : [];

  return (
    <WidgetCard
      title="Today's Numbers"
      icon={<Activity size={16} />}
      loading={isLoading}
      error={error || undefined}
      onRefresh={refetch}
    >
      <MetricsGrid>
        {metrics.map(metric => (
          <MetricCard 
            key={metric.id} 
            $color={metric.color}
            $clickable={!!metric.link}
            onClick={() => handleMetricClick(metric.link)}
          >
            <MetricHeader>
              <MetricIconWrapper $color={metric.color}>
                {metric.icon}
              </MetricIconWrapper>
              <MetricLabel>{metric.label}</MetricLabel>
            </MetricHeader>
            <MetricValue>{metric.formattedValue}</MetricValue>
          </MetricCard>
        ))}
      </MetricsGrid>
    </WidgetCard>
  );
};

export default TodaysNumbersWidget;
