/**
 * Workflow Node Locking Hook (Phase 7.3: Real-Time Collaboration)
 * 
 * Distributed locking with automatic heartbeat renewal.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { businessApi } from '@/services/businessApi';
import { logger } from '@/utils/logger';

interface NodeLock {
  locked: boolean;
  owner?: string;
  owner_name?: string;
  expires_at?: number;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds (half of TTL)

/**
 * Hook for managing workflow node locks.
 * 
 * Automatically sends heartbeat every 30 seconds to maintain lock.
 */
export const useNodeLocking = (workflowId: string, nodeId: string) => {
  const [lockState, setLockState] = useState<NodeLock | null>(null);
  const [loading, setLoading] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const acquireLock = useCallback(async () => {
    if (!workflowId || !nodeId) return;

    setLoading(true);
    try {
      const response = await businessApi.post(
        `/workflows/${workflowId}/nodes/${nodeId}/lock/`
      );
      setLockState(response.data);

      // Start heartbeat if lock acquired
      if (response.data.locked) {
        startHeartbeat();
      }
    } catch (err) {
      logger.error('Lock acquisition failed', { component: 'useNodeLocking' }, err);
    } finally {
      setLoading(false);
    }
  }, [workflowId, nodeId]);

  const releaseLock = useCallback(async () => {
    if (!workflowId || !nodeId) return;

    try {
      await businessApi.delete(`/workflows/${workflowId}/nodes/${nodeId}/lock/`);
      setLockState(null);
      stopHeartbeat();
    } catch (err) {
      logger.error('Lock release failed', { component: 'useNodeLocking' }, err);
    }
  }, [workflowId, nodeId]);

  const renewLock = useCallback(async () => {
    if (!workflowId || !nodeId) return;

    try {
      await businessApi.post(`/workflows/${workflowId}/nodes/${nodeId}/lock/renew/`);
    } catch (err) {
      logger.error('Lock renewal failed', { component: 'useNodeLocking' }, err);
      stopHeartbeat();
    }
  }, [workflowId, nodeId]);

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(renewLock, HEARTBEAT_INTERVAL);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      releaseLock();
    };
  }, []);

  return {
    lockState,
    loading,
    acquireLock,
    releaseLock,
    isLocked: lockState?.locked || false,
    isLockedByOther: lockState && !lockState.locked
  };
};
