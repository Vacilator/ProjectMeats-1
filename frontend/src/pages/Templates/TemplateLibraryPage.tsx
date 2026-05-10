/**
 * TemplateLibraryPage - Workform Template Library
 *
 * Displays the official EndToEndInquiryToPOProcess template and safe variants.
 * Features:
 * - Template cards with metadata (node count, trigger count, version)
 * - "Create New from Main Process" clone workflow
 * - Version history per template
 * - One-click publish to make variants live
 * - Validation that prevents breaking the golden pipeline
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  Tag,
  Modal,
  Input,
  Empty,
  Spin,
  Timeline,
  Badge,
  Tooltip,
  message,
  Space,
  Divider,
} from 'antd';
import {
  CopyOutlined,
  HistoryOutlined,
  RocketOutlined,
  LockOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  FileTextOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface TemplateMetadata {
  nodeCount: number;
  edgeCount: number;
  triggerCount: number;
  formStepCount: number;
  loopCount: number;
  approvalGateCount?: number;
}

interface TemplateVersion {
  version: string;
  published_at: string;
  published_by: string;
  change_summary: string;
  is_current: boolean;
}

interface WorkformTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
  version: string;
  category: string;
  isSystemTemplate: boolean;
  is_published: boolean;
  metadata: TemplateMetadata;
  created_at: string;
  updated_at: string;
  versions?: TemplateVersion[];
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function TemplateCard({
  template,
  onClone,
  onViewHistory,
  onPublish,
}: {
  template: WorkformTemplate;
  onClone: (t: WorkformTemplate) => void;
  onViewHistory: (t: WorkformTemplate) => void;
  onPublish: (t: WorkformTemplate) => void;
}): React.ReactElement {
  return (
    <Card
      className="shadow-sm hover:shadow-md transition-shadow"
      title={
        <div className="flex items-center gap-2">
          {template.isSystemTemplate ? (
            <LockOutlined style={{ color: 'rgb(var(--color-info))' }} />
          ) : (
            <FileTextOutlined style={{ color: 'rgb(var(--color-text-quaternary))' }} />
          )}
          <span className="font-semibold">{template.name}</span>
        </div>
      }
      extra={
        <Space>
          <Tag color="blue">v{template.version}</Tag>
          {template.is_published ? (
            <Badge status="success" text="Live" />
          ) : (
            <Badge status="default" text="Draft" />
          )}
        </Space>
      }
    >
      <p className="text-sm mb-4" style={{ color: 'rgb(var(--color-text-secondary))' }}>{template.description}</p>

      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Tag>
          <BranchesOutlined /> {template.metadata.nodeCount} nodes
        </Tag>
        <Tag>
          <RocketOutlined /> {template.metadata.triggerCount} triggers
        </Tag>
        <Tag>{template.metadata.formStepCount} form steps</Tag>
        {template.metadata.approvalGateCount && (
          <Tag color="orange">
            {template.metadata.approvalGateCount} approval gate
            {template.metadata.approvalGateCount > 1 ? 's' : ''}
          </Tag>
        )}
      </div>

      {/* Category and dates */}
      <div className="text-xs mb-4" style={{ color: 'rgb(var(--color-text-quaternary))' }}>
        Category: <Tag>{template.category}</Tag>
        {' • '}Updated: {new Date(template.updated_at).toLocaleDateString()}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Tooltip title="Create variant from this template">
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => onClone(template)}
          >
            Create Variant
          </Button>
        </Tooltip>
        <Tooltip title="View version history">
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => onViewHistory(template)}
          >
            History
          </Button>
        </Tooltip>
        {!template.isSystemTemplate && !template.is_published && (
          <Tooltip title="Publish this variant to make it live">
            <Button
              size="small"
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => onPublish(template)}
            >
              Publish
            </Button>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}

function VersionHistoryModal({
  template,
  open,
  onClose,
}: {
  template: WorkformTemplate | null;
  open: boolean;
  onClose: () => void;
}): React.ReactElement {
  const versions = template?.versions ?? [];

  return (
    <Modal
      title={`Version History: ${template?.name ?? ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      {versions.length === 0 ? (
        <Empty description="No version history available" />
      ) : (
        <Timeline
          items={versions.map((v) => ({
            color: v.is_current ? 'green' : 'gray',
            dot: v.is_current ? (
              <CheckCircleOutlined style={{ color: 'rgb(var(--color-success))' }} />
            ) : undefined,
            children: (
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{v.version}</span>
                  {v.is_current && <Tag color="green">Current</Tag>}
                </div>
                <div className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{v.change_summary}</div>
                <div className="text-xs" style={{ color: 'rgb(var(--color-text-quaternary))' }}>
                  {v.published_by} • {new Date(v.published_at).toLocaleDateString()}
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Modal>
  );
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------

export function TemplateLibraryPage(): React.ReactElement {
  useDocumentTitle('Templates');
  const queryClient = useQueryClient();
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkformTemplate | null>(null);
  const [variantName, setVariantName] = useState('');

  const { data: templates, isLoading } = useQuery<WorkformTemplate[]>({
    queryKey: ['template-library'],
    queryFn: async () => {
      const res = await businessApi.get('/workflows/templates/library/');
      return res.data ?? [];
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (params: { sourceId: string; name: string }) => {
      const res = await businessApi.post('/workflows/templates/clone/', params);
      return res.data;
    },
    onSuccess: () => {
      message.success('Variant created successfully');
      setCloneModalOpen(false);
      setVariantName('');
      queryClient.invalidateQueries({ queryKey: ['template-library'] });
    },
    onError: () => {
      message.error('Failed to create variant');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await businessApi.post(`/workflows/templates/${templateId}/publish/`);
      return res.data;
    },
    onSuccess: () => {
      message.success('Template published successfully');
      queryClient.invalidateQueries({ queryKey: ['template-library'] });
    },
    onError: () => {
      message.error('Failed to publish template');
    },
  });

  const handleClone = useCallback((template: WorkformTemplate) => {
    setSelectedTemplate(template);
    setVariantName(`${template.name} (Variant)`);
    setCloneModalOpen(true);
  }, []);

  const handleViewHistory = useCallback((template: WorkformTemplate) => {
    setSelectedTemplate(template);
    setHistoryModalOpen(true);
  }, []);

  const handlePublish = useCallback(
    (template: WorkformTemplate) => {
      Modal.confirm({
        title: 'Publish Template',
        content: `Are you sure you want to publish "${template.name}" v${template.version}? This will make it available for new process runs.`,
        okText: 'Publish',
        okType: 'primary',
        onOk: () => publishMutation.mutate(template.id),
      });
    },
    [publishMutation],
  );

  const handleCloneSubmit = useCallback(() => {
    if (!selectedTemplate || !variantName.trim()) return;
    cloneMutation.mutate({
      sourceId: selectedTemplate.id,
      name: variantName.trim(),
    });
  }, [selectedTemplate, variantName, cloneMutation]);

  const handleHistoryClose = useCallback(() => {
    setHistoryModalOpen(false);
  }, []);

  const { systemTemplates, variants } = useMemo(() => {
    if (!templates) return { systemTemplates: [], variants: [] };
    return {
      systemTemplates: templates.filter((t) => t.isSystemTemplate),
      variants: templates.filter((t) => !t.isSystemTemplate),
    };
  }, [templates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin size="large" tip="Loading template library..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Template Library</h1>
          <p className="mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
            Official process templates and safe variants for your trading workflows
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            if (systemTemplates.length > 0) handleClone(systemTemplates[0]);
          }}
          disabled={systemTemplates.length === 0}
        >
          Create New from Main Process
        </Button>
      </div>

      {/* System Templates */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <LockOutlined style={{ color: 'rgb(var(--color-info))' }} />
          Official Templates
        </h2>
        {systemTemplates.length === 0 ? (
          <Empty description="No system templates registered" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onClone={handleClone}
                onViewHistory={handleViewHistory}
                onPublish={handlePublish}
              />
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <>
          <Divider />
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BranchesOutlined style={{ color: 'rgb(var(--color-success))' }} />
              Variants
              <Tag>{variants.length}</Tag>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variants.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onClone={handleClone}
                  onViewHistory={handleViewHistory}
                  onPublish={handlePublish}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Clone Modal */}
      <Modal
        title="Create Variant from Template"
        open={cloneModalOpen}
        onCancel={() => setCloneModalOpen(false)}
        onOk={handleCloneSubmit}
        okText="Create Variant"
        confirmLoading={cloneMutation.isPending}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Source Template
            </label>
            <Input value={selectedTemplate?.name ?? ''} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Variant Name
            </label>
            <Input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="Enter variant name..."
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <ExclamationCircleOutlined className="text-amber-500 mr-2" />
            Core nodes (triggers, safety check, form process group) are protected
            and cannot be removed in variants.
          </div>
        </div>
      </Modal>

      {/* Version History Modal */}
      <VersionHistoryModal
        template={selectedTemplate}
        open={historyModalOpen}
        onClose={handleHistoryClose}
      />
    </div>
  );
}

export default TemplateLibraryPage;
