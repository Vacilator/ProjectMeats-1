/**
 * Option Lists Management Page
 *
 * Manages SystemChoiceList and SystemChoiceItem from the system configuration app.
 *
 * Admin Workspace Finalization:
 * - AntD Tabs/Table/Card layout
 * - System Choice Lists vs Custom Tenant Lists
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

import { TenantChoiceOverride } from '@/components/Admin/TenantChoiceOverride';

import { OptionListModal } from './OptionListModal';
import { TenantListModal, type TenantList } from './TenantListModal';

const { Text } = Typography;

type ActiveTabKey = 'system' | 'custom' | 'overrides';

interface SystemChoiceList {
  id: string;
  slug: string;
  name: string;
  description: string;
  model_field_path: string;
  is_extensible: boolean;
  is_reorderable: boolean;
  items_count: number;
  created_at: string;
  updated_at: string;
}

type CustomTenantList = TenantList;

const OptionListsPage: React.FC = () => {
  const { permissions } = useAdminPermissions();
  const canEdit = permissions.can_manage_option_lists;
  const canView =
    canEdit ||
    permissions.role === 'manager' ||
    permissions.role === 'owner' ||
    permissions.role === 'admin' ||
    permissions.role === 'superuser';

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTabKey>('system');
  const [lists, setLists] = useState<SystemChoiceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingList, setEditingList] = useState<SystemChoiceList | null>(null);

  const [customLists, setCustomLists] = useState<CustomTenantList[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [editingCustomList, setEditingCustomList] = useState<CustomTenantList | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'system' || tab === 'custom' || tab === 'overrides') {
      setActiveTab(tab);
    }
    // Only run on mount / tab param change
  }, [searchParams]);

  useEffect(() => {
    if (!canView) return;
    void loadChoiceLists();
    void loadCustomLists();
  }, [canView]);

  const loadChoiceLists = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/system/choice-lists/');
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setLists(data);
    } catch (error) {
      console.error('Failed to load choice lists:', error);
      message.error('Failed to load system option lists');
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomLists = async () => {
    setCustomLoading(true);
    try {
      const response = await apiClient.get('/workflows/lists/');
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setCustomLists(data);
    } catch (error) {
      console.error('Failed to load custom tenant lists:', error);
      message.error('Failed to load custom tenant lists');
      setCustomLists([]);
    } finally {
      setCustomLoading(false);
    }
  };

  const filteredSystemLists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return lists;

    return lists.filter((list) => {
      const name = (list.name || '').toLowerCase();
      const slug = (list.slug || '').toLowerCase();
      const desc = (list.description || '').toLowerCase();
      return name.includes(q) || slug.includes(q) || desc.includes(q);
    });
  }, [lists, searchQuery]);

  const filteredCustomLists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customLists;

    return customLists.filter((list) => {
      const name = (list.name || '').toLowerCase();
      const desc = (list.description || '').toLowerCase();
      const id = String(list.id || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || id.includes(q);
    });
  }, [customLists, searchQuery]);

  const openCreateCustomList = () => {
    if (!canEdit) {
      showAlert({
        title: 'Access restricted',
        content: 'Only tenant administrators can create custom option lists.',
        type: 'info',
      });
      return;
    }

    setEditingCustomList(null);
    setCustomModalOpen(true);
  };

  const confirmDeleteCustomList = (record: CustomTenantList) => {
    if (!canEdit) {
      message.info('Only tenant administrators can delete custom option lists.');
      return;
    }

    void (async () => {
      const confirmed = await confirmDialog({
        title: `Delete custom list "${record.name}"?`,
        content: 'This will permanently delete the list and all of its options.',
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });

      if (!confirmed) return;

      try {
        await apiClient.delete(`/workflows/lists/${record.id}/`);
        message.success('Custom list deleted');
        await loadCustomLists();
      } catch (err: any) {
        message.error(err?.response?.data?.error || 'Failed to delete custom list');
      }
    })();
  };

  const systemColumns: ColumnsType<SystemChoiceList> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <code>{record.slug}</code>
          </Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string) => <Text type="secondary">{value || '—'}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Items',
      dataIndex: 'items_count',
      key: 'items_count',
      width: 90,
      render: (count: number) => <Text>{count}</Text>,
    },
    {
      title: 'Extensibility',
      dataIndex: 'is_extensible',
      key: 'is_extensible',
      width: 140,
      render: (isExtensible: boolean) =>
        isExtensible ? <Tag color="green">Extensible</Tag> : <Tag>System Locked</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_: unknown, record) => {
        const canAddItem = canEdit && record.is_extensible;
        return (
          <Space>
            <Button
              type={record.is_extensible ? 'default' : 'text'}
              onClick={() => setEditingList(record)}
            >
              {record.is_extensible ? 'Manage Items' : 'View Items'}
            </Button>
            {record.is_extensible && (
              <Button
                type="primary"
                disabled={!canAddItem}
                onClick={() => {
                  if (!canAddItem) {
                    message.info('You do not have permission to add tenant items to this list.');
                    return;
                  }
                  setEditingList(record);
                }}
              >
                Add Item
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const customColumns: ColumnsType<CustomTenantList> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <code>{record.id}</code>
          </Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | undefined) => <Text type="secondary">{value || '—'}</Text>,
    },
    {
      title: 'Items',
      dataIndex: 'option_count',
      key: 'option_count',
      width: 90,
      render: (count: number) => <Text>{count ?? 0}</Text>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (iso: string) => <Text>{iso ? new Date(iso).toLocaleDateString() : '—'}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: unknown, record) => (
        <Space>
          <Button
            type="default"
            disabled={!canEdit}
            onClick={() => {
              setEditingCustomList(record);
              setCustomModalOpen(true);
            }}
          >
            Edit
          </Button>
          <Button danger disabled={!canEdit} onClick={() => confirmDeleteCustomList(record)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AdminPage
      title="Option Lists"
      description="Manage dropdown choice lists. System lists may be locked; extensible lists support tenant-specific additions."
      icon="📋"
      headerExtras={
        <Space wrap>
          {activeTab === 'custom' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCustomList}>
              Create Custom List
            </Button>
          )}
          <Input.Search
            allowClear
            placeholder="Search by name, slug, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 320 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void loadChoiceLists();
              void loadCustomLists();
            }}
            loading={loading || customLoading}
          />
        </Space>
      }
    >
      <AdminGuard
        feature="option_lists"
        allow={(p) =>
          p.can_manage_option_lists ||
          p.role === 'manager' ||
          p.role === 'owner' ||
          p.role === 'admin' ||
          p.role === 'superuser'
        }
        loadingFallback={<LoadingSkeleton type="card" rows={2} />}
      >
        {loading ? (
          <LoadingSkeleton type="card" rows={3} />
        ) : (
          <Card>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                const next = key as ActiveTabKey;
                setActiveTab(next);

                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('tab', next);
                setSearchParams(nextParams, { replace: true });
              }}
              items={[
                {
                  key: 'system',
                  label: 'System Choice Lists',
                  children: (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Card size="small" title="Master Products">
                        <Text type="secondary">
                          Tier 1 system catalog used across product selectors. This is seeded and maintained centrally.
                        </Text>
                      </Card>

                      {filteredSystemLists.length === 0 ? (
                        <EmptyState
                          icon="📋"
                          title={searchQuery ? 'No matches' : 'No option lists'}
                          message={
                            searchQuery
                              ? 'No system choice lists match your search.'
                              : 'No system choice lists were returned.'
                          }
                        />
                      ) : (
                        <Table
                          rowKey="id"
                          columns={systemColumns}
                          dataSource={filteredSystemLists}
                          pagination={{ pageSize: 10, showSizeChanger: true }}
                        />
                      )}
                    </Space>
                  ),
                },
                {
                  key: 'custom',
                  label: 'Custom Tenant Lists',
                  children:
                    filteredCustomLists.length === 0 ? (
                      <EmptyState
                        icon="🧩"
                        title={searchQuery ? 'No matches' : 'No custom lists yet'}
                        message={
                          searchQuery
                            ? 'No custom tenant lists match your search.'
                            : 'Create custom tenant lists for workflow-specific dropdown fields.'
                        }
                      />
                    ) : (
                      <Table
                        rowKey="id"
                        columns={customColumns}
                        dataSource={filteredCustomLists}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        loading={customLoading}
                      />
                    ),
                },
                {
                  key: 'overrides',
                  label: 'Tenant Overrides',
                  children: !permissions.tenant_id ? (
                    <EmptyState
                      icon="🏢"
                      title="Tenant unavailable"
                      message="We couldn't resolve the current tenant for overrides. Try reloading the page."
                    />
                  ) : permissions.can_manage_customizations ? (
                    <TenantChoiceOverride tenantId={String(permissions.tenant_id)} />
                  ) : (
                    <EmptyState
                      icon="🔒"
                      title="No access"
                      message="Only tenant administrators can manage choice list overrides."
                    />
                  ),
                },
              ]}
            />
          </Card>
        )}

        {editingList && (
          <OptionListModal
            listSlug={editingList.slug}
            listName={editingList.name}
            isExtensible={editingList.is_extensible}
            isReorderable={editingList.is_reorderable}
            isOpen={!!editingList}
            onClose={() => setEditingList(null)}
            onSave={() => {
              void loadChoiceLists();
              setEditingList(null);
            }}
          />
        )}

        <TenantListModal
          isOpen={customModalOpen}
          canEdit={canEdit}
          initial={editingCustomList}
          onClose={() => {
            setCustomModalOpen(false);
            setEditingCustomList(null);
          }}
          onSaved={() => void loadCustomLists()}
        />
      </AdminGuard>
    </AdminPage>
  );
};

export default OptionListsPage;
