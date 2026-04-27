/**
 * AI Suggestion Mode Badge Component
 * 
 * Phase 2.1: Graceful Degradation UI Indicator
 * Displays whether AI suggestions are active or in static fallback mode.
 */

import React from 'react';
import { Badge, Tooltip } from 'antd';
import { RobotOutlined, FileTextOutlined } from '@ant-design/icons';

interface AISuggestionBadgeProps {
  mode: 'ai' | 'static';
  reason?: string;
}

export const AISuggestionBadge: React.FC<AISuggestionBadgeProps> = ({ mode, reason }) => {
  const isAI = mode === 'ai';
  
  const badge = (
    <Badge
      count={
        <span style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          padding: '2px 8px',
          backgroundColor: isAI ? 'rgb(var(--color-success))' : 'rgb(var(--color-warning))',
          color: 'rgb(var(--color-primary-foreground))',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 500
        }}>
          {isAI ? <RobotOutlined /> : <FileTextOutlined />}
          {isAI ? 'AI Mode' : 'Static Mode'}
        </span>
      }
      style={{ marginRight: '16px' }}
    />
  );
  
  if (reason) {
    return (
      <Tooltip title={reason} placement="bottom">
        {badge}
      </Tooltip>
    );
  }
  
  return badge;
};
