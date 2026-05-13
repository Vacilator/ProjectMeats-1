import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { logger } from '@/utils/logger';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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

const HeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Subtitle = styled.p`
  margin: 0;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
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
  color: rgb(var(--color-text-inverse));
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
  color: rgb(var(--color-text-inverse));
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
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

const FilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
`;

const FilterButton = styled.button<{ $isActive?: boolean }>`
  padding: 0.5rem 1rem;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  background: ${props => props.$isActive ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border: 1px solid ${props => props.$isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(var(--color-primary), 0.1);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const PurchaseOrders: React.FC = () => {
  useDocumentTitle('Purchase Orders');
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
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

    // Clear params so refresh doesn't keep reopening — functional update avoids stale ref
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['action', 'supplier_id', 'cockpit_q'].forEach((key) => next.delete(key));
      return next;
    });
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
      const [posData, suppliersData] = await Promise.all([
        apiService.getPurchaseOrders(),
        apiService.getSuppliers(),
      ]);
      setPurchaseOrders(posData);
      setSuppliers(suppliersData);
    } catch (error) {
      logger.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const data = await apiService.getPurchaseOrders();
      setPurchaseOrders(data);
    } catch (error) {
      logger.error('Error loading purchase orders:', error);
    }
  };

  const filteredPurchaseOrders = useMemo(() => {
    if (statusFilter === 'all') return purchaseOrders;
    return purchaseOrders.filter((po) => po.status === statusFilter);
  }, [purchaseOrders, statusFilter]);

  const statusCounts = useMemo(() => ({
    all: purchaseOrders.length,
    pending: purchaseOrders.filter((po) => po.status === 'pending').length,
    approved: purchaseOrders.filter((po) => po.status === 'approved').length,
    delivered: purchaseOrders.filter((po) => po.status === 'delivered').length,
    cancelled: purchaseOrders.filter((po) => po.status === 'cancelled').length,
  }), [purchaseOrders]);

  const handleEdit = (purchaseOrder: PurchaseOrder) => {
    setPendingCreatePrefill(null);
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
      await apiService.deletePurchaseOrder(id);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'rgb(var(--color-warning))';
      case 'approved':
        return 'rgb(var(--color-success))';
      case 'delivered':
        return 'rgb(var(--color-primary))';
      case 'cancelled':
        return 'rgb(var(--color-error))';
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
      <Header>
        <HeaderCopy>
          <Title>{headerTitle}</Title>
          {headerSubtitle ? <Subtitle>{headerSubtitle}</Subtitle> : null}
        </HeaderCopy>
        <HeaderActions>
          {showingInlineForm ? (
            <SecondaryButton onClick={handleFormClose}>Back to Purchase Orders</SecondaryButton>
          ) : (
            <>
              <SecondaryButton onClick={exportToCsv} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </SecondaryButton>
              <AddButton onClick={openCreatePurchaseOrder}>+ Add Purchase Order</AddButton>
            </>
          )}
        </HeaderActions>
      </Header>

      {showingInlineForm ? (
        <UnifiedForm
          entityType="purchase_order"
          mode={editingPurchaseOrder ? 'edit' : 'create'}
          variant="inline"
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccessCallback}
          entityId={editingPurchaseOrder?.id}
          initialValues={editingPurchaseOrder ? undefined : purchaseOrderCreateInitialValues}
        />
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

          <FilterBar>
            {(['all', 'pending', 'approved', 'delivered', 'cancelled'] as const).map((status) => (
              <FilterButton
                key={status}
                $isActive={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
              </FilterButton>
            ))}
          </FilterBar>

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
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgb(var(--color-text-secondary))' }}>
              No purchase orders match the selected filter.
            </div>
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
        </>
      )}
    </>
  );
};

export default PurchaseOrders;
