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
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { showAlert } from '@/utils/uiDialogs';
import { InquiryListItem, InquiryStatus, InquiryTemplateListItem } from '../types';
import { InquiryDetailModal, CloneInquiryModal } from '../components/Inquiry';
import { UnifiedForm } from '../components/UnifiedForm';
import { inquiryService } from '../services/inquiryService';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  min-width: 0;
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

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgba(var(--color-success), 0.12)';
      case 'fulfilled': return 'rgba(var(--color-success), 0.18)';
      case 'pending': return 'rgba(var(--color-warning), 0.12)';
      case 'quoted': return 'rgba(var(--color-info), 0.12)';
      case 'rejected': return 'rgba(var(--color-danger), 0.12)';
      case 'expired': return 'rgba(var(--color-text-secondary), 0.12)';
      case 'draft': return 'rgba(var(--color-text-secondary), 0.12)';
      default: return 'rgba(var(--color-text-secondary), 0.12)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgb(var(--color-success))';
      case 'fulfilled': return 'rgb(var(--color-success))';
      case 'pending': return 'rgb(var(--color-warning))';
      case 'quoted': return 'rgb(var(--color-info))';
      case 'rejected': return 'rgb(var(--color-danger))';
      case 'expired': return 'rgb(var(--color-text-secondary))';
      case 'draft': return 'rgb(var(--color-text-secondary))';
      default: return 'rgb(var(--color-text-secondary))';
    }
  }};
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
  const navigate = useNavigate();
  const location = useLocation();
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
        const params: Record<string, unknown> = {
          page,
          page_size: pageSize,
        };

        if (search) params.search = search;
        if (statusFilter) params.status = statusFilter;
        if (entityTypeFilter) params.entity_type = entityTypeFilter;

        return inquiryService.listInquiries(params);
      },
    }),
    [entityTypeFilter, page, pageSize, search, statusFilter]
  );
  const inquiriesQuery = useQuery(inquiriesQueryOptions);

  const inquiries = inquiriesQuery.data?.items ?? [];
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
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
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

    const state = (location.state ?? {}) as any;
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
    void inquiriesQuery.refetch();
  }, [inquiriesQuery]);

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

  const handleUpdateInquiry = useCallback((updatedInquiry: any) => {
    setSelectedInquiry(updatedInquiry);
    void inquiriesQuery.refetch();
  }, [inquiriesQuery]);

  const handleClone = useCallback((inquiry: any) => {
    setDetailReviewMode(false);
    setSelectedInquiry(inquiry);
    setShowDetailModal(false);
    setShowCloneModal(true);
  }, []);

  const handleCloned = useCallback((newInquiry: any) => {
    setShowCloneModal(false);
    void inquiriesQuery.refetch();
    setSelectedInquiry(newInquiry);
    setDetailReviewMode(false);
    setShowDetailModal(true);
  }, [inquiriesQuery]);

  const handleCreateFromTemplate = async (templateId: string) => {
    setShowTemplateMenu(false);
    try {
      const detail = await inquiryService.createInquiryFromTemplate(templateId);
      setSelectedInquiry(detail);
      setDetailReviewMode(false);
      setShowDetailModal(true);
      void inquiriesQuery.refetch();
    } catch (err) {
      logger.error('Failed to create inquiry from template:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        content: 'Failed to create inquiry from template',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Container>
      <Header>
        <Title>📋 Inquiries</Title>
        <HeaderActions>
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
        </HeaderActions>
      </Header>

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
                <StatusBadge status={inquiry.status}>
                  {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                </StatusBadge>
                <ProductCount>{inquiry.product_count || 0}</ProductCount>
                <Amount>{formatCurrency(inquiry.total_actual || inquiry.total_desired)}</Amount>
                <DateCell style={{ color: inquiry.is_expired ? 'rgb(var(--color-danger))' : undefined }}>
                  {inquiry.valid_until ? formatDate(inquiry.valid_until) : '-'}
                  {inquiry.is_expired && ' ⚠️'}
                </DateCell>
                <DateCell>{formatDate(inquiry.created_on)}</DateCell>
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
