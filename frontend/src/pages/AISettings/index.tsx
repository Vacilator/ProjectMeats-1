/**
 * AI Settings Hub — Phase 40
 *
 * 3 tabs:
 * - Approval Queue: pending approvals with batch actions
 * - AI Settings: user preference toggles
 * - Learning Dashboard: accuracy metrics
 *
 * Route: /settings/ai
 */

import React, { useState } from 'react';
import { Tabs, Card, Switch, Typography, Space, Select, Divider, Spin, Empty, Statistic, Row, Col, Result, Button as AntButton } from 'antd';
import {
  SafetyCertificateOutlined,
  SettingOutlined,
  LineChartOutlined,
  BulbOutlined,
  BellOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import ApprovalQueuePanel from '../../components/AIAssistant/ApprovalQueuePanel';
import { useAIPreferences } from '../../hooks/useAIPreferences';
import { learningSnapshotsApi, approvalQueueApi } from '../../services/aiService';
import type { AILearningSnapshot, ApprovalQueueStats } from '../../services/aiService';
import { withTenantQueryKey } from '../../utils/queryKeys';

const { Title, Text, Paragraph } = Typography;

// --- Styled ---

const PageContainer = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
`;

const PageHeader = styled.div`
  margin-bottom: 24px;
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid rgb(var(--color-border));

  &:last-child {
    border-bottom: none;
  }
`;

const SettingInfo = styled.div`
  flex: 1;
  margin-right: 16px;
`;

const MetricCard = styled(Card)`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  text-align: center;
`;

const TrendBadge = styled.span<{ $positive: boolean }>`
  font-size: 12px;
  font-weight: 500;
  color: ${({ $positive }) =>
    $positive ? 'rgb(var(--color-success))' : 'rgb(var(--color-danger))'};
`;

// --- Settings Tab ---

const SettingsTab: React.FC = () => {
  const { preferences, isLoading, toggleApprovalRequired, toggleConfidenceBadges, toggleSuggestions, updatePreference, isSaving } = useAIPreferences();

  if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!preferences) return <Empty description="Unable to load preferences" />;

  return (
    <Card>
      <Title level={5}>
        <SafetyCertificateOutlined /> External Communication Approval
      </Title>
      <Paragraph type="secondary">
        When enabled, all outbound communications (emails, POs, SOs, invoices) require your approval before being sent to external parties.
      </Paragraph>
      <SettingRow>
        <SettingInfo>
          <Text strong>Require approval before sending</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Recommended: ON. Prevents accidental sends to suppliers, customers, and carriers.
          </Text>
        </SettingInfo>
        <Switch
          checked={preferences.require_external_approval}
          onChange={toggleApprovalRequired}
          loading={isSaving}
        />
      </SettingRow>

      <Divider />

      <Title level={5}>
        <RobotOutlined /> AI Assistance
      </Title>
      <SettingRow>
        <SettingInfo>
          <Text strong>Show AI confidence badges</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Display confidence indicators on AI auto-filled fields.
          </Text>
        </SettingInfo>
        <Switch
          checked={preferences.show_ai_confidence_badges}
          onChange={toggleConfidenceBadges}
          loading={isSaving}
        />
      </SettingRow>

      <SettingRow>
        <SettingInfo>
          <Text strong>Show AI suggestions</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Display AI recommendation chips on entity pages.
          </Text>
        </SettingInfo>
        <Switch
          checked={preferences.show_ai_suggestions}
          onChange={toggleSuggestions}
          loading={isSaving}
        />
      </SettingRow>

      <Divider />

      <Title level={5}>
        <BellOutlined /> Notification Preferences
      </Title>
      <SettingRow>
        <SettingInfo>
          <Text strong>Approval notification frequency</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            How often to receive approval notifications.
          </Text>
        </SettingInfo>
        <Select
          value={preferences.notification_frequency}
          onChange={(val) => updatePreference('notification_frequency', val)}
          style={{ width: 160 }}
          options={[
            { value: 'realtime', label: 'Real-time' },
            { value: 'hourly_digest', label: 'Hourly Digest' },
            { value: 'daily_digest', label: 'Daily Digest' },
          ]}
        />
      </SettingRow>

      <SettingRow>
        <SettingInfo>
          <Text strong>Feedback detail level</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Controls how much detail is collected from your interactions.
          </Text>
        </SettingInfo>
        <Select
          value={preferences.feedback_detail_level}
          onChange={(val) => updatePreference('feedback_detail_level', val)}
          style={{ width: 160 }}
          options={[
            { value: 'minimal', label: 'Minimal' },
            { value: 'standard', label: 'Standard' },
            { value: 'detailed', label: 'Detailed' },
          ]}
        />
      </SettingRow>
    </Card>
  );
};

// --- Learning Dashboard Tab ---

const LearningTab: React.FC = () => {
  const { data: snapshots = [], isLoading, isError, refetch } = useQuery<AILearningSnapshot[]>({
    queryKey: withTenantQueryKey('ai-learning-snapshots'),
    queryFn: () => learningSnapshotsApi.list(),
    staleTime: 60_000,
  });

  const { data: stats } = useQuery<ApprovalQueueStats>({
    queryKey: withTenantQueryKey('ai-approval-stats'),
    queryFn: approvalQueueApi.stats,
    staleTime: 60_000,
  });

  if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  if (isError) return (
    <Result
      status="error"
      title="Failed to load learning data"
      subTitle="Something went wrong. Please try again."
      extra={<AntButton type="primary" onClick={() => refetch()}>Retry</AntButton>}
    />
  );

  // Aggregate snapshots — latest per entity type
  const latestByType = new Map<string, AILearningSnapshot>();
  for (const snap of snapshots) {
    if (!latestByType.has(snap.entity_type)) {
      latestByType.set(snap.entity_type, snap);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Summary Stats */}
      <Row gutter={16}>
        <Col span={6}>
          <MetricCard>
            <Statistic
              title="Pending Approvals"
              value={stats?.pending ?? 0}
              prefix={<SafetyCertificateOutlined />}
            />
          </MetricCard>
        </Col>
        <Col span={6}>
          <MetricCard>
            <Statistic
              title="Approved Today"
              value={stats?.approved_today ?? 0}
              valueStyle={{ color: 'rgb(var(--color-success))' }}
            />
          </MetricCard>
        </Col>
        <Col span={6}>
          <MetricCard>
            <Statistic
              title="Total Events"
              value={snapshots.reduce((sum, s) => sum + s.total_events, 0)}
              prefix={<LineChartOutlined />}
            />
          </MetricCard>
        </Col>
        <Col span={6}>
          <MetricCard>
            <Statistic
              title="Entity Types Tracked"
              value={latestByType.size}
              prefix={<BulbOutlined />}
            />
          </MetricCard>
        </Col>
      </Row>

      {/* Per-entity accuracy */}
      <Card title="AI Accuracy by Entity Type">
        {latestByType.size === 0 ? (
          <Empty
            description="No learning data yet. AI will start collecting feedback as you use the platform."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          Array.from(latestByType.entries()).map(([entityType, snap]) => {
            const accuracy = Math.round((1 - snap.correction_rate) * 100);
            return (
              <SettingRow key={entityType}>
                <SettingInfo>
                  <Text strong style={{ textTransform: 'capitalize' }}>
                    {entityType.replace(/_/g, ' ')}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {snap.total_events} events · {snap.positive_signals} positive · {snap.negative_signals} negative
                  </Text>
                  {snap.top_corrected_fields.length > 0 && (
                    <>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Top corrected: {snap.top_corrected_fields.map(f => f.field).join(', ')}
                      </Text>
                    </>
                  )}
                </SettingInfo>
                <Space direction="vertical" align="end">
                  <Text strong style={{ fontSize: 18 }}>{accuracy}%</Text>
                  <TrendBadge $positive={snap.accuracy_trend >= 0}>
                    {snap.accuracy_trend >= 0 ? '↑' : '↓'} {Math.abs(snap.accuracy_trend * 100).toFixed(1)}%
                  </TrendBadge>
                </Space>
              </SettingRow>
            );
          })
        )}
      </Card>
    </Space>
  );
};

// --- Main Page ---

const AISettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('approvals');

  return (
    <PageContainer>
      <PageHeader>
        <Title level={3} style={{ marginBottom: 4 }}>
          <RobotOutlined /> AI Settings & Approvals
        </Title>
        <Text type="secondary">
          Manage approval queue, AI preferences, and monitor learning accuracy.
        </Text>
      </PageHeader>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'approvals',
            label: (
              <Space>
                <SafetyCertificateOutlined />
                Approval Queue
              </Space>
            ),
            children: <ApprovalQueuePanel />,
          },
          {
            key: 'settings',
            label: (
              <Space>
                <SettingOutlined />
                AI Settings
              </Space>
            ),
            children: <SettingsTab />,
          },
          {
            key: 'learning',
            label: (
              <Space>
                <LineChartOutlined />
                Learning Dashboard
              </Space>
            ),
            children: <LearningTab />,
          },
        ]}
      />
    </PageContainer>
  );
};

export default AISettingsPage;
