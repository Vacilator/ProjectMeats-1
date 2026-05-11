import React from 'react';

import { Typography } from 'antd';

import { AIAgentWidget } from '../../components/AIAssistant/AIAgentWidget';

const { Paragraph, Title } = Typography;

export const AIAgentWidgetSocketSmoke: React.FC = () => {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 16px 48px',
      }}
    >
      <Title level={2} data-testid="ai-widget-smoke-title">
        AI widget websocket smoke
      </Title>
      <Paragraph style={{ color: 'rgb(var(--color-text-secondary))' }}>
        Production-preview smoke harness for websocket preflight hardening.
      </Paragraph>

      <AIAgentWidget />
    </div>
  );
};

export default AIAgentWidgetSocketSmoke;
