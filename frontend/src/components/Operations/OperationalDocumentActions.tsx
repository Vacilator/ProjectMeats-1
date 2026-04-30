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

import { businessApi } from '@/services/businessApi';

import { getDocumentEntityConfig } from './documentOperations';

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
}

const getErrorMessage = (error: unknown): string => {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (responseData && typeof responseData === 'object') {
    const detail = (responseData as Record<string, unknown>).detail;
    const errorMessage = (responseData as Record<string, unknown>).error;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof errorMessage === 'string' && errorMessage.trim()) return errorMessage;
  }
  const messageText = (error as { message?: string })?.message;
  return typeof messageText === 'string' && messageText.trim()
    ? messageText
    : 'The action failed.';
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
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailForm] = Form.useForm<{ to: string; subject: string; body: string }>();
  const queryClient = useQueryClient();
  const config = useMemo(() => getDocumentEntityConfig(entityType), [entityType]);

  const workflowQuery = useQuery({
    queryKey: ['document-status-workflow', config?.entityType ?? entityType, String(entityId)],
    queryFn: async () => {
      const response = await businessApi.get<WorkflowResponse>(
        `/${config?.endpoint}/${encodeURIComponent(String(entityId))}/status-workflow/`
      );
      return response.data;
    },
    enabled: Boolean(config) && Boolean(entityId) && config?.entityType !== 'carrier',
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    const next = workflowQuery.data?.allowed_transitions?.[0] ?? '';
    setSelectedStatus(next);
  }, [workflowQuery.data?.allowed_transitions]);

  const transitionMutation = useMutation({
    mutationFn: async (statusValue: string) => {
      const response = await businessApi.post(
        `/${config?.endpoint}/${encodeURIComponent(String(entityId))}/transition-status/`,
        { status: statusValue }
      );
      return response.data;
    },
    onSuccess: () => {
      message.success('Status updated.');
      void queryClient.invalidateQueries({
        queryKey: ['document-status-workflow', config?.entityType ?? entityType, String(entityId)],
      });
      onChanged?.();
    },
    onError: (error) => {
      message.error(getErrorMessage(error));
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
              onChange={setSelectedStatus}
              options={(workflowQuery.data?.allowed_transitions ?? []).map((value) => {
                const match = workflowQuery.data?.statuses?.find((status) => status.value === value);
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
              loading={transitionMutation.isPending}
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

        {!compact && workflowQuery.data?.current_status ? (
          <Text type="secondary">
            Current status: {workflowQuery.data.current_status}
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
