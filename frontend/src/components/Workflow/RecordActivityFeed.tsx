/**
 * RecordActivityFeed — Compact collapsible activity timeline for entity records.
 *
 * Fetches recent audit/activity events via the entity's audit-trail endpoint
 * and renders a vertical timeline with relative timestamps, action descriptions,
 * and actor info. Status transitions are color-coded via getStatusColors.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { getDocumentEntityConfig } from '@/components/Operations/documentOperations';
import { getStatusColors } from '@/utils/statusColors';

// ============================================================================
// Types
// ============================================================================

export interface RecordActivityFeedProps {
  entityType: string;
  entityId: string | number;
}

type ActivityEvent = {
  id?: string | number;
  action: string;
  description?: string | null;
  status?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  created_at?: string | null;
  timestamp?: string | null;
};

// ============================================================================
// Helpers
// ============================================================================

const COLLAPSED_COUNT = 5;

const isStatusTransition = (event: ActivityEvent): boolean => {
  const a = (event.action ?? '').toLowerCase();
  return (
    a.includes('transition') ||
    a.includes('status') ||
    Boolean(event.from_status) ||
    Boolean(event.to_status)
  );
};

const formatRelativeTime = (raw?: string | null): string => {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

const describeEvent = (event: ActivityEvent): string => {
  if (event.description) return event.description;

  if (event.from_status && event.to_status) {
    return `${formatStatus(event.from_status)} → ${formatStatus(event.to_status)}`;
  }
  if (event.to_status) {
    return `Status set to ${formatStatus(event.to_status)}`;
  }

  const action = (event.action ?? '').toLowerCase();
  if (action === 'created') return 'Record created';
  if (action === 'updated') return 'Record updated';
  if (action === 'deleted') return 'Record deleted';

  return event.action || 'Activity recorded';
};

const formatStatus = (status: string): string =>
  status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const getActorLabel = (event: ActivityEvent): string =>
  event.actor_name || event.actor_email || '';

const getEventTime = (event: ActivityEvent): string | null =>
  event.created_at ?? event.timestamp ?? null;

// ============================================================================
// Styled Components
// ============================================================================

const FeedContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 12px 16px;
`;

const FeedHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const FeedTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const TimelineList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const TimelineItem = styled.li`
  display: flex;
  gap: 10px;
  position: relative;
  padding-bottom: 12px;

  &:last-child {
    padding-bottom: 0;
  }

  &:last-child .timeline-line {
    display: none;
  }
`;

const DotColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
  padding-top: 3px;
`;

const Dot = styled.span<{ $highlight?: boolean; $color?: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => p.$color ?? (p.$highlight
    ? 'rgb(var(--color-primary))'
    : 'rgb(var(--color-text-tertiary))')};
`;

const Line = styled.span`
  flex: 1;
  width: 1px;
  min-height: 12px;
  background: rgb(var(--color-border));
  margin-top: 4px;
`;

const EventContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionText = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  line-height: 1.4;
  display: block;
`;

const MetaRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 2px;
`;

const MetaText = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  padding: 4px 0;
  cursor: pointer;
  font-size: 12px;
  color: rgb(var(--color-primary));
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const SkeletonWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

// ============================================================================
// Component
// ============================================================================

export const RecordActivityFeed: React.FC<RecordActivityFeedProps> = ({
  entityType,
  entityId,
}) => {
  const [expanded, setExpanded] = useState(false);

  const config = useMemo(() => getDocumentEntityConfig(entityType), [entityType]);
  const endpoint = config?.endpoint ?? null;

  const stableQueryKey = useMemo(
    () => withTenantQueryKey('record-activity-feed', entityType, String(entityId)),
    [entityType, entityId],
  );

  const fetchActivityEvents = useCallback(async (): Promise<ActivityEvent[]> => {
    if (!endpoint) return [];

    try {
      const response = await businessApi.get(
        `/${endpoint}/${encodeURIComponent(String(entityId))}/audit-trail/`,
      );
      const payload = response.data;
      if (Array.isArray(payload)) return payload as ActivityEvent[];
      const results = (payload as { results?: ActivityEvent[] } | null)?.results;
      return Array.isArray(results) ? results : [];
    } catch {
      return [];
    }
  }, [endpoint, entityId]);

  const { data: events, isLoading } = useQuery({
    queryKey: stableQueryKey,
    queryFn: fetchActivityEvents,
    enabled: Boolean(endpoint) && Boolean(entityId),
    staleTime: 30_000,
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const visibleEvents = useMemo(() => {
    if (!events?.length) return [];
    return expanded ? events : events.slice(0, COLLAPSED_COUNT);
  }, [events, expanded]);

  const hasMore = (events?.length ?? 0) > COLLAPSED_COUNT;

  if (isLoading) {
    return (
      <FeedContainer>
        <FeedHeader>
          <FeedTitle>Recent Activity</FeedTitle>
        </FeedHeader>
        <SkeletonWrap>
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        </SkeletonWrap>
      </FeedContainer>
    );
  }

  if (!visibleEvents.length) {
    return null;
  }

  return (
    <FeedContainer>
      <FeedHeader>
        <FeedTitle>Recent Activity</FeedTitle>
        {hasMore && (
          <ExpandButton onClick={toggleExpanded} type="button">
            {expanded ? 'Show less' : `Show all (${events?.length ?? 0})`}
          </ExpandButton>
        )}
      </FeedHeader>

      <TimelineList role="list" aria-label="Activity timeline">
        {visibleEvents.map((event, idx) => {
          const isTransition = isStatusTransition(event);
          const statusKey = event.to_status ?? event.status;
          const dotColor = isTransition && statusKey
            ? getStatusColors(statusKey).text
            : undefined;
          const actor = getActorLabel(event);
          const time = getEventTime(event);

          return (
            <TimelineItem key={event.id ?? idx} role="listitem">
              <DotColumn>
                <Dot $highlight={isTransition} $color={dotColor} />
                <Line className="timeline-line" />
              </DotColumn>
              <EventContent>
                <ActionText>{describeEvent(event)}</ActionText>
                <MetaRow>
                  {time && <MetaText>{formatRelativeTime(time)}</MetaText>}
                  {actor && <MetaText>· {actor}</MetaText>}
                </MetaRow>
              </EventContent>
            </TimelineItem>
          );
        })}
      </TimelineList>
    </FeedContainer>
  );
};
