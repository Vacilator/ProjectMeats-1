/**
 * Semantic Card Component
 * 
 * Uses CSS variables for colors, allowing tenant-specific branding
 * without component changes.
 * 
 * Usage:
 *   <Card>
 *     <CardHeader title="Dashboard" description="Welcome back!" />
 *     <CardContent>Your content here</CardContent>
 *   </Card>
 */
import React from 'react';
import { Card as AntCard, Flex, Typography } from 'antd';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap: Record<NonNullable<CardProps['padding']>, number> = {
  none: 0,
  sm: 16,
  md: 24,
  lg: 32,
};

export const Card: React.FC<CardProps> = ({ children, className = '', padding = 'md' }) => {
  return (
    <AntCard
      className={className}
      styles={{
        body: {
          padding: paddingMap[padding],
          background: 'rgb(var(--color-surface))',
          color: 'rgb(var(--color-text-primary))',
        },
        header: {
          background: 'rgb(var(--color-surface))',
          borderBottom: '1px solid rgb(var(--color-border))',
        },
      }}
    >
      {children}
    </AntCard>
  );
};

export interface CardHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, description, actions }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
    <Flex align="center" justify="space-between" gap={12}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {actions}
    </Flex>
    {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
  </div>
);

export const CardContent: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
}> = ({ children, className, style, onClick, onMouseDown, onMouseEnter, onMouseMove }) => (
  <div
    className={className}
    style={style}
    onClick={onClick}
    onMouseDown={onMouseDown}
    onMouseEnter={onMouseEnter}
    onMouseMove={onMouseMove}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Flex align="center" justify="space-between" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgb(var(--color-border))' }}>
    {children}
  </Flex>
);
