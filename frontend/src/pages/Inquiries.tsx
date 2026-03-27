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
import React, { useRef, useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiService';
import { InquiryListItem, InquiryStatus, InquiryTemplateListItem } from '../types';
import { InquiryDetailModal, CloneInquiryModal, InquiryCreateModal } from '../components/Inquiry';

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

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

const CreateButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary));
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
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
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
  }
`;

const DropdownContainer = styled.div`
  position: relative;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
  grid-template-columns: 140px 1fr 120px 100px 120px 120px 100px;
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
  grid-template-columns: 140px 1fr 120px 100px 120px 120px 100px;
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
      case 'accepted': return 'rgba(34, 197, 94, 0.1)';
      case 'fulfilled': return 'rgba(34, 197, 94, 0.2)';
      case 'pending': return 'rgba(234, 179, 8, 0.1)';
      case 'quoted': return 'rgba(59, 130, 246, 0.1)';
      case 'rejected': return 'rgba(239, 68, 68, 0.1)';
      case 'expired': return 'rgba(107, 114, 128, 0.1)';
      case 'draft': return 'rgba(107, 114, 128, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'accepted': return 'rgb(22, 163, 74)';
      case 'fulfilled': return 'rgb(22, 163, 74)';
      case 'pending': return 'rgb(202, 138, 4)';
      case 'quoted': return 'rgb(37, 99, 235)';
      case 'rejected': return 'rgb(220, 38, 38)';
      case 'expired': return 'rgb(75, 85, 99)';
      case 'draft': return 'rgb(75, 85, 99)';
      default: return 'rgb(75, 85, 99)';
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

// ============================================================================
// Component
// ============================================================================

const Inquiries: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const didInitFromStateRef = useRef(false);

  const [prefillEntityType, setPrefillEntityType] = useState<'customer' | 'supplier' | undefined>(undefined);
  const [prefillEntityId, setPrefillEntityId] = useState<string | undefined>(undefined);
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<'customer' | 'supplier' | ''>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  
  // Templates
  const [templates, setTemplates] = useState<InquiryTemplateListItem[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (entityTypeFilter) params.entity_type = entityTypeFilter;
      
      const response = await apiClient.get('inquiries/', { params });
      const data = response.data;
      
      setInquiries(data.results || data);
      setTotalCount(data.count || data.length);
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
      setError('Failed to load inquiries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, entityTypeFilter]);
  
  // Fetch templates on mount
  useEffect(() => {
    apiClient.get('inquiry-templates/', { params: { is_active: true } })
      .then(res => setTemplates(res.data.results || res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

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

  const handleRowClick = async (inquiry: InquiryListItem) => {
    try {
      // Fetch full inquiry details
      const response = await apiClient.get(`inquiries/${inquiry.id}/`);
      setSelectedInquiry(response.data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to fetch inquiry details:', err);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchInquiries();
  };

  const handleUpdateInquiry = (updatedInquiry: any) => {
    setSelectedInquiry(updatedInquiry);
    fetchInquiries();
  };
  
  const handleClone = (inquiry: any) => {
    setSelectedInquiry(inquiry);
    setShowDetailModal(false);
    setShowCloneModal(true);
  };
  
  const handleCloned = (newInquiry: any) => {
    setShowCloneModal(false);
    fetchInquiries();
    // Open the newly cloned inquiry
    setSelectedInquiry(newInquiry);
    setShowDetailModal(true);
  };
  
  const handleCreateFromTemplate = async (templateId: string) => {
    setShowTemplateMenu(false);
    try {
      const response = await apiClient.post(`inquiries/from-template/${templateId}/`, {});
      setSelectedInquiry(response.data);
      setShowDetailModal(true);
      fetchInquiries();
    } catch (err) {
      console.error('Failed to create inquiry from template:', err);
      alert('Failed to create inquiry from template');
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
                    <span style={{ fontSize: '0.75rem', color: 'gray', marginLeft: '8px' }}>
                      ({template.product_count} products)
                    </span>
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
          <LoadingState>Loading inquiries...</LoadingState>
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
                <DateCell style={{ color: inquiry.is_expired ? 'rgb(220, 38, 38)' : undefined }}>
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

      {/* Create Inquiry Modal */}
      <InquiryCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => handleCreateSuccess()}
        initialEntityType={prefillEntityType}
        initialEntityId={prefillEntityId}
      />

      {/* Inquiry Detail Modal */}
      <InquiryDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        inquiry={selectedInquiry}
        onUpdate={handleUpdateInquiry}
        onClone={handleClone}
      />
      
      {/* Clone Inquiry Modal */}
      {selectedInquiry && (
        <CloneInquiryModal
          isOpen={showCloneModal}
          onClose={() => setShowCloneModal(false)}
          onCloned={handleCloned}
          inquiry={selectedInquiry}
        />
      )}
    </Container>
  );
};

export default Inquiries;
