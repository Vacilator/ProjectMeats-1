/**
 * Invoices Page (Receivables)
 *
 * Customer invoice management with payment tracking and activity logging.
 *
 * Features:
 * - View all customer invoices with status filtering
 * - Filter by status: Draft | Sent | Paid | Overdue | Cancelled
 * - Side panel with invoice details and activity feed
 * - Payment tracking with outstanding amounts
 * - Theme-compliant styling (32px headers, color variables)
 *
 * Pattern: Follows Claims.tsx/SalesOrders.tsx architecture for consistency
 */
import React, { useCallback, useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Skeleton, message } from 'antd';
import { FileText } from 'lucide-react';

import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '../../components/Onboarding';
import SharePortalLinkPanel from '../../components/Portal/SharePortalLinkPanel';
import { ActivityFeed, RecordPaymentModal, PaymentHistoryList } from '../../components/Shared';
import InvoiceForm from './InvoiceForm';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import { businessApi } from '@/services/businessApi';
import { traderService } from '@/services/traderService';
import { coerceFiniteNumber, formatCurrency } from '../../shared/utils';
import type { TradeTimelinePayload, TradeWeightPayload } from '../../utils/trade';
import { formatTradeDate, formatTradeWeight } from '../../utils/trade';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { buildCsv, downloadCsv } from '@/utils/csv';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { StatusActionCell } from '@/components/Workflow';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface Invoice {
  id: number;
  tenant: string;
  invoice_number: string;
  customer: number;
  customer_name?: string;
  sales_order: number | null;
  our_sales_order_num: string;
  date_time_stamp: string;
  due_date: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partial_paid' | 'paid' | 'overdue' | 'cancelled';
  total_amount: string;
  paid_amount?: string;
  outstanding_amount?: string;
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

type InvoiceStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partial_paid' | 'paid' | 'overdue' | 'cancelled';

// ============================================================================
// Styled Components (Theme-Compliant)
// ============================================================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem;
  background: rgb(var(--color-background));
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const PrimaryButton = styled.button`
  padding: 0.75rem 1.5rem;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  padding: 0.75rem 1.5rem;
  background: rgb(var(--color-bg-secondary));
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgb(var(--color-bg-tertiary));
    color: rgb(var(--color-text-primary));
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
  transition: grid-template-columns 0.3s ease;
  flex: 1;
  overflow: hidden;

  /* Stack layout on tablets and mobile */
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const FilterButton = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 1rem;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))'};
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-primary))'};
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`;

const SearchInput = styled.input`
  padding: 0.5rem 1rem;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const TableContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const TableWrapper = styled.div`
  overflow-y: auto;
  flex: 1;

  /* Only enable horizontal scroll on small screens when truly needed */
  @media (max-width: 768px) {
    overflow-x: auto;
  }

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
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
`;

const TableHeader = styled.thead`
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  position: sticky;
  top: 0;
  z-index: 10;
`;

const TableRow = styled.tr<{ $clickable?: boolean; $selected?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border));
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};
  background: ${props => props.$selected ? 'rgba(var(--color-primary), 0.05)' : 'transparent'};
  transition: background 0.15s ease;

  &:hover {
    background: ${props => props.$clickable ? 'rgba(var(--color-primary), 0.08)' : 'transparent'};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const TableHead = styled.th`
  padding: 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--color-text-secondary));
`;

const TableCell = styled.td`
  padding: 1rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const SidePanel = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  max-height: calc(100vh - 8rem);

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 4px;
  }
`;

const SidePanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SidePanelTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const RecordPaymentButton = styled.button`
  background: rgba(var(--color-success), 0.1);
  border: 1px solid rgba(var(--color-success), 0.3);
  color: rgb(var(--color-success));
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(var(--color-success), 0.15);
    border-color: rgba(var(--color-success), 0.5);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DetailLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--color-text-secondary));
`;

const DetailValue = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const ErrorMessage = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgba(var(--color-error), 1);
  font-size: 0.875rem;
`;

const EmptyMessage = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

// ============================================================================
// Main Component
// ============================================================================

const Invoices: React.FC = () => {
  useDocumentTitle('Invoices');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPortalAccess, setShowPortalAccess] = useState(false);

  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: withTenantQueryKey('invoices', statusFilter),
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await businessApi.get('accounting/invoices/', { params });
      const invoicesData = response.data.results || response.data;
      return invoicesData.map((invoice: Invoice) => ({
        ...invoice,
        outstanding_amount: invoice.outstanding_amount ||
                          (invoice.status === 'paid' ? '0.00' : invoice.total_amount),
      })) as Invoice[];
    },
    staleTime: 30_000,
  });

  const invoices = invoicesQuery.data ?? [];
  const loading = invoicesQuery.isLoading;
  const error = invoicesQuery.error ? 'Failed to load invoices' : null;

  const refreshInvoices = useCallback(
    () => queryClient.invalidateQueries({ queryKey: withTenantQueryKey('invoices') }),
    [queryClient]
  );

  const handlePaymentModalClose = useCallback(() => setShowPaymentModal(false), []);
  const handleCreateModalClose = useCallback(() => setIsModalOpen(false), []);

  const handlePaymentSuccess = useCallback(() => {
    refreshInvoices();
    setShowPaymentModal(false);
  }, [refreshInvoices]);
  const handleCreateSuccess = useCallback(() => refreshInvoices(), [refreshInvoices]);

  useEffect(() => {
    if (searchParams.get('action') !== 'create') {
      return;
    }

    setIsModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const state = (location.state ?? {}) as { openCreateModal?: boolean };
    if (!state.openCreateModal) {
      return;
    }

    setIsModalOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  // Filter invoices by status and search query
  const filteredInvoices = invoices.filter(invoice => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending_approval') {
        if (invoice.status !== 'pending_approval' && invoice.status !== 'approved') return false;
      } else if (statusFilter === 'paid') {
        if (invoice.status !== 'paid' && invoice.status !== 'partial_paid') return false;
      } else if (invoice.status !== statusFilter) {
        return false;
      }
    }

    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.customer_name?.toLowerCase().includes(query) ||
      invoice.our_sales_order_num.toLowerCase().includes(query)
    );
  });

  // Count invoices by status
  const counts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    pending: invoices.filter(i => i.status === 'pending_approval' || i.status === 'approved').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid' || i.status === 'partial_paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    cancelled: invoices.filter(i => i.status === 'cancelled').length,
  };

  const openCreateInvoice = () => {
    setIsModalOpen(true);
  };

  const handleExportCsv = () => {
    const headers = ['Invoice #', 'Customer', 'Status', 'Total', 'Paid', 'Outstanding', 'Due Date', 'Created'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number, inv.customer_name ?? '', inv.status,
      inv.total_amount, inv.paid_amount ?? '', inv.outstanding_amount ?? '',
      inv.due_date ?? '', inv.created_on,
    ]);
    const csv = buildCsv({ headers, rows });
    downloadCsv(`invoices_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Receivables - Invoices</PageTitle>
        <HeaderActions>
          <SecondaryButton onClick={handleExportCsv} disabled={!filteredInvoices.length}>
            Export CSV
          </SecondaryButton>
          <PrimaryButton onClick={openCreateInvoice}>
            + Create Invoice
          </PrimaryButton>
        </HeaderActions>
      </PageHeader>

      <ContentContainer $hasSidePanel={!!selectedInvoice}>
        <MainContent>
          <FilterBar>
            <FilterButton $active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All ({counts.all})
            </FilterButton>
            <FilterButton $active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')}>
              Draft ({counts.draft})
            </FilterButton>
            <FilterButton $active={statusFilter === 'pending_approval'} onClick={() => setStatusFilter('pending_approval')}>
              Pending ({counts.pending})
            </FilterButton>
            <FilterButton $active={statusFilter === 'sent'} onClick={() => setStatusFilter('sent')}>
              Sent ({counts.sent})
            </FilterButton>
            <FilterButton $active={statusFilter === 'paid'} onClick={() => setStatusFilter('paid')}>
              Paid ({counts.paid})
            </FilterButton>
            <FilterButton $active={statusFilter === 'overdue'} onClick={() => setStatusFilter('overdue')}>
              Overdue ({counts.overdue})
            </FilterButton>
            <FilterButton $active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')}>
              Cancelled ({counts.cancelled})
            </FilterButton>
            <SearchInput
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </FilterBar>

          <TableContainer>
            {loading ? (
              <div style={{ padding: 16 }}>
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : filteredInvoices.length === 0 ? (
              searchQuery || statusFilter !== 'all' ? (
                <EmptyMessage>No invoices match your current filters</EmptyMessage>
              ) : (
                <TransactionalEmptyState
                  icon={<FileText size={36} />}
                  title="No invoices yet"
                  message="Create your first invoice to track what is owed, due dates, and payment progress for receivables."
                  actions={[
                    {
                      label: 'Create Invoice',
                      onClick: openCreateInvoice,
                      variant: 'primary',
                    },
                    {
                      label: 'Create Sales Order',
                      onClick: () => navigate('/sales-orders?action=create'),
                      variant: 'secondary',
                    },
                  ]}
                >
                  <TransactionalEmptyStateGuidance>
                    <TransactionalEmptyStateGuidanceItem>
                      Invoices are easiest to manage once the related sales order already exists.
                    </TransactionalEmptyStateGuidanceItem>
                    <TransactionalEmptyStateGuidanceItem>
                      Use invoices to track outstanding balances, payment history, and overdue follow-up.
                    </TransactionalEmptyStateGuidanceItem>
                  </TransactionalEmptyStateGuidance>
                </TransactionalEmptyState>
              )
            ) : (
              <TableWrapper>
                <Table aria-label="Invoices list">
                  <TableHeader>
                    <tr>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>SO Reference</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {filteredInvoices.map(invoice => (
                      <TableRow
                        key={invoice.id}
                        $clickable
                        $selected={selectedInvoice?.id === invoice.id}
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <TableCell>{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.customer_name || `Customer #${invoice.customer}`}</TableCell>
                        <TableCell>{invoice.our_sales_order_num || '-'}</TableCell>
                        <TableCell>
                          {formatTradeDate(
                            invoice.trade_timeline,
                            'date_time_stamp',
                            invoice.date_time_stamp,
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {formatTradeDate(invoice.trade_timeline, 'due_date', invoice.due_date, '-')}
                        </TableCell>
                        <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                        <TableCell>
                          {formatCurrency(invoice.outstanding_amount || invoice.total_amount)}
                        </TableCell>
                        <TableCell>
                          <StatusActionCell
                            entityType="invoice"
                            entityId={invoice.id}
                            status={invoice.status}
                            onTransitioned={() => refreshInvoices()}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </TableWrapper>
            )}
          </TableContainer>
        </MainContent>

        {selectedInvoice && (
          <SidePanel>
            <SidePanelHeader>
              <SidePanelTitle>
                {showPortalAccess ? 'Portal Access' : selectedInvoice.invoice_number}
              </SidePanelTitle>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {!showPortalAccess ? (
                  <>
                    <RecordPaymentButton
                      onClick={() =>
                        navigate(`/records/invoice/${encodeURIComponent(String(selectedInvoice.id))}`)
                      }
                    >
                      Open Record
                    </RecordPaymentButton>
                    <RecordPaymentButton onClick={() => setShowPortalAccess(true)}>
                      Portal Access
                    </RecordPaymentButton>
                    {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                      <>
                        <RecordPaymentButton onClick={() => setShowPaymentModal(true)}>
                          💰 Record Payment
                        </RecordPaymentButton>
                        <RecordPaymentButton onClick={async () => {
                          try {
                            await traderService.sendInvoiceEmail(String(selectedInvoice.id));
                            message.success('Invoice email sent successfully');
                          } catch {
                            message.error('Failed to send invoice email');
                          }
                        }}>
                          ✉️ Email Invoice
                        </RecordPaymentButton>
                      </>
                    )}
                  </>
                ) : null}
                <CloseButton onClick={() => setSelectedInvoice(null)}>×</CloseButton>
              </div>
            </SidePanelHeader>

            {showPortalAccess ? (
              <SharePortalLinkPanel
                entityType="invoice"
                entityId={selectedInvoice.id}
                onBack={() => setShowPortalAccess(false)}
              />
            ) : (
              <>
                <DetailSection>
                  <DetailLabel>Customer</DetailLabel>
                  <DetailValue>
                    {selectedInvoice.customer_name || `Customer #${selectedInvoice.customer}`}
                  </DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Sales Order</DetailLabel>
                  <DetailValue>{selectedInvoice.our_sales_order_num || 'N/A'}</DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Invoice Date</DetailLabel>
                  <DetailValue>
                    {formatTradeDate(
                      selectedInvoice.trade_timeline,
                      'date_time_stamp',
                      selectedInvoice.date_time_stamp
                    )}
                  </DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Due Date</DetailLabel>
                  <DetailValue>
                    {formatTradeDate(
                      selectedInvoice.trade_timeline,
                      'due_date',
                      selectedInvoice.due_date,
                      'Not set'
                    )}
                  </DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Total Weight</DetailLabel>
                  <DetailValue>{formatTradeWeight(selectedInvoice)}</DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Financial Summary</DetailLabel>
                  <DetailValue>
                    <div>Total: {formatCurrency(selectedInvoice.total_amount)}</div>
                    <div>
                      Outstanding: {formatCurrency(selectedInvoice.outstanding_amount || selectedInvoice.total_amount)}
                    </div>
                  </DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Status</DetailLabel>
                  <DetailValue>
                    <StatusActionCell
                      entityType="invoice"
                      entityId={selectedInvoice.id}
                      status={selectedInvoice.status}
                      compact
                    />
                  </DetailValue>
                </DetailSection>

                {selectedInvoice.notes && (
                  <DetailSection>
                    <DetailLabel>Notes</DetailLabel>
                    <DetailValue>{selectedInvoice.notes}</DetailValue>
                  </DetailSection>
                )}

                <DetailSection>
                  <DetailLabel>Payment History</DetailLabel>
                  <PaymentHistoryList
                    entityType="invoice"
                    entityId={selectedInvoice.id}
                  />
                </DetailSection>

                <DetailSection>
                  <DetailLabel>Activity Log</DetailLabel>
                  <ActivityFeed
                    entityType="invoice"
                    entityId={selectedInvoice.id}
                    showCreateForm={true}
                    maxHeight="400px"
                  />
                </DetailSection>

                <DetailSection>
                  <AIEntityInsights entityType="invoice" entityId={String(selectedInvoice.id)} />
                </DetailSection>

                <DetailSection>
                  <EntityWorkflowStatusPanel entityType="invoice" entityId={String(selectedInvoice.id)} />
                </DetailSection>

                <RecordPaymentModal
                  isOpen={showPaymentModal}
                  onClose={handlePaymentModalClose}
                  entityType="invoice"
                  entityId={selectedInvoice.id}
                  entityReference={selectedInvoice.invoice_number}
                  outstandingAmount={
                    coerceFiniteNumber(
                      selectedInvoice.outstanding_amount || selectedInvoice.total_amount
                    ) ?? 0
                  }
                  onSuccess={handlePaymentSuccess}
                />
              </>
            )}
          </SidePanel>
        )}
      </ContentContainer>

      {isModalOpen && (
        <FormErrorBoundary entityType="invoice" onClose={handleCreateModalClose}>
          <InvoiceForm
            mode="create"
            onSuccess={handleCreateSuccess}
            onCancel={handleCreateModalClose}
          />
        </FormErrorBoundary>
      )}
    </PageContainer>
  );
};

export default Invoices;
