import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Collapse,
  Empty,
  List,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import { AIDraftReviewContent } from '@/components/AIAssistant/AIDraftReviewModal';
import {
  AI_INBOX_REFRESH_EVENT,
  aiStaffApi,
  emitAIInboxRefreshEvent,
} from '@/services/aiService';
import { businessApi } from '@/services/businessApi';
import { buildReviewDetailsPathFromItem } from '@/utils/reviewDetailsPath';
import { withTenantQueryKey } from '@/utils/queryKeys';
import {
  buildEmailSyncCtaMessage,
  emailSyncNeedsReconnect,
  getEmailSyncErrorCode,
} from '@/utils/emailSyncDiagnostics';

const { Paragraph, Text, Title } = Typography;

type EmailLogStatus =
  | 'logged'
  | 'ai_parsing'
  | 'draft_created'
  | 'order_created'
  | 'action_required'
  | 'failed'
  | 'ignored';

type EmailLog = {
  id: string;
  subject: string;
  sender: string;
  status: EmailLogStatus;
  has_attachments: boolean;
  attachment_count?: number;
  attachment_filenames?: string[];
  error_message: string | null;
  created_at: string;
  draft: {
    id: string;
    draft_type: string;
    status: string;
    summary: string;
    classification_confidence: number;
  } | null;
};

type EmailLogsResponse = {
  emails: EmailLog[];
  count: number;
};

const STATUS_CONFIG: Record<
  EmailLogStatus,
  { color: string; icon: React.ReactNode; text: string }
> = {
  logged: { color: 'blue', icon: <MailOutlined />, text: 'Logged' },
  ai_parsing: { color: 'processing', icon: <SyncOutlined spin />, text: 'AI Parsing' },
  draft_created: {
    color: 'warning',
    icon: <ExclamationCircleOutlined />,
    text: 'Draft Ready',
  },
  order_created: {
    color: 'success',
    icon: <CheckCircleOutlined />,
    text: 'Order Created',
  },
  action_required: {
    color: 'warning',
    icon: <ClockCircleOutlined />,
    text: 'Action Required',
  },
  failed: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Failed' },
  ignored: { color: 'default', icon: <ClockCircleOutlined />, text: 'Ignored' },
};

const fetchEmailLogs = async (): Promise<EmailLogsResponse> => {
  const response = await businessApi.get<EmailLogsResponse>('/integrations/email/logs/?limit=10');
  return response.data;
};

export const EmailIngestionCockpitPanel: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const highlightedDraftId = useMemo(
    () => new URLSearchParams(location.search).get('draft'),
    [location.search],
  );
  const [syncing, setSyncing] = useState(false);
  const [activeDraftKeys, setActiveDraftKeys] = useState<string[]>(
    highlightedDraftId ? [highlightedDraftId] : [],
  );

  useEffect(() => {
    if (highlightedDraftId) {
      setActiveDraftKeys([highlightedDraftId]);
    }
  }, [highlightedDraftId]);

  const emailsQuery = useQuery({
    queryKey: withTenantQueryKey('process-cockpit-email-logs'),
    queryFn: fetchEmailLogs,
    staleTime: 15_000,
  });

  const pendingReviewsQuery = useQuery({
    queryKey: withTenantQueryKey('process-cockpit-pending-reviews', highlightedDraftId || 'all'),
    queryFn: () => aiStaffApi.listPendingReviews({ highlightedId: highlightedDraftId }),
    staleTime: 15_000,
  });

  const refetchAll = useCallback(() => {
    void emailsQuery.refetch();
    void pendingReviewsQuery.refetch();
  }, [emailsQuery, pendingReviewsQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleRefresh = () => {
      refetchAll();
    };

    window.addEventListener(AI_INBOX_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(AI_INBOX_REFRESH_EVENT, handleRefresh);
  }, [refetchAll]);

  const pendingReviews = useMemo(
    () => pendingReviewsQuery.data ?? [],
    [pendingReviewsQuery.data],
  );
  const emails = emailsQuery.data?.emails ?? [];
  const reviewById = useMemo(
    () => new Map(pendingReviews.map((review) => [review.id, review])),
    [pendingReviews],
  );

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await businessApi.post('/integrations/email/sync/');
      const ok = response.data?.ok;
      const hint = response.data?.hint;
      const stats = response.data?.stats;

      if (ok === false) {
        const code = getEmailSyncErrorCode(response.data);
        const errorMessage = response.data?.error || 'Email sync failed.';

        if (emailSyncNeedsReconnect(code)) {
          message.error({
            content: buildEmailSyncCtaMessage(
              'Outlook needs to be reconnected.',
              () => navigate('/settings/email-integrations'),
              typeof hint === 'string' ? hint : undefined,
            ),
            duration: 6,
          });
          refetchAll();
          return;
        }

        message.error(typeof hint === 'string' ? `${errorMessage} ${hint}` : errorMessage);
        refetchAll();
        return;
      }

      if (stats?.emails_saved) {
        message.success(`Saved ${stats.emails_saved} new email${stats.emails_saved === 1 ? '' : 's'}.`);
      } else {
        message.success('Email sync completed.');
      }

      emitAIInboxRefreshEvent('manual');
      refetchAll();
    } catch (error: any) {
      const code = getEmailSyncErrorCode(error?.response?.data);

      if (emailSyncNeedsReconnect(code)) {
        message.error({
          content: buildEmailSyncCtaMessage(
            'Outlook needs to be reconnected.',
            () => navigate('/settings/email-integrations'),
          ),
          duration: 6,
        });
        refetchAll();
        return;
      }

      message.error(error?.response?.data?.error || 'Failed to start email sync');
    } finally {
      setSyncing(false);
    }
  }, [navigate, refetchAll]);

  const handleResolved = useCallback(
    (reviewId: string) => {
      setActiveDraftKeys((current) => current.filter((key) => key !== reviewId));
      refetchAll();
    },
    [refetchAll],
  );

  const openReview = useCallback((reviewId: string) => {
    setActiveDraftKeys([reviewId]);
  }, []);

  const reviewItems = pendingReviews.map((review) => ({
    key: review.id,
    label: (
      <Space direction="vertical" size={2}>
        <Text strong>{review.source_subject || review.intent_label || 'Pending review'}</Text>
        <Space size={8} wrap>
          {review.intent_label ? <Tag color="blue">{review.intent_label}</Tag> : null}
          {review.sender ? <Tag>{review.sender}</Tag> : null}
          <Text type="secondary">
            {review.created_on ? new Date(review.created_on).toLocaleString() : 'recently'}
          </Text>
        </Space>
      </Space>
    ),
    children: (
      <AIDraftReviewContent
        open
        item={review}
        onResolved={handleResolved}
      />
    ),
  }));

  return (
    <Card
      size="small"
      title="Email Ingestion + Action Required"
      extra={
        <Space>
          <Button onClick={() => refetchAll()} icon={<SyncOutlined />} disabled={emailsQuery.isFetching || pendingReviewsQuery.isFetching}>
            Refresh
          </Button>
          <Button type="primary" onClick={() => void handleSyncNow()} icon={<SyncOutlined spin={syncing} />} loading={syncing}>
            Sync Now
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <Paragraph style={{ marginBottom: 0 }}>
          Recent inbox intake and operator review now live in Process Cockpit. Expand an action-required item to inspect the parsed payload and edit the draft inline.
        </Paragraph>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ marginTop: 0 }}>
              Recent Emails
            </Title>
            {emailsQuery.isLoading ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : emails.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No order-related emails have been ingested yet."
              />
            ) : (
              <List
                dataSource={emails}
                renderItem={(email) => {
                  const matchingReview = email.draft?.id ? reviewById.get(email.draft.id) : null;
                  const reviewDetailsPath = matchingReview
                    ? buildReviewDetailsPathFromItem(matchingReview)
                    : null;

                  return (
                    <List.Item
                      key={email.id}
                      actions={[
                        email.draft?.id && matchingReview ? (
                          <Button
                            key="open-review"
                            type="link"
                            size="small"
                            onClick={() => openReview(email.draft!.id)}
                          >
                            Open Draft Review
                          </Button>
                        ) : null,
                        reviewDetailsPath ? (
                          <Button
                            key="review-details"
                            type="link"
                            size="small"
                            onClick={() => navigate(reviewDetailsPath)}
                          >
                            Review Details
                          </Button>
                        ) : null,
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        avatar={<MailOutlined style={{ color: 'rgb(var(--color-primary))', fontSize: 18 }} />}
                        title={
                          <Space direction="vertical" size={2}>
                            <Space size={8} wrap>
                              <Text strong>{email.subject}</Text>
                              <Tag color={STATUS_CONFIG[email.status].color} icon={STATUS_CONFIG[email.status].icon}>
                                {STATUS_CONFIG[email.status].text}
                              </Tag>
                            </Space>
                            {email.draft?.summary ? (
                              <Text type="secondary">{email.draft.summary}</Text>
                            ) : null}
                            {email.error_message ? (
                              <Text type="danger">{email.error_message}</Text>
                            ) : null}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">{email.sender}</Text>
                            <Text type="secondary">
                              {new Date(email.created_at).toLocaleString()}
                              {email.has_attachments
                                ? ` • ${email.attachment_count ?? 1} attachment${(email.attachment_count ?? 1) !== 1 ? 's' : ''}`
                                : ''}
                            </Text>
                            {email.attachment_filenames && email.attachment_filenames.length > 0 ? (
                              <Space size={[4, 2]} wrap style={{ marginTop: 2 }}>
                                {email.attachment_filenames.slice(0, 4).map((name) => {
                                  const ext = name.split('.').pop()?.toLowerCase() ?? '';
                                  const icon =
                                    ['pdf'].includes(ext) ? '📄' :
                                    ['xlsx', 'xls', 'csv'].includes(ext) ? '📊' :
                                    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? '🖼️' :
                                    ['doc', 'docx'].includes(ext) ? '📝' :
                                    '📎';
                                  return (
                                    <Tag key={name} style={{ fontSize: 11, margin: 0 }}>{icon} {name}</Tag>
                                  );
                                })}
                                {email.attachment_filenames.length > 4 ? (
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    +{email.attachment_filenames.length - 4} more
                                  </Text>
                                ) : null}
                              </Space>
                            ) : null}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ marginTop: 0 }}>
              Action Required
            </Title>
            {pendingReviewsQuery.isLoading ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : reviewItems.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No AI review items are waiting for operator action."
              />
            ) : (
              <Collapse
                activeKey={activeDraftKeys}
                onChange={(keys) => {
                  const nextKeys = Array.isArray(keys) ? keys.map(String) : [String(keys)];
                  setActiveDraftKeys(nextKeys.filter(Boolean));
                }}
                items={reviewItems}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default EmailIngestionCockpitPanel;
