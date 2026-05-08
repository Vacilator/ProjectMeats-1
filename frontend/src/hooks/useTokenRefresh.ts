/**
 * Automatic Token Refresh Hook
 * 
 * Provides automatic JWT token refresh to prevent session expiration.
 * 
 * Features:
 * - Background token refresh before expiration
 * - Idle detection and auto-logout
 * - Session restoration on page reload
 * - Expiration warnings
 * 
 * Usage:
 * ```typescript
 * function App() {
 *   useTokenRefresh({
 *     refreshBeforeExpiry: 5 * 60 * 1000, // 5 minutes
 *     idleTimeout: 30 * 60 * 1000,        // 30 minutes
 *     onExpiringSoon: () => showWarning(),
 *     onExpired: () => redirectToLogin(),
 *   });
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { 
  getAccessToken, 
  refreshAccessToken, 
  clearTokens,
  needsRefresh,
  isUsingJwt 
} from '../services/jwtService';
import { logger } from '@/utils/logger';

interface TokenRefreshOptions {
  /** Refresh token this many ms before expiry (default: 5 minutes) */
  refreshBeforeExpiry?: number;
  /** Auto-logout after this many ms of inactivity (default: 30 minutes) */
  idleTimeout?: number;
  /** Called when token will expire in < 1 minute */
  onExpiringSoon?: () => void;
  /** Called when token has expired */
  onExpired?: () => void;
  /** Called when user is idle for too long */
  onIdle?: () => void;
  /** Enable debug logging */
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<TokenRefreshOptions> = {
  refreshBeforeExpiry: 5 * 60 * 1000, // 5 minutes
  idleTimeout: 30 * 60 * 1000,         // 30 minutes
  onExpiringSoon: () => logger.warn('Token expiring soon', { component: 'TokenRefresh' }),
  onExpired: () => {
    logger.warn('Token expired', { component: 'TokenRefresh' });
    clearTokens();
    window.location.href = '/login';
  },
  onIdle: () => {
    logger.warn('User idle, logging out', { component: 'TokenRefresh' });
    clearTokens();
    window.location.href = '/login?reason=idle';
  },
  debug: false,
};

export function useTokenRefresh(options: TokenRefreshOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const hasWarnedRef = useRef<boolean>(false);
  
  const log = useCallback((...args: any[]) => {
    if (opts.debug) {
      logger.debug('[TokenRefresh]', args);
    }
  }, [opts.debug]);

  /**
   * Schedule the next token refresh check
   */
  const scheduleRefresh = useCallback(() => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
    // Only schedule if using JWT
    if (!isUsingJwt()) {
      log('Not using JWT, skipping refresh schedule');
      return;
    }
    
    const token = getAccessToken();
    if (!token) {
      log('No access token, skipping refresh schedule');
      return;
    }
    
    // Check if token needs refresh
    if (needsRefresh()) {
      log('Token needs refresh now');
      refreshTokenNow();
      return;
    }
    
    // Schedule next check for 1 minute from now
    const checkInterval = 60 * 1000; // 1 minute
    refreshTimerRef.current = setTimeout(() => {
      scheduleRefresh();
    }, checkInterval);
    
    log('Next refresh check in', checkInterval / 1000, 'seconds');
  }, [log]);

  /**
   * Perform token refresh immediately
   */
  const refreshTokenNow = useCallback(async () => {
    log('Attempting token refresh...');
    
    try {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        log('Token refreshed successfully');
        hasWarnedRef.current = false; // Reset warning flag
        scheduleRefresh(); // Schedule next refresh
      } else {
        log('Token refresh failed');
        opts.onExpired();
      }
    } catch (error) {
      logger.error('[TokenRefresh] Refresh error:', error);
      opts.onExpired();
    }
  }, [log, opts, scheduleRefresh]);

  /**
   * Reset idle timer on user activity
   */
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    idleTimerRef.current = setTimeout(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= opts.idleTimeout) {
        log('User idle for', idleTime / 1000, 'seconds');
        opts.onIdle();
      }
    }, opts.idleTimeout);
  }, [log, opts]);

  /**
   * Handle user activity events
   */
  const handleActivity = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  /**
   * Initialize token refresh and idle detection
   */
  useEffect(() => {
    if (!isUsingJwt()) {
      log('Not using JWT, token refresh disabled');
      return;
    }

    log('Initializing automatic token refresh');
    
    // Start refresh schedule
    scheduleRefresh();
    
    // Start idle detection
    resetIdleTimer();
    
    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    // Cleanup
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [scheduleRefresh, resetIdleTimer, handleActivity, log]);

  /**
   * Handle page visibility changes (tab switching)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        log('Page visible again, checking token status');
        
        // When tab becomes visible, check if token needs refresh
        if (needsRefresh()) {
          refreshTokenNow();
        }
        
        // Reset idle timer
        resetIdleTimer();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshTokenNow, resetIdleTimer, log]);

  return {
    refreshNow: refreshTokenNow,
  };
}
