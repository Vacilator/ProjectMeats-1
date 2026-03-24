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

interface CustomTenantList {
  id: string;
  slug: string;
  name: string;
  description?: string;
  items_count: number;
  updated_at: string;
}

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

  // Mock data placeholder for Custom Tenant Lists (workflow-specific dropdowns)
  const [customLists] = useState<CustomTenantList[]>([]);

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
      message.error('Failed to load option lists');
      setLists([]);
    } finally {
      setLoading(false);
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
      const slug = (list.slug || '').toLowerCase();
      const desc = (list.description || '').toLowerCase();
      return name.includes(q) || slug.includes(q) || desc.includes(q);
    });
  }, [customLists, searchQuery]);

  const openCreateCustomList = () => {
    Modal.info({
      title: 'Create Custom Tenant List (Coming Soon)',
      content: (
        <div>
          <p>
            Custom Tenant Lists will support workflow-specific dropdown fields (tenant-owned choice lists).
          </p>
          <p>
            For now, this is a placeholder. If/when a TenantListModal exists, we can wire it here.
          </p>
        </div>
      ),
    });
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
            <code>{record.slug}</code>
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
      dataIndex: 'items_count',
      key: 'items_count',
      width: 90,
      render: (count: number) => <Text>{count}</Text>,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (iso: string) => <Text>{iso ? new Date(iso).toLocaleDateString() : '—'}</Text>,
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
          <Button icon={<ReloadOutlined />} onClick={loadChoiceLists} loading={loading} />
        </Space>
      }
    >
      <AdminGuard
        feature="option_lists"
        allow={(p) => p.can_manage_option_lists || p.role === 'manager'}
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
                  children:
                    filteredSystemLists.length === 0 ? (
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
                    ),
                },
                {
                  key: 'custom',
                  label: 'Custom Tenant Lists',
                  children:
                    filteredCustomLists.length === 0 ? (
                      <EmptyState
                        icon="🧩"
                        title="No custom lists yet"
                        message="Create custom tenant lists for workflow-specific dropdown fields."
                      />
                    ) : (
                      <Table
                        rowKey="id"
                        columns={customColumns}
                        dataSource={filteredCustomLists}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
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
      </AdminGuard>
    </AdminPage>
  );
};

export default OptionListsPage;
