/**
 * Tenant Choice Override Manager
 *
 * UI for managing TenantChoiceOverride (Tier 3 tenant customizations).
 * Uses the same Card/Table layout style as the rest of the Admin workspace.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { businessApi } from '@/services/businessApi';
import { useToast } from '../../hooks/useToast';
import { confirmDialog } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';

const { Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface SystemChoiceList {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_extensible: boolean;
  is_reorderable: boolean;
}

interface SystemChoiceItem {
  id: string;
  value: string;
  label: string;
  order: number;
  is_active: boolean;
  is_system_defined: boolean;
}

interface TenantOverride {
  id?: string;
  choice_list: string;
  disabled_system_items: string[];
  display_config: {
    custom_order?: string[];
    grouping?: Record<string, string[]>;
  };
}

interface TenantChoiceOverrideProps {
  tenantId: string;
}

type TableRow = SystemChoiceItem & {
  disabled: boolean;
};

// ============================================================================
// Component
// ============================================================================

export const TenantChoiceOverride: React.FC<TenantChoiceOverrideProps> = ({ tenantId }) => {
  const toast = useToast();

  const [choiceLists, setChoiceLists] = useState<SystemChoiceList[]>([]);
  const [selectedList, setSelectedList] = useState<SystemChoiceList | null>(null);
  const [systemItems, setSystemItems] = useState<SystemChoiceItem[]>([]);
  const [tenantOverride, setTenantOverride] = useState<TenantOverride | null>(null);
  const [disabledItems, setDisabledItems] = useState<Set<string>>(new Set());
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({ value: '', label: '' });

  const loadChoiceLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await businessApi.get('/system/choice-lists/');
      const raw = response.data as Record<string, unknown>;
      const lists: unknown[] = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? (raw.results as unknown[]) : [];
      setChoiceLists(lists as SystemChoiceList[]);
    } catch (error) {
      logger.error('[TenantChoiceOverride] Failed to load choice lists:', error);
      toast.error('Failed to load choice lists');
      setChoiceLists([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadListData = useCallback(
    async (list: SystemChoiceList) => {
      setIsLoading(true);
      try {
        const itemsRes = await businessApi.get(`/system/choice-lists/${list.slug}/items/`);
        const itemsData = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const systemItemIds = new Set(
          itemsData.filter((i: SystemChoiceItem) => i.is_system_defined).map((i: SystemChoiceItem) => i.id)
        );

        const activeItems = itemsData.filter((item: SystemChoiceItem) => item.is_active);
        setSystemItems(activeItems);

        try {
          const overrideRes = await businessApi.get(`/system/tenant-overrides/`, {
            params: { choice_list: list.id },
          });

          const overrideData = overrideRes.data as Record<string, unknown>;
          const results = Array.isArray(overrideData?.results)
            ? overrideData.results
            : Array.isArray(overrideRes.data)
              ? overrideRes.data
              : [];

          const override = results[0];
          if (override) {
            setTenantOverride(override);
            setDisabledItems(
              new Set((override.disabled_system_items || []).filter((id: string) => systemItemIds.has(id)))
            );
            setCustomOrder(override.display_config?.custom_order || []);
          } else {
            setTenantOverride(null);
            setDisabledItems(new Set());
            setCustomOrder([]);
          }
        } catch (error) {
          logger.error('[TenantChoiceOverride] No override found:', error);
          setTenantOverride(null);
          setDisabledItems(new Set());
          setCustomOrder([]);
        }
      } catch (error) {
        logger.error('[TenantChoiceOverride] Failed to load list data:', error);
        toast.error('Failed to load list data');
        setSystemItems([]);
        setTenantOverride(null);
        setDisabledItems(new Set());
        setCustomOrder([]);
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadChoiceLists();
  }, [loadChoiceLists]);

  useEffect(() => {
    if (selectedList) {
      void loadListData(selectedList);
    } else {
      setSystemItems([]);
      setTenantOverride(null);
      setDisabledItems(new Set());
      setCustomOrder([]);
    }
  }, [selectedList, loadListData]);

  const rows: TableRow[] = useMemo(() => {
    // Order ALL active items (including disabled), using customOrder if present.
    const itemMap = new Map(systemItems.map((item) => [item.id, item]));
    const ordered: SystemChoiceItem[] = [];

    if (customOrder.length > 0) {
      for (const id of customOrder) {
        const item = itemMap.get(id);
        if (item) {
          ordered.push(item);
          itemMap.delete(id);
        }
      }
    }

    Array.from(itemMap.values())
      .sort((a, b) => a.order - b.order)
      .forEach((item) => ordered.push(item));

    return ordered.map((item) => ({
      ...item,
      disabled: disabledItems.has(item.id),
    }));
  }, [systemItems, customOrder, disabledItems]);

  const handleToggleDisabled = useCallback((item: SystemChoiceItem) => {
    if (!item.is_system_defined) return;

    setDisabledItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleMoveUp = useCallback(
    (itemId: string) => {
      const currentIndex = rows.findIndex((item) => item.id === itemId);
      if (currentIndex <= 0) return;

      const newOrder = rows.map((item) => item.id);
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setCustomOrder(newOrder);
    },
    [rows]
  );

  const handleMoveDown = useCallback(
    (itemId: string) => {
      const currentIndex = rows.findIndex((item) => item.id === itemId);
      if (currentIndex === -1 || currentIndex >= rows.length - 1) return;

      const newOrder = rows.map((item) => item.id);
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setCustomOrder(newOrder);
    },
    [rows]
  );

  const handleAddCustomItem = useCallback(async () => {
    if (!selectedList || !newCustomItem.value || !newCustomItem.label) return;

    try {
      await businessApi.post(`/system/choice-lists/${selectedList.slug}/items/`, {
        value: newCustomItem.value,
        label: newCustomItem.label,
        extra_data: {},
        order: systemItems.length,
        is_active: true,
        is_default: false,
      });

      toast.success('Added custom item');
      await loadListData(selectedList);
      setIsAddCustomModalOpen(false);
      setNewCustomItem({ value: '', label: '' });
    } catch (error) {
      logger.error('[TenantChoiceOverride] Failed to add custom item:', error);
      toast.error('Failed to add custom item');
    }
  }, [selectedList, newCustomItem, systemItems.length, loadListData, toast]);

  const handleSave = useCallback(async () => {
    if (!selectedList) return;

    setIsSaving(true);
    try {
      const overrideData: TenantOverride = {
        choice_list: selectedList.id,
        disabled_system_items: Array.from(disabledItems),
        display_config: {
          custom_order: customOrder.length > 0 ? customOrder : undefined,
        },
      };

      if (tenantOverride?.id) {
        await businessApi.patch(`/system/tenant-overrides/${tenantOverride.id}/`, overrideData);
      } else {
        await businessApi.post('/system/tenant-overrides/', overrideData);
      }

      toast.success('Saved customizations');
      await loadListData(selectedList);
    } catch (error: unknown) {
      logger.error('[TenantChoiceOverride] Failed to save override:', error);
      const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      toast.error((typeof data.error === 'string' ? data.error : '') || 'Failed to save customizations');
    } finally {
      setIsSaving(false);
    }
  }, [selectedList, disabledItems, customOrder, tenantOverride, loadListData, toast]);

  const handleReset = useCallback(() => {
    void (async () => {
      const confirmed = await confirmDialog({
        title: 'Reset to system defaults?',
        content: 'This will remove all tenant customizations for this list.',
        okText: 'Reset',
        cancelText: 'Cancel',
        danger: true,
      });

      if (!confirmed) return;

      setDisabledItems(new Set());
      setCustomOrder([]);
      toast.success('Reset to defaults (not yet saved)');
    })();
  }, [toast]);

  const columns: ColumnsType<TableRow> = useMemo(() => {
    const canReorder = Boolean(selectedList?.is_reorderable);

    return [
      {
        title: 'Label',
        dataIndex: 'label',
        key: 'label',
        render: (value: string, record) => (
          <Space direction="vertical" size={0}>
            <Text strong style={record.disabled ? { opacity: 0.6 } : undefined}>
              {value}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, opacity: record.disabled ? 0.6 : 1 }}>
              <code>{record.value}</code>
            </Text>
          </Space>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'is_system_defined',
        key: 'type',
        width: 140,
        render: (isSystem: boolean) => (isSystem ? <Tag color="blue">System</Tag> : <Tag color="purple">Tenant</Tag>),
      },
      {
        title: 'Status',
        key: 'status',
        width: 140,
        render: (_: unknown, record) => (
          record.disabled ? <Tag color="default">Disabled</Tag> : <Tag color="green">Visible</Tag>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: canReorder ? 240 : 160,
        render: (_: unknown, record) => (
          <Space>
            {canReorder && (
              <>
                <Button
                  size="small"
                  onClick={() => handleMoveUp(record.id)}
                  disabled={rows.findIndex((r) => r.id === record.id) === 0}
                >
                  Up
                </Button>
                <Button
                  size="small"
                  onClick={() => handleMoveDown(record.id)}
                  disabled={rows.findIndex((r) => r.id === record.id) === rows.length - 1}
                >
                  Down
                </Button>
              </>
            )}
            <Button
              size="small"
              danger={record.disabled}
              onClick={() => handleToggleDisabled(record)}
              disabled={!record.is_system_defined}
              title={!record.is_system_defined ? 'Tenant-added items cannot be disabled here' : undefined}
            >
              {record.disabled ? 'Enable' : 'Disable'}
            </Button>
          </Space>
        ),
      },
    ];
  }, [handleMoveDown, handleMoveUp, handleToggleDisabled, rows, selectedList?.is_reorderable]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card
        title="Tenant Overrides"
        extra={
          selectedList ? (
            <Space>
              <Button onClick={handleReset} disabled={isSaving}>
                Reset
              </Button>
              <Button type="primary" onClick={handleSave} loading={isSaving}>
                Save Changes
              </Button>
            </Space>
          ) : null
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>Choice list</Text>
            <Select
              style={{ minWidth: 320 }}
              loading={isLoading}
              placeholder="Select a system choice list"
              value={selectedList?.id}
              onChange={(value) => {
                const next = choiceLists.find((l) => l.id === value) ?? null;
                setSelectedList(next);
              }}
              options={choiceLists.map((l) => ({
                value: l.id,
                label: l.name,
              }))}
            />
          </Space>

          {!selectedList ? (
            <Text type="secondary">Select a choice list to customize.</Text>
          ) : (
            <Card
                size="small"
                title={selectedList.name}
                extra={
                  selectedList.is_extensible ? (
                    <Button type="primary" onClick={() => setIsAddCustomModalOpen(true)}>
                      Add Custom Item
                    </Button>
                  ) : null
                }
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {selectedList.description ? (
                    <Text type="secondary">{selectedList.description}</Text>
                  ) : null}

                  <Space wrap>
                    {selectedList.is_extensible ? <Tag color="green">Can Add Items</Tag> : <Tag>System Locked</Tag>}
                    {selectedList.is_reorderable ? <Tag color="purple">Can Reorder</Tag> : <Tag>Fixed Order</Tag>}
                    {customOrder.length > 0 ? <Tag color="gold">Custom Order</Tag> : null}
                    <Tag color="blue">Tenant: {tenantId}</Tag>
                  </Space>

                  <Table
                    aria-label="Tenant choice overrides"
                    rowKey="id"
                    columns={columns}
                    dataSource={rows}
                    loading={isLoading}
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                  />
                </Space>
              </Card>
          )}
        </Space>
      </Card>

      <Modal
        title="Add Custom Item"
        open={isAddCustomModalOpen}
        onCancel={() => {
          setIsAddCustomModalOpen(false);
          setNewCustomItem({ value: '', label: '' });
        }}
        onOk={handleAddCustomItem}
        okText="Add"
        okButtonProps={{ disabled: !newCustomItem.value || !newCustomItem.label }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text type="secondary">Adds a tenant-specific option to this system choice list.</Text>
          <Input
            value={newCustomItem.label}
            onChange={(e) => setNewCustomItem((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Label"
          />
          <Input
            value={newCustomItem.value}
            onChange={(e) => setNewCustomItem((prev) => ({ ...prev, value: e.target.value }))}
            placeholder="Value"
          />
        </Space>
      </Modal>
    </Space>
  );
};

export default TenantChoiceOverride;
