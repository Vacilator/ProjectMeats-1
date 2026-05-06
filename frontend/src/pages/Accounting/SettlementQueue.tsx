import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';

import SettlementEventDetailPanel from '@/components/Accounting/SettlementEventDetailPanel';
import SettlementQueueTable from '@/components/Accounting/SettlementQueueTable';
import { useAuth } from '@/contexts/AuthContext';
import { settlementQueueService, type SettlementEntityType, type SettlementEventRecord } from '@/services/settlementQueueService';
import { withTenantQueryKey } from '@/utils/queryKeys';

const PageShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 28px;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.p`
  margin: 6px 0 0;
  color: rgb(var(--color-text-secondary));
`;

const FilterRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))')};
  border-radius: 999px;
  padding: 8px 14px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  background: ${({ $active }) => ($active ? 'rgba(var(--color-primary), 0.12)' : 'rgb(var(--color-surface))')};
  color: ${({ $active }) => ($active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))')};
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 20px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const StateBox = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 24px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
`;

const filterOptions = [
  { label: 'Ready to review', value: 'ready_to_post' as const },
  { label: 'Failed', value: 'failed' as const },
  { label: 'All', value: 'all' as const },
];

type FilterState = (typeof filterOptions)[number]['value'];

const getMutationMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) {
      return response.data.error;
    }
    if ('message' in error && typeof (error as { message: string }).message === 'string') {
      return (error as { message: string }).message;
    }
  }
  return 'Unable to complete settlement review action.';
};

const SettlementQueue: React.FC = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [filterState, setFilterState] = useState<FilterState>('ready_to_post');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const listQueryKey = useMemo(
    () => withTenantQueryKey('settlement-events', filterState),
    [filterState],
  );
  const detailQueryKey = useMemo(
    () => (selectedEventId ? withTenantQueryKey('settlement-event', selectedEventId) : null),
    [selectedEventId],
  );

  const listQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () => settlementQueueService.listSettlementEvents(filterState),
    enabled: isAdmin,
  });

  const detailQuery = useQuery({
    queryKey: detailQueryKey ?? withTenantQueryKey('settlement-event', 'none'),
    queryFn: () => settlementQueueService.getSettlementEvent(selectedEventId as number),
    enabled: isAdmin && selectedEventId !== null,
  });

  const selectedEventKey = useMemo(
    () => (listQuery.data ?? []).map((event) => event.id).join(','),
    [listQuery.data],
  );

  useEffect(() => {
    const events = listQuery.data ?? [];
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }
    if (!selectedEventId || !events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(events[0].id);
    }
  }, [selectedEventId, selectedEventKey, listQuery.data]);

  const invalidateSettlementQueries = async (event: SettlementEventRecord) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: listQueryKey }),
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('settlement-event', event.id) }),
    ]);
  };

  const approveMutation = useMutation({
    mutationFn: ({ eventId, note }: { eventId: number; note: string }) =>
      settlementQueueService.approveSettlementEvent(eventId, { note }),
    onSuccess: invalidateSettlementQueries,
  });
  const relinkMutation = useMutation({
    mutationFn: ({
      eventId,
      note,
      entityType,
      objectId,
    }: {
      eventId: number;
      note: string;
      entityType: SettlementEntityType;
      objectId: number;
    }) =>
      settlementQueueService.relinkSettlementEvent(eventId, {
        note,
        entity_type: entityType,
        object_id: objectId,
      }),
    onSuccess: invalidateSettlementQueries,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ eventId, note }: { eventId: number; note: string }) =>
      settlementQueueService.rejectSettlementEvent(eventId, { note }),
    onSuccess: invalidateSettlementQueries,
  });

  const mutationError = approveMutation.error || relinkMutation.error || rejectMutation.error;
  const isMutating = approveMutation.isPending || relinkMutation.isPending || rejectMutation.isPending;

  if (!isAdmin) {
    return <StateBox>Settlement review access is limited to tenant admins and owners.</StateBox>;
  }

  return (
    <PageShell>
      <Header>
        <div>
          <Title>Settlement Queue</Title>
          <Subtitle>Review auto-match exceptions, relink bank settlements, and capture manual audit notes.</Subtitle>
        </div>
        <FilterRow>
          {filterOptions.map((option) => (
            <FilterButton
              key={option.value}
              type="button"
              $active={filterState === option.value}
              onClick={() => setFilterState(option.value)}
            >
              {option.label}
            </FilterButton>
          ))}
        </FilterRow>
      </Header>

      {listQuery.isLoading ? (
        <StateBox>Loading settlement queue…</StateBox>
      ) : listQuery.isError ? (
        <StateBox>Unable to load settlement events right now.</StateBox>
      ) : (
        <Layout>
          <SettlementQueueTable
            events={listQuery.data ?? []}
            selectedEventId={selectedEventId}
            onSelect={setSelectedEventId}
          />
          {detailQuery.isLoading || !detailQuery.data ? (
            <StateBox>
              {selectedEventId ? 'Loading settlement detail…' : 'No settlement events match the current filter.'}
            </StateBox>
          ) : (
            <SettlementEventDetailPanel
              event={detailQuery.data}
              isMutating={isMutating}
              mutationError={mutationError ? getMutationMessage(mutationError) : null}
              onApprove={({ eventId, note }) => approveMutation.mutateAsync({ eventId, note })}
              onReject={({ eventId, note }) => rejectMutation.mutateAsync({ eventId, note })}
              onRelink={({ eventId, note, entityType, objectId }) =>
                relinkMutation.mutateAsync({ eventId, note, entityType, objectId })
              }
            />
          )}
        </Layout>
      )}
    </PageShell>
  );
};

export default SettlementQueue;

