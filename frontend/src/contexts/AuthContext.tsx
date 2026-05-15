/**
 * Authentication context for managing user authentication state across the app.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { UserProfile } from '../types';
import { authService, LoginCredentials, SignUpCredentials } from '../services/authService';
import { clearSentryUser, setSentryTenant, setSentryUser } from '../utils/sentry';
import { logger } from '../utils/logger';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  guestLogin: () => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const tenantId = localStorage.getItem('tenantId') || undefined;
          setSentryUser(String(currentUser.id), currentUser.email, tenantId, currentUser.username);
          if (tenantId) setSentryTenant(tenantId);
        } else {
          clearSentryUser();
        }
      } catch (error) {
        logger.error('Failed to initialize auth', { component: 'AuthContext' }, error);
        setUser(null);
        clearSentryUser();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const loggedInUser = await authService.login(credentials);
      setUser(loggedInUser);

      if (loggedInUser) {
        const tenantId = localStorage.getItem('tenantId') || undefined;
        setSentryUser(String(loggedInUser.id), loggedInUser.email, tenantId, loggedInUser.username);
        if (tenantId) setSentryTenant(tenantId);
      } else {
        clearSentryUser();
      }
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const guestLogin = useCallback(async () => {
    setLoading(true);
    try {
      const loggedInUser = await authService.guestLogin();
      setUser(loggedInUser);

      if (loggedInUser) {
        const tenantId = localStorage.getItem('tenantId') || undefined;
        setSentryUser(String(loggedInUser.id), loggedInUser.email, tenantId, loggedInUser.username);
        if (tenantId) setSentryTenant(tenantId);
      } else {
        clearSentryUser();
      }
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    setLoading(true);
    try {
      const newUser = await authService.signUp(credentials);
      setUser(newUser);

      if (newUser) {
        const tenantId = localStorage.getItem('tenantId') || undefined;
        setSentryUser(String(newUser.id), newUser.email, tenantId, newUser.username);
        if (tenantId) setSentryTenant(tenantId);
      } else {
        clearSentryUser();
      }
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      clearSentryUser();
    } catch (error) {
      logger.error('Logout failed during AuthContext cleanup', { component: 'AuthContext' }, error);
      setUser(null);
      clearSentryUser();
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const tenantId = localStorage.getItem('tenantId') || undefined;
        setSentryUser(String(currentUser.id), currentUser.email, tenantId, currentUser.username);
        if (tenantId) setSentryTenant(tenantId);
      } else {
        clearSentryUser();
      }
    } catch (error) {
      logger.error('Failed to refresh user', { component: 'AuthContext' }, error);
      setUser(null);
      clearSentryUser();
    }
  }, []);

  const isAdmin = useMemo(() => authService.isAdmin(), []);

  const value = useMemo<AuthContextType>(() => {
    return {
      user,
      loading,
      login,
      guestLogin,
      signUp,
      logout,
      isAuthenticated: Boolean(user),
      isAdmin,
      refreshUser,
    };
  }, [user, loading, login, guestLogin, signUp, logout, isAdmin, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Minimal auth state hook that does NOT require AuthProvider.
 *
 * Used for providers/hooks that can be mounted in isolation (tests, storybook, etc.)
 * but still need to avoid firing authenticated queries when no credentials exist.
 */
export const useAuthState = (): { isAuthenticated: boolean; loading: boolean } => {
  const context = useContext(AuthContext);

  // Treat cached user objects as *non-authoritative* for API gating.
  // We only consider the session authenticated for network calls when token credentials exist.
  const hasTokenCredentials =
    typeof window !== 'undefined' &&
    Boolean(
      localStorage.getItem('accessToken') ||
        localStorage.getItem('refreshToken') ||
        localStorage.getItem('authToken')
    );

  if (context !== undefined) {
    return {
      isAuthenticated: context.isAuthenticated && hasTokenCredentials,
      loading: context.loading,
    };
  }

  return { isAuthenticated: hasTokenCredentials, loading: false };
};
