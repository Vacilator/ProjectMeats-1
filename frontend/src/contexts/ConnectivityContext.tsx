import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ConnectivityStatus = 'online' | 'offline' | 'reconnecting';

interface ConnectivityState {
  status: ConnectivityStatus;
  lastChangedAt: number | null;
}

interface ConnectivityContextValue extends ConnectivityState {
  isOnline: boolean;
}

interface ConnectivityProviderProps {
  children: React.ReactNode;
}

const RECONNECT_STABILIZE_MS = 1500;

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

function getInitialStatus(): ConnectivityStatus {
  if (typeof navigator === 'undefined') {
    return 'online';
  }

  return navigator.onLine ? 'online' : 'offline';
}

export const ConnectivityProvider: React.FC<ConnectivityProviderProps> = ({ children }) => {
  const [state, setState] = useState<ConnectivityState>(() => ({
    status: getInitialStatus(),
    lastChangedAt: null,
  }));
  const stateRef = useRef(state);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const updateStatus = useCallback((nextStatus: ConnectivityStatus) => {
    setState((prevState) => {
      if (prevState.status === nextStatus) {
        return prevState;
      }

      return {
        status: nextStatus,
        lastChangedAt: Date.now(),
      };
    });
  }, []);

  const handleOffline = useCallback(() => {
    clearReconnectTimer();

    if (stateRef.current.status !== 'offline') {
      updateStatus('offline');
    }
  }, [clearReconnectTimer, updateStatus]);

  const handleOnline = useCallback(() => {
    clearReconnectTimer();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
      return;
    }

    if (stateRef.current.status === 'online') {
      return;
    }

    updateStatus('reconnecting');

    reconnectTimerRef.current = window.setTimeout(() => {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        updateStatus('online');
      } else {
        updateStatus('offline');
      }
    }, RECONNECT_STABILIZE_MS);
  }, [clearReconnectTimer, handleOffline, updateStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearReconnectTimer();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [clearReconnectTimer, handleOffline, handleOnline]);

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      ...state,
      isOnline: state.status === 'online',
    }),
    [state]
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
};

export function useConnectivity(): ConnectivityContextValue {
  const context = useContext(ConnectivityContext);

  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider.');
  }

  return context;
}
