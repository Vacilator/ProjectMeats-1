/**
 * Workflow Sharing Component
 *
 * Enables export/import of workflows as reusable templates.
 * Supports sharing between tenants, version control, and template library.
 */

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Typography,
  Input,
  Switch,
  Form,
  message,
  Upload,
  Card,
  List,
  Tag,
  Descriptions,
  Alert
} from 'antd';
import {
  Download,
  Upload as UploadIcon,
  Share2,
  Copy,
  FileJson,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { businessApi } from '@/services/businessApi';
import { logger } from '@/utils/logger';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface WorkflowSharingProps {
  workflowId: string;
  workflowName: string;
  visible: boolean;
  onClose: () => void;
}

interface WorkflowTemplate {
  name: string;
  description: string;
  trigger_type: string;
  entity_type: string;
  nodes: any[];
  edges: any[];
  variables: Record<string, any>;
  metadata: {
    exported_at: string;
    version: string;
    author: string;
  };
}

export const WorkflowSharing: React.FC<WorkflowSharingProps> = ({
  workflowId,
  workflowName,
  visible,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportedTemplate, setExportedTemplate] = useState<WorkflowTemplate | null>(null);
  const [importForm] = Form.useForm();

  /**
   * Get current tenant ID from localStorage
   */
  const getTenantId = (): string | null => {
    return localStorage.getItem('tenantId');
  };

  // Export workflow as template
  const handleExport = async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;

    setLoading(true);
    try {
      const response = await businessApi.post(
        `/tenants/${tenantId}/workflows/${workflowId}/export_template/`
      );

      const template = response.data;
      setExportedTemplate(template);
      message.success('Workflow exported successfully');
    } catch (error) {
      logger.error('Failed to export workflow:', error);
      message.error('Failed to export workflow');
    } finally {
      setLoading(false);
    }
  };

  // Download template as JSON
  const handleDownload = () => {
    if (!exportedTemplate) return;

    const dataStr = JSON.stringify(exportedTemplate, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflowName.replace(/\s+/g, '_')}_template.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('Template downloaded');
  };

  // Copy template to clipboard
  const handleCopyToClipboard = () => {
    if (!exportedTemplate) return;

    navigator.clipboard.writeText(JSON.stringify(exportedTemplate, null, 2));
    message.success('Template copied to clipboard');
  };

  // Import template from JSON
  const handleImport = async (values: any) => {
    const tenantId = getTenantId();
    if (!tenantId) return;

    setLoading(true);
    try {
      let template: WorkflowTemplate;

      if (typeof values.template === 'string') {
        template = JSON.parse(values.template);
      } else {
        template = values.template;
      }

      const response = await businessApi.post(
        `/tenants/${tenantId}/workflows/import_template/`,
        {
          template,
          name: values.name,
          activate: values.activate
        }
      );

      message.success('Workflow imported successfully');
      importForm.resetFields();
      onClose();

      // Optionally navigate to the new workflow
      if (response.data.workflow?.id) {
        window.location.href = `/workflows/${response.data.workflow.id}`;
      }
    } catch (error: any) {
      logger.error('Failed to import workflow:', error);

      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to import workflow. Please check the template format.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Upload JSON file
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target?.result as string);
        importForm.setFieldsValue({
          template: JSON.stringify(template, null, 2),
          name: template.name || ''
        });
        message.success('Template loaded from file');
      } catch (error) {
        message.error('Invalid JSON file');
      }
    };

    reader.readAsText(file);
    return false; // Prevent auto upload
  };

  const renderExportTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        message="Export Workflow as Template"
        description="Create a reusable template that can be imported by other tenants or shared with your team."
        type="info"
        showIcon
      />

      {!exportedTemplate ? (
        <Button
          type="primary"
          icon={<Download size={16} />}
          onClick={handleExport}
          loading={loading}
          size="large"
          block
        >
          Generate Template
        </Button>
      ) : (
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions title="Template Details" column={1} bordered size="small">
              <Descriptions.Item label="Name">
                <Text strong>{exportedTemplate.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {exportedTemplate.description || 'No description'}
              </Descriptions.Item>
              <Descriptions.Item label="Trigger">
                <Tag color="blue">{exportedTemplate.trigger_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Entity">
                <Tag color="purple">{exportedTemplate.entity_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nodes">
                {exportedTemplate.nodes.length} nodes
              </Descriptions.Item>
              <Descriptions.Item label="Exported">
                {new Date(exportedTemplate.metadata.exported_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Author">
                {exportedTemplate.metadata.author}
              </Descriptions.Item>
            </Descriptions>

            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button
                icon={<FileJson size={16} />}
                onClick={handleDownload}
              >
                Download JSON
              </Button>
              <Button
                icon={<Copy size={16} />}
                onClick={handleCopyToClipboard}
              >
                Copy to Clipboard
              </Button>
            </Space>

            <Card size="small" title="Template Preview" style={{ maxHeight: 300, overflow: 'auto' }}>
              <pre style={{ margin: 0, fontSize: 12 }}>
                {JSON.stringify(exportedTemplate, null, 2)}
              </pre>
            </Card>
          </Space>
        </Card>
      )}
    </Space>
  );

  const renderImportTab = () => (
    <Form
      form={importForm}
      layout="vertical"
      onFinish={handleImport}
    >
      <Alert
        message="Import Workflow Template"
        description="Import a workflow template by uploading a JSON file or pasting the template JSON."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item
        label="Upload Template File"
      >
        <Upload
          accept=".json"
          beforeUpload={handleFileUpload}
          maxCount={1}
          showUploadList={false}
        >
          <Button icon={<UploadIcon size={16} />} block>
            Upload JSON File
          </Button>
        </Upload>
      </Form.Item>

      <Form.Item
        label="Or Paste Template JSON"
        name="template"
        rules={[
          { required: true, message: 'Please provide a template' },
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              try {
                JSON.parse(value);
                return Promise.resolve();
              } catch {
                return Promise.reject('Invalid JSON format');
              }
            }
          }
        ]}
      >
        <TextArea
          rows={8}
          placeholder='{"name": "My Template", ...}'
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Form.Item>

      <Form.Item
        label="Workflow Name (Optional)"
        name="name"
        tooltip="Override the template's default name"
      >
        <Input placeholder="Leave empty to use template name" />
      </Form.Item>

      <Form.Item
        label="Activate Immediately"
        name="activate"
        valuePropName="checked"
        initialValue={false}
      >
        <Switch />
      </Form.Item>

      <Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<CheckCircle size={16} />}
          >
            Import Workflow
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );

  return (
    <Modal
      title={
        <Space>
          <Share2 size={20} />
          <Text strong>Workflow Sharing</Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnHidden
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <Button
            type={activeTab === 'export' ? 'primary' : 'default'}
            onClick={() => setActiveTab('export')}
          >
            Export Template
          </Button>
          <Button
            type={activeTab === 'import' ? 'primary' : 'default'}
            onClick={() => setActiveTab('import')}
          >
            Import Template
          </Button>
        </Space>

        {activeTab === 'export' ? renderExportTab() : renderImportTab()}
      </Space>
    </Modal>
  );
};
