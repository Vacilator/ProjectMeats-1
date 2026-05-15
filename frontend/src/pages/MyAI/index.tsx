/**
 * My AI — Workspace AI Hub
 *
 * Consolidated AI management page under /workspace/my-ai.
 * Four tabs:
 *   1. Chat Sessions — conversation history with search, grouped by date
 *   2. Approvals — AI action approval queue with batch operations
 *   3. Preferences — AI behavior settings and notification controls
 *   4. Learning — AI accuracy metrics and feedback dashboard
 *
 * Design: Inspired by Linear's settings, Notion AI's session management,
 * and HubSpot's AI preferences. Clean, spacious, functional.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Spin,
  Statistic,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import {
  BellOutlined,
  BulbOutlined,
  LineChartOutlined,
  MessageOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { MessageSquare, Sparkles, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import ApprovalQueuePanel from '@/components/AIAssistant/ApprovalQueuePanel';
import { useAIPreferences } from '@/hooks/useAIPreferences';
import {
  approvalQueueApi,
  chatSessionsApi,
  learningSnapshotsApi,
} from '@/services/aiService';
import type { AILearningSnapshot, ApprovalQueueStats } from '@/services/aiService';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  groupChatSessionsByDate,
  type SessionHistoryLike,
} from '@/components/ChatInterface/sessionHistory';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

type TabKey = 'sessions' | 'approvals' | 'preferences' | 'learning';

interface ChatSession extends SessionHistoryLike {
  message_count?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const PageShell = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const HeaderIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(var(--color-primary), 0.15), rgba(var(--color-primary), 0.05));
  color: rgb(var(--color-primary));
  font-size: 22px;
`;

const HeaderText = styled.div`
  flex: 1;
`;

const Subtitle = styled.p`
  margin: 0 0 24px;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgb(var(--color-border));
  margin-bottom: 24px;
  overflow-x: auto;
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 550;
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ $active }) =>
    $active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border-bottom: 2px solid ${({ $active }) =>
    $active ? 'rgb(var(--color-primary))' : 'transparent'};
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const TabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: rgba(var(--color-primary), 0.12);
  color: rgb(var(--color-primary));
  font-size: 11px;
  font-weight: 650;
`;

// --- Chat Sessions Tab ---

const SearchBar = styled.div`
  margin-bottom: 20px;
`;

const SessionGroup = styled.div`
  margin-bottom: 24px;
`;

const GroupLabel = styled.h3`
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-tertiary));
`;

const SessionCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  margin-bottom: 8px;

  &:hover {
    border-color: rgba(var(--color-primary), 0.35);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const SessionIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
  flex-shrink: 0;
`;

const SessionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const SessionTitle = styled.div`
  font-size: 14px;
  font-weight: 550;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SessionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const SessionActions = styled.div`
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s;

  ${SessionCard}:hover & {
    opacity: 1;
  }
`;

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(var(--color-error), 0.1);
    color: rgb(var(--color-error));
  }
`;

// --- Settings Tab ---

const SettingSection = styled(Card)`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  margin-bottom: 16px;

  .ant-card-body {
    padding: 20px;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid rgba(var(--color-border), 0.5);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
`;

const SettingInfo = styled.div`
  flex: 1;
  margin-right: 16px;
`;

// --- Learning Tab ---

const MetricCard = styled(Card)`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  text-align: center;

  .ant-card-body {
    padding: 16px;
  }
`;

const TrendBadge = styled.span<{ $positive: boolean }>`
  font-size: 12px;
  font-weight: 550;
  color: ${({ $positive }) =>
    $positive ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))'};
`;

const AccuracyRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid rgba(var(--color-border), 0.5);

  &:last-child {
    border-bottom: none;
  }
`;

const AccuracyBar = styled.div<{ $pct: number }>`
  height: 6px;
  border-radius: 3px;
  background: rgba(var(--color-border), 0.5);
  width: 80px;
  margin-top: 4px;

  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${({ $pct }) => $pct}%;
    border-radius: 3px;
    background: ${({ $pct }) =>
      $pct >= 90
        ? 'rgb(var(--color-success))'
        : $pct >= 70
          ? 'rgb(var(--color-warning))'
          : 'rgb(var(--color-error))'};
    transition: width 0.3s;
  }
`;

const EmptyHint = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyIcon = styled.div`
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.6;
`;

// ============================================================================
// Chat Sessions Tab
// ============================================================================

const ChatSessionsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const _navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery<ChatSession[]>({
    queryKey: withTenantQueryKey('ai-chat-sessions'),
    queryFn: () => chatSessionsApi.list(),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const groups = useMemo(() => groupChatSessionsByDate(filtered), [filtered]);

  const handleOpenSession = useCallback(
    (sessionId: string) => {
      localStorage.setItem('pm.ai.widget.sessionId', sessionId);
      window.dispatchEvent(new CustomEvent('pm:ai-toggle', { detail: { open: true } }));
    },
    []
  );

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      try {
        await chatSessionsApi.delete(sessionId);
      } catch {
        // Silently handle — session may already be deleted
      }
    },
    []
  );

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <>
      <SearchBar>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          size="large"
          style={{ borderRadius: 'var(--radius-md)' }}
        />
      </SearchBar>

      {groups.length === 0 ? (
        <EmptyHint>
          <EmptyIcon>
            <Sparkles size={40} />
          </EmptyIcon>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {search ? 'No matching conversations' : 'No conversations yet'}
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {search
              ? 'Try a different search term.'
              : 'Start a conversation with the AI assistant using the chat button in the bottom right.'}
          </Text>
        </EmptyHint>
      ) : (
        groups.map((group) => (
          <SessionGroup key={group.label}>
            <GroupLabel>{group.label}</GroupLabel>
            {group.sessions.map((session) => (
              <SessionCard
                key={session.id}
                onClick={() => handleOpenSession(session.id)}
                aria-label={`Open conversation: ${session.title || 'Untitled'}`}
              >
                <SessionIcon>
                  <MessageSquare size={18} />
                </SessionIcon>
                <SessionContent>
                  <SessionTitle>
                    {session.title || 'Untitled conversation'}
                  </SessionTitle>
                  <SessionMeta>
                    <span>{formatTime(session.last_activity || session.created_on)}</span>
                    {session.message_count != null && (
                      <span>· {session.message_count} messages</span>
                    )}
                  </SessionMeta>
                </SessionContent>
                <SessionActions>
                  <Tooltip title="Delete conversation">
                    <IconBtn
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                  </Tooltip>
                </SessionActions>
              </SessionCard>
            ))}
          </SessionGroup>
        ))
      )}
    </>
  );
};

// ============================================================================
// Preferences Tab
// ============================================================================

const PreferencesTab: React.FC = () => {
  const {
    preferences,
    isLoading,
    toggleApprovalRequired,
    toggleConfidenceBadges,
    toggleSuggestions,
    updatePreference,
    isSaving,
  } = useAIPreferences();

  if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!preferences) return <Empty description="Unable to load preferences" />;

  return (
    <>
      <SettingSection>
        <SectionHead>
          <SafetyCertificateOutlined style={{ fontSize: 16, color: 'rgb(var(--color-primary))' }} />
          <Text strong style={{ fontSize: 15 }}>External Communication Approval</Text>
        </SectionHead>
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          When enabled, all outbound communications require your approval before being sent.
        </Paragraph>
        <SettingRow>
          <SettingInfo>
            <Text strong>Require approval before sending</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Recommended: ON. Prevents accidental sends to external parties.
            </Text>
          </SettingInfo>
          <Switch
            checked={preferences.require_external_approval}
            onChange={toggleApprovalRequired}
            loading={isSaving}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection>
        <SectionHead>
          <RobotOutlined style={{ fontSize: 16, color: 'rgb(var(--color-primary))' }} />
          <Text strong style={{ fontSize: 15 }}>AI Assistance</Text>
        </SectionHead>
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
      </SettingSection>

      <SettingSection>
        <SectionHead>
          <BellOutlined style={{ fontSize: 16, color: 'rgb(var(--color-primary))' }} />
          <Text strong style={{ fontSize: 15 }}>Notifications</Text>
        </SectionHead>
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
      </SettingSection>
    </>
  );
};

// ============================================================================
// Learning Dashboard Tab
// ============================================================================

const LearningTab: React.FC = () => {
  const { data: snapshots = [], isLoading } = useQuery<AILearningSnapshot[]>({
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

  const latestByType = new Map<string, AILearningSnapshot>();
  for (const snap of snapshots) {
    if (!latestByType.has(snap.entity_type)) {
      latestByType.set(snap.entity_type, snap);
    }
  }

  const totalEvents = snapshots.reduce((sum, s) => sum + s.total_events, 0);
  const avgAccuracy =
    latestByType.size > 0
      ? Math.round(
          (Array.from(latestByType.values()).reduce(
            (sum, s) => sum + (1 - s.correction_rate),
            0
          ) /
            latestByType.size) *
            100
        )
      : 0;

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <MetricCard>
            <Statistic
              title="Pending Approvals"
              value={stats?.pending ?? 0}
              prefix={<SafetyCertificateOutlined />}
            />
          </MetricCard>
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard>
            <Statistic
              title="Approved Today"
              value={stats?.approved_today ?? 0}
              valueStyle={{ color: 'rgb(var(--color-success))' }}
            />
          </MetricCard>
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard>
            <Statistic
              title="Total Events"
              value={totalEvents}
              prefix={<LineChartOutlined />}
            />
          </MetricCard>
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard>
            <Statistic
              title="Avg. Accuracy"
              value={avgAccuracy}
              suffix="%"
              prefix={<BulbOutlined />}
              valueStyle={{
                color:
                  avgAccuracy >= 90
                    ? 'rgb(var(--color-success))'
                    : avgAccuracy >= 70
                      ? 'rgb(var(--color-warning))'
                      : 'rgb(var(--color-error))',
              }}
            />
          </MetricCard>
        </Col>
      </Row>

      <Card
        title="AI Accuracy by Entity Type"
        style={{ borderRadius: 'var(--radius-lg)' }}
      >
        {latestByType.size === 0 ? (
          <EmptyHint>
            <EmptyIcon>📊</EmptyIcon>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              No learning data yet
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              AI will start collecting feedback as you use the platform. Accuracy metrics will appear here.
            </Text>
          </EmptyHint>
        ) : (
          Array.from(latestByType.entries()).map(([entityType, snap]) => {
            const accuracy = Math.round((1 - snap.correction_rate) * 100);
            return (
              <AccuracyRow key={entityType}>
                <SettingInfo>
                  <Text strong style={{ textTransform: 'capitalize' }}>
                    {entityType.replace(/_/g, ' ')}
                  </Text>
                  <AccuracyBar $pct={accuracy} />
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
                    {snap.total_events} events · {snap.positive_signals} positive · {snap.negative_signals} negative
                  </Text>
                  {snap.top_corrected_fields.length > 0 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Top corrected: {snap.top_corrected_fields.map((f) => f.field).join(', ')}
                    </Text>
                  )}
                </SettingInfo>
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 20 }}>{accuracy}%</Text>
                  <br />
                  <TrendBadge $positive={snap.accuracy_trend >= 0}>
                    {snap.accuracy_trend >= 0 ? '↑' : '↓'}{' '}
                    {Math.abs(snap.accuracy_trend * 100).toFixed(1)}%
                  </TrendBadge>
                </div>
              </AccuracyRow>
            );
          })
        )}
      </Card>
    </>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const MyAIPage: React.FC = () => {
  useDocumentTitle('My AI');
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'sessions';
  const activeTab: TabKey =
    rawTab === 'approvals' || rawTab === 'preferences' || rawTab === 'learning'
      ? rawTab
      : 'sessions';

  const { data: stats } = useQuery<ApprovalQueueStats>({
    queryKey: withTenantQueryKey('ai-approval-stats-badge'),
    queryFn: approvalQueueApi.stats,
    staleTime: 60_000,
  });

  const setTab = useCallback(
    (tab: TabKey) => {
      const next = new URLSearchParams(searchParams);
      if (tab === 'sessions') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const pendingCount = stats?.pending ?? 0;

  return (
    <PageShell>
      <Header>
        <HeaderIcon>
          <Sparkles size={22} />
        </HeaderIcon>
        <HeaderText>
          <Title level={3} style={{ margin: 0 }}>
            My AI
          </Title>
        </HeaderText>
      </Header>
      <Subtitle>
        Manage your AI assistant, review approvals, adjust preferences, and monitor learning accuracy.
      </Subtitle>

      <TabBar role="tablist">
        <Tab
          role="tab"
          $active={activeTab === 'sessions'}
          aria-selected={activeTab === 'sessions'}
          onClick={() => setTab('sessions')}
        >
          <MessageOutlined /> Chat Sessions
        </Tab>
        <Tab
          role="tab"
          $active={activeTab === 'approvals'}
          aria-selected={activeTab === 'approvals'}
          onClick={() => setTab('approvals')}
        >
          <SafetyCertificateOutlined /> Approvals
          {pendingCount > 0 && <TabBadge>{pendingCount}</TabBadge>}
        </Tab>
        <Tab
          role="tab"
          $active={activeTab === 'preferences'}
          aria-selected={activeTab === 'preferences'}
          onClick={() => setTab('preferences')}
        >
          <SettingOutlined /> Preferences
        </Tab>
        <Tab
          role="tab"
          $active={activeTab === 'learning'}
          aria-selected={activeTab === 'learning'}
          onClick={() => setTab('learning')}
        >
          <LineChartOutlined /> Learning
        </Tab>
      </TabBar>

      {activeTab === 'sessions' && <ChatSessionsTab />}
      {activeTab === 'approvals' && <ApprovalQueuePanel />}
      {activeTab === 'preferences' && <PreferencesTab />}
      {activeTab === 'learning' && <LearningTab />}
    </PageShell>
  );
};

export default MyAIPage;
