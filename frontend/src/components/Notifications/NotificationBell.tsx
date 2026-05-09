/**
 * NotificationBell component - displays notification icon with unread count badge.
 *
 * Features:
 * - Unread count badge
 * - Click to open notification panel
 * - Animated bell icon for new notifications
 */
import React, { useState, useRef, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationsContext';
import NotificationPanel from './NotificationPanel';

// ============================================================================
// ANIMATIONS
// ============================================================================

const shake = keyframes`
  0%, 100% { transform: rotate(0deg); }
  10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
  20%, 40%, 60%, 80% { transform: rotate(10deg); }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const BellContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const BellButton = styled.button<{ $hasUnread: boolean; $isAnimating: boolean }>`
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  color: rgb(var(--color-text-secondary));

  &:hover {
    background-color: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.3);
  }

  ${({ $isAnimating }) => $isAnimating && css`
    animation: ${shake} 0.5s ease-in-out;
  `}
`;

const Badge = styled.span<{ $count: number }>`
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  color: rgb(var(--color-text-inverse));
  background-color: rgb(var(--color-error));
  border-radius: 9px;

  /* Adjust for large numbers */
  ${({ $count }) => $count > 99 && css`
    font-size: 9px;
    min-width: 22px;
    padding: 0 3px;
  `}
`;

const PanelContainer = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  z-index: 1000;
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  transform: ${({ $isOpen }) => ($isOpen ? 'translateY(0)' : 'translateY(-10px)')};
  transition: all 0.2s ease;
`;

// ============================================================================
// COMPONENT
// ============================================================================

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const { unreadCount, fetchNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastCount, setLastCount] = useState(unreadCount);
  const containerRef = useRef<HTMLDivElement>(null);

  // Animate when new notifications arrive
  useEffect(() => {
    if (unreadCount > lastCount && !isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
    setLastCount(unreadCount);
  }, [unreadCount, lastCount, isOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <BellContainer ref={containerRef} className={className}>
      <BellButton
        data-testid="notification-bell-button"
        onClick={handleToggle}
        $hasUnread={unreadCount > 0}
        $isAnimating={isAnimating}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <Badge data-testid="notification-bell-badge" $count={unreadCount} aria-hidden="true">
            {displayCount}
          </Badge>
        )}
      </BellButton>

      <PanelContainer $isOpen={isOpen}>
        <NotificationPanel onClose={handleClose} />
      </PanelContainer>
    </BellContainer>
  );
};

export default NotificationBell;
