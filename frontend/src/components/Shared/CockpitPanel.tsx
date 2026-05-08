/**
 * CockpitPanel — Canonical reusable panel for the command center.
 *
 * A lightweight, minimalist card wrapper used across the Trader Cockpit
 * for consistent section styling. Replaces duplicated Card styling patterns.
 *
 * Props:
 * - title: Section heading text
 * - extra: Optional right-aligned action or text
 * - compact: Use tighter padding (default false)
 * - children: Panel content
 */
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Card, Typography } from 'antd';

const { Text } = Typography;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const StyledCard = styled(Card)<{ $compact?: boolean }>`
  border-radius: 12px;
  overflow: hidden;
  animation: ${fadeIn} 0.25s ease-out;
  margin-bottom: 1rem;

  .ant-card-head {
    border-bottom: 1px solid rgb(var(--color-border, 229 231 235) / 0.6);
    padding: ${({ $compact }) => ($compact ? '0.5rem 1rem' : '0.75rem 1.25rem')};
    min-height: auto;
  }

  .ant-card-body {
    padding: ${({ $compact }) => ($compact ? '0.75rem 1rem' : '1rem 1.25rem')};
  }
`;

export interface CockpitPanelProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CockpitPanel: React.FC<CockpitPanelProps> = ({
  title,
  extra,
  compact = false,
  children,
  className,
  style,
}) => (
  <StyledCard
    size="small"
    role="region"
    aria-label={typeof title === 'string' ? title : undefined}
    title={
      title ? (
        <Text strong style={{ fontSize: '0.85rem' }}>
          {title}
        </Text>
      ) : undefined
    }
    extra={extra}
    $compact={compact}
    className={className}
    style={style}
  >
    {children}
  </StyledCard>
);

export default CockpitPanel;
