import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from 'antd';
import { ClipboardList } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { buildPurchaseOrderReviewPath } from '@/services/purchaseOrderReviewService';
import type { PurchaseOrder, Supplier } from '../services/apiService';
import { businessApi } from '@/services/businessApi';
import { EntityPageHeader } from '@/components/Shared/EntityPageHeader';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../components/Onboarding';
import SupplierPOForm from './PurchaseOrders/SupplierPOForm';
import StatusFilterBar from '../components/Shared/StatusFilterBar';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import PurchaseOrderWorkflow from '../components/Workflow/PurchaseOrderWorkflow';
import { formatTradeDate } from '@/utils/trade';
import { logger } from '@/utils/logger';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { StatusActionCell } from '@/components/Workflow';

// Styled Components
const SecondaryButton = styled.button`
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  min-height: 44px;

  &:hover {
    background: rgb(var(--color-surface-hover));
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatsCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-surface-foreground));
  padding: 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  text-align: center;
  border: 1px solid rgb(var(--color-border));
  transition: box-shadow 0.2s ease, background-color 0.3s ease;
`;

const StatNumber = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-primary));
  margin-bottom: 8px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  font-weight: 500;
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;

  /* Prevent wide tables from causing page-level horizontal scrolling on mobile. */
  max-width: 100%;
`;

const Table = styled.table`
  width: 100%;
  min-width: 880px;
  background: rgb(var(--color-surface));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgb(var(--color-border));
`;

const TableHeader = styled.thead`
  background: rgb(var(--color-surface-hover));
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  border-bottom: 1px solid rgb(var(--color-border));

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: rgb(var(--color-surface-hover));
  }
`;

const TableHeaderCell = styled.th`
  text-align: left;
  padding: 16px 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const TableCell = styled.td`
  padding: 16px 20px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const ActionButton = styled.button`
  background: rgb(var(--color-success));
  color: rgb(var(--color-text-inverse));
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-success));
  }
`;

const DeleteButton = styled.button`
  background: rgb(var(--color-error));
  color: rgb(var(--color-text-inverse));
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-error));
  }
`;

const PurchaseOrders: React.FC = () => {
  useDocumentTitle('Purchase Orders');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [poSearchText, setPoSearchText] = useState('');
  const [poActiveTab, setPoActiveTab] = useState('all');
  const poTabs = useMemo(() => [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ], []);
  const filteredPurchaseOrders = useMemo(() => {
    let result = purchaseOrders;
    if (poActiveTab !== 'all') {
      result = result.filter((po) => po.status?.toLowerCase() === poActiveTab);
    }
    const q = poSearchText.trim().toLowerCase();
    if (q) {
      result = result.filter((po) =>
        (po.order_number ?? '').toLowerCase().includes(q) ||
        (po.item_description ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [purchaseOrders, poActiveTab, poSearchText]);

  useEffect(() => {
    const reviewType = searchParams.get('review');
    const purchaseOrderId = searchParams.get('purchase_order');
    if (reviewType !== 'purchase_order' || !purchaseOrderId) {
      return;
    }

    navigate(buildPurchaseOrderReviewPath(purchaseOrderId), { replace: true });
  }, [navigate, searchParams]);

  // Auto-open form if ?action=create in URL
  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;

    setEditingPurchaseOrder(null);
    setShowForm(true);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['action', 'supplier_id'].forEach((key) => next.delete(key));
      return next;
    });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadData();
  }, []);

  const [exporting, setExporting] = useState(false);

  const exportToCsv = async () => {
    try {
      setExporting(true);

      // Use backend streaming export (tenant-safe via get_queryset + filter_queryset)
      const response = await businessApi.get('/purchase-orders/', {
        params: { format: 'csv' },
        responseType: 'blob',
      });

      const data = response.data as any;
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error exporting purchase orders:', error);
      showAlert({
        title: 'Export Failed',
        content: 'Could not export purchase orders. Please try again.',
        type: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [posResp, suppResp] = await Promise.all([
        businessApi.get('purchase-orders/'),
        businessApi.get('suppliers/'),
      ]);
      setPurchaseOrders((posResp.data.results || posResp.data) as PurchaseOrder[]);
      setSuppliers((suppResp.data.results || suppResp.data) as Supplier[]);
    } catch (error) {
      logger.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const resp = await businessApi.get('purchase-orders/');
      setPurchaseOrders((resp.data.results || resp.data) as PurchaseOrder[]);
    } catch (error) {
      logger.error('Error loading purchase orders:', error);
    }
  };

  const handleEdit = (purchaseOrder: PurchaseOrder) => {
    setEditingPurchaseOrder(purchaseOrder);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const po = purchaseOrders.find((p) => p.id === id);
    const label = po?.order_number ? `PO #${po.order_number}` : 'this purchase order';
    const confirmed = await confirmDialog({
      title: 'Delete Purchase Order',
      content: `Are you sure you want to delete "${label}"? This action cannot be undone.`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await businessApi.delete(`purchase-orders/${id}/`);
      showAlert({
        type: 'success',
        title: 'Deleted',
        content: 'Purchase order deleted successfully.',
      });
      await loadPurchaseOrders(); // Re-fetch to update the list
    } catch (error: unknown) {
      // Type-safe error handling: Use 'unknown' instead of 'any' and assert expected structure
      logger.error('Error deleting purchase order:', error);
      const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const errorMessage = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.message
        || 'Failed to delete purchase order';
      showAlert({
        type: 'error',
        title: 'Error',
        content: `Error: ${errorMessage}`,
      });
    }
  };

  const openCreatePurchaseOrder = () => {
    setEditingPurchaseOrder(null);
    setShowForm(true);
  };

  const purchaseOrderCreateInitialValues = useMemo(() => {
    return {
      order_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      weight_unit: 'LBS',
      logistics_scenario: 'supplier_delivery',
    } satisfies Record<string, unknown>;
  }, []);

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPurchaseOrder(null);
  };

  const handleFormSuccess = async () => {
    await loadPurchaseOrders();
    handleFormClose();
  };

  const handleFormSuccessCallback = useCallback(() => {
    void handleFormSuccess();
  }, [handleFormSuccess]);

  const showingInlineForm = showForm;
  const headerTitle = showingInlineForm
    ? editingPurchaseOrder
      ? 'Edit Purchase Order'
      : 'Create Purchase Order'
    : 'Purchase Orders';
  const headerSubtitle = showingInlineForm
    ? editingPurchaseOrder
      ? 'Update the purchase order details in the shared trade form.'
      : 'Create a purchase order in the shared trade form.'
    : null;

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <>
      <EntityPageHeader
        title={headerTitle}
        subtitle={headerSubtitle ?? undefined}
        actions={
          showingInlineForm ? (
            <SecondaryButton onClick={handleFormClose}>Back to Purchase Orders</SecondaryButton>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SecondaryButton onClick={exportToCsv} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </SecondaryButton>
              <button
                onClick={openCreatePurchaseOrder}
                style={{
                  background: 'rgb(var(--color-primary))',
                  color: 'rgb(var(--color-text-inverse))',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                + Add Purchase Order
              </button>
            </div>
          )
        }
      />

      {showingInlineForm ? (
        <FormErrorBoundary entityType="purchase order" onClose={handleFormClose}>
        <SupplierPOForm
          mode={editingPurchaseOrder ? 'edit' : 'create'}
          entityId={editingPurchaseOrder?.id}
          initialValues={editingPurchaseOrder ? {
            logistics_scenario: (editingPurchaseOrder.logistics_scenario as 'customer_pickup' | 'supplier_delivery' | 'we_pickup') || 'supplier_delivery',
            supplier: String(editingPurchaseOrder.supplier || ''),
            product: (editingPurchaseOrder.product || '') as string,
            item_description: editingPurchaseOrder.item_description || '',
            fresh_or_frozen: editingPurchaseOrder.fresh_or_frozen || '',
            package_type: editingPurchaseOrder.package_type || '',
            quantity: editingPurchaseOrder.quantity != null ? String(editingPurchaseOrder.quantity) : '',
            total_weight: editingPurchaseOrder.total_weight != null ? String(editingPurchaseOrder.total_weight) : '',
            weight_unit: editingPurchaseOrder.weight_unit || 'LBS',
            price_per_unit: editingPurchaseOrder.price_per_unit != null ? String(editingPurchaseOrder.price_per_unit) : '',
            delivery_date: editingPurchaseOrder.delivery_date || '',
            notes: editingPurchaseOrder.notes || '',
            pick_up_location: editingPurchaseOrder.pick_up_location || null,
            delivery_location: editingPurchaseOrder.delivery_location || null,
          } : purchaseOrderCreateInitialValues as Partial<Record<string, unknown>>}
          onSuccess={handleFormSuccessCallback}
          onCancel={handleFormClose}
        />
        </FormErrorBoundary>
      ) : (
        <>
          <StatsCards>
            <StatCard>
              <StatNumber>{purchaseOrders.length}</StatNumber>
              <StatLabel>Total Orders</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>{purchaseOrders.filter((po) => po.status === 'pending').length}</StatNumber>
              <StatLabel>Pending</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>{purchaseOrders.filter((po) => po.status === 'approved').length}</StatNumber>
              <StatLabel>Approved</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>
                $
                {Array.isArray(purchaseOrders)
                  ? purchaseOrders
                      .reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0)
                      .toFixed(2)
                  : '0.00'}
              </StatNumber>
              <StatLabel>Total Value</StatLabel>
            </StatCard>
          </StatsCards>

          <PurchaseOrderWorkflow
            stages={[
              {
                id: 'draft',
                label: 'Draft',
                status: 'completed',
                description: 'Order created',
              },
              {
                id: 'approval',
                label: 'Approval',
                status: 'completed',
                description: 'Management review',
              },
              {
                id: 'processing',
                label: 'Processing',
                status: 'active',
                description: 'Supplier processing',
              },
              {
                id: 'shipping',
                label: 'Shipping',
                status: 'pending',
                description: 'In transit',
              },
              {
                id: 'delivered',
                label: 'Delivered',
                status: 'pending',
                description: 'Order complete',
              },
            ]}
          />

          <StatusFilterBar
            tabs={poTabs}
            activeTab={poActiveTab}
            onTabChange={setPoActiveTab}
            searchText={poSearchText}
            onSearchChange={setPoSearchText}
            searchPlaceholder="Search orders…"
          />

          {filteredPurchaseOrders.length === 0 && purchaseOrders.length === 0 ? (
            <TransactionalEmptyState
              icon={<ClipboardList size={36} />}
              title="No purchase orders yet"
              message="Create your first purchase order to start tracking supplier commitments, receiving plans, and order value."
              actions={[
                {
                  label: 'Create Purchase Order',
                  onClick: openCreatePurchaseOrder,
                  variant: 'primary',
                },
                {
                  label: 'Add First Supplier',
                  onClick: () => navigate('/suppliers/new'),
                  variant: 'secondary',
                },
              ]}
            >
              <TransactionalEmptyStateGuidance>
                <TransactionalEmptyStateGuidanceItem>
                  Add a supplier first if you do not yet have one to purchase from.
                </TransactionalEmptyStateGuidanceItem>
                <TransactionalEmptyStateGuidanceItem>
                  Use purchase orders to lock in cost, quantity, and delivery expectations before fulfillment starts.
                </TransactionalEmptyStateGuidanceItem>
              </TransactionalEmptyStateGuidance>
            </TransactionalEmptyState>
          ) : filteredPurchaseOrders.length === 0 ? (
            <TransactionalEmptyState
              icon={<ClipboardList size={36} />}
              title="No results"
              message="No purchase orders match the current filters."
              actions={[
                {
                  label: 'Clear Filters',
                  onClick: () => { setPoActiveTab('all'); setPoSearchText(''); },
                  variant: 'secondary',
                },
              ]}
            />
          ) : (
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Order Number</TableHeaderCell>
                    <TableHeaderCell>Supplier</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Order Date</TableHeaderCell>
                    <TableHeaderCell>Delivery Date</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchaseOrders.map((purchaseOrder) => {
                    const supplier = suppliers.find((s) => s.id === purchaseOrder.supplier);
                    return (
                      <TableRow
                        key={purchaseOrder.id}
                        onClick={() => handleEdit(purchaseOrder)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleEdit(purchaseOrder);
                          }
                        }}
                      >
                        <TableCell>{purchaseOrder.order_number}</TableCell>
                        <TableCell>{supplier?.name || `ID: ${purchaseOrder.supplier}`}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(Number(purchaseOrder.total_amount) || 0)}
                        </TableCell>
                        <TableCell>
                          <StatusActionCell
                            entityType="purchase_order"
                            entityId={purchaseOrder.id}
                            status={purchaseOrder.status}
                            onTransitioned={loadPurchaseOrders}
                          />
                        </TableCell>
                        <TableCell>
                          {formatTradeDate(
                            purchaseOrder.trade_timeline,
                            'order_date',
                            purchaseOrder.order_date
                          )}
                        </TableCell>
                        <TableCell>
                          {formatTradeDate(
                            purchaseOrder.trade_timeline,
                            'delivery_date',
                            purchaseOrder.delivery_date,
                            'Not set'
                          )}
                        </TableCell>
                        <TableCell>
                          <ActionButton
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/records/purchase_order/${encodeURIComponent(String(purchaseOrder.id))}`);
                            }}
                          >
                            View
                          </ActionButton>
                          <ActionButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(purchaseOrder);
                            }}
                          >
                            Edit
                          </ActionButton>
                          <DeleteButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(purchaseOrder.id);
                            }}
                          >
                            Delete
                          </DeleteButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </>
      )}
    </>
  );
};

export default PurchaseOrders;
