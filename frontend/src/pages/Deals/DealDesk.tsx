import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from 'antd';
import styled from 'styled-components';

import type { DealDeskRow, DealStatus } from '../../types/deals';
import { dealsService } from '../../services/dealsService';
import { formatCurrency } from '../../shared/utils';
import { formatDateLocal } from '../../utils/formatters';

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

const Subtitle = styled.p`
  margin: 0.25rem 0 0;
  color: rgb(var(--color-text-secondary));
  font-size: 0.95rem;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const FilterButton = styled.button<{ active?: boolean }>`
  padding: 0.5rem 1rem;
  background: ${props => props.active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))'};
  color: ${props => props.active ? 'white' : 'rgb(var(--color-text-primary))'};
  border: 1px solid ${props => props.active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    opacity: 0.92;
  }
`;

const SearchInput = styled.input`
  padding: 0.5rem 1rem;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  min-width: 260px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const SummaryStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const SummaryCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1rem;
`;

const SummaryLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(var(--color-text-secondary));
`;

const SummaryValue = styled.div`
  margin-top: 0.4rem;
  font-size: 1.3rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
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
  overflow: auto;
  flex: 1;
`;

const Table = styled.table`
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
`;

const TableHeader = styled.thead`
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  position: sticky;
  top: 0;
  z-index: 1;
`;

const TableHead = styled.th`
  padding: 0.85rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(var(--color-text-secondary));
`;

const TableRow = styled.tr<{ pastDue?: boolean }>`
  border-bottom: 1px solid rgb(var(--color-border));
  background: ${props => props.pastDue ? 'rgba(234, 179, 8, 0.12)' : 'transparent'};

  &:hover {
    background: ${props => props.pastDue ? 'rgba(234, 179, 8, 0.16)' : 'rgba(var(--color-primary), 0.05)'};
  }
`;

const TableCell = styled.td`
  padding: 0.85rem 1rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
  vertical-align: top;
`;

const StatusBadge = styled.span<{ status: DealStatus }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  ${props => {
    switch (props.status) {
      case 'completed':
        return 'background: rgba(34, 197, 94, 0.15); color: rgb(34, 197, 94);';
      case 'delivered':
        return 'background: rgba(59, 130, 246, 0.15); color: rgb(59, 130, 246);';
      case 'in_transit':
        return 'background: rgba(234, 179, 8, 0.18); color: rgb(180, 83, 9);';
      case 'cancelled':
        return 'background: rgba(107, 114, 128, 0.15); color: rgb(107, 114, 128);';
      case 'active':
        return 'background: rgba(59, 130, 246, 0.12); color: rgb(37, 99, 235);';
      case 'draft':
      default:
        return 'background: rgba(148, 163, 184, 0.18); color: rgb(71, 85, 105);';
    }
  }}
`;

const ProfitValue = styled.span<{ positive: boolean }>`
  font-weight: 700;
  color: ${props => props.positive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'};
`;

const Muted = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 0.8rem;
`;

const ErrorMessage = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgb(239, 68, 68);
`;

const EmptyMessage = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const STATUS_FILTERS: Array<DealStatus | 'all'> = [
  'all',
  'draft',
  'active',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
];

const prettifyStatus = (status: DealStatus | 'all') =>
  status === 'all' ? 'All' : status.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

const parseMoney = (value: string) => Number.parseFloat(value || '0');

const DealDesk: React.FC = () => {
  const [deals, setDeals] = useState<DealDeskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;

    const loadDeals = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await dealsService.list({ status: statusFilter });
        if (active) {
          setDeals(data);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.response?.data?.error || 'Failed to load Deal Desk');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDeals();

    return () => {
      active = false;
    };
  }, [statusFilter]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery) return deals;
    const query = searchQuery.toLowerCase();
    return deals.filter((deal) =>
      [
        deal.deal_number,
        deal.purchase_order_number,
        deal.sales_order_number,
        deal.supplier_name,
        deal.customer_name,
        deal.carrier_name,
        deal.next_action,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [deals, searchQuery]);

  const counts = useMemo(() => {
    return STATUS_FILTERS.reduce<Record<string, number>>((acc, filter) => {
      acc[filter] = filter === 'all' ? deals.length : deals.filter((deal) => deal.status === filter).length;
      return acc;
    }, {});
  }, [deals]);

  const totals = useMemo(() => {
    return filteredDeals.reduce(
      (acc, deal) => {
        acc.margin += parseMoney(deal.net_margin);
        if (deal.is_past_due) acc.pastDue += 1;
        if (deal.status === 'in_transit') acc.inTransit += 1;
        return acc;
      },
      { margin: 0, pastDue: 0, inTransit: 0 }
    );
  }, [filteredDeals]);

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle>Deal Desk</PageTitle>
          <Subtitle>Trader ledger replacement for buy-side, sell-side, logistics, and follow-up.</Subtitle>
        </div>
      </PageHeader>

      <SummaryStrip>
        <SummaryCard>
          <SummaryLabel>Open Deals</SummaryLabel>
          <SummaryValue>{filteredDeals.length}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Net Profit</SummaryLabel>
          <SummaryValue>{formatCurrency(totals.margin)}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>In Transit</SummaryLabel>
          <SummaryValue>{totals.inTransit}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Past Due Follow-Ups</SummaryLabel>
          <SummaryValue>{totals.pastDue}</SummaryValue>
        </SummaryCard>
      </SummaryStrip>

      <FilterBar>
        {STATUS_FILTERS.map((filter) => (
          <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
            {prettifyStatus(filter)} ({counts[filter] || 0})
          </FilterButton>
        ))}
        <SearchInput
          type="text"
          aria-label="Search deals"
          placeholder="Search PO, SO, supplier, customer, carrier..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </FilterBar>

      <TableContainer>
        {loading ? (
          <div style={{ padding: 16 }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : filteredDeals.length === 0 ? (
          <EmptyMessage>{searchQuery ? 'No deals match your search.' : 'No deals found.'}</EmptyMessage>
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>PO #</TableHead>
                  <TableHead>SO #</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Net Profit</TableHead>
                </tr>
              </TableHeader>
              <tbody>
                {filteredDeals.map((deal) => {
                  const netMargin = parseMoney(deal.net_margin);
                  return (
                    <TableRow
                      key={deal.id}
                      data-testid={`deal-row-${deal.id}`}
                      data-past-due={deal.is_past_due ? 'true' : 'false'}
                      pastDue={deal.is_past_due}
                    >
                      <TableCell>
                        <StatusBadge status={deal.status}>{prettifyStatus(deal.status)}</StatusBadge>
                        <Muted>{deal.deal_number}</Muted>
                      </TableCell>
                      <TableCell>
                        <div>{deal.next_action || 'No follow-up scheduled'}</div>
                        <Muted>{deal.next_follow_up_date ? formatDateLocal(deal.next_follow_up_date) : '—'}</Muted>
                      </TableCell>
                      <TableCell>{deal.supplier_name || '—'}</TableCell>
                      <TableCell>{deal.customer_name || '—'}</TableCell>
                      <TableCell>{deal.carrier_name || '—'}</TableCell>
                      <TableCell>{deal.purchase_order_number || '—'}</TableCell>
                      <TableCell>{deal.sales_order_number || '—'}</TableCell>
                      <TableCell>{deal.pickup_date ? formatDateLocal(deal.pickup_date) : '—'}</TableCell>
                      <TableCell>{deal.delivery_date ? formatDateLocal(deal.delivery_date) : '—'}</TableCell>
                      <TableCell>
                        <ProfitValue positive={netMargin >= 0}>{formatCurrency(netMargin)}</ProfitValue>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </TableContainer>
    </PageContainer>
  );
};

export default DealDesk;
