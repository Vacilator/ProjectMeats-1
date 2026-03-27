/**
 * Auto-Save Hook for Workflow Editor
 * Phase 7.5: Incremental Auto-Save
 * 
 * Features:
 * - Debounced save to prevent excessive API calls
 * - Optimistic UI updates
 * - Save status indicators
 * - Error handling with retry logic
 * - Dirty state tracking
 * 
 * Created: 2026-02-27
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '@/utils/performance';

// ============================================================================
// Types
// ============================================================================

export type SaveStatus = 
  | 'idle'          // No changes
  | 'pending'       // Changes not yet saved
  | 'saving'        // Currently saving
  | 'saved'         // Successfully saved
  | 'error';        // Save failed

export interface AutoSaveOptions<T> {
  /** Function to call to save data */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in milliseconds (default: 2000) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Callback when save completes successfully */
  onSaveSuccess?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Show saved indicator for N milliseconds (default: 2000) */
  savedIndicatorDuration?: number;
}

export interface AutoSaveResult {
  /** Current save status */
  status: SaveStatus;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Manually trigger save (bypasses debounce) */
  saveNow: () => Promise<void>;
  /** Reset dirty state */
  resetDirty: () => void;
  /** Last save timestamp */
  lastSaved: Date | null;
  /** Current error if status is 'error' */
  error: Error | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for implementing auto-save functionality with debouncing and status tracking.
 * 
 * @example
 * ```tsx
 * const { status, isDirty, saveNow } = useAutoSave({
 *   data: workflowData,
 *   onSave: async (data) => {
 *     await api.updateWorkflow(workflowId, data);
 *   },
 *   delay: 3000,
 *   onSaveSuccess: () => toast.success('Workflow saved'),
 *   onSaveError: (err) => toast.error(err.message)
 * });
 * 
 * return (
 *   <div>
 *     <StatusIndicator status={status} />
 *     <button onClick={saveNow}>Save Now</button>
 *   </div>
 * );
 * ```
 */
export function useAutoSave<T>(
  data: T,
  options: AutoSaveOptions<T>
): AutoSaveResult {
  const {
    onSave,
    delay = 2000,
    enabled = true,
    onSaveSuccess,
    onSaveError,
    maxRetries = 3,
    savedIndicatorDuration = 2000,
  } = options;

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const retryCountRef = useRef(0);
  const previousDataRef = useRef<T>(data);
  const savedIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Core save function with retry logic
   */
  const performSave = useCallback(async (dataToSave: T) => {
    if (!enabled) return;

    setStatus('saving');
    setError(null);

    try {
      await onSave(dataToSave);
      
      // Save successful
      setStatus('saved');
      setIsDirty(false);
      setLastSaved(new Date());
      retryCountRef.current = 0;
      
      onSaveSuccess?.();

      // Show "saved" indicator for a few seconds
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
      }
      savedIndicatorTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, savedIndicatorDuration);

    } catch (err) {
      const saveError = err instanceof Error ? err : new Error('Save failed');
      
      // Retry logic
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        console.warn(
          `Auto-save failed, retrying (${retryCountRef.current}/${maxRetries})...`,
          saveError
        );
        
        // Exponential backoff: 1s, 2s, 4s
        const retryDelay = 1000 * Math.pow(2, retryCountRef.current - 1);
        setTimeout(() => performSave(dataToSave), retryDelay);
        return;
      }
      
      // Max retries exceeded
      setStatus('error');
      setError(saveError);
      onSaveError?.(saveError);
      retryCountRef.current = 0;
    }
  }, [enabled, onSave, onSaveSuccess, onSaveError, maxRetries, savedIndicatorDuration]);

  /**
   * Debounced save function
   */
  const debouncedSave = useDebounce(performSave, delay);

  /**
   * Manual save (bypasses debounce)
   */
  const saveNow = useCallback(async () => {
    if (!enabled || !isDirty) return;
    await performSave(data);
  }, [enabled, isDirty, data, performSave]);

  /**
   * Reset dirty state (e.g., after discarding changes)
   */
  const resetDirty = useCallback(() => {
    setIsDirty(false);
    setStatus('idle');
    previousDataRef.current = data;
  }, [data]);

  /**
   * Detect data changes and trigger auto-save
   */
  useEffect(() => {
    // Skip if auto-save disabled
    if (!enabled) return;

    // Skip on initial mount
    if (!previousDataRef.current) {
      previousDataRef.current = data;
      return;
    }

    // Check if data actually changed (deep comparison would be better but expensive)
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);
    
    if (dataChanged) {
      setIsDirty(true);
      setStatus('pending');
      previousDataRef.current = data;
      
      // Trigger debounced save
      debouncedSave(data);
    }
  }, [data, enabled, debouncedSave]);

  /**
   * Cleanup timers on unmount
   */
  useEffect(() => {
    return () => {
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
      }
    };
  }, []);

  return {
    status,
    isDirty,
    saveNow,
    resetDirty,
    lastSaved,
    error,
  };
}
