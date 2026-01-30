/**
 * Option Lists Management Page
 * 
 * Allows admins to manage:
 * - System option lists (global)
 * - Tenant-specific option lists
 * - Entity field choice overrides
 * - Audit history of changes
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, Tabs, Card, 
  Typography, message, Popconfirm, Tooltip, Badge, Empty, Spin, Timeline
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined,
  TeamOutlined, SettingOutlined, ReloadOutlined, SearchOutlined,
  HistoryOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import optionListsService, {
  FieldOptionList, TenantList, ChoiceOverride, OptionItem,
  EntityChoiceFields, UnifiedOptionList, AuditLogEntry, TenantInfo
} from '../../../services/optionListsService';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

// Option editor component for managing {value, label} pairs
const OptionEditor: React.FC<{
  value?: OptionItem[];
  onChange?: (value: OptionItem[]) => void;
}> = ({ value = [], onChange }) => {
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    // Convert options array to text format (one per line)
    const text = value.map(opt => 
      opt.value === opt.label ? opt.label : `${opt.value}|${opt.label}`
    ).join('\n');
    setTextValue(text);
  }, [value]);

  const handleTextChange = (text: string) => {
    setTextValue(text);
    // Parse text to options
    const lines = text.split('\n').filter(line => line.trim());
    const options = lines.map(line => {
      if (line.includes('|')) {
        const [val, label] = line.split('|', 2);
        return { value: val.trim(), label: label.trim() };
      }
      return { value: line.trim(), label: line.trim() };
    });
    onChange?.(options);
  };

  return (
    <div>
      <TextArea
        rows={8}
        value={textValue}
        onChange={e => handleTextChange(e.target.value)}
        placeholder="Enter options (one per line)&#10;Format: value|label or just value&#10;&#10;Example:&#10;beef|Beef&#10;pork|Pork&#10;chicken|Chicken"
      />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {value.length} options • Use "value|label" for custom values, or just text for same value/label
      </Text>
    </div>
  );
};

// System Option Lists Tab
const SystemListsTab: React.FC = () => {
  const [lists, setLists] = useState<FieldOptionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingList, setEditingList] = useState<FieldOptionList | null>(null);
  const [form] = Form.useForm();

  const loadLists = async () => {
    setLoading(true);
    try {
      const data = await optionListsService.getSystemOptionLists();
      setLists(data);
    } catch (err) {
      message.error('Failed to load option lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editingList) {
        await optionListsService.updateSystemOptionList(editingList.id, values);
        message.success('Option list updated');
      } else {
        await optionListsService.createSystemOptionList(values);
        message.success('Option list created');
      }
      setModalVisible(false);
      setEditingList(null);
      form.resetFields();
      loadLists();
    } catch (err) {
      message.error('Failed to save option list');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await optionListsService.deleteSystemOptionList(id);
      message.success('Option list deleted');
      loadLists();
    } catch (err) {
      message.error('Failed to delete option list');
    }
  };

  const columns: ColumnsType<FieldOptionList> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <span>{name}</span>
          {record.is_system && <Tag color="blue">System</Tag>}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Options',
      dataIndex: 'option_count',
      key: 'option_count',
      width: 100,
      render: count => <Badge count={count} showZero color="#52c41a" />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingList(record);
                form.setFieldsValue(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          {!record.is_system && (
            <Popconfirm
              title="Delete this option list?"
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="Delete">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">
          System-wide option lists available to all tenants
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadLists}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingList(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Create Option List
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={lists}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingList ? 'Edit Option List' : 'Create Option List'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingList(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Protein Types, Payment Terms" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={2} placeholder="Describe what this list is used for" />
          </Form.Item>

          <Form.Item
            name="options"
            label="Options"
            rules={[{ required: true, message: 'Please add at least one option' }]}
          >
            <OptionEditor />
          </Form.Item>

          <Form.Item
            name="is_system"
            valuePropName="checked"
            initialValue={false}
          >
            <Select options={[
              { value: false, label: 'Custom List (can be deleted)' },
              { value: true, label: 'System List (protected)' },
            ]} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingList ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// Entity Field Overrides Tab
const EntityOverridesTab: React.FC = () => {
  const [overrides, setOverrides] = useState<ChoiceOverride[]>([]);
  const [entityFields, setEntityFields] = useState<EntityChoiceFields[]>([]);
  const [systemLists, setSystemLists] = useState<FieldOptionList[]>([]);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ChoiceOverride | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [overridesData, fieldsData, listsData, tenantsData] = await Promise.all([
        optionListsService.getChoiceOverrides(),
        optionListsService.getEntityChoiceFields(),
        optionListsService.getSystemOptionLists(),
        optionListsService.getTenants().catch(() => []),
      ]);
      setOverrides(overridesData);
      setEntityFields(fieldsData.entities);
      setSystemLists(listsData);
      setTenants(tenantsData);
    } catch (err) {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (values: any) => {
    try {
      // If using an option list, clear inline options
      if (values.option_list) {
        values.options = [];
      }
      
      if (editingOverride) {
        await optionListsService.updateChoiceOverride(editingOverride.id, values);
        message.success('Override updated');
      } else {
        await optionListsService.createChoiceOverride(values);
        message.success('Override created');
      }
      setModalVisible(false);
      setEditingOverride(null);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to save override');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await optionListsService.deleteChoiceOverride(id);
      message.success('Override deleted');
      loadData();
    } catch (err) {
      message.error('Failed to delete override');
    }
  };

  // Build entity.field options for select
  const entityFieldOptions = useMemo(() => {
    return entityFields.flatMap(entity =>
      entity.choice_fields.map(field => ({
        value: `${entity.entity_type}|${field.name}`,
        label: `${entity.entity_type}.${field.name}`,
        entity: entity.entity_type,
        field: field.name,
      }))
    );
  }, [entityFields]);

  const columns: ColumnsType<ChoiceOverride> = [
    {
      title: 'Entity.Field',
      key: 'entity_field',
      render: (_, record) => (
        <Space>
          <Tag color="purple">{record.entity_type}</Tag>
          <span>{record.field_name}</span>
        </Space>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'tenant_name',
      key: 'scope',
      render: (name) => name ? (
        <Tag icon={<TeamOutlined />} color="green">{name}</Tag>
      ) : (
        <Tag icon={<GlobalOutlined />} color="blue">System Default</Tag>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode_display',
      key: 'mode',
    },
    {
      title: 'Options',
      dataIndex: 'option_count',
      key: 'options',
      render: (count, record) => (
        <Space>
          <Badge count={count} showZero color="#52c41a" />
          {record.option_list_name && (
            <Tag color="cyan">from: {record.option_list_name}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: active => active ? 
        <Tag color="success">Active</Tag> : 
        <Tag color="default">Inactive</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingOverride(record);
                form.setFieldsValue({
                  ...record,
                  entity_field: `${record.entity_type}|${record.field_name}`,
                });
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this override?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">
          Override default choices for entity fields (e.g., Product.protein_type)
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingOverride(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Create Override
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : overrides.length === 0 ? (
        <Empty description="No overrides configured">
          <Button type="primary" onClick={() => setModalVisible(true)}>
            Create First Override
          </Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={overrides}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )}

      <Modal
        title={editingOverride ? 'Edit Override' : 'Create Override'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingOverride(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="entity_field"
            label="Entity & Field"
            rules={[{ required: true, message: 'Select entity and field' }]}
          >
            <Select
              showSearch
              placeholder="Select entity.field"
              options={entityFieldOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(value) => {
                const [entity, field] = value.split('|');
                form.setFieldsValue({ entity_type: entity, field_name: field });
              }}
              disabled={!!editingOverride}
            />
          </Form.Item>

          {/* Hidden fields for actual values */}
          <Form.Item name="entity_type" hidden><Input /></Form.Item>
          <Form.Item name="field_name" hidden><Input /></Form.Item>

          <Form.Item
            name="tenant"
            label="Scope"
            help="Leave empty for system-wide default, or select tenant for tenant-specific override"
          >
            <Select
              allowClear
              placeholder="System Default (all tenants)"
              options={[
                { value: null, label: '🌐 System Default (applies to all tenants)' },
                ...tenants.map(t => ({ value: t.id, label: `🏢 ${t.name}` }))
              ]}
            />
          </Form.Item>

          <Form.Item
            name="mode"
            label="Override Mode"
            initialValue="replace"
            rules={[{ required: true }]}
          >
            <Select options={[
              { value: 'replace', label: '🔄 Replace All - Completely replace default options' },
              { value: 'append', label: '➕ Append - Add to end of default options' },
              { value: 'prepend', label: '⬆️ Prepend - Add before default options' },
              { value: 'filter', label: '🔍 Filter - Show only specified options from defaults' },
            ]} />
          </Form.Item>

          <Form.Item
            name="option_list"
            label="Use Existing Option List"
            help="Select a pre-defined option list, or leave empty to define inline"
          >
            <Select
              allowClear
              placeholder="(Define inline options below)"
              options={systemLists.map(list => ({
                value: list.id,
                label: `${list.name} (${list.option_count} options)`,
              }))}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.option_list !== curr.option_list}
          >
            {({ getFieldValue }) => 
              !getFieldValue('option_list') && (
                <Form.Item
                  name="options"
                  label="Inline Options"
                  rules={[{ required: true, message: 'Add options or select an option list' }]}
                >
                  <OptionEditor />
                </Form.Item>
              )
            }
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Status"
            initialValue={true}
          >
            <Select options={[
              { value: true, label: '✅ Active' },
              { value: false, label: '⏸️ Inactive' },
            ]} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingOverride ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// Tenant Lists Tab
const TenantListsTab: React.FC = () => {
  const [lists, setLists] = useState<TenantList[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingList, setEditingList] = useState<TenantList | null>(null);
  const [form] = Form.useForm();

  const loadLists = async () => {
    setLoading(true);
    try {
      const data = await optionListsService.getTenantLists();
      setLists(data);
    } catch (err) {
      message.error('Failed to load tenant lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editingList) {
        await optionListsService.updateTenantList(editingList.id, values);
        message.success('Tenant list updated');
      } else {
        await optionListsService.createTenantList(values);
        message.success('Tenant list created');
      }
      setModalVisible(false);
      setEditingList(null);
      form.resetFields();
      loadLists();
    } catch (err) {
      message.error('Failed to save tenant list');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await optionListsService.deleteTenantList(id);
      message.success('Tenant list deleted');
      loadLists();
    } catch (err) {
      message.error('Failed to delete tenant list');
    }
  };

  const columns: ColumnsType<TenantList> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Options',
      key: 'options',
      width: 100,
      render: (_, record) => (
        <Badge count={record.options?.length || 0} showZero color="#52c41a" />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: active => active ? 
        <Tag color="success">Active</Tag> : 
        <Tag color="default">Inactive</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingList(record);
                form.setFieldsValue(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this tenant list?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">
          Option lists specific to your tenant (not shared with other tenants)
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadLists}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingList(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Create Tenant List
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={lists}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingList ? 'Edit Tenant List' : 'Create Tenant List'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingList(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Custom Categories, Special Options" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={2} placeholder="Describe what this list is used for" />
          </Form.Item>

          <Form.Item
            name="options"
            label="Options"
            rules={[{ required: true, message: 'Please add at least one option' }]}
          >
            <OptionEditor />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Status"
            initialValue={true}
          >
            <Select options={[
              { value: true, label: '✅ Active' },
              { value: false, label: '⏸️ Inactive' },
            ]} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingList ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// Audit History Tab
const AuditHistoryTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await optionListsService.getAuditLogs({
        entity_type: entityFilter,
        action: actionFilter,
        limit: 100,
      });
      setLogs(data);
    } catch (err) {
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter, actionFilter]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'update': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'delete': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'activate': return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
      case 'deactivate': return <CloseCircleOutlined style={{ color: '#8c8c8c' }} />;
      default: return <HistoryOutlined />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'green';
      case 'update': return 'orange';
      case 'delete': return 'red';
      case 'activate': return 'blue';
      case 'deactivate': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Time',
      dataIndex: 'performed_at',
      key: 'performed_at',
      width: 180,
      render: date => formatDate(date),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action, record) => (
        <Space>
          {getActionIcon(action)}
          <Tag color={getActionColor(action)}>{record.action_display}</Tag>
        </Space>
      ),
    },
    {
      title: 'Entity.Field',
      key: 'entity_field',
      render: (_, record) => (
        <Space>
          <Tag color="purple">{record.entity_type}</Tag>
          <span>{record.field_name}</span>
        </Space>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
      render: (name) => name ? (
        <Tag icon={<TeamOutlined />} color="green">{name}</Tag>
      ) : (
        <Tag icon={<GlobalOutlined />} color="blue">System</Tag>
      ),
    },
    {
      title: 'User',
      dataIndex: 'performed_by_name',
      key: 'performed_by_name',
      render: name => name || <Text type="secondary">System</Text>,
    },
    {
      title: 'Changes',
      key: 'changes',
      ellipsis: true,
      render: (_, record) => {
        if (record.changes && record.changes.length > 0) {
          return (
            <Tooltip title={record.changes.map(c => `${c.field}: ${c.old} → ${c.new}`).join(', ')}>
              <Text type="secondary">{record.changes.length} field(s) changed</Text>
            </Tooltip>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
  ];

  // Get unique entity types for filter
  const entityTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.entity_type));
    return Array.from(types).sort();
  }, [logs]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Text type="secondary">Audit trail of all choice override changes</Text>
        </Space>
        <Space>
          <Select
            allowClear
            placeholder="Filter by entity"
            style={{ width: 150 }}
            value={entityFilter}
            onChange={setEntityFilter}
            options={entityTypes.map(t => ({ value: t, label: t }))}
          />
          <Select
            allowClear
            placeholder="Filter by action"
            style={{ width: 150 }}
            value={actionFilter}
            onChange={setActionFilter}
            options={[
              { value: 'create', label: 'Created' },
              { value: 'update', label: 'Updated' },
              { value: 'delete', label: 'Deleted' },
              { value: 'activate', label: 'Activated' },
              { value: 'deactivate', label: 'Deactivated' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadLogs}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {record.changes && record.changes.length > 0 && (
                  <div>
                    <Text strong>Changes:</Text>
                    <Timeline style={{ marginTop: 8 }}>
                      {record.changes.map((change, idx) => (
                        <Timeline.Item key={idx}>
                          <Text code>{change.field}</Text>: {' '}
                          <Text delete type="secondary">{JSON.stringify(change.old)}</Text>
                          {' → '}
                          <Text type="success">{JSON.stringify(change.new)}</Text>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </div>
                )}
                {record.ip_address && (
                  <Text type="secondary">IP: {record.ip_address}</Text>
                )}
              </Space>
            </div>
          ),
        }}
      />
    </div>
  );
};

// Main component
const OptionListsPage: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <SettingOutlined /> Option Lists
        </Title>
        <Text type="secondary">
          Manage dropdown options for select fields across the system.
          Changes here affect form dropdowns throughout the application.
        </Text>
      </div>

      <Card>
        <Tabs defaultActiveKey="system">
          <TabPane
            tab={
              <span>
                <GlobalOutlined /> System Lists
              </span>
            }
            key="system"
          >
            <SystemListsTab />
          </TabPane>
          <TabPane
            tab={
              <span>
                <TeamOutlined /> Tenant Lists
              </span>
            }
            key="tenant"
          >
            <TenantListsTab />
          </TabPane>
          <TabPane
            tab={
              <span>
                <SettingOutlined /> Entity Field Overrides
              </span>
            }
            key="overrides"
          >
            <EntityOverridesTab />
          </TabPane>
          <TabPane
            tab={
              <span>
                <HistoryOutlined /> Audit History
              </span>
            }
            key="audit"
          >
            <AuditHistoryTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default OptionListsPage;
