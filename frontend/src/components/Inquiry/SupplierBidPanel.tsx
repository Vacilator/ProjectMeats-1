/**
 * SupplierBidPanel — Per-product supplier bid management
 *
 * Shows supplier bids as expandable child rows under each InquiryProduct.
 * Provides "+ Add Supplier/Bid" button, request bid actions, and accept/reject.
 */
import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message, Tooltip, Tag, Popconfirm, Input, Select } from 'antd';
import { Plus, Send, Check, X, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InquiryProduct, InquiryProductSupplierBid, SupplierBidStatus } from '../../types';
import { inquiryService } from '../../services/inquiryService';

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

// ── Props ──

interface SupplierBidPanelProps {
  product: InquiryProduct;
  inquiryStatus: string;
  readOnly?: boolean;
}

// ── Component ──

export const SupplierBidPanel: React.FC<SupplierBidPanelProps> = ({
  product,
  inquiryStatus,
  readOnly = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [addingBid, setAddingBid] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState('');
  const queryClient = useQueryClient();

  const bids = useMemo(() => product.supplier_bids ?? [], [product.supplier_bids]);
  const hasBids = bids.length > 0;
  const canManageBids = !readOnly && ['draft', 'pending', 'quoted'].includes(inquiryStatus);
  const hasDraftBids = bids.some(b => b.bid_status === 'draft');

  const invalidateInquiry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inquiry'] });
    queryClient.invalidateQueries({ queryKey: ['inquiries'] });
  }, [queryClient]);

  // ── Mutations ──

  const requestBidMutation = useMutation({
    mutationFn: (bidId: string) => inquiryService.requestBid(bidId),
    onSuccess: () => {
      message.success('Bid request sent');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to send bid request'),
  });

  const requestAllMutation = useMutation({
    mutationFn: () => inquiryService.requestAllBids(product.id),
    onSuccess: (data) => {
      message.success(data.message);
      invalidateInquiry();
    },
    onError: () => message.error('Failed to send bid requests'),
  });

  const acceptBidMutation = useMutation({
    mutationFn: (bidId: string) => inquiryService.acceptBid(bidId),
    onSuccess: () => {
      message.success('Bid accepted — pricing updated');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to accept bid'),
  });

  const deleteBidMutation = useMutation({
    mutationFn: (bidId: string) => inquiryService.deleteBid(bidId),
    onSuccess: () => {
      message.success('Bid removed');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to remove bid'),
  });

  const createBidMutation = useMutation({
    mutationFn: (supplierId: string) =>
      inquiryService.createBid({
        inquiry_product: product.id,
        supplier: supplierId,
      } as Partial<InquiryProductSupplierBid>),
    onSuccess: () => {
      message.success('Supplier bid added');
      setAddingBid(false);
      setNewSupplierId('');
      invalidateInquiry();
    },
    onError: () => message.error('Failed to add supplier bid'),
  });

  const handleAddBid = useCallback(() => {
    if (!newSupplierId.trim()) {
      message.warning('Enter a supplier ID');
      return;
    }
    createBidMutation.mutate(newSupplierId.trim());
  }, [newSupplierId, createBidMutation]);

  // ── Render ──

  return (
    <BidPanelContainer>
      <BidPanelHeader onClick={() => setExpanded(!expanded)}>
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
              ).map(([status, count]) => (
                <Tag key={status} color={BID_STATUS_META[status as SupplierBidStatus]?.color || 'default'} style={{ fontSize: '0.75rem' }}>
                  {count} {BID_STATUS_META[status as SupplierBidStatus]?.label || status}
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
          >
            <Send size={12} /> Request All
          </BulkRequestBtn>
        )}
      </BidPanelHeader>

      {expanded && (
        <BidList>
          {bids.length === 0 && !addingBid && (
            <EmptyBids>No supplier bids yet. Add a supplier to start the bidding process.</EmptyBids>
          )}

          {bids.map((bid) => (
            <BidRow key={bid.id}>
              <BidSupplierInfo>
                <span className="name">{bid.supplier_name || `Supplier ${String(bid.supplier).slice(0, 8)}`}</span>
                {bid.plant_name && <span className="plant">{bid.plant_name}</span>}
                {bid.contact_name && <span className="contact">{bid.contact_name}</span>}
              </BidSupplierInfo>

              <BidPricing>
                {bid.bid_price_per_unit != null ? (
                  <span className="price">${Number(bid.bid_price_per_unit).toFixed(4)}/unit</span>
                ) : (
                  <span className="no-price">—</span>
                )}
                {bid.bid_total != null && (
                  <span className="total">${Number(bid.bid_total).toFixed(2)} total</span>
                )}
              </BidPricing>

              <Tag color={BID_STATUS_META[bid.bid_status]?.color || 'default'}>
                {BID_STATUS_META[bid.bid_status]?.icon} {BID_STATUS_META[bid.bid_status]?.label || bid.bid_status}
              </Tag>

              {bid.requested_at && (
                <Tooltip title={`Requested: ${new Date(bid.requested_at).toLocaleString()}`}>
                  <Clock size={12} style={{ opacity: 0.5 }} />
                </Tooltip>
              )}

              {canManageBids && (
                <BidActions>
                  {bid.bid_status === 'draft' && (
                    <ActionBtn
                      onClick={() => requestBidMutation.mutate(bid.id)}
                      disabled={requestBidMutation.isPending}
                      title="Send bid request"
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
                      <ActionBtn $variant="danger" title="Remove bid">
                        <X size={12} />
                      </ActionBtn>
                    </Popconfirm>
                  )}
                </BidActions>
              )}
            </BidRow>
          ))}

          {addingBid && (
            <AddBidRow>
              <Input
                size="small"
                placeholder="Supplier ID or search..."
                value={newSupplierId}
                onChange={(e) => setNewSupplierId(e.target.value)}
                onPressEnter={handleAddBid}
                style={{ flex: 1 }}
                autoFocus
              />
              <ActionBtn
                $variant="success"
                onClick={handleAddBid}
                disabled={createBidMutation.isPending}
              >
                <Check size={12} />
              </ActionBtn>
              <ActionBtn
                $variant="danger"
                onClick={() => { setAddingBid(false); setNewSupplierId(''); }}
              >
                <X size={12} />
              </ActionBtn>
            </AddBidRow>
          )}

          {canManageBids && !addingBid && (
            <AddBidButton onClick={() => setAddingBid(true)}>
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

const BidRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid rgba(var(--color-border), 0.15);
  font-size: 0.8125rem;

  &:last-of-type {
    border-bottom: none;
  }
`;

const BidSupplierInfo = styled.div`
  flex: 1;
  min-width: 0;

  .name {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    display: block;
  }
  .plant, .contact {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
  }
`;

const BidPricing = styled.div`
  text-align: right;
  min-width: 100px;

  .price {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    display: block;
  }
  .total {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
  }
  .no-price {
    color: rgb(var(--color-text-tertiary));
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

const AddBidRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
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
