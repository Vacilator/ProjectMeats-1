import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from 'antd';
import { ClipboardList } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { buildPurchaseOrderReviewPath } from '@/services/purchaseOrderReviewService';
import { apiClient, apiService, PurchaseOrder, Supplier } from '../services/apiService';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../components/Onboarding';
import { UnifiedForm } from '../components/UnifiedForm';
import PurchaseOrderWorkflow from '../components/Workflow/PurchaseOrderWorkflow';
import { formatTradeDate } from '@/utils/trade';

// Styled Components
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;

  @media (max-width: 520px) {
    flex-wrap: wrap;
    align-items: flex-start;
  }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 520px) {
    width: 100%;
    flex-wrap: wrap;

    & > button {
      flex: 1 1 100%;
    }
  }
`;

const AddButton = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;

  @media (max-width: 520px) {
    padding: 12px 16px;
  }

  &:hover {
    background: rgb(var(--color-primary-hover));
    transform: translateY(-1px);
  }
`;

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

const LoadingMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  font-size: 18px;
  color: rgb(var(--color-text-secondary));
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

const StatusBadge = styled.span<{ $color: string }>`
  background: ${(props) => props.$color};
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
`;

const ActionButton = styled.button`
  background: rgb(34, 197, 94);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: background 0.2s;

  &:hover {
    background: rgb(34, 197, 94);
  }
`;

const DeleteButton = styled.button`
  background: rgb(239, 68, 68);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(239, 68, 68);
  }
`;

const PurchaseOrders: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  type CockpitPrefill = {
    source?: string;
    query?: string;
    supplierId?: string;
    contextEntity?: { id?: string; type?: string; label?: string };
  };

  const cockpitPrefill = (location.state as any)?.prefill as CockpitPrefill | undefined;
  const [pendingCreatePrefill, setPendingCreatePrefill] = useState<CockpitPrefill | null>(null);

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    const reviewType = searchParams.get('review');
    const purchaseOrderId = searchParams.get('purchase_order');
    if (reviewType !== 'purchase_order' || !purchaseOrderId) {
      return;
    }

    navigate(buildPurchaseOrderReviewPath(purchaseOrderId), { replace: true });
  }, [navigate, searchParams]);

  // Auto-open form if ?action=create in URL (e.g., from Cockpit suggested actions)
  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;

    const supplierId =
      searchParams.get('supplier_id') ??
      cockpitPrefill?.supplierId ??
      undefined;

    const cockpitQuery =
      searchParams.get('cockpit_q') ??
      cockpitPrefill?.query ??
      undefined;

    setPendingCreatePrefill({
      source: 'cockpit',
      supplierId: supplierId || undefined,
      query: cockpitQuery || undefined,
      contextEntity: cockpitPrefill?.contextEntity,
    });

    setEditingPurchaseOrder(null);
    setShowForm(true);

    // Clear params so refresh doesn't keep reopening.
    ['action', 'supplier_id', 'cockpit_q'].forEach((key) => searchParams.delete(key));
    setSearchParams(searchParams);
  }, [searchParams, setSearchParams, cockpitPrefill]);

  useEffect(() => {
    loadData();
  }, []);

  const [exporting, setExporting] = useState(false);

  const exportToCsv = async () => {
    try {
      setExporting(true);

      // Use backend streaming export (tenant-safe via get_queryset + filter_queryset)
      const response = await apiClient.get('/purchase-orders/', {
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
      console.error('Error exporting purchase orders:', error);
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
      const [posData, suppliersData] = await Promise.all([
        apiService.getPurchaseOrders(),
        apiService.getSuppliers(),
      ]);
      setPurchaseOrders(posData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const data = await apiService.getPurchaseOrders();
      setPurchaseOrders(data);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
    }
  };

  const handleEdit = (purchaseOrder: PurchaseOrder) => {
    setPendingCreatePrefill(null);
    setEditingPurchaseOrder(purchaseOrder);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDialog({
      title: 'Delete purchase order?',
      content: 'Are you sure you want to delete this purchase order?',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiService.deletePurchaseOrder(id);
      showAlert({
        type: 'success',
        title: 'Deleted',
        content: 'Purchase order deleted successfully.',
      });
      await loadPurchaseOrders(); // Re-fetch to update the list
    } catch (error: unknown) {
      // Type-safe error handling: Use 'unknown' instead of 'any' and assert expected structure
      console.error('Error deleting purchase order:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'rgb(234, 179, 8)';
      case 'approved':
        return 'rgb(34, 197, 94)';
      case 'delivered':
        return 'rgb(var(--color-primary))';
      case 'cancelled':
        return 'rgb(239, 68, 68)';
      default:
        return 'rgb(var(--color-text-secondary))';
    }
  };

  const openCreatePurchaseOrder = () => {
    setPendingCreatePrefill(null);
    setEditingPurchaseOrder(null);
    setShowForm(true);
  };

  const purchaseOrderCreateInitialValues = useMemo(() => {
    const noteParts: string[] = [];

    if (pendingCreatePrefill?.query) {
      noteParts.push(`Cockpit search: "${pendingCreatePrefill.query}"`);
    }

    if (pendingCreatePrefill?.contextEntity?.label) {
      noteParts.push(`Context: ${pendingCreatePrefill.contextEntity.label}`);
    }

    return {
      supplier: pendingCreatePrefill?.supplierId || undefined,
      order_date: new Date().toISOString().split('T')[0],
      notes: noteParts.join('\n') || undefined,
      status: 'pending',
      weight_unit: 'LBS',
      logistics_scenario: 'supplier_delivery',
    } satisfies Record<string, unknown>;
  }, [pendingCreatePrefill]);

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPurchaseOrder(null);
    setPendingCreatePrefill(null);
  };

  const handleFormSuccess = async () => {
    await loadPurchaseOrders();
    handleFormClose();
  };

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <>
      <Header>
        <Title>Purchase Orders</Title>
        <HeaderActions>
          <SecondaryButton onClick={exportToCsv} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </SecondaryButton>
          <AddButton onClick={openCreatePurchaseOrder}>
          + Add Purchase Order
          </AddButton>
        </HeaderActions>
      </Header>

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

      {/* Sample Workflow Visualization */}
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

      {purchaseOrders.length === 0 ? (
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
            {purchaseOrders.map((purchaseOrder) => {
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
                    <StatusBadge $color={getStatusColor(purchaseOrder.status)}>
                      {purchaseOrder.status.toUpperCase()}
                    </StatusBadge>
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

      <UnifiedForm
        entityType="purchase_order"
        mode={editingPurchaseOrder ? 'edit' : 'create'}
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={() => {
          void handleFormSuccess();
        }}
        entityId={editingPurchaseOrder?.id}
        initialValues={editingPurchaseOrder ? undefined : purchaseOrderCreateInitialValues}
      />
    </>
  );
};

export default PurchaseOrders;
