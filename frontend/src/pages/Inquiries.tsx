/**
 * Inquiries Page
 *
 * List and manage product inquiries.
 * Features:
 * - Inquiry list with search and filters
 * - Status badges and workflow
 * - Create new inquiry
 * - View inquiry details
 * - Create fulfillment from accepted inquiries
 * - Clone existing inquiries
 * - Create from templates
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { showAlert } from '@/utils/uiDialogs';
import { buildCsv, downloadCsv } from '@/utils/csv';
import { EntityPageHeader } from '@/components/Shared/EntityPageHeader';
import { InquiryListItem, InquiryStatus, InquiryTemplateListItem, Inquiry } from '../types';
import { InquiryDetailModal, CloneInquiryModal } from '../components/Inquiry';
import { UnifiedForm } from '../components/UnifiedForm';
import { inquiryService } from '../services/inquiryService';
import { formatDateLocal } from '@/utils/formatters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import { StatusActionCell } from '@/components/Workflow';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  min-width: 0;
`;



const CreateButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;

  @media (max-width: 520px) {
    width: 100%;
    justify-content: center;
  }

  &:hover {
    opacity: 0.9;
  }
`;

const SecondaryButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;

  @media (max-width: 520px) {
    width: 100%;
    justify-content: center;
  }

  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const DropdownContainer = styled.div`
  position: relative;

  @media (max-width: 520px) {
    width: 100%;
  }
`;

const DropdownMenu = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'block' : 'none'};
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-float);
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
`;

const DropdownItem = styled.button`
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-primary), 0.1);
  }

  &:not(:last-child) {
    border-bottom: 1px solid rgb(var(--color-border));
  }
`;

const DropdownLabel = styled.div`
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(var(--color-primary), 0.05);
`;

const TemplateMeta = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  margin-left: 0.5rem;
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
  min-height: 44px;

  @media (max-width: 520px) {
    min-width: 0;
    width: 100%;
    font-size: 16px; /* iOS Safari zoom-on-focus prevention */
  }

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
  min-height: 44px;

  @media (max-width: 520px) {
    min-width: 0;
    width: 100%;
    font-size: 16px; /* iOS Safari zoom-on-focus prevention */
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
  min-width: 0;
  border-radius: var(--radius-lg);
`;

const Table = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-width: 920px;

  @media (max-width: 520px) {
    min-width: 0;
  }
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr 120px 100px 120px 120px 100px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(var(--color-primary), 0.05);
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.025em;

  @media (max-width: 520px) {
    grid-template-columns: 120px 1fr 110px;

    > :nth-child(n+4) {
      display: none;
    }
  }
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr 120px 100px 120px 120px 100px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  align-items: center;
  cursor: pointer;
  transition: background 0.15s;

  @media (max-width: 520px) {
    grid-template-columns: 120px 1fr 110px;

    > :nth-child(n+4) {
      display: none;
    }
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(var(--color-primary), 0.02);
  }
`;

const InquiryNumber = styled.span`
  font-weight: 600;
  color: rgb(var(--color-primary));
`;

const EntityInfo = styled.div`
  .name {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
  }

  .contact {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
  }
`;

const ProductCount = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const Amount = styled.span`
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const DateCell = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
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
    margin-bottom: 1.5rem;
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
  flex-wrap: wrap;
  gap: 0.75rem;

  @media (max-width: 520px) {
    align-items: stretch;
  }
`;

const PaginationInfo = styled.span`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));

  @media (max-width: 520px) {
    width: 100%;
  }
`;

const PaginationButtons = styled.div`
  display: flex;
  gap: 0.5rem;

  @media (max-width: 520px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const PaginationButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  cursor: pointer;
  min-height: 44px;

  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.05);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

const Inquiries: React.FC = () => {
  useDocumentTitle('Inquiries');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const didInitFromStateRef = useRef(false);
  const didInitReviewRef = useRef<string | null>(null);

  const [prefillEntityType, setPrefillEntityType] = useState<'customer' | 'supplier' | undefined>(undefined);
  const [prefillEntityId, setPrefillEntityId] = useState<string | undefined>(undefined);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<'customer' | 'supplier' | ''>('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const inquiriesQueryOptions = useMemo(
    () => ({
      queryKey: withTenantQueryKey('inquiries', page, pageSize, search, statusFilter, entityTypeFilter),
      queryFn: async () => {
        try {
          const params: Record<string, unknown> = {
            page,
            page_size: pageSize,
          };

          if (search) params.search = search;
          if (statusFilter) params.status = statusFilter;
          if (entityTypeFilter) params.entity_type = entityTypeFilter;

          return await inquiryService.listInquiries(params);
        } catch {
          return { items: [], count: 0 };
        }
      },
    }),
    [entityTypeFilter, page, pageSize, search, statusFilter]
  );
  const inquiriesQuery = useQuery(inquiriesQueryOptions);
  const refreshInquiries = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: withTenantQueryKey('inquiries', page, pageSize, search, statusFilter, entityTypeFilter),
      }),
    [entityTypeFilter, page, pageSize, queryClient, search, statusFilter]
  );

  const inquiries = useMemo(() => inquiriesQuery.data?.items ?? [], [inquiriesQuery.data?.items]);
  const totalCount = inquiriesQuery.data?.count ?? 0;
  const loading = inquiriesQuery.isLoading;
  const error = inquiriesQuery.isError ? 'Failed to load inquiries. Please try again.' : null;

  useEffect(() => {
    if (inquiriesQuery.error) {
      logger.error('[Inquiries] Failed to fetch inquiries:', inquiriesQuery.error);
    }
  }, [inquiriesQuery.error]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [detailReviewMode, setDetailReviewMode] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<InquiryTemplateListItem[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const reviewSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const reviewInquiryId = reviewSearchParams.get('inquiry');
  const isReviewLink = reviewSearchParams.get('review') === 'inquiry';


  // Fetch templates on mount
  useEffect(() => {
    inquiryService.listInquiryTemplates()
      .then(setTemplates)
      .catch((err: unknown) => logger.error('Failed to load inquiry templates', {}, err));
  }, []);


  // Allow deep-linking from Cockpit to open the create modal with context.
  useEffect(() => {
    if (didInitFromStateRef.current) return;

    const state = (location.state ?? {}) as Record<string, unknown>;
    if (state?.openCreateModal) {
      didInitFromStateRef.current = true;
      setPrefillEntityType(state.entityType === 'supplier' ? 'supplier' : state.entityType === 'customer' ? 'customer' : undefined);
      setPrefillEntityId(typeof state.entityId === 'string' ? state.entityId : state.entityId != null ? String(state.entityId) : undefined);
      setShowCreateModal(true);

      // Clear state so refresh/back doesn't repeatedly reopen the modal.
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const clearReviewParams = useCallback(() => {
    if (!isReviewLink && !reviewInquiryId) {
      return;
    }

    const params = new URLSearchParams(location.search);
    params.delete('review');
    params.delete('inquiry');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true, state: location.state }
    );
  }, [isReviewLink, location.pathname, location.search, location.state, navigate, reviewInquiryId]);

  const openInquiryDetail = useCallback(async (inquiryId: string, reviewMode = false) => {
    try {
      const detail = await inquiryService.getInquiryDetail(inquiryId);
      setSelectedInquiry(detail);
      setDetailReviewMode(reviewMode);
      setShowDetailModal(true);
    } catch (err) {
      logger.error('Failed to fetch inquiry details:', err);
    }
  }, []);

  useEffect(() => {
    if (!isReviewLink || !reviewInquiryId) {
      didInitReviewRef.current = null;
      return;
    }
    if (didInitReviewRef.current === reviewInquiryId) {
      return;
    }

    didInitReviewRef.current = reviewInquiryId;
    void openInquiryDetail(reviewInquiryId, true);
  }, [isReviewLink, openInquiryDetail, reviewInquiryId]);

  const handleRowClick = async (inquiry: InquiryListItem) => {
    await openInquiryDetail(String(inquiry.id));
  };

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    void refreshInquiries();
  }, [refreshInquiries]);

  const handleCreateClose = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleDetailClose = useCallback(() => {
    setShowDetailModal(false);
    setDetailReviewMode(false);
    clearReviewParams();
  }, [clearReviewParams]);

  const handleCloneClose = useCallback(() => {
    setShowCloneModal(false);
  }, []);

  const handleUpdateInquiry = useCallback((updatedInquiry: Inquiry) => {
    setSelectedInquiry(updatedInquiry);
    void refreshInquiries();
  }, [refreshInquiries]);

  const handleClone = useCallback((inquiry: Inquiry) => {
    setDetailReviewMode(false);
    setSelectedInquiry(inquiry);
    setShowDetailModal(false);
    setShowCloneModal(true);
  }, []);

  const handleCloned = useCallback((newInquiry: Inquiry) => {
    setShowCloneModal(false);
    void refreshInquiries();
    setSelectedInquiry(newInquiry);
    setDetailReviewMode(false);
    setShowDetailModal(true);
  }, [refreshInquiries]);

  const handleCreateFromTemplate = useCallback(async (templateId: string) => {
    setShowTemplateMenu(false);
    try {
      const detail = await inquiryService.createInquiryFromTemplate(templateId);
      setSelectedInquiry(detail);
      setDetailReviewMode(false);
      setShowDetailModal(true);
      void refreshInquiries();
    } catch (err) {
      logger.error('Failed to create inquiry from template:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        content: 'Failed to create inquiry from template',
      });
    }
  }, [refreshInquiries]);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportCSV = useCallback(() => {
    if (!inquiries.length) return;
    const csv = buildCsv({
      headers: ['Inquiry #', 'Customer', 'Supplier', 'Contact', 'Status', 'Entity Type', 'Products', 'Amount', 'Valid Until', 'Created'],
      rows: inquiries.map((inq) => [
        inq.inquiry_number,
        inq.customer_name ?? '',
        inq.supplier_name ?? '',
        inq.contact_name ?? '',
        inq.status,
        inq.entity_type,
        String(inq.product_count ?? 0),
        inq.total_actual != null ? inq.total_actual.toFixed(2) : inq.total_desired != null ? inq.total_desired.toFixed(2) : '',
        inq.valid_until ?? '',
        inq.created_on ?? '',
      ]),
    });
    downloadCsv(`inquiries-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [inquiries]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Container>
      <EntityPageHeader
        title="📋 Inquiries"
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <SecondaryButton onClick={handleExportCSV} disabled={!inquiries.length}>
              📥 Export CSV
            </SecondaryButton>
            {templates.length > 0 && (
              <DropdownContainer>
                <SecondaryButton onClick={() => setShowTemplateMenu(!showTemplateMenu)}>
                  📝 From Template ▾
                </SecondaryButton>
                <DropdownMenu $isOpen={showTemplateMenu}>
                  <DropdownLabel>Templates</DropdownLabel>
                  {templates.map(template => (
                    <DropdownItem
                      key={template.id}
                      onClick={() => handleCreateFromTemplate(template.id)}
                    >
                      {template.name}
                      <TemplateMeta>({template.product_count} products)</TemplateMeta>
                    </DropdownItem>
                  ))}
                  <DropdownItem onClick={() => navigate('/inquiries/templates')}>
                    ⚙️ Manage Templates...
                  </DropdownItem>
                </DropdownMenu>
              </DropdownContainer>
            )}
            <CreateButton onClick={() => setShowCreateModal(true)}>
              + New Inquiry
            </CreateButton>
          </div>
        }
      />

      <FiltersBar>
        <SearchInput
          type="text"
          placeholder="Search inquiries..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <FilterSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as InquiryStatus | '');
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="quoted">Quoted</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="fulfilled">Fulfilled</option>
        </FilterSelect>

        <FilterSelect
          value={entityTypeFilter}
          onChange={(e) => {
            setEntityTypeFilter(e.target.value as 'customer' | 'supplier' | '');
            setPage(1);
          }}
        >
          <option value="">All Types</option>
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
        </FilterSelect>
      </FiltersBar>

      <TableWrapper data-testid="inquiries-table-wrapper">
        <Table>
          <TableHeader>
            <span>Inquiry #</span>
            <span>Customer/Supplier</span>
            <span>Status</span>
            <span>Products</span>
            <span>Value</span>
            <span>Valid Until</span>
            <span>Created</span>
          </TableHeader>

        {loading ? (
          <LoadingState>
            <Skeleton active paragraph={{ rows: 6 }} />
          </LoadingState>
        ) : error ? (
          <EmptyState>
            <div className="icon">⚠️</div>
            <div className="title">Error Loading Inquiries</div>
            <div className="description">{error}</div>
          </EmptyState>
        ) : inquiries.length === 0 ? (
          <EmptyState>
            <div className="icon">📋</div>
            <div className="title">No Inquiries Found</div>
            <div className="description">
              {search || statusFilter || entityTypeFilter
                ? 'Try adjusting your filters'
                : 'Create your first inquiry to get started'}
            </div>
            {!search && !statusFilter && !entityTypeFilter && (
              <CreateButton onClick={() => setShowCreateModal(true)}>
                + Create Inquiry
              </CreateButton>
            )}
          </EmptyState>
        ) : (
          <>
            {inquiries.map((inquiry) => (
              <TableRow key={inquiry.id} onClick={() => handleRowClick(inquiry)}>
                <InquiryNumber>{inquiry.inquiry_number}</InquiryNumber>
                <EntityInfo>
                  <div className="name">
                    {inquiry.customer_name || inquiry.supplier_name}
                  </div>
                  {inquiry.contact_name && (
                    <div className="contact">{inquiry.contact_name}</div>
                  )}
                </EntityInfo>
                <StatusActionCell
                  entityType="inquiry"
                  entityId={inquiry.id}
                  status={inquiry.status}
                  onTransitioned={() => {
                    queryClient.invalidateQueries({
                      queryKey: withTenantQueryKey('inquiries'),
                    });
                  }}
                />
                <ProductCount>{inquiry.product_count || 0}</ProductCount>
                <Amount>{formatCurrency(inquiry.total_actual || inquiry.total_desired)}</Amount>
                <DateCell style={{ color: inquiry.is_expired ? 'rgb(var(--color-danger))' : undefined }}>
                  {inquiry.valid_until ? formatDateLocal(inquiry.valid_until) : '-'}
                  {inquiry.is_expired && ' ⚠️'}
                </DateCell>
                <DateCell>{formatDateLocal(inquiry.created_on)}</DateCell>
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
      </TableWrapper>

      {/* Create Inquiry (UnifiedForm → enhanced inquiry form by default) */}
      <FormErrorBoundary entityType="inquiry" onClose={handleCreateClose}>
        <UnifiedForm
          entityType="inquiry"
          mode="create"
          isOpen={showCreateModal}
          onClose={handleCreateClose}
          context={{
            customerId: prefillEntityType === 'customer' ? prefillEntityId : undefined,
            supplierId: prefillEntityType === 'supplier' ? prefillEntityId : undefined,
          }}
          onSuccess={handleCreateSuccess}
        />
      </FormErrorBoundary>

      {/* Inquiry Detail Modal */}
      {showDetailModal && selectedInquiry ? (
        <InquiryDetailModal
          isOpen={showDetailModal}
          onClose={handleDetailClose}
          inquiry={selectedInquiry}
          reviewMode={detailReviewMode}
          onUpdate={handleUpdateInquiry}
          onClone={handleClone}
        />
      ) : null}

      {/* Clone Inquiry Modal */}
      {showCloneModal && selectedInquiry ? (
        <CloneInquiryModal
          isOpen={showCloneModal}
          onClose={handleCloneClose}
          onCloned={handleCloned}
          inquiry={selectedInquiry}
        />
      ) : null}
    </Container>
  );
};

export default Inquiries;
