/**
 * Semantic Badge Atom
 *
 * Lightweight status badge using semantic CSS variables.
 */

import React from 'react';
import { Tag } from 'antd';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    backgroundColor: 'rgb(var(--color-surface))',
    borderColor: 'rgb(var(--color-border))',
    color: 'rgb(var(--color-text-secondary))',
  },
  success: {
    backgroundColor: 'rgba(var(--color-success), 0.15)',
    borderColor: 'rgba(var(--color-success), 0.35)',
    color: 'rgb(var(--color-success))',
  },
  warning: {
    backgroundColor: 'rgba(var(--color-warning), 0.15)',
    borderColor: 'rgba(var(--color-warning), 0.35)',
    color: 'rgb(var(--color-warning))',
  },
  error: {
    backgroundColor: 'rgba(var(--color-error), 0.15)',
    borderColor: 'rgba(var(--color-error), 0.35)',
    color: 'rgb(var(--color-error))',
  },
  info: {
    backgroundColor: 'rgba(var(--color-info), 0.15)',
    borderColor: 'rgba(var(--color-info), 0.35)',
    color: 'rgb(var(--color-info))',
  },
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  return (
    <Tag
      className={className}
      bordered
      style={{
        ...variantStyles[variant],
        marginInlineEnd: 0,
      }}
    >
      {children}
    </Tag>
  );
};
