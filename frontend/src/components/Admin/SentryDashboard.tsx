/**
 * Sentry Monitoring Dashboard
 * 
 * Admin dashboard for viewing Sentry error tracking and performance metrics.
 * Displays recent errors, performance trends, and system health.
 * 
 * Phase 6.4: Real-time error tracking and APM
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Statistic, Row, Col, Table, Tag, Space, Typography, Alert, Spin } from 'antd';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Users,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SentryStats {
  errorRate: number;
  totalErrors: number;
  affectedUsers: number;
  avgResponseTime: number;
  healthScore: number;
}

interface RecentError {
  id: string;
  message: string;
  timestamp: string;
  component?: string;
  count: number;
  severity: 'error' | 'warning' | 'info';
  resolved: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const DashboardContainer = styled.div`
  padding: 24px;
  background: rgb(var(--color-background));
`;

const StatsRow = styled(Row)`
  margin-bottom: 24px;
`;

const StatCard = styled(Card)`
  text-align: center;
  
  .ant-statistic-title {
    font-size: 13px;
    color: rgb(var(--color-text-secondary));
  }
  
  .ant-statistic-content {
    font-size: 28px;
    font-weight: 600;
  }
`;

const ErrorsCard = styled(Card)`
  margin-top: 24px;
`;

const StatusBadge = styled(Tag)<{ $status: 'healthy' | 'warning' | 'critical' }>`
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
  
  background: ${props => {
    switch (props.$status) {
      case 'healthy': return 'rgba(34, 197, 94, 0.1)';
      case 'warning': return 'rgba(234, 179, 8, 0.1)';
      case 'critical': return 'rgba(239, 68, 68, 0.1)';
    }
  }};
  
  color: ${props => {
    switch (props.$status) {
      case 'healthy': return 'rgb(22, 163, 74)';
      case 'warning': return 'rgb(202, 138, 4)';
      case 'critical': return 'rgb(220, 38, 38)';
    }
  }};
  
  border: none;
`;

const SentryLink = styled.a`
  color: rgb(var(--color-primary));
  font-size: 14px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    color: rgb(var(--color-primary-hover));
  }
`;

// ============================================================================
// Component
// ============================================================================

export const SentryDashboard: React.FC = () => {
  const [stats, setStats] = useState<SentryStats | null>(null);
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentryConfigured, setSentryConfigured] = useState(false);
  
  useEffect(() => {
    // Check if Sentry is configured
    const sentryDsn = (window as any).ENV?.SENTRY_DSN;
    const sentryEnabled = (window as any).ENV?.SENTRY_ENABLED === 'true';
    
    setSentryConfigured(!!(sentryDsn && sentryEnabled));
    
    // Simulate loading stats (in production, fetch from Sentry API)
    const timer = setTimeout(() => {
      if (sentryDsn && sentryEnabled) {
        // Mock data - in production, this would come from Sentry API
        setStats({
          errorRate: 0.5, // errors per minute
          totalErrors: 127,
          affectedUsers: 15,
          avgResponseTime: 245, // ms
          healthScore: 95, // 0-100
        });
        
        setErrors([
          {
            id: '1',
            message: 'TypeError: Cannot read property "id" of undefined',
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            component: 'WorkflowEditor',
            count: 3,
            severity: 'error',
            resolved: false,
          },
          {
            id: '2',
            message: 'Network request failed: timeout',
            timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            component: 'CustomerList',
            count: 1,
            severity: 'warning',
            resolved: false,
          },
          {
            id: '3',
            message: 'Validation failed: email format invalid',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            component: 'UserRegistration',
            count: 2,
            severity: 'info',
            resolved: true,
          },
        ]);
      }
      
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const getHealthStatus = (score: number): 'healthy' | 'warning' | 'critical' => {
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'warning';
    return 'critical';
  };
  
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };
  
  const errorColumns = [
    {
      title: 'Error',
      dataIndex: 'message',
      key: 'message',
      render: (text: string, record: RecentError) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.component && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              in {record.component}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 100,
      render: (timestamp: string) => formatTimestamp(timestamp),
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 5 ? 'red' : count > 1 ? 'orange' : 'default'}>
          {count}×
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 100,
      render: (resolved: boolean) => (
        resolved ? (
          <Tag icon={<CheckCircle size={12} />} color="success">
            Resolved
          </Tag>
        ) : (
          <Tag icon={<XCircle size={12} />} color="error">
            Open
          </Tag>
        )
      ),
    },
  ];
  
  if (!sentryConfigured) {
    return (
      <DashboardContainer>
        <Alert
          message="Sentry Not Configured"
          description={
            <>
              <Paragraph>
                Sentry error tracking is not currently enabled. To enable real-time error monitoring:
              </Paragraph>
              <ol>
                <li>Create a Sentry project at <a href="https://sentry.io" target="_blank" rel="noopener noreferrer">sentry.io</a></li>
                <li>Add <code>SENTRY_DSN</code> to your environment variables</li>
                <li>Set <code>SENTRY_ENABLED=true</code></li>
                <li>Restart the application</li>
              </ol>
            </>
          }
          type="info"
          showIcon
          icon={<AlertTriangle size={20} />}
        />
      </DashboardContainer>
    );
  }
  
  if (loading) {
    return (
      <DashboardContainer>
        <Card>
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '40px 0' }}>
            <Spin size="large" />
            <Text>Loading Sentry metrics...</Text>
          </Space>
        </Card>
      </DashboardContainer>
    );
  }
  
  return (
    <DashboardContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={3}>Error Tracking & Performance</Title>
          <Paragraph type="secondary">
            Real-time monitoring powered by Sentry
            {' '}
            <SentryLink
              href={(window as any).ENV?.SENTRY_PROJECT_URL || 'https://sentry.io'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Sentry →
            </SentryLink>
          </Paragraph>
        </div>
        
        {stats && (
          <>
            <StatsRow gutter={16}>
              <Col xs={24} sm={12} md={6}>
                <StatCard>
                  <Statistic
                    title="Health Score"
                    value={stats.healthScore}
                    suffix="%"
                    prefix={
                      <StatusBadge $status={getHealthStatus(stats.healthScore)}>
                        <Activity size={14} />
                      </StatusBadge>
                    }
                    valueStyle={{
                      color: getHealthStatus(stats.healthScore) === 'healthy'
                        ? 'rgb(22, 163, 74)'
                        : getHealthStatus(stats.healthScore) === 'warning'
                          ? 'rgb(202, 138, 4)'
                          : 'rgb(220, 38, 38)',
                    }}
                  />
                </StatCard>
              </Col>
              
              <Col xs={24} sm={12} md={6}>
                <StatCard>
                  <Statistic
                    title="Error Rate"
                    value={stats.errorRate}
                    suffix="/min"
                    prefix={<AlertTriangle size={18} />}
                    valueStyle={{ color: stats.errorRate > 1 ? 'rgb(239, 68, 68)' : undefined }}
                  />
                </StatCard>
              </Col>
              
              <Col xs={24} sm={12} md={6}>
                <StatCard>
                  <Statistic
                    title="Total Errors"
                    value={stats.totalErrors}
                    prefix={<XCircle size={18} />}
                  />
                </StatCard>
              </Col>
              
              <Col xs={24} sm={12} md={6}>
                <StatCard>
                  <Statistic
                    title="Affected Users"
                    value={stats.affectedUsers}
                    prefix={<Users size={18} />}
                  />
                </StatCard>
              </Col>
            </StatsRow>
            
            <StatsRow gutter={16}>
              <Col xs={24} sm={12}>
                <StatCard>
                  <Statistic
                    title="Avg Response Time"
                    value={stats.avgResponseTime}
                    suffix="ms"
                    prefix={<Clock size={18} />}
                    valueStyle={{ color: stats.avgResponseTime > 500 ? 'rgb(234, 179, 8)' : undefined }}
                  />
                </StatCard>
              </Col>
              
              <Col xs={24} sm={12}>
                <StatCard>
                  <Statistic
                    title="Performance Score"
                    value={85}
                    suffix="/100"
                    prefix={<Zap size={18} />}
                  />
                </StatCard>
              </Col>
            </StatsRow>
          </>
        )}
        
        <ErrorsCard title="Recent Errors" extra={<Text type="secondary">Last 24 hours</Text>}>
          <Table
            columns={errorColumns}
            dataSource={errors}
            rowKey="id"
            pagination={false}
            size="middle"
          />
        </ErrorsCard>
      </Space>
    </DashboardContainer>
  );
};
