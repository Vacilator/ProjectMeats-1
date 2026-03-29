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
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { getChoices, type ChoiceOption } from '@/services/choicesService';

import { TenantChoiceOverride } from '@/components/Admin/TenantChoiceOverride';

import { OptionListModal } from './OptionListModal';
import { TenantListModal, type TenantList } from './TenantListModal';

const { Text } = Typography;

type ActiveTabKey = 'system' | 'custom' | 'overrides';

interface MasterProduct {
  id: string;
  product_code: string;
  name: string;
  description?: string;
  category?: string;
  protein_type?: string;
  fresh_or_frozen?: string;
  package_type?: string;
  carton_type?: string;
  unit_weight?: string | number | null;
  uom?: string;
  tested_product?: boolean;
  is_active?: boolean;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TenantProductPreference {
  id: string;
  product: string;
  product_code?: string;
  product_name?: string;
  display_name?: string;
  internal_code?: string;
  notes?: string;
  default_price?: string | number | null;
  default_cost?: string | number | null;
  is_active?: boolean;
  is_favorite?: boolean;
  sort_order?: number;
  updated_at?: string;
}

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

  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [proteinChoices, setProteinChoices] = useState<ChoiceOption[]>([]);

  // Tenant overrides for master products (TenantProductPreference)
  const [productPreferences, setProductPreferences] = useState<Record<string, TenantProductPreference>>({});
  const [productPrefsLoading, setProductPrefsLoading] = useState(false);
  const [productPrefModalOpen, setProductPrefModalOpen] = useState(false);
  const [editingProductPref, setEditingProductPref] = useState<{
    product: MasterProduct;
    pref: TenantProductPreference | null;
  } | null>(null);
  const [savingProductPref, setSavingProductPref] = useState(false);

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

  const canEditProducts = permissions.role === 'superuser';

  useEffect(() => {
    if (!canView) return;
    void loadChoiceLists();
    void loadCustomLists();
    void loadMasterProducts();
    void loadProductPreferences();
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

  const loadMasterProducts = async () => {
    setProductsLoading(true);
    try {
      const response = await apiClient.get('/system/products/', {
        params: {
          include_inactive: true,
          page_size: 500,
        },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setProducts(data);
    } catch (error) {
      console.error('Failed to load master products:', error);
      message.error('Failed to load master products');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadProductPreferences = async () => {
    if (!permissions.tenant_id) {
      setProductPreferences({});
      return;
    }

    setProductPrefsLoading(true);
    try {
      const response = await apiClient.get('/system/product-preferences/', {
        params: { page_size: 2000 },
      });
      const raw = response.data as any;
      const data: TenantProductPreference[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.results)
          ? raw.results
          : [];

      const next: Record<string, TenantProductPreference> = {};
      for (const row of data) {
        if (!row?.product) continue;
        next[String(row.product)] = row;
      }
      setProductPreferences(next);
    } catch (error) {
      console.error('Failed to load tenant product preferences:', error);
      message.error('Failed to load tenant product overrides');
      setProductPreferences({});
    } finally {
      setProductPrefsLoading(false);
    }
  };

  const canEditProductOverrides = Boolean(permissions.can_manage_customizations);

  const upsertProductPreference = async (
    productId: string,
    patch: Partial<TenantProductPreference>
  ): Promise<boolean> => {
    if (!canEditProductOverrides) {
      message.info('Only tenant administrators can edit product overrides.');
      return;
    }

    const pid = String(productId || '').trim();
    if (!pid) return;

    const existing = productPreferences[pid];
    try {
      if (existing?.id) {
        const payload: Record<string, unknown> = {
          display_name: patch.display_name ?? existing.display_name ?? '',
          internal_code: patch.internal_code ?? existing.internal_code ?? '',
          notes: patch.notes ?? existing.notes ?? '',
          default_price: patch.default_price ?? existing.default_price ?? null,
          default_cost: patch.default_cost ?? existing.default_cost ?? null,
          is_active: patch.is_active ?? existing.is_active ?? true,
          is_favorite: patch.is_favorite ?? existing.is_favorite ?? false,
          sort_order: patch.sort_order ?? existing.sort_order ?? 0,
        };

        const resp = await apiClient.patch(`/system/product-preferences/${existing.id}/`, payload);
        const updated = resp.data as TenantProductPreference;
        setProductPreferences((prev) => ({ ...prev, [pid]: updated }));
        return;
      }

      const payload: Record<string, unknown> = {
        product: pid,
        display_name: patch.display_name ?? '',
        internal_code: patch.internal_code ?? '',
        notes: patch.notes ?? '',
        default_price: patch.default_price ?? null,
        default_cost: patch.default_cost ?? null,
        is_active: patch.is_active ?? true,
        is_favorite: patch.is_favorite ?? false,
        sort_order: patch.sort_order ?? 0,
      };

      const resp = await apiClient.post('/system/product-preferences/', payload);
      const created = resp.data as TenantProductPreference;
      setProductPreferences((prev) => ({ ...prev, [pid]: created }));
    } catch (err: any) {
      message.error(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to save product override');
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

  const filteredMasterProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;

    return products.filter((p) => {
      const code = String(p.product_code || '').toLowerCase();
      const name = String(p.name || '').toLowerCase();
      const protein = String(p.protein_type || '').toLowerCase();
      const category = String(p.category || '').toLowerCase();
      return code.includes(q) || name.includes(q) || protein.includes(q) || category.includes(q);
    });
  }, [products, searchQuery]);

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

  const [productForm] = Form.useForm();
  const [productPrefForm] = Form.useForm();

  useEffect(() => {
    if (!productModalOpen) return;

    void (async () => {
      try {
        const opts = await getChoices('protein_type');
        setProteinChoices(opts);
      } catch {
        setProteinChoices([]);
      }
    })();
  }, [productModalOpen]);

  useEffect(() => {
    if (!productPrefModalOpen) return;
    if (!editingProductPref) return;

    const product = editingProductPref.product;
    const pref = editingProductPref.pref;

    productPrefForm.setFieldsValue({
      is_active: pref ? Boolean(pref.is_active) : Boolean(product.is_active ?? true),
      display_name: pref?.display_name ?? '',
      internal_code: pref?.internal_code ?? '',
      default_price: pref?.default_price ?? null,
      default_cost: pref?.default_cost ?? null,
      is_favorite: Boolean(pref?.is_favorite ?? false),
      sort_order: pref?.sort_order ?? 0,
      notes: pref?.notes ?? '',
    });
  }, [editingProductPref, productPrefForm, productPrefModalOpen]);

  useEffect(() => {
    if (!productModalOpen) return;

    if (editingProduct) {
      productForm.setFieldsValue({
        product_code: editingProduct.product_code,
        name: editingProduct.name,
        protein_type: editingProduct.protein_type || '',
        category: editingProduct.category || 'OTHER',
        is_active: Boolean(editingProduct.is_active ?? true),
        is_system: Boolean(editingProduct.is_system ?? true),
      });
      return;
    }

    productForm.resetFields();
    productForm.setFieldsValue({
      product_code: '',
      name: '',
      protein_type: '',
      category: 'OTHER',
      is_active: true,
      is_system: true,
    });
  }, [editingProduct, productForm, productModalOpen]);

  const handleSaveProduct = async (values: any) => {
    if (!canEditProducts) {
      message.info('Only superusers can modify master products.');
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        product_code: String(values.product_code || '').trim(),
        name: String(values.name || '').trim(),
        protein_type: String(values.protein_type || '').trim() || '',
        category: String(values.category || 'OTHER'),
        is_active: Boolean(values.is_active),
        is_system: Boolean(values.is_system),
      };

      if (editingProduct?.id) {
        await apiClient.patch(`/system/products/${editingProduct.id}/`, payload);
        message.success('Product updated');
      } else {
        await apiClient.post('/system/products/', payload);
        message.success('Product created');
      }

      setProductModalOpen(false);
      setEditingProduct(null);
      await loadMasterProducts();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };

  const productColumns: ColumnsType<MasterProduct> = [
    {
      title: 'Code',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 160,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => {
        const pref = productPreferences[String(record.id)];
        const overrideName = String(pref?.display_name || '').trim();
        return (
          <Space direction="vertical" size={0}>
            <Text>{value}</Text>
            {overrideName ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tenant override: <strong>{overrideName}</strong>
              </Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: 'Tenant Active',
      key: 'tenant_active',
      width: 130,
      render: (_: unknown, record) => {
        const pref = productPreferences[String(record.id)];
        const tenantActive = pref ? Boolean(pref.is_active) : Boolean(record.is_active ?? true);
        return (
          <Switch
            checked={tenantActive}
            disabled={!canEditProductOverrides}
            onChange={(checked) => void upsertProductPreference(String(record.id), { is_active: checked })}
          />
        );
      },
    },
    {
      title: 'Protein',
      dataIndex: 'protein_type',
      key: 'protein_type',
      width: 120,
      render: (value: string) => <Text type="secondary">{value || '—'}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (value: string) => <Text type="secondary">{value || '—'}</Text>,
      responsive: ['md'],
    },
    {
      title: 'System Active',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      render: (isActive: boolean) => (isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
      responsive: ['md'],
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_: unknown, record) => (
        <Space>
          <Button
            type="default"
            disabled={!canEditProductOverrides}
            onClick={() => {
              setEditingProductPref({ product: record, pref: productPreferences[String(record.id)] ?? null });
              setProductPrefModalOpen(true);
            }}
          >
            Tenant Override
          </Button>
          <Button
            type="default"
            disabled={!canEditProducts}
            onClick={() => {
              setEditingProduct(record);
              setProductModalOpen(true);
            }}
          >
            Edit System
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
          {activeTab === 'system' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!canEditProducts}
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
            >
              Add Product
            </Button>
          )}
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
              void loadMasterProducts();
              void loadProductPreferences();
            }}
            loading={loading || customLoading || productsLoading || productPrefsLoading}
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
                      <Card
                        size="small"
                        title="Master Products"
                        extra={
                          <Space size="small">
                            {canEditProductOverrides ? (
                              <Tag color="blue">Tenant overrides</Tag>
                            ) : (
                              <Tag>Tenant overrides (view)</Tag>
                            )}
                            {canEditProducts ? <Tag color="green">System editable</Tag> : <Tag>System locked</Tag>}
                          </Space>
                        }
                      >
                        <Text type="secondary">
                          System products power product selectors (Inquiry products, workflow quick create, etc.).
                          {canEditProductOverrides
                            ? ' Tenant admins can override display/pricing/active per tenant without changing the system catalog.'
                            : ' Tenant overrides are read-only for your role.'}
                        </Text>
                        <Divider style={{ margin: '12px 0' }} />

                        {productsLoading || productPrefsLoading ? (
                          <LoadingSkeleton type="card" rows={2} />
                        ) : filteredMasterProducts.length === 0 ? (
                          <EmptyState
                            icon="📦"
                            title={searchQuery ? 'No matches' : 'No products returned'}
                            message={
                              searchQuery
                                ? 'No master products match your search.'
                                : 'No master products were returned from the API.'
                            }
                          />
                        ) : (
                          <Table
                            rowKey="id"
                            columns={productColumns}
                            dataSource={filteredMasterProducts}
                            pagination={{ pageSize: 10, showSizeChanger: true }}
                          />
                        )}
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

        <Modal
          open={productPrefModalOpen}
          title="Tenant Product Override"
          onCancel={() => {
            if (savingProductPref) return;
            setProductPrefModalOpen(false);
            setEditingProductPref(null);
          }}
          okText={savingProductPref ? 'Saving…' : 'Save'}
          okButtonProps={{
            loading: savingProductPref,
            disabled: savingProductPref || !canEditProductOverrides,
          }}
          cancelButtonProps={{ disabled: savingProductPref }}
          onOk={() => productPrefForm.submit()}
          destroyOnClose
          footer={(() => {
            const hasOverride = Boolean(editingProductPref?.pref?.id);
            const canRemove = hasOverride && canEditProductOverrides;

            return [
              canRemove ? (
                <Button
                  key="remove"
                  danger
                  disabled={savingProductPref}
                  onClick={() => {
                    const productId = String(editingProductPref?.product?.id || '');
                    if (!productId) return;

                    Modal.confirm({
                      title: 'Remove tenant override?',
                      content: 'This will revert this product to system defaults for your tenant.',
                      okText: 'Remove override',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancel',
                      onOk: async () => {
                        setSavingProductPref(true);
                        const ok = await deleteProductPreference(productId);
                        setSavingProductPref(false);
                        if (!ok) return;
                        message.success('Override removed');
                        setProductPrefModalOpen(false);
                        setEditingProductPref(null);
                      },
                    });
                  }}
                >
                  Remove override
                </Button>
              ) : null,
              <Button
                key="cancel"
                disabled={savingProductPref}
                onClick={() => {
                  setProductPrefModalOpen(false);
                  setEditingProductPref(null);
                }}
              >
                Cancel
              </Button>,
              <Button
                key="save"
                type="primary"
                loading={savingProductPref}
                disabled={savingProductPref || !canEditProductOverrides}
                onClick={() => productPrefForm.submit()}
              >
                Save
              </Button>,
            ].filter(Boolean);
          })()}
        >
          {!editingProductPref ? (
            <EmptyState icon="📦" title="No product selected" message="Select a product to edit tenant overrides." />
          ) : (
            <Form
              form={productPrefForm}
              layout="vertical"
              onFinish={async (values) => {
                if (!editingProductPref) return;
                const productId = String(editingProductPref.product.id);

                setSavingProductPref(true);
                const ok = await upsertProductPreference(productId, {
                  is_active: Boolean(values.is_active),
                  display_name: String(values.display_name || '').trim(),
                  internal_code: String(values.internal_code || '').trim(),
                  default_price: values.default_price ?? null,
                  default_cost: values.default_cost ?? null,
                  is_favorite: Boolean(values.is_favorite),
                  sort_order: Number(values.sort_order ?? 0),
                  notes: String(values.notes || '').trim(),
                });
                setSavingProductPref(false);

                if (!ok) return;
                message.success('Override saved');
                setProductPrefModalOpen(false);
                setEditingProductPref(null);
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {editingProductPref.product.product_code} — {editingProductPref.product.name}
                  </Text>
                  <Text type="secondary">
                    These settings apply only to your current tenant. System catalog fields are unchanged.
                  </Text>
                </Space>
              </div>

              <Form.Item name="is_active" label="Tenant Active" valuePropName="checked">
                <Switch disabled={!canEditProductOverrides || savingProductPref} />
              </Form.Item>

              <Form.Item name="display_name" label="Display Name (override)">
                <Input placeholder="Leave blank to use system name" disabled={!canEditProductOverrides || savingProductPref} />
              </Form.Item>

              <Form.Item name="internal_code" label="Internal Code (tenant)" >
                <Input placeholder="Optional" disabled={!canEditProductOverrides || savingProductPref} />
              </Form.Item>

              <Space size="large" style={{ width: '100%' }} wrap>
                <Form.Item name="default_price" label="Default Price" style={{ minWidth: 180 }}>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="Optional"
                    disabled={!canEditProductOverrides || savingProductPref}
                  />
                </Form.Item>

                <Form.Item name="default_cost" label="Default Cost" style={{ minWidth: 180 }}>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="Optional"
                    disabled={!canEditProductOverrides || savingProductPref}
                  />
                </Form.Item>

                <Form.Item name="sort_order" label="Sort Order" style={{ minWidth: 140 }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    disabled={!canEditProductOverrides || savingProductPref}
                  />
                </Form.Item>
              </Space>

              <Form.Item name="is_favorite" label="Favorite" valuePropName="checked">
                <Switch disabled={!canEditProductOverrides || savingProductPref} />
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  placeholder="Optional"
                  disabled={!canEditProductOverrides || savingProductPref}
                />
              </Form.Item>

              {!canEditProductOverrides && (
                <Text type="secondary">Only tenant administrators can edit tenant overrides.</Text>
              )}
            </Form>
          )}
        </Modal>

        <Modal
          open={productModalOpen}
          title={editingProduct ? 'Edit Master Product' : 'Add Master Product'}
          onCancel={() => {
            if (savingProduct) return;
            setProductModalOpen(false);
            setEditingProduct(null);
          }}
          okText={savingProduct ? 'Saving…' : 'Save'}
          okButtonProps={{
            loading: savingProduct,
            disabled: savingProduct || !canEditProducts,
          }}
          cancelButtonProps={{ disabled: savingProduct }}
          onOk={() => productForm.submit()}
          destroyOnClose
        >
          <Form form={productForm} layout="vertical" onFinish={handleSaveProduct}>
            <Form.Item
              name="product_code"
              label="Product Code"
              rules={[{ required: true, message: 'Product code is required' }]}
            >
              <Input placeholder="e.g., BEEF-RIBEYE-001" disabled={savingProduct} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Name is required' }]}
            >
              <Input placeholder="e.g., Ribeye" disabled={savingProduct} />
            </Form.Item>

            <Form.Item name="protein_type" label="Protein Type">
              <Select
                showSearch
                allowClear
                placeholder="Select protein type"
                options={proteinChoices.map((o) => ({ value: o.value, label: o.label }))}
                disabled={savingProduct}
              />
            </Form.Item>

            <Form.Item name="category" label="Category">
              <Select
                disabled={savingProduct}
                options={[
                  { value: 'BEEF', label: 'Beef' },
                  { value: 'PORK', label: 'Pork' },
                  { value: 'POULTRY', label: 'Poultry' },
                  { value: 'SEAFOOD', label: 'Seafood' },
                  { value: 'LAMB', label: 'Lamb' },
                  { value: 'VEAL', label: 'Veal' },
                  { value: 'GAME', label: 'Game' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </Form.Item>

            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch disabled={savingProduct} />
            </Form.Item>

            <Form.Item name="is_system" label="System Product" valuePropName="checked">
              <Switch disabled={savingProduct} />
            </Form.Item>

            {!canEditProducts && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Only superusers can edit master products.</Text>
              </div>
            )}
          </Form>
        </Modal>
      </AdminGuard>
    </AdminPage>
  );
};

export default OptionListsPage;
