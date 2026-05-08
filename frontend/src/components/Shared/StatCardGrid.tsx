/**
 * StatCardGrid — Canonical KPI card grid for the command center.
 *
 * Renders a responsive grid of minimalist stat cards with hover effects.
 * Replaces duplicated StatsRow + StatCard patterns across pages.
 *
 * Usage:
 *   <StatCardGrid items={[
 *     { value: 12, label: 'Active', icon: <Activity size={11} /> },
 *     { value: 0, label: 'Blocked', icon: <AlertTriangle size={11} />, alert: true },
 *   ]} />
 */
import React from 'react';
import styled from 'styled-components';

const Grid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols || 4}, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const CardItem = styled.div`
  background: rgb(var(--color-bg-primary, 255 255 255));
  border: 1px solid rgb(var(--color-border, 229 231 235));
  border-radius: 12px;
  padding: 1rem 1.25rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary, 99 102 241) / 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
`;

const Value = styled.div<{ $alert?: boolean }>`
  font-size: 1.75rem;
  font-weight: 800;
  color: ${({ $alert }) =>
    $alert ? 'rgb(239, 68, 68)' : 'rgb(var(--color-text-primary, 17 24 39))'};
  line-height: 1.2;
`;

const Label = styled.div`
  font-size: 0.72rem;
  font-weight: 500;
  color: rgb(var(--color-text-tertiary, 107 114 128));
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

export interface StatCardItem {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  /** Highlight value in red when truthy */
  alert?: boolean;
}

export interface StatCardGridProps {
  items: StatCardItem[];
  columns?: number;
}

export const StatCardGrid: React.FC<StatCardGridProps> = ({ items, columns }) => (
  <Grid $cols={columns || items.length}>
    {items.map((item, idx) => (
      <CardItem key={idx}>
        <Value $alert={item.alert && Number(item.value) > 0}>
          {item.value}
        </Value>
        <Label>
          {item.icon}
          {item.label}
        </Label>
      </CardItem>
    ))}
  </Grid>
);

export default StatCardGrid;
