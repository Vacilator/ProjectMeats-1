/**
 * Fulfillments Page
 *
 * List and manage fulfillments.
 * Features:
 * - Fulfillment list with search and filters
 * - Status badges and workflow
 * - Tracking information
 * - Ship/Deliver/Complete actions
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton } from 'antd';
import styled from 'styled-components';
import { apiClient } from '../services/apiService';
import { FulfillmentListItem, FulfillmentStatus } from '../types';
import { FulfillmentDetailModal, CreateFulfillmentModal } from '../components/Fulfillment';
import { logger } from '@/utils/logger';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FiltersBar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
`;

const SearchInput = styled.input`
  padding: 0.625rem 1rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const FilterSelect = styled.select`
  padding: 0.625rem 1rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Table = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 140px 140px 1fr 120px 180px 120px 100px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(var(--color-primary), 0.05);
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 140px 140px 1fr 120px 180px 120px 100px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  align-items: center;
  cursor: pointer;
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(var(--color-primary), 0.02);
  }
`;

const FulfillmentNumber = styled.span`
  font-weight: 600;
  color: rgb(var(--color-primary));
`;

const InquiryLink = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));

  &:hover {
    text-decoration: underline;
  }
`;

const EntityInfo = styled.div`
  .name {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
  }

  .supplier {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
  }
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'completed':
      case 'delivered': return 'rgba(var(--color-success), 0.15)';
      case 'shipped': return 'rgba(var(--color-info), 0.1)';
      case 'in_progress': return 'rgba(var(--color-warning), 0.1)';
      case 'pending': return 'rgba(var(--color-neutral), 0.1)';
      case 'cancelled': return 'rgba(var(--color-error), 0.1)';
      default: return 'rgba(var(--color-neutral), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'completed':
      case 'delivered': return 'rgb(var(--color-success))';
      case 'shipped': return 'rgb(var(--color-info))';
      case 'in_progress': return 'rgb(var(--color-warning))';
      case 'pending': return 'rgb(var(--color-neutral))';
      case 'cancelled': return 'rgb(var(--color-error))';
      default: return 'rgb(var(--color-neutral))';
    }
  }};
`;

const TrackingInfo = styled.div`
  .numbers {
    font-size: 0.875rem;
    font-family: monospace;
    color: rgb(var(--color-text-primary));
  }

  .count {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
  }
`;

const DateCell = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'success' | 'secondary' }>`
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: white;
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'success':
        return `
          background: rgb(var(--color-success));
          color: white;
          border: none;
          &:hover { opacity: 0.9; }
        `;
      default:
        return `
          background: transparent;
          color: rgb(var(--color-text-primary));
          border: 1px solid rgb(var(--color-border));
          &:hover { background: rgba(var(--color-text-primary), 0.05); }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));

  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .title {
    font-size: 1.125rem;
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    margin-bottom: 0.5rem;
  }

  .description {
    font-size: 0.875rem;
  }
`;

const LoadingState = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgb(var(--color-border));
`;

const PaginationInfo = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const PaginationButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const PaginationButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.05);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PartialBadge = styled.span`
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-xs);
  background: rgba(var(--color-warning), 0.1);
  color: rgb(var(--color-warning));
  margin-left: 0.5rem;
`;

// ============================================================================
// Component
// ============================================================================

const Fulfillments: React.FC = () => {
  const [fulfillments, setFulfillments] = useState<FulfillmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FulfillmentStatus | ''>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Detail modal
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<string | null>(null);

  const fetchFulfillments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };

      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const response = await apiClient.get('fulfillments/', { params });
      const data = response.data;

      setFulfillments(data.results || data);
      setTotalCount(data.count || data.length);
    } catch (err) {
      logger.error('Failed to fetch fulfillments:', err);
      setError('Failed to load fulfillments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchFulfillments();
  }, [fetchFulfillments]);

  const handleAction = async (fulfillmentId: string, action: 'ship' | 'deliver' | 'complete') => {
    setActionLoading(fulfillmentId);

    try {
      await apiClient.post(`fulfillments/${fulfillmentId}/${action}/`);
      fetchFulfillments();
    } catch (err) {
      logger.error(`Failed to ${action} fulfillment:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const getActionButton = (fulfillment: FulfillmentListItem) => {
    const isLoading = actionLoading === fulfillment.id;

    switch (fulfillment.status) {
      case 'pending':
      case 'in_progress':
        return (
          <ActionButton
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(fulfillment.id, 'ship');
            }}
            disabled={isLoading}
          >
            {isLoading ? '...' : '📦 Ship'}
          </ActionButton>
        );
      case 'shipped':
        return (
          <ActionButton
            variant="success"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(fulfillment.id, 'deliver');
            }}
            disabled={isLoading}
          >
            {isLoading ? '...' : '✓ Deliver'}
          </ActionButton>
        );
      case 'delivered':
        return (
          <ActionButton
            variant="success"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(fulfillment.id, 'complete');
            }}
            disabled={isLoading}
          >
            {isLoading ? '...' : '✓ Complete'}
          </ActionButton>
        );
      default:
        return null;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Container>
      <Header>
        <Title>📦 Fulfillments</Title>
        <ActionButton variant="primary" onClick={() => setShowCreateModal(true)}>
          + Create Fulfillment
        </ActionButton>
      </Header>

      <FiltersBar>
        <SearchInput
          type="text"
          placeholder="Search fulfillments..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <FilterSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as FulfillmentStatus | '');
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </FilterSelect>
      </FiltersBar>

      <Table>
        <TableHeader>
          <span>Fulfillment #</span>
          <span>Inquiry #</span>
          <span>Customer/Supplier</span>
          <span>Status</span>
          <span>Tracking</span>
          <span>Est. Delivery</span>
          <span>Action</span>
        </TableHeader>

        {loading ? (
          <LoadingState>
            <Skeleton active paragraph={{ rows: 6 }} />
          </LoadingState>
        ) : error ? (
          <EmptyState>
            <div className="icon">⚠️</div>
            <div className="title">Error Loading Fulfillments</div>
            <div className="description">{error}</div>
          </EmptyState>
        ) : fulfillments.length === 0 ? (
          <EmptyState>
            <div className="icon">📦</div>
            <div className="title">No Fulfillments Found</div>
            <div className="description">
              {search || statusFilter
                ? 'Try adjusting your filters'
                : 'Fulfillments will appear here when you create them from accepted inquiries'}
            </div>
          </EmptyState>
        ) : (
          <>
            {fulfillments.map((fulfillment) => (
              <TableRow
                key={fulfillment.id}
                onClick={() => setSelectedFulfillmentId(fulfillment.id)}
              >
                <FulfillmentNumber>
                  {fulfillment.fulfillment_number}
                  {fulfillment.is_partial && <PartialBadge>Partial</PartialBadge>}
                </FulfillmentNumber>
                <InquiryLink>{fulfillment.inquiry_number || '-'}</InquiryLink>
                <EntityInfo>
                  <div className="name">{fulfillment.customer_name || '-'}</div>
                  {fulfillment.supplier_name && (
                    <div className="supplier">from {fulfillment.supplier_name}</div>
                  )}
                </EntityInfo>
                <StatusBadge status={fulfillment.status}>
                  {fulfillment.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </StatusBadge>
                <TrackingInfo>
                  {fulfillment.tracking_numbers && fulfillment.tracking_numbers.length > 0 ? (
                    <>
                      <div className="numbers">{fulfillment.tracking_numbers[0]}</div>
                      {fulfillment.tracking_numbers.length > 1 && (
                        <div className="count">+{fulfillment.tracking_numbers.length - 1} more</div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>No tracking</span>
                  )}
                </TrackingInfo>
                <DateCell>{formatDate((fulfillment as any).expected_delivery ?? (fulfillment as any).estimated_delivery)}</DateCell>
                <div>{getActionButton(fulfillment)}</div>
              </TableRow>
            ))}

            {totalPages > 1 && (
              <Pagination>
                <PaginationInfo>
                  Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
                </PaginationInfo>
                <PaginationButtons>
                  <PaginationButton
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </PaginationButton>
                  <PaginationButton
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </PaginationButton>
                </PaginationButtons>
              </Pagination>
            )}
          </>
        )}
      </Table>

      {/* Create Fulfillment Modal (guided selection) */}
      {showCreateModal && (
        <CreateFulfillmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            void fetchFulfillments();
          }}
        />
      )}

      {/* Fulfillment Detail Modal */}
      {selectedFulfillmentId && (
        <FulfillmentDetailModal
          isOpen={!!selectedFulfillmentId}
          onClose={() => setSelectedFulfillmentId(null)}
          fulfillmentId={selectedFulfillmentId}
          onUpdate={fetchFulfillments}
        />
      )}
    </Container>
  );
};

export default Fulfillments;
