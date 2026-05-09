import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadOutlined, MailOutlined } from '@ant-design/icons';

import { useConnectivity } from '@/contexts/ConnectivityContext';
import { businessApi } from '@/services/businessApi';
import { getErrorMessage } from '@/utils/errorHelpers';
import { withTenantQueryKey } from '@/utils/queryKeys';

import {
  getDocumentEntityConfig,
  supportsOptimisticOperationalStatus,
} from './documentOperations';
import {
  flushOperationalStatusQueue,
  getQueuedOperationalStatus,
  OPERATIONAL_STATUS_QUEUE_EVENT,
  readOperationalStatusQueue,
  upsertOperationalStatusQueueItem,
  type OperationalStatusQueueItem,
} from './operationalStatusQueue';
import { isOperationalOfflineQueueEnabled } from './operationalOfflineMode';

const { Text } = Typography;
const { TextArea } = Input;

type WorkflowResponse = {
  current_status: string;
  allowed_transitions: string[];
  statuses: Array<{ value: string; label: string }>;
};

interface OperationalDocumentActionsProps {
  entityType: string;
  entityId: string | number;
  recordLabel?: string;
  compact?: boolean;
  onChanged?: () => void;
  onOptimisticStatusChange?: (nextStatus: string) => void;
}

const isOfflineLikeError = (error: unknown): boolean =>
  /network\s*error|failed\s*to\s*fetch|networkerror|offline/i.test(getErrorMessage(error));

const buildOptimisticWorkflow = (
  workflow: WorkflowResponse | undefined,
  nextStatus: string
): WorkflowResponse | undefined => {
  if (!workflow) {
    return workflow;
  }

  return {
    ...workflow,
    current_status: nextStatus,
    allowed_transitions: [],
  };
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const OperationalDocumentActions: React.FC<OperationalDocumentActionsProps> = ({
  entityType,
  entityId,
  recordLabel,
  compact = false,
  onChanged,
  onOptimisticStatusChange,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [queuedTransition, setQueuedTransition] = useState<OperationalStatusQueueItem | null>(null);
  const [isQueueSyncing, setIsQueueSyncing] = useState(false);
  const [emailForm] = Form.useForm<{ to: string; subject: string; body: string }>();
  const queryClient = useQueryClient();
  const { isOnline, lastChangedAt } = useConnectivity();
  const config = useMemo(() => getDocumentEntityConfig(entityType), [entityType]);
  const normalizedEntityType = config?.entityType ?? entityType;
  const normalizedEntityId = String(entityId);
  const tenantId = window.localStorage.getItem('tenantId') ?? 'unknown-tenant';
  const offlineQueueEnabled = useMemo(() => isOperationalOfflineQueueEnabled(), []);
  const supportsOptimisticStatus = useMemo(
    () => offlineQueueEnabled && supportsOptimisticOperationalStatus(normalizedEntityType),
    [normalizedEntityType, offlineQueueEnabled]
  );
  const hasQueuedTransition = offlineQueueEnabled && Boolean(queuedTransition);
  const workflowQueryKey = useMemo(
    () => withTenantQueryKey('document-status-workflow', normalizedEntityType, normalizedEntityId),
    [normalizedEntityId, normalizedEntityType]
  );

  const workflowQuery = useQuery({
    queryKey: workflowQueryKey,
    queryFn: async () => {
      const response = await businessApi.get<WorkflowResponse>(
        `/${config?.endpoint}/${encodeURIComponent(normalizedEntityId)}/status-workflow/`
      );
      return response.data;
    },
    enabled: Boolean(config) && Boolean(entityId) && config?.entityType !== 'carrier',
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    if (!offlineQueueEnabled) {
      setQueuedTransition(null);
      return;
    }

    const refreshQueuedTransition = () => {
      setQueuedTransition(getQueuedOperationalStatus(tenantId, normalizedEntityType, normalizedEntityId));
    };

    refreshQueuedTransition();

    const handleQueueEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ tenantId?: string }>).detail;
      if (detail?.tenantId && detail.tenantId !== tenantId) {
        return;
      }
      refreshQueuedTransition();
    };

    window.addEventListener(OPERATIONAL_STATUS_QUEUE_EVENT, handleQueueEvent);
    window.addEventListener('storage', handleQueueEvent);

    return () => {
      window.removeEventListener(OPERATIONAL_STATUS_QUEUE_EVENT, handleQueueEvent);
      window.removeEventListener('storage', handleQueueEvent);
    };
  }, [normalizedEntityId, normalizedEntityType, offlineQueueEnabled, tenantId]);

  useEffect(() => {
    if (!offlineQueueEnabled || !isOnline) {
      return;
    }

    const hasQueuedItems = readOperationalStatusQueue(tenantId).length > 0;
    if (!hasQueuedItems) {
      return;
    }

    let cancelled = false;
    setIsQueueSyncing(true);

    void flushOperationalStatusQueue({
      tenantId,
      processItem: async (item) => {
        const itemConfig = getDocumentEntityConfig(item.entityType);
        if (!itemConfig) {
          return;
        }

        await businessApi.post(
          `/${itemConfig.endpoint}/${encodeURIComponent(item.entityId)}/transition-status/`,
          { status: item.nextStatus }
        );

        await queryClient.invalidateQueries({
          queryKey: withTenantQueryKey('document-status-workflow', item.entityType, item.entityId),
        });

        if (item.entityType === normalizedEntityType && item.entityId === normalizedEntityId) {
          onChanged?.();
        }
      },
      isRetriableError: isOfflineLikeError,
    }).finally(() => {
      if (!cancelled) {
        setIsQueueSyncing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isOnline,
    lastChangedAt,
    normalizedEntityId,
    normalizedEntityType,
    offlineQueueEnabled,
    onChanged,
    queryClient,
    tenantId,
  ]);

  const effectiveWorkflow = hasQueuedTransition && queuedTransition
    ? buildOptimisticWorkflow(workflowQuery.data, queuedTransition.nextStatus)
    : workflowQuery.data;

  useEffect(() => {
    const next = effectiveWorkflow?.allowed_transitions?.[0] ?? '';
    setSelectedStatus(next);
  }, [effectiveWorkflow?.allowed_transitions]);

  const transitionMutation = useMutation({
    mutationFn: async (statusValue: string) => {
      const response = await businessApi.post(
        `/${config?.endpoint}/${encodeURIComponent(normalizedEntityId)}/transition-status/`,
        { status: statusValue }
      );
      return response.data;
    },
    onMutate: async (statusValue) => {
      if (!supportsOptimisticStatus) {
        return { previousWorkflow: undefined as WorkflowResponse | undefined };
      }

      await queryClient.cancelQueries({ queryKey: workflowQueryKey });
      const previousWorkflow = queryClient.getQueryData<WorkflowResponse>(workflowQueryKey);
      const optimisticWorkflow = buildOptimisticWorkflow(previousWorkflow, statusValue);

      if (optimisticWorkflow) {
        queryClient.setQueryData(workflowQueryKey, optimisticWorkflow);
      }

      onOptimisticStatusChange?.(statusValue);
      return { previousWorkflow };
    },
    onSuccess: () => {
      setQueuedTransition(null);
      message.success('Status updated.');
      void queryClient.invalidateQueries({
        queryKey: workflowQueryKey,
      });
      onChanged?.();
    },
    onError: (error, statusValue, context) => {
      if (supportsOptimisticStatus && isOfflineLikeError(error)) {
        const queueItem: OperationalStatusQueueItem = {
          tenantId,
          entityType: normalizedEntityType,
          entityId: normalizedEntityId,
          nextStatus: statusValue,
          queuedAt: new Date().toISOString(),
        };

        upsertOperationalStatusQueueItem(queueItem);
        setQueuedTransition(queueItem);
        message.warning('Connection lost. Status update queued and will retry automatically.');
        return;
      }

      if (context?.previousWorkflow) {
        queryClient.setQueryData(workflowQueryKey, context.previousWorkflow);
        onOptimisticStatusChange?.(context.previousWorkflow.current_status);
      }

      message.error(getErrorMessage(error));
    },
    onSettled: (_data, error) => {
      if (!(supportsOptimisticStatus && isOfflineLikeError(error))) {
        void queryClient.invalidateQueries({ queryKey: workflowQueryKey });
      }
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (payload: { to: string[]; subject: string; body: string }) => {
      const response = await businessApi.post(
        `/${config?.endpoint}/${encodeURIComponent(String(entityId))}/email/`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      message.success('Document emailed.');
      setIsEmailOpen(false);
      emailForm.resetFields();
      onChanged?.();
    },
    onError: (error) => {
      message.error(getErrorMessage(error));
    },
  });

  const handleDownload = async () => {
    if (!config) return;
    try {
      const response = await businessApi.get(
        `/${config.endpoint}/${encodeURIComponent(String(entityId))}/pdf/`,
        {
          responseType: 'blob',
        }
      );
      const disposition = String(response.headers['content-disposition'] || '');
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1] || `${config.label.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      triggerBlobDownload(response.data as Blob, filename);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleEmailSubmit = async () => {
    const values = await emailForm.validateFields();
    const recipients = values.to
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    await emailMutation.mutateAsync({
      to: recipients,
      subject: values.subject,
      body: values.body,
    });
  };

  if (!config || config.entityType === 'carrier') {
    return null;
  }

  return (
    <>
      <Space
        direction={compact ? 'horizontal' : 'vertical'}
        size={compact ? 8 : 12}
        style={{ width: compact ? 'auto' : '100%' }}
      >
        {workflowQuery.isLoading ? (
          <Spin size="small" />
        ) : workflowQuery.isError ? (
          <Alert type="error" showIcon message="Workflow unavailable." />
        ) : (
          <Space wrap>
            <Select
              size={compact ? 'small' : 'middle'}
              style={{ minWidth: compact ? 180 : 220 }}
              value={selectedStatus || undefined}
              placeholder="Select next status"
              disabled={transitionMutation.isPending || hasQueuedTransition}
              onChange={setSelectedStatus}
              options={(effectiveWorkflow?.allowed_transitions ?? []).map((value) => {
                const match = effectiveWorkflow?.statuses?.find((status) => status.value === value);
                return {
                  value,
                  label: match?.label ?? value,
                };
              })}
            />
            <Button
              size={compact ? 'small' : 'middle'}
              type="primary"
              disabled={!selectedStatus}
              loading={transitionMutation.isPending || (hasQueuedTransition && isQueueSyncing)}
              onClick={() => {
                if (selectedStatus) {
                  transitionMutation.mutate(selectedStatus);
                }
              }}
            >
              Update Status
            </Button>
          </Space>
        )}

        {hasQueuedTransition ? (
          <Text type="secondary">Queued offline: {queuedTransition?.nextStatus}</Text>
        ) : null}

        <Space wrap>
          <Button
            size={compact ? 'small' : 'middle'}
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            Download PDF
          </Button>
          <Button
            size={compact ? 'small' : 'middle'}
            icon={<MailOutlined />}
            onClick={() => {
              emailForm.setFieldsValue({
                to: '',
                subject: `${config.label}: ${recordLabel || entityId}`,
                body: `Attached is the latest ${config.label.toLowerCase()} for ${recordLabel || entityId}.`,
              });
              setIsEmailOpen(true);
            }}
          >
            Email Document
          </Button>
        </Space>

        {!compact && effectiveWorkflow?.current_status ? (
          <Text type="secondary">
            Current status: {effectiveWorkflow.current_status}
          </Text>
        ) : null}
      </Space>

      <Modal
        open={isEmailOpen}
        title={`Email ${config.label}`}
        onCancel={() => setIsEmailOpen(false)}
        onOk={() => {
          void handleEmailSubmit();
        }}
        okText="Send Email"
        confirmLoading={emailMutation.isPending}
      >
        <Form form={emailForm} layout="vertical">
          <Form.Item
            label="Recipients"
            name="to"
            rules={[{ required: true, message: 'Enter at least one email address.' }]}
          >
            <Input placeholder="recipient@example.com, team@example.com" />
          </Form.Item>
          <Form.Item
            label="Subject"
            name="subject"
            rules={[{ required: true, message: 'Enter an email subject.' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Message" name="body">
            <TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default OperationalDocumentActions;
