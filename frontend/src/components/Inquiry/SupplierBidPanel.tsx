/**
 * SupplierBidPanel — Per-product supplier bid management
 *
 * Displays supplier bids as child rows that mirror the product row layout.
 * Each bid shows: supplier, quantity, price/unit, UOM, total, notes + actions.
 * Ship-to location is rendered at product level by the parent component.
 *
 * Requirements:
 * - Bid form mirrors product row structure (same fields + supplier dropdown)
 * - Remove redundant respond_by / fulfillment_date (valid_until on inquiry is canonical)
 * - Bids save and display correctly after creation
 */
import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message, Tooltip, Tag, Popconfirm, Select, Input, InputNumber } from 'antd';
import { Plus, Send, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InquiryProduct, InquiryProductSupplierBid, SupplierBidStatus } from '../../types';
import { inquiryService } from '../../services/inquiryService';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { suppliersApi, type Supplier } from '@/services/businessApi';

// ── Status visual config ──

const BID_STATUS_META: Record<SupplierBidStatus, { label: string; color: string; icon: string }> = {
  draft: { label: 'Draft', color: 'default', icon: '📝' },
  requested: { label: 'Bid Requested', color: 'processing', icon: '📤' },
  received: { label: 'Bid Received', color: 'warning', icon: '📥' },
  accepted: { label: 'Accepted', color: 'success', icon: '✅' },
  rejected: { label: 'Rejected', color: 'error', icon: '❌' },
  expired: { label: 'Expired', color: 'default', icon: '⏰' },
  withdrawn: { label: 'Withdrawn', color: 'default', icon: '↩️' },
};

// ── UOM options (must match backend UOMChoices exactly) ──
const UOM_OPTIONS = [
  { value: 'LBS', label: 'Lbs' },
  { value: 'KG', label: 'Kg' },
  { value: 'CS', label: 'Cases' },
  { value: 'EA', label: 'Each' },
  { value: 'PLT', label: 'Pallets' },
  { value: 'BOX', label: 'Boxes' },
];

// ── Props ──

interface SupplierBidPanelProps {
  product: InquiryProduct;
  inquiryStatus: string;
  readOnly?: boolean;
}

// ── New bid form state ──
interface NewBidForm {
  supplier: string;
  bid_quantity: string;
  bid_price_per_unit: string;
  bid_uom: string;
  bid_total: string;
  bid_notes: string;
}

const EMPTY_BID_FORM: NewBidForm = {
  supplier: '',
  bid_quantity: '',
  bid_price_per_unit: '',
  bid_uom: 'LBS',
  bid_total: '',
  bid_notes: '',
};

// ── Component ──

export const SupplierBidPanel: React.FC<SupplierBidPanelProps> = ({
  product,
  inquiryStatus,
  readOnly = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [addingBid, setAddingBid] = useState(false);
  const [newBid, setNewBid] = useState<NewBidForm>(EMPTY_BID_FORM);
  const queryClient = useQueryClient();

  const bids = useMemo(() => product.supplier_bids ?? [], [product.supplier_bids]);
  const canManageBids = !readOnly && ['draft', 'pending', 'quoted', 'approved', 'action_required', 'in_progress'].includes(inquiryStatus);
  const hasDraftBids = bids.some(b => b.bid_status === 'draft');

  // Fetch suppliers for searchable dropdown
  const { data: suppliers } = useQuery({
    queryKey: withTenantQueryKey('suppliers-list'),
    queryFn: async () => {
      return await suppliersApi.list();
    },
    enabled: canManageBids,
    staleTime: 60_000,
    retry: false,
  });

  const supplierOptions = useMemo(() => {
    if (!suppliers?.length) return [];
    return suppliers
      .filter((s: Supplier) => s.is_active !== false)
      .map((s: Supplier) => ({
        value: String(s.id),
        label: s.name,
        searchText: `${s.name} ${s.contact_person ?? ''} ${s.city ?? ''} ${s.supplier_type ?? ''}`.toLowerCase(),
      }));
  }, [suppliers]);

  const invalidateInquiry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('inquiry') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('inquiries') });
  }, [queryClient]);

  // ── Mutations ──

  const requestBidMutation = useMutation({
    retry: false,
    mutationFn: (bidId: string) => inquiryService.requestBid(bidId),
    onSuccess: () => {
      message.success('Bid request sent');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to send bid request'),
  });

  const requestAllMutation = useMutation({
    retry: false,
    mutationFn: () => inquiryService.requestAllBids(product.id),
    onSuccess: (data) => {
      message.success(data.message);
      invalidateInquiry();
    },
    onError: () => message.error('Failed to send bid requests'),
  });

  const acceptBidMutation = useMutation({
    retry: false,
    mutationFn: (bidId: string) => inquiryService.acceptBid(bidId),
    onSuccess: () => {
      message.success('Bid accepted — pricing updated');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to accept bid'),
  });

  const deleteBidMutation = useMutation({
    retry: false,
    mutationFn: (bidId: string) => inquiryService.deleteBid(bidId),
    onSuccess: () => {
      message.success('Bid removed');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to remove bid'),
  });

  const createBidMutation = useMutation({
    retry: false,
    mutationFn: (payload: Partial<InquiryProductSupplierBid>) =>
      inquiryService.createBid(payload),
    onSuccess: () => {
      message.success('Supplier bid added');
      setAddingBid(false);
      setNewBid(EMPTY_BID_FORM);
      invalidateInquiry();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to add supplier bid';
      message.error(msg);
    },
  });

  const handleAddBid = useCallback(() => {
    if (!newBid.supplier) {
      message.warning('Please select a supplier');
      return;
    }
    const payload: Partial<InquiryProductSupplierBid> = {
      inquiry_product: product.id,
      supplier: newBid.supplier,
      bid_quantity: newBid.bid_quantity ? Number(newBid.bid_quantity) : undefined,
      bid_price_per_unit: newBid.bid_price_per_unit ? Number(newBid.bid_price_per_unit) : undefined,
      bid_uom: newBid.bid_uom || undefined,
      bid_total: newBid.bid_total ? Number(newBid.bid_total) : undefined,
      bid_notes: newBid.bid_notes || undefined,
    };
    createBidMutation.mutate(payload);
  }, [newBid, product.id, createBidMutation]);

  // Auto-calc total when quantity/price changes
  const updateBidField = useCallback((field: keyof NewBidForm, value: string) => {
    setNewBid(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate total from quantity * price
      if (field === 'bid_quantity' || field === 'bid_price_per_unit') {
        const qty = parseFloat(field === 'bid_quantity' ? value : prev.bid_quantity);
        const price = parseFloat(field === 'bid_price_per_unit' ? value : prev.bid_price_per_unit);
        if (!isNaN(qty) && !isNaN(price)) {
          updated.bid_total = (qty * price).toFixed(2);
        }
      }
      return updated;
    });
  }, []);

  // ── Render ──

  return (
    <BidPanelContainer>
      <BidPanelHeader
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Supplier bids for product (${bids.length} bids)`}
      >
        <ExpandToggle>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </ExpandToggle>
        <BidSummary>
          <span>Supplier Bids ({bids.length})</span>
          {bids.length > 0 && (
            <BidStatusSummary>
              {Object.entries(
                bids.reduce((acc, b) => {
                  acc[b.bid_status] = (acc[b.bid_status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([st, count]) => (
                <Tag key={st} color={BID_STATUS_META[st as SupplierBidStatus]?.color || 'default'} style={{ fontSize: '0.75rem' }}>
                  {count} {BID_STATUS_META[st as SupplierBidStatus]?.label || st}
                </Tag>
              ))}
            </BidStatusSummary>
          )}
        </BidSummary>
        {canManageBids && hasDraftBids && (
          <BulkRequestBtn
            onClick={(e) => {
              e.stopPropagation();
              requestAllMutation.mutate();
            }}
            disabled={requestAllMutation.isPending}
            title="Request bids from all draft suppliers"
            aria-label="Request bids from all draft suppliers"
          >
            <Send size={12} /> {requestAllMutation.isPending ? 'Sending…' : 'Request All Bids'}
          </BulkRequestBtn>
        )}
      </BidPanelHeader>

      {expanded && (
        <BidList>
          {/* ── Column headers for bid rows (mirror product row) ── */}
          {(bids.length > 0 || addingBid) && (
            <BidColumnHeaders>
              <div className="col supplier">Supplier</div>
              <div className="col qty">Qty</div>
              <div className="col price">Price/Unit</div>
              <div className="col uom">UOM</div>
              <div className="col total">Total</div>
              <div className="col notes">Notes</div>
              <div className="col status">Status</div>
              <div className="col actions">Actions</div>
            </BidColumnHeaders>
          )}

          {bids.length === 0 && !addingBid && (
            <EmptyBids>No supplier bids yet. Add a supplier to start the bidding process.</EmptyBids>
          )}

          {/* ── Existing bid rows ── */}
          {bids.map((bid) => (
            <BidRow key={bid.id}>
              <div className="col supplier">
                <span className="name">{bid.supplier_name || `Supplier ${String(bid.supplier).slice(0, 8)}`}</span>
                {bid.plant_name && <span className="sub">{bid.plant_name}</span>}
              </div>
              <div className="col qty">
                {bid.bid_quantity != null ? Number(bid.bid_quantity).toLocaleString() : '—'}
              </div>
              <div className="col price">
                {bid.bid_price_per_unit != null ? `$${Number(bid.bid_price_per_unit).toFixed(2)}` : '—'}
              </div>
              <div className="col uom">
                {bid.bid_uom || '—'}
              </div>
              <div className="col total">
                {bid.bid_total != null ? `$${Number(bid.bid_total).toFixed(2)}` : '—'}
              </div>
              <div className="col notes">
                {bid.bid_notes ? (
                  <Tooltip title={bid.bid_notes}>
                    <span className="truncate">{bid.bid_notes}</span>
                  </Tooltip>
                ) : '—'}
              </div>
              <div className="col status">
                <Tag color={BID_STATUS_META[bid.bid_status]?.color || 'default'} style={{ fontSize: '0.7rem', margin: 0 }}>
                  {BID_STATUS_META[bid.bid_status]?.icon} {BID_STATUS_META[bid.bid_status]?.label || bid.bid_status}
                </Tag>
              </div>
              <div className="col actions">
                {canManageBids && (
                  <BidActions>
                    {bid.bid_status === 'draft' && (
                      <ActionBtn
                        onClick={() => requestBidMutation.mutate(bid.id)}
                        disabled={requestBidMutation.isPending}
                        title="Send bid request"
                        aria-label="Send bid request"
                      >
                        <Send size={12} />
                      </ActionBtn>
                    )}
                    {bid.bid_status === 'received' && (
                      <ActionBtn
                        $variant="success"
                        onClick={() => acceptBidMutation.mutate(bid.id)}
                        disabled={acceptBidMutation.isPending}
                        title="Accept this bid"
                        aria-label="Accept this bid"
                      >
                        <Check size={12} />
                      </ActionBtn>
                    )}
                    {['draft', 'expired'].includes(bid.bid_status) && (
                      <Popconfirm
                        title="Remove this supplier bid?"
                        onConfirm={() => deleteBidMutation.mutate(bid.id)}
                        okText="Remove"
                        cancelText="Cancel"
                      >
                        <ActionBtn $variant="danger" title="Remove bid" aria-label="Remove bid">
                          <X size={12} />
                        </ActionBtn>
                      </Popconfirm>
                    )}
                  </BidActions>
                )}
              </div>
            </BidRow>
          ))}

          {/* ── Add new bid form (mirrors product row layout) ── */}
          {addingBid && (
            <BidRow className="adding">
              <div className="col supplier">
                <Select
                  showSearch
                  size="small"
                  placeholder="Select supplier..."
                  value={newBid.supplier || undefined}
                  onChange={(val: string) => updateBidField('supplier', val)}
                  options={supplierOptions}
                  filterOption={(input, option) => {
                    const searchText = (option as { searchText?: string })?.searchText ?? '';
                    return searchText.includes(input.toLowerCase());
                  }}
                  style={{ width: '100%' }}
                  autoFocus
                  notFoundContent="No suppliers found"
                  getPopupContainer={(trigger) => trigger.parentElement || document.body}
                />
              </div>
              <div className="col qty">
                <InputNumber
                  size="small"
                  placeholder="Qty"
                  min={0}
                  value={newBid.bid_quantity ? Number(newBid.bid_quantity) : undefined}
                  onChange={(val) => updateBidField('bid_quantity', val != null ? String(val) : '')}
                  style={{ width: '100%' }}
                  controls={false}
                />
              </div>
              <div className="col price">
                <InputNumber
                  size="small"
                  placeholder="$/unit"
                  min={0}
                  step={0.01}
                  precision={2}
                  value={newBid.bid_price_per_unit ? Number(newBid.bid_price_per_unit) : undefined}
                  onChange={(val) => updateBidField('bid_price_per_unit', val != null ? String(val) : '')}
                  style={{ width: '100%' }}
                  controls={false}
                  prefix="$"
                />
              </div>
              <div className="col uom">
                <Select
                  size="small"
                  value={newBid.bid_uom || 'LBS'}
                  onChange={(val: string) => updateBidField('bid_uom', val)}
                  options={UOM_OPTIONS}
                  style={{ width: '100%' }}
                  getPopupContainer={(trigger) => trigger.parentElement || document.body}
                />
              </div>
              <div className="col total">
                <InputNumber
                  size="small"
                  placeholder="Total"
                  min={0}
                  step={0.01}
                  precision={2}
                  value={newBid.bid_total ? Number(newBid.bid_total) : undefined}
                  onChange={(val) => updateBidField('bid_total', val != null ? String(val) : '')}
                  style={{ width: '100%' }}
                  controls={false}
                  prefix="$"
                />
              </div>
              <div className="col notes">
                <Input
                  size="small"
                  placeholder="Notes..."
                  value={newBid.bid_notes}
                  onChange={(e) => updateBidField('bid_notes', e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="col status" />
              <div className="col actions">
                <BidActions>
                  <ActionBtn
                    $variant="success"
                    onClick={handleAddBid}
                    disabled={createBidMutation.isPending || !newBid.supplier}
                    aria-label="Save supplier bid"
                    title="Save bid"
                  >
                    <Check size={12} />
                  </ActionBtn>
                  <ActionBtn
                    $variant="danger"
                    onClick={() => { setAddingBid(false); setNewBid(EMPTY_BID_FORM); }}
                    aria-label="Cancel add supplier bid"
                    title="Cancel"
                  >
                    <X size={12} />
                  </ActionBtn>
                </BidActions>
              </div>
            </BidRow>
          )}

          {canManageBids && !addingBid && (
            <AddBidButton onClick={() => setAddingBid(true)} aria-label="Add supplier bid">
              <Plus size={14} /> Add Supplier / Bid
            </AddBidButton>
          )}
        </BidList>
      )}
    </BidPanelContainer>
  );
};

// ── Styled Components ──

const BidPanelContainer = styled.div`
  margin-top: 0.5rem;
  border: 1px solid rgba(var(--color-border), 0.3);
  border-radius: var(--radius-sm);
  background: rgba(var(--color-surface), 0.5);
`;

const BidPanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.8125rem;
  user-select: none;

  &:hover {
    background: rgba(var(--color-surface-hover), 0.5);
  }
`;

const ExpandToggle = styled.span`
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
`;

const BidSummary = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgb(var(--color-text-secondary));
  font-weight: 500;
`;

const BidStatusSummary = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const BulkRequestBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid rgba(var(--color-primary), 0.3);
  border-radius: var(--radius-sm);
  background: rgba(var(--color-primary), 0.08);
  color: rgb(var(--color-primary));
  font-size: 0.75rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.15);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const BidList = styled.div`
  border-top: 1px solid rgba(var(--color-border), 0.2);
  padding: 0.5rem;
`;

const EmptyBids = styled.div`
  text-align: center;
  font-size: 0.8125rem;
  color: rgb(var(--color-text-tertiary));
  padding: 0.75rem;
`;

const BidColumnHeaders = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 0.8fr 1.2fr 1.5fr 1.2fr 1fr;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid rgba(var(--color-border), 0.3);
  margin-bottom: 0.25rem;

  .col {
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgb(var(--color-text-tertiary));
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
`;

const BidRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 0.8fr 1.2fr 1.5fr 1.2fr 1fr;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid rgba(var(--color-border), 0.1);
  font-size: 0.8125rem;
  align-items: center;

  &:last-of-type {
    border-bottom: none;
  }

  &.adding {
    background: rgba(var(--color-primary), 0.03);
    border: 1px dashed rgba(var(--color-primary), 0.2);
    border-radius: var(--radius-sm);
    margin-top: 0.25rem;
  }

  .col.supplier {
    min-width: 0;
    .name {
      font-weight: 500;
      color: rgb(var(--color-text-primary));
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sub {
      font-size: 0.7rem;
      color: rgb(var(--color-text-secondary));
    }
  }

  .col.qty, .col.price, .col.total {
    font-variant-numeric: tabular-nums;
  }

  .col.notes {
    min-width: 0;
    .truncate {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.75rem;
      color: rgb(var(--color-text-secondary));
    }
  }
`;

const BidActions = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const ActionBtn = styled.button<{ $variant?: 'success' | 'danger' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  background: ${({ $variant }) =>
    $variant === 'success'
      ? 'rgba(var(--color-success), 0.12)'
      : $variant === 'danger'
      ? 'rgba(var(--color-error), 0.12)'
      : 'rgba(var(--color-primary), 0.12)'};
  color: ${({ $variant }) =>
    $variant === 'success'
      ? 'rgb(var(--color-success))'
      : $variant === 'danger'
      ? 'rgb(var(--color-error))'
      : 'rgb(var(--color-primary))'};

  &:hover:not(:disabled) {
    opacity: 0.8;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const AddBidButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px dashed rgba(var(--color-border), 0.4);
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 0.8125rem;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  margin-top: 0.25rem;

  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.04);
  }
`;

export default SupplierBidPanel;
