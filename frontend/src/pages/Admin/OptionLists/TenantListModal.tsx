import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Space, Switch, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

import { apiClient } from '@/services/apiService';

const { Text } = Typography;

export interface TenantListOption {
  value: string;
  label: string;
}

export interface TenantList {
  id: string;
  name: string;
  description: string;
  options: TenantListOption[];
  option_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type EditableOptionRow = TenantListOption & { key: string };

export interface TenantListModalProps {
  isOpen: boolean;
  canEdit: boolean;
  initial?: TenantList | null;
  onClose: () => void;
  onSaved: () => void;
}

export const TenantListModal: React.FC<TenantListModalProps> = ({
  isOpen,
  canEdit,
  initial,
  onClose,
  onSaved,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<EditableOptionRow[]>([]);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!isOpen) return;

    form.setFieldsValue({
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      is_active: initial?.is_active ?? true,
    });

    const initialOptions = Array.isArray(initial?.options) ? initial!.options : [];
    setOptions(
      initialOptions.map((opt, idx) => ({
        key: `${idx}-${opt.value}`,
        value: opt.value ?? '',
        label: opt.label ?? '',
      }))
    );
  }, [form, initial, isOpen]);

  const optionErrors = useMemo(() => {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const row of options) {
      const v = String(row.value ?? '').trim();
      const l = String(row.label ?? '').trim();

      if (!v || !l) {
        errors.push('All options must have both a value and a label.');
        break;
      }

      const key = v.toLowerCase();
      if (seen.has(key)) {
        errors.push(`Duplicate option value: "${v}"`);
        break;
      }
      seen.add(key);
    }

    return errors;
  }, [options]);

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`, value: '', label: '' },
    ]);
  };

  const removeOption = (key: string) => {
    setOptions((prev) => prev.filter((o) => o.key !== key));
  };

  const updateOption = (key: string, patch: Partial<TenantListOption>) => {
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  };

  const handleSave = async () => {
    if (!canEdit) {
      message.info('Only tenant administrators can manage option lists.');
      return;
    }

    try {
      const values = await form.validateFields();

      if (optionErrors.length > 0) {
        message.error(optionErrors[0]);
        return;
      }

      const payload = {
        name: String(values.name ?? '').trim(),
        description: String(values.description ?? ''),
        is_active: Boolean(values.is_active),
        options: options.map(({ value, label }) => ({
          value: String(value).trim(),
          label: String(label).trim(),
        })),
      };

      setSaving(true);

      if (isEdit && initial?.id) {
        await apiClient.patch(`/workflows/lists/${initial.id}/`, payload);
      } else {
        await apiClient.post('/workflows/lists/', payload);
      }

      message.success(isEdit ? 'Custom list updated' : 'Custom list created');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      if (errObj.errorFields) return; // antd validation
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      message.error((typeof data.error === 'string' ? data.error : '') || 'Failed to save custom list');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<EditableOptionRow> = [
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value: string, record) => (
        <Input
          value={value}
          disabled={!canEdit}
          onChange={(e) => updateOption(record.key, { value: e.target.value })}
        />
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (value: string, record) => (
        <Input
          value={value}
          disabled={!canEdit}
          onChange={(e) => updateOption(record.key, { label: e.target.value })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 54,
      render: (_: unknown, record) => (
        <Button
          danger
          type="text"
          icon={<DeleteOutlined />}
          disabled={!canEdit}
          onClick={() => removeOption(record.key)}
          aria-label="Remove option"
        />
      ),
    },
  ];

  return (
    <Modal
      title={isEdit ? `Edit Custom List: ${initial?.name ?? ''}` : 'Create Custom Tenant List'}
      open={isOpen}
      onCancel={onClose}
      onOk={handleSave}
      okButtonProps={{ disabled: !canEdit || saving, loading: saving }}
      cancelButtonProps={{ disabled: saving }}
      okText={isEdit ? 'Save' : 'Create'}
      width={780}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Name is required' }]}
        >
          <Input disabled={!canEdit} placeholder="e.g., Delivery Methods" />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <Input.TextArea disabled={!canEdit} rows={2} placeholder="Optional description" />
        </Form.Item>

        <Form.Item label="Active" name="is_active" valuePropName="checked">
          <Switch disabled={!canEdit} />
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong>Options</Text>
            <Button icon={<PlusOutlined />} onClick={addOption} disabled={!canEdit}>
              Add option
            </Button>
          </Space>

          <Table
            rowKey="key"
            size="small"
            columns={columns}
            dataSource={options}
            pagination={false}
            locale={{ emptyText: 'No options yet' }}
          />

          {optionErrors.length > 0 && <Text type="danger">{optionErrors[0]}</Text>}
        </Space>
      </Form>
    </Modal>
  );
};
