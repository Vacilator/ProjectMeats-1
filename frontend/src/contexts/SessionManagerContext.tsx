/**
 * Session Manager Context
 *
 * Manages session expiration state globally across the app.
 * Used by apiService.ts to trigger SessionExpiredModal instead of hard redirects.
 *
 * Features:
 * - Global session expired flag
 * - Modal visibility control
 * - Re-login and navigation handlers
 * - Integrates with AuthContext for seamless re-auth
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionExpiredModal } from '../components/Modal';
import { logger } from '../utils/logger';

interface SessionManagerContextType {
  showSessionExpired: (message?: string) => void;
  hideSessionExpired: () => void;
  isSessionExpired: boolean;
}

const SessionManagerContext = createContext<SessionManagerContextType | undefined>(undefined);

export const useSessionManager = () => {
  const context = useContext(SessionManagerContext);
  if (!context) {
    throw new Error('useSessionManager must be used within SessionManagerProvider');
  }
  return context;
};

interface SessionManagerProviderProps {
  children: ReactNode;
}

export const SessionManagerProvider: React.FC<SessionManagerProviderProps> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const navigate = useNavigate();

  const showSessionExpired = useCallback((customMessage?: string) => {
    setMessage(customMessage);
    setIsModalOpen(true);
  }, []);

  const hideSessionExpired = useCallback(() => {
    setIsModalOpen(false);
    setMessage(undefined);
  }, []);

  // Register the global handler on mount
  React.useEffect(() => {
    registerGlobalSessionExpiredHandler(showSessionExpired);

    return () => {
      // Clean up on unmount
      registerGlobalSessionExpiredHandler(() => {
        logger.warn('Handler cleaned up, falling back to redirect', {
          component: 'SessionManagerContext',
        });
        window.location.href = '/login';
      });
    };
  }, [showSessionExpired]);

  const handleReLogin = useCallback(() => {
    // Preserve current location for redirect after login
    const currentPath = window.location.pathname + window.location.search;
    localStorage.setItem('redirectAfterLogin', currentPath);

    hideSessionExpired();

    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      navigate('/login', {
        state: {
          from: currentPath,
          reason: 'session_expired'
        }
      });
    }, 100);
  }, [hideSessionExpired, navigate]);

  const handleGoToLogin = useCallback(() => {
    hideSessionExpired();

    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      navigate('/login');
    }, 100);
  }, [hideSessionExpired, navigate]);

  const value: SessionManagerContextType = {
    showSessionExpired,
    hideSessionExpired,
    isSessionExpired: isModalOpen,
  };

  return (
    <SessionManagerContext.Provider value={value}>
      {children}
      <SessionExpiredModal
        isOpen={isModalOpen}
        onReLogin={handleReLogin}
        onGoToLogin={handleGoToLogin}
        message={message}
      />
    </SessionManagerContext.Provider>
  );
};

/**
 * Export a global callback that can be used by apiService.ts
 * This allows the service layer to trigger the modal without React context
 */
let globalSessionExpiredHandler: ((message?: string) => void) | null = null;

export const registerGlobalSessionExpiredHandler = (handler: (message?: string) => void) => {
  globalSessionExpiredHandler = handler;
};

export const triggerGlobalSessionExpired = (message?: string) => {
  if (globalSessionExpiredHandler) {
    globalSessionExpiredHandler(message);
  } else {
    // Fallback to hard redirect if handler not registered yet
    logger.warn('Handler not registered, falling back to redirect', {
      component: 'SessionManagerContext',
    });
    window.location.href = '/login';
  }
};
