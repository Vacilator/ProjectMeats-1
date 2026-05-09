import React from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Paragraph, Text, Title } = Typography;

export const IngestionMonitor: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space size="middle" align="start">
          <MailOutlined style={{ fontSize: 20, color: 'rgb(var(--color-primary))' }} />
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
              Email Ingestion now lives in Process Cockpit
            </Title>
            <Paragraph style={{ marginBottom: 8 }}>
              Recent email intake, action-required AI drafts, parsed payloads, and inline review forms are now centralized in the Process Cockpit workflow view.
            </Paragraph>
            <Text type="secondary">
              Use the cockpit to review inquiry and purchase-order drafts without bouncing through a separate monitor page.
            </Text>
          </div>
        </Space>

        <Button type="primary" onClick={() => navigate('/command-center?tab=action-required')}>
          Open Command Center
        </Button>
      </Space>
    </Card>
  );
};

export default IngestionMonitor;
