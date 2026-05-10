/**
 * ConfidenceBadge — shared AI confidence indicator
 * 
 * Centralizes confidence level thresholds and visual styling across all AI surfaces.
 * Theme Compliance: CSS custom properties only.
 */
import React from 'react';
import styled from 'styled-components';
import { Zap } from 'lucide-react';
import { Tooltip } from 'antd';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.6,
  AUTO_EXECUTE: 0.95,
} as const;

export const getConfidenceLevel = (score: number): ConfidenceLevel => {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
};

export const getConfidenceLabel = (level: ConfidenceLevel): string => {
  switch (level) {
    case 'high': return 'High Confidence';
    case 'medium': return 'Medium Confidence';
    case 'low': return 'Low Confidence';
  }
};

const Badge = styled.span<{ $level: ConfidenceLevel }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  background: ${(p) =>
    p.$level === 'high' ? 'rgb(var(--color-success) / 0.12)' :
    p.$level === 'medium' ? 'rgb(var(--color-warning) / 0.12)' :
    'rgb(var(--color-text-secondary) / 0.08)'};
  color: ${(p) =>
    p.$level === 'high' ? 'rgb(var(--color-success))' :
    p.$level === 'medium' ? 'rgb(var(--color-warning))' :
    'rgb(var(--color-text-secondary))'};
`;

export interface ConfidenceBadgeProps {
  score: number;
  showPercentage?: boolean;
  showAutoExecute?: boolean;
  size?: 'small' | 'default';
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score,
  showPercentage = true,
  showAutoExecute = false,
  size = 'default',
  className,
}) => {
  const level = getConfidenceLevel(score);
  const label = getConfidenceLabel(level);
  const pct = Math.round(score * 100);
  const isAutoExecute = showAutoExecute && score >= CONFIDENCE_THRESHOLDS.AUTO_EXECUTE;

  return (
    <Tooltip title={`${label}: ${pct}% confidence${isAutoExecute ? ' — above auto-execute threshold' : ''}`}>
      <Badge
        $level={level}
        className={className}
        style={size === 'small' ? { fontSize: '0.6rem', padding: '0.1rem 0.375rem' } : undefined}
        aria-label={`${label}: ${pct}%`}
      >
        {isAutoExecute && <Zap size={10} />}
        {showPercentage ? `${pct}%` : label}
      </Badge>
    </Tooltip>
  );
};

export default ConfidenceBadge;
