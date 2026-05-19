/**
 * SupplierBidPanel — Per-product supplier bid management
 *
 * Displays supplier bids as child rows that mirror the product row layout.
 * Each bid shows: supplier, quantity, price/unit, commission/unit, UOM, total, margin, notes, status + actions.
 * Ship-to location is rendered at product level by the parent component.
 *
 * Features:
 * - Bid form mirrors product row structure (same fields + supplier dropdown)
 * - Accept Winning Bid from draft/requested/received status
 * - Commission/unit field for profit tracking
 * - Instant display after save (optimistic + invalidation)
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { message, Tooltip, Tag, Popconfirm, Select, Input, InputNumber } from 'antd';
import { Plus, Send, Check, X, ChevronDown, ChevronRight, Trophy } from 'lucide-react';
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
  commission_per_unit: string;
  bid_uom: string;
  bid_total: string;
  bid_notes: string;
}

const EMPTY_BID_FORM: NewBidForm = {
  supplier: '',
  bid_quantity: '',
  bid_price_per_unit: '',
  commission_per_unit: '',
  bid_uom: 'LBS',
  bid_total: '',
  bid_notes: '',
};

// ── Helpers ──

function calcMargin(bid: InquiryProductSupplierBid): string {
  if (bid.commission_per_unit != null && bid.bid_quantity != null) {
    return `$${(Number(bid.commission_per_unit) * Number(bid.bid_quantity)).toFixed(2)}`;
  }
  return '—';
}

function calcMarginPercent(bid: InquiryProductSupplierBid): string {
  if (bid.commission_per_unit != null && bid.bid_price_per_unit != null && Number(bid.bid_price_per_unit) > 0) {
    const pct = (Number(bid.commission_per_unit) / Number(bid.bid_price_per_unit)) * 100;
    return `${pct.toFixed(1)}%`;
  }
  return '';
}

// ── Component ──

export const SupplierBidPanel: React.FC<SupplierBidPanelProps> = ({
  product,
  inquiryStatus,
  readOnly = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [addingBid, setAddingBid] = useState(false);
  const [newBid, setNewBid] = useState<NewBidForm>(EMPTY_BID_FORM);
  const [optimisticBids, setOptimisticBids] = useState<InquiryProductSupplierBid[]>([]);
  const queryClient = useQueryClient();

  const serverBids = useMemo(() => product.supplier_bids ?? [], [product.supplier_bids]);
  const bids = useMemo(() => {
    // Merge optimistic bids with server bids (remove optimistic once server has them)
    const serverIds = new Set(serverBids.map(b => b.id));
    const pending = optimisticBids.filter(ob => !serverIds.has(ob.id));
    return [...serverBids, ...pending];
  }, [serverBids, optimisticBids]);

  const canManageBids = !readOnly && ['draft', 'pending', 'quoted', 'approved', 'action_required', 'in_progress'].includes(inquiryStatus);
  const hasDraftBids = bids.some(b => b.bid_status === 'draft');
  const hasAcceptedBid = bids.some(b => b.bid_status === 'accepted');

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
      message.success('🏆 Winning bid accepted — pricing updated');
      invalidateInquiry();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to accept bid';
      message.error(msg);
    },
  });

  const deleteBidMutation = useMutation({
    retry: false,
    mutationFn: (bidId: string) => inquiryService.deleteBid(bidId),
    onSuccess: (_data, bidId) => {
      message.success('Bid removed');
      // Remove from optimistic list too
      setOptimisticBids(prev => prev.filter(b => b.id !== bidId));
      invalidateInquiry();
    },
    onError: () => message.error('Failed to remove bid'),
  });

  const createBidMutation = useMutation({
    retry: false,
    mutationFn: (payload: Partial<InquiryProductSupplierBid>) =>
      inquiryService.createBid(payload),
    onSuccess: (createdBid) => {
      message.success('Supplier bid added');
      // Optimistically show the new bid immediately
      setOptimisticBids(prev => [...prev, createdBid]);
      setAddingBid(false);
      setNewBid(EMPTY_BID_FORM);
      // Also invalidate to get server state
      invalidateInquiry();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to add supplier bid';
      message.error(msg);
    },
  });

  // Clear optimistic bids when server data updates
  useEffect(() => {
    if (serverBids.length > 0 && optimisticBids.length > 0) {
      const serverIds = new Set(serverBids.map(b => b.id));
      const remaining = optimisticBids.filter(ob => !serverIds.has(ob.id));
      if (remaining.length !== optimisticBids.length) {
        setOptimisticBids(remaining);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverBids]);

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
      commission_per_unit: newBid.commission_per_unit ? Number(newBid.commission_per_unit) : undefined,
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

  const handleDeleteBid = useCallback((bidId: string) => {
    deleteBidMutation.mutate(bidId);
  }, [deleteBidMutation]);

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
          {hasAcceptedBid && <Tag color="success" style={{ fontSize: '0.7rem', margin: 0 }}>🏆 Winner Selected</Tag>}
          {bids.length > 0 && !hasAcceptedBid && (
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
          {/* ── Column headers for bid rows ── */}
          {(bids.length > 0 || addingBid) && (
            <BidColumnHeaders>
              <div className="col supplier">Supplier</div>
              <div className="col qty">Qty</div>
              <div className="col price">Price/U</div>
              <div className="col commission">Comm/U</div>
              <div className="col uom">UOM</div>
              <div className="col total">Total</div>
              <div className="col margin">Margin</div>
              <div className="col status">Status</div>
              <div className="col actions">Actions</div>
            </BidColumnHeaders>
          )}

          {bids.length === 0 && !addingBid && (
            <EmptyBids>No supplier bids yet. Add a supplier to start the bidding process.</EmptyBids>
          )}

          {/* ── Existing bid rows ── */}
          {bids.map((bid) => {
            const isAccepted = bid.bid_status === 'accepted';
            const canAccept = canManageBids && !hasAcceptedBid && ['draft', 'requested', 'received'].includes(bid.bid_status);
            const canDelete = canManageBids && !isAccepted && bid.bid_status !== 'rejected';

            return (
              <BidRow key={bid.id} className={isAccepted ? 'winner' : ''}>
                <div className="col supplier">
                  <span className="name">
                    {isAccepted && '🏆 '}
                    {bid.supplier_name || `Supplier ${String(bid.supplier).slice(0, 8)}`}
                  </span>
                  {bid.plant_name && <span className="sub">{bid.plant_name}</span>}
                </div>
                <div className="col qty">
                  {bid.bid_quantity != null ? Number(bid.bid_quantity).toLocaleString() : '—'}
                </div>
                <div className="col price">
                  {bid.bid_price_per_unit != null ? `$${Number(bid.bid_price_per_unit).toFixed(2)}` : '—'}
                </div>
                <div className="col commission">
                  {bid.commission_per_unit != null ? `$${Number(bid.commission_per_unit).toFixed(2)}` : '—'}
                </div>
                <div className="col uom">
                  {bid.bid_uom || '—'}
                </div>
                <div className="col total">
                  {bid.bid_total != null ? `$${Number(bid.bid_total).toFixed(2)}` : '—'}
                </div>
                <div className="col margin">
                  <span>{calcMargin(bid)}</span>
                  {calcMarginPercent(bid) && <span className="sub">{calcMarginPercent(bid)}</span>}
                </div>
                <div className="col status">
                  <Tag color={BID_STATUS_META[bid.bid_status]?.color || 'default'} style={{ fontSize: '0.7rem', margin: 0 }}>
                    {BID_STATUS_META[bid.bid_status]?.icon} {BID_STATUS_META[bid.bid_status]?.label || bid.bid_status}
                  </Tag>
                </div>
                <div className="col actions">
                  <BidActions>
                    {bid.bid_status === 'draft' && canManageBids && (
                      <ActionBtn
                        onClick={() => requestBidMutation.mutate(bid.id)}
                        disabled={requestBidMutation.isPending}
                        title="Send bid request"
                        aria-label="Send bid request"
                      >
                        <Send size={12} />
                      </ActionBtn>
                    )}
                    {canAccept && (
                      <Popconfirm
                        title="Accept this as the winning bid?"
                        description="This will set the pricing on the product and reject other bids."
                        onConfirm={() => acceptBidMutation.mutate(bid.id)}
                        okText="Accept"
                        cancelText="Cancel"
                        okButtonProps={{ loading: acceptBidMutation.isPending }}
                        zIndex={1200}
                      >
                        <ActionBtn
                          $variant="success"
                          disabled={acceptBidMutation.isPending}
                          title="Accept as winning bid"
                          aria-label="Accept as winning bid"
                        >
                          <Trophy size={12} />
                        </ActionBtn>
                      </Popconfirm>
                    )}
                    {canDelete && (
                      <Popconfirm
                        title="Remove this supplier bid?"
                        onConfirm={() => handleDeleteBid(bid.id)}
                        okText="Remove"
                        cancelText="Cancel"
                        okButtonProps={{ loading: deleteBidMutation.isPending }}
                        zIndex={1200}
                      >
                        <ActionBtn
                          $variant="danger"
                          title="Remove bid"
                          aria-label="Remove bid"
                        >
                          <X size={12} />
                        </ActionBtn>
                      </Popconfirm>
                    )}
                  </BidActions>
                </div>
              </BidRow>
            );
          })}

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
              <div className="col commission">
                <InputNumber
                  size="small"
                  placeholder="Comm"
                  min={0}
                  step={0.01}
                  precision={2}
                  value={newBid.commission_per_unit ? Number(newBid.commission_per_unit) : undefined}
                  onChange={(val) => updateBidField('commission_per_unit', val != null ? String(val) : '')}
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
              <div className="col margin" />
              <div className="col status">
                <Input
                  size="small"
                  placeholder="Notes..."
                  value={newBid.bid_notes}
                  onChange={(e) => updateBidField('bid_notes', e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
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
  grid-template-columns: 2fr 0.8fr 1fr 0.9fr 0.7fr 1fr 1fr 1.1fr 1fr;
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
  grid-template-columns: 2fr 0.8fr 1fr 0.9fr 0.7fr 1fr 1fr 1.1fr 1fr;
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

  &.winner {
    background: rgba(var(--color-success), 0.04);
    border-left: 3px solid rgb(var(--color-success));
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

  .col.qty, .col.price, .col.total, .col.commission, .col.margin {
    font-variant-numeric: tabular-nums;
  }

  .col.margin {
    .sub {
      display: block;
      font-size: 0.7rem;
      color: rgb(var(--color-text-secondary));
    }
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
