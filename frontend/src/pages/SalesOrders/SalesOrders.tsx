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
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Skeleton } from 'antd';

import { ActivityFeed, EntityFormSurface } from '../../components/Shared';
import { apiClient } from '../../services/apiService';
import { formatCurrency } from '../../shared/utils';
import { formatDateLocal, formatToLocal } from '../../utils/formatters';

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

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;

  @media (max-width: 520px) {
    font-size: 1.75rem;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 520px) {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
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

const ContentContainer = styled.div<{ hasSidePanel?: boolean }>`
  display: grid;
  grid-template-columns: ${props => props.hasSidePanel ? '1fr 400px' : '1fr'};
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

const FilterButton = styled.button<{ isActive?: boolean }>`
  padding: 0.5rem 1rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  background: ${props => props.isActive ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border: 1px solid ${props => props.isActive ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
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

const TableRow = styled.tr<{ isSelected?: boolean; isClickable?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border));
  background: ${props => props.isSelected ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  cursor: ${props => props.isClickable ? 'pointer' : 'default'};
  transition: background 0.2s ease;

  &:hover {
    background: ${props => props.isClickable ? 'rgb(var(--color-surface-hover))' : 'transparent'};
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

const StatusBadge = styled.span<{ status: OrderStatus }>`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;

  ${props => {
    switch (props.status) {
      case 'draft':
        return `
          background: rgba(var(--color-text-secondary), 0.12);
          color: rgb(var(--color-text-secondary));
        `;
      case 'confirmed':
        return `
          background: rgba(var(--color-info), 0.12);
          color: rgb(var(--color-info));
        `;
      case 'processing':
        return `
          background: rgba(var(--color-warning), 0.12);
          color: rgb(var(--color-warning));
        `;
      case 'shipped':
        return `
          background: rgba(var(--color-info), 0.12);
          color: rgb(var(--color-info));
        `;
      case 'delivered':
        return `
          background: rgba(var(--color-success), 0.12);
          color: rgb(var(--color-success));
        `;
      case 'cancelled':
        return `
          background: rgba(var(--color-danger), 0.12);
          color: rgb(var(--color-danger));
        `;
      default:
        return '';
    }
  }}
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
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

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  type CockpitPrefill = {
    source?: string;
    query?: string;
    customerId?: string;
    contextEntity?: { id?: string; type?: string; label?: string };
  };

  const cockpitPrefill = (location.state as any)?.prefill as CockpitPrefill | undefined;
  const [createPrefill, setCreatePrefill] = useState<CockpitPrefill | null>(null);

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modalInitialValues = useMemo(() => {
    if (!createPrefill) return undefined;

    const noteParts: string[] = [];
    if (createPrefill.query) noteParts.push(`Cockpit search: \"${createPrefill.query}\"`);
    if (createPrefill.contextEntity?.label) noteParts.push(`Context: ${createPrefill.contextEntity.label}`);

    return {
      customer: createPrefill.customerId ?? '',
      notes: noteParts.join('\n'),
    };
  }, [createPrefill]);

  // Auto-open modal if ?action=create in URL (e.g., from Cockpit suggested actions)
  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;

    const customerId =
      searchParams.get('customer_id') ??
      cockpitPrefill?.customerId ??
      undefined;

    const cockpitQuery =
      searchParams.get('cockpit_q') ??
      cockpitPrefill?.query ??
      undefined;

    setCreatePrefill({
      source: 'cockpit',
      customerId: customerId || undefined,
      query: cockpitQuery || undefined,
      contextEntity: cockpitPrefill?.contextEntity,
    });

    setIsModalOpen(true);

    ['action', 'customer_id', 'cockpit_q'].forEach((key) => searchParams.delete(key));
    setSearchParams(searchParams);
  }, [searchParams, setSearchParams, cockpitPrefill]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const exportToCsv = async () => {
    try {
      setExporting(true);
      const response = await apiClient.get('sales-orders/', {
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
    } catch (err: any) {
      console.error('Error exporting sales orders:', err);
      setError('Failed to export sales orders');
    } finally {
      setExporting(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('sales-orders/');
      setOrders(response.data.results || response.data);
    } catch (err: any) {
      console.error('Failed to fetch sales orders:', err);
      setError(err.response?.data?.detail || 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (order: SalesOrder) => {
    setSelectedOrder(order);
  };

  const handleClosePanel = () => {
    setSelectedOrder(null);
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
      <PageHeader>
        <PageTitle>Sales Orders</PageTitle>
        <HeaderActions>
          <SecondaryButton onClick={exportToCsv} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </SecondaryButton>
          <PrimaryButton onClick={() => { setCreatePrefill(null); setIsModalOpen(true); }}>
            + New Sales Order
          </PrimaryButton>
        </HeaderActions>
      </PageHeader>

      <ContentContainer hasSidePanel={selectedOrder !== null}>
        <MainContent>
          {/* Filters and Search */}
          <FilterBar>
            <FilterButton 
              isActive={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              All ({statusCounts.all})
            </FilterButton>
            <FilterButton 
              isActive={statusFilter === 'draft'}
              onClick={() => setStatusFilter('draft')}
            >
              Draft ({statusCounts.draft})
            </FilterButton>
            <FilterButton 
              isActive={statusFilter === 'confirmed'}
              onClick={() => setStatusFilter('confirmed')}
            >
              Confirmed ({statusCounts.confirmed})
            </FilterButton>
            <FilterButton 
              isActive={statusFilter === 'processing'}
              onClick={() => setStatusFilter('processing')}
            >
              Processing ({statusCounts.processing})
            </FilterButton>
            <FilterButton 
              isActive={statusFilter === 'shipped'}
              onClick={() => setStatusFilter('shipped')}
            >
              Shipped ({statusCounts.shipped})
            </FilterButton>
            <FilterButton 
              isActive={statusFilter === 'delivered'}
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
              <EmptyState>
                <p>No sales orders found.</p>
                <p>Click "New Sales Order" to create your first order.</p>
              </EmptyState>
            ) : (
              <Table>
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
                      isClickable
                      isSelected={selectedOrder?.id === order.id}
                      onClick={() => handleOrderClick(order)}
                    >
                      <TableCell>{order.order_number}</TableCell>
                      <TableCell>{order.customer_name || `Customer #${order.customer}`}</TableCell>
                      <TableCell>{formatDateLocal(order.order_date)}</TableCell>
                      <TableCell>{order.delivery_date ? formatDateLocal(order.delivery_date) : 'Not scheduled'}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(order.total_amount))}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status}>
                          {order.status.toUpperCase()}
                        </StatusBadge>
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
            </SidePanelHeader>

            <SidePanelContent>
              <DetailSection>
                <DetailLabel>Status</DetailLabel>
                <StatusBadge status={selectedOrder.status}>
                  {selectedOrder.status.toUpperCase()}
                </StatusBadge>
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
                <DetailValue>{formatToLocal(selectedOrder.order_date)}</DetailValue>
              </DetailSection>

              {selectedOrder.delivery_date && (
                <DetailSection>
                  <DetailLabel>Delivery Date</DetailLabel>
                  <DetailValue>{formatToLocal(selectedOrder.delivery_date)}</DetailValue>
                </DetailSection>
              )}

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
            </SidePanelContent>
          </SidePanel>
        )}
      </ContentContainer>

      <EntityFormSurface
        entityType="sales-orders"
        mode="create"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchOrders()}
        initialValues={modalInitialValues as any}
      />
    </PageContainer>
  );
};

export default SalesOrdersPage;
