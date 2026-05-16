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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Skeleton } from 'antd';
import styled from 'styled-components';
import { businessApi } from '@/services/businessApi';
import { FulfillmentListItem, FulfillmentStatus } from '../types';
import { FulfillmentDetailModal, CreateFulfillmentModal } from '../components/Fulfillment';
import StatusFilterBar from '@/components/Shared/StatusFilterBar';
import { StatusActionCell } from '@/components/Workflow';
import { logger } from '@/utils/logger';
import { formatDateLocal } from '@/utils/formatters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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

const Table = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 140px 140px 1fr 160px 180px 120px;
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
  grid-template-columns: 140px 140px 1fr 160px 180px 120px;
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

const DateCell = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
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

const CreateButton = styled.button`
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.9; }
`;

// ============================================================================
// Component
// ============================================================================

const Fulfillments: React.FC = () => {
  useDocumentTitle('Fulfillments');
  const [fulfillments, setFulfillments] = useState<FulfillmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FulfillmentStatus | ''>('');
  const [activeTab, setActiveTab] = useState('all');

  const fulfillmentTabs = useMemo(() => [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'completed', label: 'Completed' },
  ], []);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Detail modal
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<string | null>(null);

  const fetchFulfillments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };

      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const response = await businessApi.get('fulfillments/', { params });
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

  const handleCreateClose = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    void fetchFulfillments();
  }, [fetchFulfillments]);

  const handleDetailClose = useCallback(() => {
    setSelectedFulfillmentId(null);
  }, []);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Container>
      <Header>
        <Title>📦 Fulfillments</Title>
        <CreateButton onClick={() => setShowCreateModal(true)}>
          + Create Fulfillment
        </CreateButton>
      </Header>

      <StatusFilterBar
        tabs={fulfillmentTabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setStatusFilter(tab === 'all' ? '' : tab as FulfillmentStatus);
          setPage(1);
        }}
        searchText={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search fulfillments…"
      />

      <Table>
        <TableHeader>
          <span>Fulfillment #</span>
          <span>Inquiry #</span>
          <span>Customer/Supplier</span>
          <span>Status</span>
          <span>Tracking</span>
          <span>Est. Delivery</span>
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
                <div onClick={(e) => e.stopPropagation()}>
                  <StatusActionCell
                    entityType="fulfillment"
                    entityId={fulfillment.id}
                    status={fulfillment.status}
                    onTransitioned={fetchFulfillments}
                  />
                </div>
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
                <DateCell>{formatDateLocal(fulfillment.estimated_delivery)}</DateCell>
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
          onClose={handleCreateClose}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Fulfillment Detail Modal */}
      {selectedFulfillmentId && (
        <FulfillmentDetailModal
          isOpen={!!selectedFulfillmentId}
          onClose={handleDetailClose}
          fulfillmentId={selectedFulfillmentId}
          onUpdate={fetchFulfillments}
        />
      )}
    </Container>
  );
};

export default Fulfillments;
