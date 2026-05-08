/**
 * Calendar Widget
 *
 * Displays upcoming events, appointments, and deadlines in a compact calendar view.
 * Provides quick access to event details and calendar management.
 *
 * Features:
 * - Monthly mini calendar
 * - Event list for selected date
 * - Today's schedule
 * - Event type indicators
 *
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WidgetCard } from './WidgetCard';
import { businessApi } from '@/services/businessApi';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  type: 'meeting' | 'deadline' | 'reminder' | 'event';
  color?: string;
}

export interface CalendarWidgetProps {
  initialDate?: Date;
}

// ============================================================================
// Styled Components
// ============================================================================

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const CalendarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
`;

const MonthDisplay = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const NavButtons = styled.div`
  display: flex;
  gap: 4px;
`;

const NavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
    color: rgb(var(--color-primary));
  }
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
`;

const DayLabel = styled.div`
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  padding: 4px 0;
`;

const DayCell = styled.button<{
  $isToday?: boolean;
  $isSelected?: boolean;
  $hasEvents?: boolean;
  $isOtherMonth?: boolean;
}>`
  position: relative;
  aspect-ratio: 1;
  border: 1px solid ${props => props.$isSelected
    ? 'rgb(var(--color-primary))'
    : 'rgb(var(--color-border))'};
  border-radius: var(--radius-sm);
  background: ${props => {
    if (props.$isSelected) return 'rgba(var(--color-primary), 0.1)';
    if (props.$isOtherMonth) return 'rgba(var(--color-surface-secondary), 0.5)';
    return 'rgb(var(--color-surface))';
  }};
  color: ${props => {
    if (props.$isOtherMonth) return 'rgb(var(--color-text-tertiary))';
    if (props.$isToday) return 'rgb(var(--color-primary))';
    return 'rgb(var(--color-text-primary))';
  }};
  font-size: 12px;
  font-weight: ${props => props.$isToday ? 600 : 400};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }

  ${props => props.$hasEvents && `
    &::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgb(var(--color-primary));
    }
  `}
`;

const EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
`;

const EventItem = styled.div`
  display: flex;
  align-items: start;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-surface));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.03);
  }
`;

const EventIndicator = styled.div<{ $color: string }>`
  width: 4px;
  height: 100%;
  border-radius: 2px;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const EventContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const EventTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const EventMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
`;

const EventMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const EmptyState = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getEventColor = (type: string): string => {
  switch (type) {
    case 'meeting': return 'rgb(var(--color-info))';
    case 'deadline': return 'rgb(var(--color-error))';
    case 'reminder': return 'rgb(var(--color-warning))';
    default: return 'rgb(var(--color-success))';
  }
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const getDaysInMonth = (year: number, month: number): Date[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: Date[] = [];

  // Add previous month's trailing days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // Add current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Add next month's leading days to complete the grid
  const remainingDays = 35 - days.length; // 5 weeks
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
};

// ============================================================================
// Component
// ============================================================================

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  initialDate = new Date(),
}) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const response = await businessApi.get('/calendar/events/', {
          params: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          }
        });
        setEvents(response.data.results || []);
      } catch (error) {
        logger.error('[CalendarWidget] Failed to fetch events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [year, month]);

  const days = getDaysInMonth(year, month);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(year, month + direction, 1));
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = new Date(event.startTime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <WidgetCard
      title="Calendar"
      icon={<CalendarIcon size={16} />}
    >
      <CalendarContainer>
        <CalendarHeader>
          <MonthDisplay>{monthName}</MonthDisplay>
          <NavButtons>
            <NavButton onClick={() => navigateMonth(-1)}>
              <ChevronLeft size={16} />
            </NavButton>
            <NavButton onClick={() => navigateMonth(1)}>
              <ChevronRight size={16} />
            </NavButton>
          </NavButtons>
        </CalendarHeader>

        <CalendarGrid>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <DayLabel key={i}>{day}</DayLabel>
          ))}
          {days.map((date, i) => {
            const isToday = date.getTime() === today.getTime();
            const isSelected = date.getTime() === selectedDate.getTime();
            const isOtherMonth = date.getMonth() !== month;
            const hasEvents = getEventsForDate(date).length > 0;

            return (
              <DayCell
                key={i}
                $isToday={isToday}
                $isSelected={isSelected}
                $hasEvents={hasEvents}
                $isOtherMonth={isOtherMonth}
                onClick={() => setSelectedDate(date)}
              >
                {date.getDate()}
              </DayCell>
            );
          })}
        </CalendarGrid>

        {selectedDateEvents.length > 0 ? (
          <EventsList>
            {selectedDateEvents.map(event => (
              <EventItem
                key={event.id}
                onClick={() => navigate(`/calendar/events/${event.id}`)}
              >
                <EventIndicator $color={getEventColor(event.type)} />
                <EventContent>
                  <EventTitle>{event.title}</EventTitle>
                  <EventMeta>
                    <EventMetaRow>
                      <Clock size={10} />
                      {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </EventMetaRow>
                    {event.location && (
                      <EventMetaRow>
                        <MapPin size={10} />
                        {event.location}
                      </EventMetaRow>
                    )}
                  </EventMeta>
                </EventContent>
              </EventItem>
            ))}
          </EventsList>
        ) : (
          <EmptyState>
            No events for {selectedDate.toLocaleDateString()}
          </EmptyState>
        )}
      </CalendarContainer>
    </WidgetCard>
  );
};

export default CalendarWidget;
