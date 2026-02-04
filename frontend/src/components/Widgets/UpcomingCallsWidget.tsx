/**
 * Upcoming Calls Widget
 * 
 * Displays scheduled calls and callbacks.
 * Allows quick access to call details and actions.
 * 
 * Features:
 * - Upcoming calls list
 * - Time-based sorting
 * - Quick actions
 * 
 * Updated: 2026-02-04 - Phase 1.3 - Connected to real API
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React from 'react';
import styled from 'styled-components';
import { Phone, Clock, User, Calendar } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { useCockpitStats } from '../../hooks/useCockpitStats';
import { format, formatDistanceToNow } from 'date-fns';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface UpcomingCallsWidgetProps {
  // Props for potential future customization
}

// ============================================================================
// Styled Components
// ============================================================================

const CallsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
`;

const CallItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgb(var(--color-border));
  transition: all 0.15s ease;
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-background-hover));
    border-color: rgb(var(--color-primary));
  }
`;

const CallHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const CallTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  flex: 1;
`;

const CallTime = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
`;

const CallMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

export const UpcomingCallsWidget: React.FC<UpcomingCallsWidgetProps> = () => {
  const { stats, isLoading, error, refetch } = useCockpitStats();

  return (
    <WidgetCard
      title="Upcoming Calls"
      icon={<Phone size={16} />}
      loading={isLoading}
      error={error || undefined}
      onRefresh={refetch}
    >
      {stats && stats.upcoming_calls.length > 0 ? (
        <CallsList>
          {stats.upcoming_calls.map(call => (
            <CallItem key={call.id}>
              <CallHeader>
                <CallTitle>{call.title}</CallTitle>
                <CallTime>
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(call.scheduled_for), { addSuffix: true })}
                </CallTime>
              </CallHeader>
              <CallMeta>
                <MetaItem>
                  <Calendar size={12} />
                  {format(new Date(call.scheduled_for), 'MMM d, h:mm a')}
                </MetaItem>
                {call.duration_minutes && (
                  <MetaItem>
                    <Clock size={12} />
                    {call.duration_minutes} min
                  </MetaItem>
                )}
                {call.assigned_to && (
                  <MetaItem>
                    <User size={12} />
                    {call.assigned_to}
                  </MetaItem>
                )}
              </CallMeta>
            </CallItem>
          ))}
        </CallsList>
      ) : (
        <EmptyState>
          <Phone size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
          <div>No upcoming calls</div>
        </EmptyState>
      )}
    </WidgetCard>
  );
};

export default UpcomingCallsWidget;
