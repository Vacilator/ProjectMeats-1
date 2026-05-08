/**
 * Toast Notification Hook
 *
 * Provides a simple toast notification system for user feedback.
 * Uses React Context to manage toast state globally.
 *
 * Usage:
 * ```typescript
 * const toast = useToast();
 *
 * toast.success('User invited successfully');
 * toast.error('Failed to save changes');
 * toast.info('Processing your request...');
 * toast.warning('This action cannot be undone');
 * ```
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import styled from 'styled-components';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  /**
   * Error toast that accepts either a pre-formatted string or an unknown error object.
   * Unknown errors are normalized via `getErrorMessage()`.
   */
  error: (messageOrError: string | unknown, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Toast Provider Component - Wrap your app with this.
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration: number = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, type, message, duration };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (message, duration) => addToast('success', message, duration),
    error: (messageOrError, duration) =>
      addToast('error', getErrorMessage(messageOrError), duration),
    info: (message, duration) => addToast('info', message, duration),
    warning: (message, duration) => addToast('warning', message, duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            type={toast.type}
            onClick={() => dismiss(toast.id)}
            role="alert"
            aria-live="polite"
          >
            <ToastIcon>{getIcon(toast.type)}</ToastIcon>
            <ToastMessage>{toast.message}</ToastMessage>
            <CloseButton onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              ×
            </CloseButton>
          </ToastItem>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast notifications.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function getErrorMessage(err: unknown, fallback: string = 'Something went wrong'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const e = err as {
    message?: unknown;
    response?: {
      data?: unknown;
    };
  };

  const data = e.response?.data;
  if (typeof data === 'string' && data.trim()) return data;

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const direct =
      (typeof obj.detail === 'string' && obj.detail) ||
      (typeof obj.error === 'string' && obj.error) ||
      (typeof obj.message === 'string' && obj.message) ||
      null;

    if (direct) return direct;

    const first = Object.entries(obj).find(([, v]) => typeof v === 'string' || Array.isArray(v));
    if (first) {
      const v = first[1];
      if (typeof v === 'string' && v.trim()) return v;
      if (Array.isArray(v) && v.length > 0) return String(v[0]);
    }
  }

  if (typeof e.message === 'string' && e.message.trim()) return e.message;

  return fallback;
}

// Helper function to get icon for toast type
function getIcon(type: ToastType): string {
  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };
  return icons[type];
}

// Styled Components

const ToastContainer = styled.div`
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;

  @media (max-width: 768px) {
    left: 16px;
    right: 16px;
    top: 70px;
  }
`;

const ToastItem = styled.div<{ type: ToastType }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid ${({ type }) => getBorderColor(type)};
  border-left: 4px solid ${({ type }) => getBorderColor(type)};
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  max-width: 500px;
  pointer-events: auto;
  cursor: pointer;
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    min-width: unset;
    max-width: unset;
  }
`;

const ToastIcon = styled.span`
  font-size: 18px;
  flex-shrink: 0;
`;

const ToastMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  flex: 1;
  line-height: 1.5;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-text-secondary));
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.2s;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

// Helper function to get border color based on toast type
function getBorderColor(type: ToastType): string {
  const colors: Record<ToastType, string> = {
    success: 'rgb(var(--color-success))',
    error: 'rgb(var(--color-error))',
    info: 'rgb(var(--color-info))',
    warning: 'rgb(var(--color-warning))',
  };
  return colors[type];
}
