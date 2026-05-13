/**
 * useApprovalGate — Hook for intercepting outbound communications.
 *
 * Checks user AI preferences and shows ApprovalPreviewModal if needed.
 * Returns a promise that resolves when user approves/rejects.
 */

import { useCallback, useRef, useState } from 'react';
import { userAIPreferencesApi, approvalQueueApi } from '../services/aiService';
import type { ExternalApprovalRequest } from '../services/aiService';

export interface ApprovalGateRequest {
  requestType: string;
  subject: string;
  recipientType?: string;
  recipientEntityId?: string;
  recipientName?: string;
  recipientEmail?: string;
  contentPreview?: string;
  contentPayload?: Record<string, unknown>;
  sourceEntityType?: string;
  sourceEntityId?: string;
  aiGenerated?: boolean;
  aiConfidence?: number;
  priority?: string;
}

export interface ApprovalGateResult {
  requiresApproval: boolean;
  approved: boolean;
  requestId?: string;
  editedContent?: Record<string, unknown> | null;
}

interface PendingResolver {
  resolve: (result: ApprovalGateResult) => void;
  request: ApprovalGateRequest;
}

export function useApprovalGate() {
  const [showModal, setShowModal] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<ApprovalGateRequest | null>(null);
  const [createdApproval, setCreatedApproval] = useState<ExternalApprovalRequest | null>(null);
  const pendingRef = useRef<PendingResolver | null>(null);
  const prefsCache = useRef<{ requireApproval: boolean; loaded: boolean }>({
    requireApproval: true,
    loaded: false,
  });

  const loadPrefs = useCallback(async () => {
    if (prefsCache.current.loaded) return prefsCache.current.requireApproval;
    try {
      const prefs = await userAIPreferencesApi.get();
      prefsCache.current = { requireApproval: prefs.require_external_approval, loaded: true };
      return prefs.require_external_approval;
    } catch {
      return true; // Default to requiring approval on error
    }
  }, []);

  /**
   * Intercept an outbound communication.
   * If approval is required, shows the modal and waits for user decision.
   * Returns a promise that resolves with the result.
   */
  const intercept = useCallback(async (request: ApprovalGateRequest): Promise<ApprovalGateResult> => {
    const requireApproval = await loadPrefs();

    if (!requireApproval) {
      return { requiresApproval: false, approved: true };
    }

    // Show the approval modal and wait for user decision
    return new Promise<ApprovalGateResult>((resolve) => {
      pendingRef.current = { resolve, request };
      setCurrentRequest(request);
      setShowModal(true);
    });
  }, [loadPrefs]);

  /** Called by ApprovalPreviewModal when user approves. */
  const handleApprove = useCallback(async (notes?: string) => {
    if (createdApproval) {
      try {
        await approvalQueueApi.approve(createdApproval.id, notes);
      } catch {
        // Best-effort
      }
    }
    pendingRef.current?.resolve({
      requiresApproval: true,
      approved: true,
      requestId: createdApproval?.id,
    });
    setShowModal(false);
    setCurrentRequest(null);
    setCreatedApproval(null);
    pendingRef.current = null;
  }, [createdApproval]);

  /** Called by ApprovalPreviewModal when user rejects. */
  const handleReject = useCallback(async (notes?: string) => {
    if (createdApproval) {
      try {
        await approvalQueueApi.reject(createdApproval.id, notes);
      } catch {
        // Best-effort
      }
    }
    pendingRef.current?.resolve({
      requiresApproval: true,
      approved: false,
      requestId: createdApproval?.id,
    });
    setShowModal(false);
    setCurrentRequest(null);
    setCreatedApproval(null);
    pendingRef.current = null;
  }, [createdApproval]);

  /** Called when user edits content then approves. */
  const handleEditApprove = useCallback(async (editedContent: Record<string, unknown>, notes?: string) => {
    if (createdApproval) {
      try {
        await approvalQueueApi.editApprove(createdApproval.id, editedContent, notes);
      } catch {
        // Best-effort
      }
    }
    pendingRef.current?.resolve({
      requiresApproval: true,
      approved: true,
      requestId: createdApproval?.id,
      editedContent,
    });
    setShowModal(false);
    setCurrentRequest(null);
    setCreatedApproval(null);
    pendingRef.current = null;
  }, [createdApproval]);

  /** Dismiss the modal without deciding (cancel). */
  const handleCancel = useCallback(() => {
    pendingRef.current?.resolve({
      requiresApproval: true,
      approved: false,
    });
    setShowModal(false);
    setCurrentRequest(null);
    setCreatedApproval(null);
    pendingRef.current = null;
  }, []);

  /** Invalidate the cached prefs (call after user changes settings). */
  const invalidatePrefs = useCallback(() => {
    prefsCache.current = { requireApproval: true, loaded: false };
  }, []);

  return {
    intercept,
    showModal,
    currentRequest,
    handleApprove,
    handleReject,
    handleEditApprove,
    handleCancel,
    invalidatePrefs,
    setCreatedApproval,
  };
}
