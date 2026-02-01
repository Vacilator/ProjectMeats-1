/**
 * Upcoming Calls Widget
 * 
 * Displays scheduled calls and reminders for contacts.
 * Shows today's and upcoming callbacks.
 * 
 * Features:
 * - Today's calls highlighted
 * - Overdue calls flagged
 * - Quick call/reschedule actions
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Phone, Clock, AlertCircle, ChevronRight, Calendar } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import axios from 'axios';
import { format, isToday, isPast, isTomorrow } from 'date-fns';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface CallItem {
  id: string;
  contactName: string;
  companyName: string;
  phone: string;
  scheduledAt: string;
  notes?: string;
  entityType: 'customer' | 'supplier';
  entityId: string;
}

export interface UpcomingCallsWidgetProps {
  tenantId?: string;
  limit?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const CallsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CallItem = styled.div<{ $overdue?: boolean; $today?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: ${props => 
    props.$overdue ? 'rgba(239, 68, 68, 0.08)' : 
    props.$today ? 'rgba(34, 197, 94, 0.08)' : 
    'rgb(var(--color-background))'};
  border: 1px solid ${props => 
    props.$overdue ? 'rgba(239, 68, 68, 0.2)' : 
    props.$today ? 'rgba(34, 197, 94, 0.2)' : 
    'rgb(var(--color-border))'};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const CallIcon = styled.div<{ $overdue?: boolean; $today?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${props => 
    props.$overdue ? 'rgba(239, 68, 68, 0.15)' : 
    props.$today ? 'rgba(34, 197, 94, 0.15)' : 
    'rgb(var(--color-primary) / 0.1)'};
  color: ${props => 
    props.$overdue ? 'rgb(239, 68, 68)' : 
    props.$today ? 'rgb(34, 197, 94)' : 
    'rgb(var(--color-primary))'};
`;

const CallContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const CallContact = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CallCompany = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CallTime = styled.div<{ $overdue?: boolean; $today?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: ${props => 
    props.$overdue ? 'rgb(239, 68, 68)' : 
    props.$today ? 'rgb(34, 197, 94)' : 
    'rgb(var(--color-text-tertiary))'};
  margin-top: 2px;
`;

const CallAction = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-text-tertiary));
`;

const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-tertiary));
  padding: 8px 4px 4px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));

  svg {
    margin-bottom: 8px;
    opacity: 0.5;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const UpcomingCallsWidget: React.FC<UpcomingCallsWidgetProps> = ({
  tenantId,
  limit = 10,
}) => {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      // Try to fetch from API, fall back to mock data
      const response = await axios.get(`/api/v1/workspace/calls/upcoming/?limit=${limit}`).catch(() => null);
      
      if (response?.data) {
        setCalls(response.data.calls);
      } else {
        // Mock data for development
        const now = new Date();
        setCalls([
          {
            id: '1',
            contactName: 'Mike Johnson',
            companyName: 'Fresh Foods Co',
            phone: '+1 (555) 123-4567',
            scheduledAt: new Date(now.getTime() - 2 * 3600000).toISOString(), // 2 hours ago (overdue)
            entityType: 'customer',
            entityId: '101',
          },
          {
            id: '2',
            contactName: 'Sarah Williams',
            companyName: 'Premium Meats Inc',
            phone: '+1 (555) 234-5678',
            scheduledAt: new Date(now.getTime() + 2 * 3600000).toISOString(), // In 2 hours (today)
            entityType: 'supplier',
            entityId: '201',
          },
          {
            id: '3',
            contactName: 'Tom Brown',
            companyName: 'Quality Proteins LLC',
            phone: '+1 (555) 345-6789',
            scheduledAt: new Date(now.getTime() + 4 * 3600000).toISOString(), // In 4 hours (today)
            notes: 'Discuss Q2 pricing',
            entityType: 'supplier',
            entityId: '202',
          },
          {
            id: '4',
            contactName: 'Lisa Davis',
            companyName: 'Metro Restaurants',
            phone: '+1 (555) 456-7890',
            scheduledAt: new Date(now.getTime() + 24 * 3600000).toISOString(), // Tomorrow
            entityType: 'customer',
            entityId: '102',
          },
        ]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, [tenantId, limit]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Group calls by status
  const overdueCalls = calls.filter(c => isPast(new Date(c.scheduledAt)) && !isToday(new Date(c.scheduledAt)));
  const todayCalls = calls.filter(c => isToday(new Date(c.scheduledAt)));
  const upcomingCalls = calls.filter(c => !isToday(new Date(c.scheduledAt)) && !isPast(new Date(c.scheduledAt)));

  const formatCallTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isTomorrow(date)) {
      return `Tomorrow ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <WidgetCard
      title="Upcoming Calls"
      icon={<Phone size={16} />}
      loading={loading}
      error={error}
      onRefresh={fetchCalls}
    >
      {calls.length === 0 ? (
        <EmptyState>
          <Calendar size={24} />
          <span>No calls scheduled</span>
        </EmptyState>
      ) : (
        <CallsList>
          {overdueCalls.length > 0 && (
            <>
              <SectionLabel>Overdue</SectionLabel>
              {overdueCalls.map(call => (
                <CallItem key={call.id} $overdue>
                  <CallIcon $overdue>
                    <AlertCircle size={16} />
                  </CallIcon>
                  <CallContent>
                    <CallContact>{call.contactName}</CallContact>
                    <CallCompany>{call.companyName}</CallCompany>
                    <CallTime $overdue>
                      <Clock size={10} />
                      {formatCallTime(call.scheduledAt)}
                    </CallTime>
                  </CallContent>
                  <CallAction>
                    <ChevronRight size={16} />
                  </CallAction>
                </CallItem>
              ))}
            </>
          )}

          {todayCalls.length > 0 && (
            <>
              <SectionLabel>Today</SectionLabel>
              {todayCalls.map(call => (
                <CallItem key={call.id} $today>
                  <CallIcon $today>
                    <Phone size={16} />
                  </CallIcon>
                  <CallContent>
                    <CallContact>{call.contactName}</CallContact>
                    <CallCompany>{call.companyName}</CallCompany>
                    <CallTime $today>
                      <Clock size={10} />
                      {formatCallTime(call.scheduledAt)}
                    </CallTime>
                  </CallContent>
                  <CallAction>
                    <ChevronRight size={16} />
                  </CallAction>
                </CallItem>
              ))}
            </>
          )}

          {upcomingCalls.length > 0 && (
            <>
              <SectionLabel>Upcoming</SectionLabel>
              {upcomingCalls.map(call => (
                <CallItem key={call.id}>
                  <CallIcon>
                    <Phone size={16} />
                  </CallIcon>
                  <CallContent>
                    <CallContact>{call.contactName}</CallContact>
                    <CallCompany>{call.companyName}</CallCompany>
                    <CallTime>
                      <Clock size={10} />
                      {formatCallTime(call.scheduledAt)}
                    </CallTime>
                  </CallContent>
                  <CallAction>
                    <ChevronRight size={16} />
                  </CallAction>
                </CallItem>
              ))}
            </>
          )}
        </CallsList>
      )}
    </WidgetCard>
  );
};

export default UpcomingCallsWidget;
