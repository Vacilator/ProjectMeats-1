import React, { useState, useEffect } from 'react';
import { List, Tag, Button, Space, Typography, Empty, message, Spin } from 'antd';
import { SyncOutlined, MailOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';

import { businessApi } from '@/services/businessApi';
import {
  buildEmailSyncCtaMessage,
  emailSyncNeedsReconnect,
  getEmailSyncErrorCode,
} from '@/utils/emailSyncDiagnostics';

const { Title, Text } = Typography;

interface EmailLog {
  id: string;
  message_id: string;
  subject: string;
  sender: string;
  status: 'logged' | 'ai_parsing' | 'draft_created' | 'order_created' | 'failed' | 'ignored';
  provider_type: string | null;
  has_attachments: boolean;
  extracted_data: Record<string, any> | null;
  related_order_id: string | null;
  draft: {
    id: string;
    draft_type: string;
    status: string;
    summary: string;
    classification_confidence: number;
  } | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

interface EmailLogsResponse {
  emails: EmailLog[];
  count: number;
}

/**
 * Status tag renderer with color coding
 */
const getStatusTag = (status: EmailLog['status']) => {
  const statusConfig = {
    logged: { color: 'blue', icon: <MailOutlined />, text: 'Logged' },
    ai_parsing: { color: 'processing', icon: <SyncOutlined spin />, text: 'AI Parsing' },
    draft_created: { color: 'warning', icon: <ExclamationCircleOutlined />, text: 'Draft Ready' },
    order_created: { color: 'success', icon: <CheckCircleOutlined />, text: 'Order Created' },
    failed: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Failed' },
    ignored: { color: 'default', icon: <ClockCircleOutlined />, text: 'Ignored' },
  };

  const config = statusConfig[status];
  return (
    <Tag color={config.color} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

/**
 * Email Ingestion Monitor Component
 * 
 * Displays recent emails ingested from Microsoft Outlook for order processing.
 * Shows processing status and allows manual sync trigger.
 */
export const IngestionMonitor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const highlightedDraftId = new URLSearchParams(location.search).get('draft');

  /**
   * Fetch email logs from API
   */
  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const response = await businessApi.get<EmailLogsResponse>('/integrations/email/logs/?limit=10');
      setEmails(response.data.emails);
    } catch (error: any) {
      console.error('Failed to fetch email logs:', error);
      message.error(error?.response?.data?.error || 'Failed to load email logs');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Trigger manual email sync
   */
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const startTime = Date.now();

      const response = await businessApi.post('/integrations/email/sync/');

      // Ensure loader shows for at least 1.5s for UX
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 1500 - elapsedTime));
      }

      const ok = response.data?.ok;
      const hint = response.data?.hint;
      const stats = response.data?.stats;

      // Soft-fail path: backend can return 200 with ok:false when Outlook/Graph is unhealthy.
      if (ok === false) {
        const code = getEmailSyncErrorCode(response.data);
        const err = response.data?.error || 'Email sync failed.';

        if (emailSyncNeedsReconnect(code)) {
          message.error({
            content: buildEmailSyncCtaMessage(
              'Outlook needs to be reconnected.',
              () => navigate('/settings/email-integrations'),
              typeof hint === 'string' ? hint : undefined
            ),
            duration: 6,
          });
          await fetchEmailLogs();
          return;
        }

        message.error(typeof hint === 'string' ? `${err} ${hint}` : err);
        await fetchEmailLogs();
        return;
      }

      if (stats) {
        const scanned = stats.emails_scanned ?? 0;
        const matched = stats.emails_matched ?? 0;
        const saved = stats.emails_saved ?? 0;
        const skipped = stats.emails_skipped ?? 0;
        const errors = stats.errors ?? 0;

        if (errors > 0) {
          const detail = (stats.errors_detail && stats.errors_detail[0]) ? String(stats.errors_detail[0]) : undefined;
          message.warning(detail ? `Sync completed with warnings: ${detail}` : 'Sync completed with warnings.');
        }

        if (saved > 0) {
          message.success(`Sync complete: Saved ${saved} new emails (matched ${matched}, scanned ${scanned}).`);
        } else if (skipped > 0) {
          message.info(`Sync complete: ${skipped} emails were already in the system (matched ${matched}, scanned ${scanned}).`);
        } else {
          message.info(`Sync complete: No new matching emails found (matched ${matched}, scanned ${scanned}).`);
        }
      } else {
        message.success('Email sync completed.');
      }

      await fetchEmailLogs();
    } catch (error: any) {
      console.error('Failed to trigger sync:', error);

      const parsedCode = getEmailSyncErrorCode(error?.response?.data);

      if (emailSyncNeedsReconnect(parsedCode)) {
        message.error({
          content: buildEmailSyncCtaMessage(
            'Outlook needs to be reconnected.',
            () => navigate('/settings/email-integrations')
          ),
          duration: 6,
        });
        await fetchEmailLogs();
        return;
      }

      message.error(error?.response?.data?.error || 'Failed to start email sync');
    } finally {
      setSyncing(false);
    }
  };

  // Load email logs on mount
  useEffect(() => {
    fetchEmailLogs();
  }, []);

  return (
    <div style={{ padding: '16px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Email Ingestion Monitor
            </Title>
            <Text type="secondary">
              Recent order-related emails from Microsoft Outlook
            </Text>
          </div>
          <Space>
            <Button
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSyncNow}
              loading={syncing}
              type="primary"
            >
              Sync Now
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={fetchEmailLogs}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Email List */}
        <Spin spinning={loading}>
          {emails.length === 0 ? (
            <Empty
              description="No emails ingested yet"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Text type="secondary">
                Click "Sync Now" to fetch order-related emails from your inbox
              </Text>
            </Empty>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={emails}
                renderItem={(email) => (
                  <List.Item
                    key={email.id}
                    style={
                      highlightedDraftId && email.draft?.id === highlightedDraftId
                        ? {
                            border: '1px solid rgb(var(--color-primary))',
                            borderRadius: 12,
                            paddingInline: 12,
                            background: 'rgb(var(--color-primary) / 0.05)',
                          }
                        : undefined
                    }
                    actions={[
                      getStatusTag(email.status),
                      email.draft && (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => navigate(`/settings/email-integrations?draft=${email.draft?.id}`)}
                        >
                          Review Draft
                        </Button>
                      ),
                      email.related_order_id && (
                        <Button
                          type="link"
                        size="small"
                        href={`/orders/${email.related_order_id}`}
                      >
                        View Order
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<MailOutlined style={{ fontSize: '24px', color: 'rgb(var(--color-primary))' }} />}
                    title={
                      <Space direction="vertical" size={0}>
                        <Text strong>{email.subject}</Text>
                        {email.error_message && (
                          <Text type="danger" style={{ fontSize: '12px' }}>
                            Error: {email.error_message}
                          </Text>
                        )}
                        {email.draft?.summary && (
                          <Text style={{ fontSize: '12px', color: 'rgb(var(--color-text-primary))' }}>
                            {email.draft.summary}
                          </Text>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">From: {email.sender}</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {new Date(email.created_at).toLocaleString()}
                          {email.has_attachments && ' • Has attachments'}
                        </Text>
                        {email.draft?.draft_type && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Draft Type: {email.draft.draft_type.replace(/_/g, ' ')}
                          </Text>
                        )}
                        {email.extracted_data?.confidence && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            AI Confidence: {Math.round(email.extracted_data.confidence * 100)}%
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>

        {/* Status Legend */}
        <div
          style={{
            padding: '12px',
            background: 'rgb(var(--color-surface))',
            border: '1px solid rgb(var(--color-border))',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <Text type="secondary" strong>Status Legend:</Text>
          <div style={{ marginTop: '8px' }}>
            <Space wrap>
              {getStatusTag('logged')} New email received
              {getStatusTag('ai_parsing')} AI extracting order data
              {getStatusTag('order_created')} Order created successfully
              {getStatusTag('ignored')} Low confidence, needs review
              {getStatusTag('failed')} Processing error
            </Space>
          </div>
        </div>
      </Space>
    </div>
  );
};

export default IngestionMonitor;
