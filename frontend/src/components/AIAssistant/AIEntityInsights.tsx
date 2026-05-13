import React from 'react';
import styled from 'styled-components';

interface AIEntityInsightsProps {
  entityType: string;
  entityId: string | number;
}

const InsightBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--color-primary), 0.04);
  border: 1px solid rgba(var(--color-primary), 0.1);
  border-radius: 8px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const AIIcon = styled.span`
  font-size: 14px;
  display: flex;
  align-items: center;
`;

const InsightText = styled.span`
  flex: 1;
`;

const LearnMoreLink = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-primary));
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  &:hover {
    text-decoration: underline;
  }
`;

const AIEntityInsights: React.FC<AIEntityInsightsProps> = ({
  entityType,
}) => {
  return (
    <InsightBar>
      <AIIcon>🤖</AIIcon>
      <InsightText>
        AI is learning from your interactions with this{' '}
        {entityType.replace(/_/g, ' ')}
      </InsightText>
      <LearnMoreLink
        onClick={() => {
          window.location.href = '/settings/ai';
        }}
      >
        AI Settings →
      </LearnMoreLink>
    </InsightBar>
  );
};

export default AIEntityInsights;
