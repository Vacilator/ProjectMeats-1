/**
 * Sales Orders Page
 * 
 * Comprehensive sales order management with customer tracking and activity logging.
 * 
 * Features:
 * - View all sales orders with status filtering
 * - Search by customer, order number, or date range
 * - Side panel with order details and activity feed
 * - Theme-compliant styling (32px headers, color variables)
 * - Timezone-aware date formatting
 * 
 * Pattern: Follows Claims.tsx architecture for consistency
 */
import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Skeleton } from 'antd';
import { PackagePlus } from 'lucide-react';

import { EntityPageHeader } from '@/components/Shared/EntityPageHeader';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../../components/Onboarding';
import { ActivityFeed } from '../../components/Shared';
import SalesOrderForm from './SalesOrderForm';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import { businessApi } from '@/services/businessApi';
import { formatCurrency } from '../../shared/utils';
import type { TradeTimelinePayload, TradeWeightPayload } from '../../utils/trade';
import { formatTradeDate, formatTradeDateTime, formatTradeWeight } from '../../utils/trade';
import { logger } from '@/utils/logger';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { StatusActionCell } from '@/components/Workflow';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SalesOrder {
  id: number;
  tenant: string;
  order_number: string;
  customer: number;
  customer_name?: string;
  order_date: string;
  delivery_date: string | null;
  status: 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: string;
  notes: string;
  created_by: number | null;
  created_by_name: string;
  created_on: string;
  updated_on: string;
  total_weight?: string | null;
  weight_unit?: string | null;
  trade_weight?: TradeWeightPayload | null;
  trade_timeline?: TradeTimelinePayload;
}

type OrderStatus = 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// ============================================================================
// Styled Components (Theme-Compliant)
// ============================================================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem;
  background: rgb(var(--color-background));
  min-width: 0;

  @media (max-width: 520px) {
    padding: 1rem;
  }
`;



const SecondaryButton = styled.button`
  padding: 0.75rem 1.25rem;
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
  min-height: 44px;

  @media (max-width: 520px) {
    width: 100%;
    justify-content: center;
  }

  &:hover {
    background: rgb(var(--color-surface-hover));
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled.button`
  padding: 0.75rem 1.5rem;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;
  min-height: 44px;

  @media (max-width: 520px) {
    width: 100%;
    justify-content: center;
  }

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ContentContainer = styled.div<{ $hasSidePanel?: boolean }>`
  display: grid;
  grid-template-columns: ${props => props.$hasSidePanel ? '1fr 400px' : '1fr'};
  gap: 1.5rem;
  height: calc(100vh - 180px);
  overflow: hidden;
  transition: grid-template-columns 0.3s ease;
  min-width: 0;
  max-width: 100%;
  
  /* Stack layout on tablets and mobile */
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-width: 0;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  flex-wrap: wrap;
  min-width: 0;
`;

const FilterButton = styled.button<{ $isActive?: boolean }>`
  padding: 0.5rem 1rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  background: ${props => props.$isActive ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border: 1px solid ${props => props.$isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(var(--color-primary), 0.1);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const SearchBar = styled.input`
  flex: 1;
  min-width: 250px;
  padding: 0.5rem 1rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  min-height: 44px;

  @media (max-width: 520px) {
    min-width: 0;
    width: 100%;
    font-size: 16px; /* prevent iOS Safari zoom-on-focus */
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const TableContainer = styled.div`
  flex: 1;
  width: 100%;
  overflow-y: auto;
  max-width: 100%;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;

  /* Only enable horizontal scroll on small screens when truly needed */
  @media (max-width: 768px) {
    overflow-x: auto;
  }

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgb(var(--color-surface));
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--color-text-secondary));
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  /* Reduce minimum width on smaller screens */
  @media (min-width: 769px) {
    min-width: 800px;
  }
  
  @media (max-width: 768px) {
    min-width: 600px;
  }

  @media (max-width: 520px) {
    min-width: 0;
  }
`;

const TableHeader = styled.thead`
  background: rgb(var(--color-surface-hover));
  position: sticky;
  top: 0;
  z-index: 10;
`;

const TableRow = styled.tr<{ $isSelected?: boolean; $isClickable?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border));
  background: ${props => props.$isSelected ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  cursor: ${props => props.$isClickable ? 'pointer' : 'default'};
  transition: background 0.2s ease;

  &:hover {
    background: ${props => props.$isClickable ? 'rgb(var(--color-surface-hover))' : 'transparent'};
  }
`;

const TableHeaderCell = styled.th`
  text-align: left;
  padding: 1rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;

  @media (max-width: 520px) {
    padding: 0.75rem 1rem;

    &:nth-child(3),
    &:nth-child(4) {
      display: none;
    }
  }
`;

const TableCell = styled.td`
  padding: 1rem 1.5rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;

  @media (max-width: 520px) {
    padding: 0.75rem 1rem;

    &:nth-child(3),
    &:nth-child(4) {
      display: none;
    }

    &:nth-child(2) {
      white-space: normal;
      word-break: break-word;
    }
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const EmptyResultsState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const ErrorState = styled.div`
  padding: 1rem 1.5rem;
  background: rgba(var(--color-danger), 0.12);
  border: 1px solid rgba(var(--color-danger), 0.3);
  border-radius: var(--radius-md);
  color: rgb(var(--color-danger));
  font-size: 0.875rem;
  margin: 1rem 1.5rem;
`;

// Side Panel Styles
const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const SidePanelHeader = styled.div`
  position: relative;
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const SidePanelTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.5rem 0;
`;

const SidePanelSubtitle = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem;
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  font-size: 1.25rem;
  transition: color 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const SidePanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgb(var(--color-surface));
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 3px;
  }
`;

const DetailSection = styled.div`
  margin-bottom: 1.5rem;
`;

const DetailLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
`;

const DetailValue = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const DetailAmount = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--color-primary));
  margin-top: 0.25rem;
`;

// ============================================================================
// Component
// ============================================================================

export const SalesOrdersPage: React.FC = () => {
  useDocumentTitle('Sales Orders');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-open modal if ?action=create in URL
  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;

    setIsModalOpen(true);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['action', 'customer_id'].forEach((key) => next.delete(key));
      return next;
    });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const exportToCsv = async () => {
    try {
      setExporting(true);
      const response = await businessApi.get('sales-orders/', {
        params: { format: 'csv' },
        responseType: 'blob',
      });

      const data = response.data as any;
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_orders_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      logger.error('Error exporting sales orders:', err);
      setError('Failed to export sales orders');
    } finally {
      setExporting(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await businessApi.get('sales-orders/');
      setOrders(response.data.results || response.data);
    } catch (err: unknown) {
      logger.error('Failed to fetch sales orders:', err);
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((data.detail as string) || 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderClick = (order: SalesOrder) => {
    setSelectedOrder(order);
  };

  const handleClosePanel = () => {
    setSelectedOrder(null);
  };

  const openCreateSalesOrder = () => {
    setIsModalOpen(true);
  };

  // Filter and search logic
  const filteredOrders = orders.filter(order => {
    // Status filter
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.notes.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const statusCounts = {
    all: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  return (
    <PageContainer>
      <EntityPageHeader
        title="Sales Orders"
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <SecondaryButton onClick={exportToCsv} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </SecondaryButton>
            <PrimaryButton onClick={openCreateSalesOrder}>
              + New Sales Order
            </PrimaryButton>
          </div>
        }
      />

      <ContentContainer $hasSidePanel={selectedOrder !== null}>
        <MainContent>
          {/* Filters and Search */}
          <FilterBar>
            <FilterButton 
              $isActive={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              All ({statusCounts.all})
            </FilterButton>
            <FilterButton 
              $isActive={statusFilter === 'draft'}
              onClick={() => setStatusFilter('draft')}
            >
              Draft ({statusCounts.draft})
            </FilterButton>
            <FilterButton 
              $isActive={statusFilter === 'confirmed'}
              onClick={() => setStatusFilter('confirmed')}
            >
              Confirmed ({statusCounts.confirmed})
            </FilterButton>
            <FilterButton 
              $isActive={statusFilter === 'processing'}
              onClick={() => setStatusFilter('processing')}
            >
              Processing ({statusCounts.processing})
            </FilterButton>
            <FilterButton 
              $isActive={statusFilter === 'shipped'}
              onClick={() => setStatusFilter('shipped')}
            >
              Shipped ({statusCounts.shipped})
            </FilterButton>
            <FilterButton 
              $isActive={statusFilter === 'delivered'}
              onClick={() => setStatusFilter('delivered')}
            >
              Delivered ({statusCounts.delivered})
            </FilterButton>
            <SearchBar
              type="text"
              placeholder="Search orders, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </FilterBar>

          {/* Error State */}
          {error && <ErrorState>{error}</ErrorState>}

          {/* Table */}
          <TableContainer data-testid="sales-orders-table-container">
            {loading ? (
              <LoadingState>
                <Skeleton active paragraph={{ rows: 8 }} />
              </LoadingState>
            ) : filteredOrders.length === 0 ? (
              statusFilter !== 'all' || searchQuery ? (
                <EmptyResultsState>No sales orders match your current filters.</EmptyResultsState>
              ) : (
                <TransactionalEmptyState
                  icon={<PackagePlus size={36} />}
                  title="No sales orders yet"
                  message="Create your first sales order to move a customer request into pricing, fulfillment, and invoice-ready workflow."
                  actions={[
                    {
                      label: 'Create Sales Order',
                      onClick: openCreateSalesOrder,
                      variant: 'primary',
                    },
                    {
                      label: 'Add First Customer',
                      onClick: () => navigate('/customers/new'),
                      variant: 'secondary',
                    },
                  ]}
                >
                  <TransactionalEmptyStateGuidance>
                    <TransactionalEmptyStateGuidanceItem>
                      Add a customer first if you do not yet have an account to sell against.
                    </TransactionalEmptyStateGuidanceItem>
                    <TransactionalEmptyStateGuidanceItem>
                      Sales orders become the backbone for invoices, freight coordination, and order activity history.
                    </TransactionalEmptyStateGuidanceItem>
                  </TransactionalEmptyStateGuidance>
                </TransactionalEmptyState>
              )
            ) : (
              <Table aria-label="Sales orders list">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Order #</TableHeaderCell>
                    <TableHeaderCell>Customer</TableHeaderCell>
                    <TableHeaderCell>Order Date</TableHeaderCell>
                    <TableHeaderCell>Delivery Date</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      $isClickable
                      $isSelected={selectedOrder?.id === order.id}
                      onClick={() => handleOrderClick(order)}
                    >
                      <TableCell>{order.order_number}</TableCell>
                      <TableCell>{order.customer_name || `Customer #${order.customer}`}</TableCell>
                      <TableCell>
                        {formatTradeDate(order.trade_timeline, 'order_date', order.order_date)}
                      </TableCell>
                      <TableCell>
                        {formatTradeDate(
                          order.trade_timeline,
                          'delivery_date',
                          order.delivery_date,
                          'Not scheduled'
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(parseFloat(order.total_amount))}</TableCell>
                      <TableCell>
                        <StatusActionCell
                          entityType="sales_order"
                          entityId={order.id}
                          status={order.status}
                          onTransitioned={() => fetchOrders()}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            )}
          </TableContainer>
        </MainContent>

        {/* Side Panel */}
        {selectedOrder && (
          <SidePanel>
            <SidePanelHeader>
              <CloseButton onClick={handleClosePanel} aria-label="Close order details">×</CloseButton>
              <SidePanelTitle>Order Details</SidePanelTitle>
              <SidePanelSubtitle>{selectedOrder.order_number}</SidePanelSubtitle>
              <button
                type="button"
                onClick={() => navigate(`/records/sales_order/${encodeURIComponent(String(selectedOrder.id))}`)}
                style={{
                  marginTop: '0.5rem',
                  border: '1px solid rgb(var(--color-border))',
                  borderRadius: 8,
                  background: 'rgb(var(--color-surface))',
                  color: 'rgb(var(--color-text-primary))',
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                }}
              >
                Open Record
              </button>
            </SidePanelHeader>

            <SidePanelContent>
              <DetailSection>
                <DetailLabel>Status</DetailLabel>
                <StatusActionCell
                  entityType="sales_order"
                  entityId={selectedOrder.id}
                  status={selectedOrder.status}
                  compact
                />
              </DetailSection>

              <DetailSection>
                <DetailLabel>Total Amount</DetailLabel>
                <DetailAmount>
                  {formatCurrency(parseFloat(selectedOrder.total_amount))}
                </DetailAmount>
              </DetailSection>

              <DetailSection>
                <DetailLabel>Customer</DetailLabel>
                <DetailValue>
                  {selectedOrder.customer_name || `Customer #${selectedOrder.customer}`}
                </DetailValue>
              </DetailSection>

              <DetailSection>
                <DetailLabel>Order Date</DetailLabel>
                <DetailValue>
                  {formatTradeDateTime(
                    selectedOrder.trade_timeline,
                    'order_date',
                    selectedOrder.order_date
                  )}
                </DetailValue>
              </DetailSection>

              {selectedOrder.delivery_date && (
                <DetailSection>
                  <DetailLabel>Delivery Date</DetailLabel>
                  <DetailValue>
                    {formatTradeDateTime(
                      selectedOrder.trade_timeline,
                      'delivery_date',
                      selectedOrder.delivery_date
                    )}
                  </DetailValue>
                </DetailSection>
              )}

              <DetailSection>
                <DetailLabel>Total Weight</DetailLabel>
                <DetailValue>{formatTradeWeight(selectedOrder)}</DetailValue>
              </DetailSection>

              {selectedOrder.notes && (
                <DetailSection>
                  <DetailLabel>Notes</DetailLabel>
                  <DetailValue>{selectedOrder.notes}</DetailValue>
                </DetailSection>
              )}

              <DetailSection>
                <DetailLabel>Created By</DetailLabel>
                <DetailValue>{selectedOrder.created_by_name}</DetailValue>
              </DetailSection>

              <DetailSection>
                <DetailLabel>Activity History</DetailLabel>
                <div style={{ marginTop: '1rem' }}>
                  <ActivityFeed
                    entityType="sales_order"
                    entityId={selectedOrder.id}
                    showCreateForm
                    maxHeight="300px"
                  />
                </div>
              </DetailSection>

              <DetailSection>
                <AIEntityInsights entityType="sales_order" entityId={String(selectedOrder.id)} />
              </DetailSection>

              <DetailSection>
                <EntityWorkflowStatusPanel entityType="sales_order" entityId={String(selectedOrder.id)} />
              </DetailSection>
            </SidePanelContent>
          </SidePanel>
        )}
      </ContentContainer>

      {isModalOpen && (
        <FormErrorBoundary entityType="sales order" onClose={handleCreateClose}>
          <SalesOrderForm
            mode="create"
            onSuccess={handleCreateSuccess}
            onCancel={handleCreateClose}
          />
        </FormErrorBoundary>
      )}
    </PageContainer>
  );
};

export default SalesOrdersPage;
