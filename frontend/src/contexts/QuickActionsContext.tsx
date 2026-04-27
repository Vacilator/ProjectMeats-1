/**
 * Quick Actions Context
 *
 * Global state management for Quick Actions feature.
 * Handles loading, caching, and updating user's quick actions.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthState } from '@/contexts/AuthContext';
import { getAvailableWorkForms } from '@/services/workformsApi';
import { showAlert } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';
import { getValidTenantId } from '@/utils/tenantId';
import { ApiErrorContent } from '@/components/errors/ApiErrorContent';
import { getApiErrorPresentation } from '@/services/apiErrorPresentation';
import {
  quickActionsService,
  formSubmissionService,
  QuickActionItem,
  AvailableForm,
  FormSubmission,
} from '../services/quickActionsService';

interface QuickActionsContextType {
  // Quick Actions
  quickActions: QuickActionItem[];
  availableForms: AvailableForm[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshQuickActions: () => Promise<void>;
  updateQuickActions: (items: QuickActionItem[]) => Promise<void>;
  addQuickAction: (form: AvailableForm) => Promise<void>;
  removeQuickAction: (actionId: string) => Promise<void>;
  reorderQuickActions: (items: QuickActionItem[]) => Promise<void>;
  
  // Form Submission
  activeSubmission: FormSubmission | null;
  startFormSubmission: (formId: string) => Promise<FormSubmission>;
  resumeSubmission: (submissionId: string) => Promise<void>;
  closeSubmission: () => void;
  
  // UI State
  isEditorOpen: boolean;
  openEditor: () => void;
  closeEditor: () => void;
  
  isFormModalOpen: boolean;
  openFormModal: (formId: string) => void;
  closeFormModal: () => void;
}

const QuickActionsContext = createContext<QuickActionsContextType | undefined>(undefined);

export const useQuickActions = (): QuickActionsContextType => {
  const context = useContext(QuickActionsContext);
  if (!context) {
    throw new Error('useQuickActions must be used within a QuickActionsProvider');
  }
  return context;
};

interface QuickActionsProviderProps {
  children: ReactNode;
}

export const QuickActionsProvider: React.FC<QuickActionsProviderProps> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuthState();

  const [quickActions, setQuickActions] = useState<QuickActionItem[]>([]);
  const [availableForms, setAvailableForms] = useState<AvailableForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSubmission, setActiveSubmission] = useState<FormSubmission | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const warnedMissingTenantRef = React.useRef(false);

  // Load quick actions when authenticated (and tenant is available)
  const refreshQuickActions = useCallback(async () => {
    // Prevent noisy 401 spam during app bootstrap.
    if (authLoading) return;
    if (!isAuthenticated) {
      setQuickActions([]);
      setAvailableForms([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const isAuthError = (err: any) => {
      const status = err?.response?.status;
      return status === 401 || status === 403;
    };

    try {
      setIsLoading(true);
      setError(null);

      // Tenant-scoped endpoints will 400 if tenant context is missing/invalid.
      // Avoid noisy console errors and defer loading until tenant is selected.
      const tenantId = getValidTenantId();
      if (!tenantId) {
        if (!warnedMissingTenantRef.current) {
          warnedMissingTenantRef.current = true;
          logger.warn('[QuickActions] Skipping initial load; missing/invalid tenantId');
        }
        setQuickActions([]);
        setAvailableForms([]);
        setError(null);
        return;
      }

      const [actionsResult, formsResult, workformsResult] = await Promise.allSettled([
        quickActionsService.getQuickActions(),
        quickActionsService.getAvailableForms(),
        getAvailableWorkForms(),
      ]);

      const isAuthRejection = (r: PromiseSettledResult<unknown>) =>
        r.status === 'rejected' && isAuthError((r as PromiseRejectedResult).reason);

      // Important: support cookie-auth sessions (no localStorage token).
      // Treat "all three sources rejected with 401/403" as a normal logged-out state.
      // Otherwise, degrade gracefully (e.g., workforms list may be forbidden while legacy forms still work).
      const loggedOut = [actionsResult, formsResult, workformsResult].every(isAuthRejection);
      if (loggedOut) {
        setQuickActions([]);
        setAvailableForms([]);
        setError(null);
        return;
      }

      if (actionsResult.status === 'rejected') {
        // Don't treat auth errors here as "logged out" unless *all* sources failed auth.
        // This allows partial functionality when one endpoint is forbidden.
        const msg = actionsResult.reason?.message || 'Failed to load quick actions';
        logger.warn('[QuickActions] getQuickActions failed', actionsResult.reason);
        setError(isAuthError(actionsResult.reason) ? null : msg);
      }

      const actionsResponse = actionsResult.status === 'fulfilled' ? actionsResult.value : { items: [] };
      setQuickActions(actionsResponse.items || []);

      const availableResponse = formsResult.status === 'fulfilled' ? formsResult.value : [];
      const availableTargets = (Array.isArray(availableResponse) ? availableResponse : [])
        .filter((item) => (item.type ?? 'form') === 'form' || item.type === 'workflow')
        .map((item) => {
          const isWorkflow = item.type === 'workflow';
          return {
            ...item,
            type: isWorkflow ? ('workflow' as const) : ('form' as const),
            icon: item.icon || (isWorkflow ? 'layers' : 'file-text'),
          } as AvailableForm;
        });

      if (formsResult.status === 'rejected') {
        logger.warn('[QuickActions] available-forms failed; continuing with WorkForms enrichment only', formsResult.reason);
      }

      // Optional enrichment from /tenant-workforms/ (may be permission-scoped differently).
      const workformsResponse = workformsResult.status === 'fulfilled' ? workformsResult.value : [];
      const workformsEnrichment = (Array.isArray(workformsResponse) ? workformsResponse : [])
        .filter((wf) => wf.status === 'active' || wf.status === 'draft')
        .map((wf) => {
          const anyWf = wf as any;
          const nodeCount =
            typeof anyWf.node_count === 'number'
              ? anyWf.node_count
              : typeof anyWf.step_count === 'number'
                ? anyWf.step_count
                : null;

          return {
            id: wf.id,
            type: 'workflow' as const,
            name: wf.name,
            description: wf.description ?? '',
            icon: 'layers',
            status: wf.status,
            is_default: false,
            is_quick_action_enabled: true,
            step_count: typeof anyWf.step_count === 'number' ? anyWf.step_count : 0,
            node_count: nodeCount,
          } as AvailableForm;
        });

      if (workformsResult.status === 'rejected') {
        logger.warn('[QuickActions] WorkForms list failed; continuing with available-forms only', workformsResult.reason);
      }

      const byKey = new Map<string, AvailableForm>();

      for (const item of availableTargets) {
        byKey.set(`${item.type ?? 'form'}:${item.id}`, item);
      }

      // Enrich/override workflow rows with WorkForms list data when available.
      for (const wf of workformsEnrichment) {
        byKey.set(`workflow:${wf.id}`, {
          ...byKey.get(`workflow:${wf.id}`),
          ...wf,
        });
      }

      const combined = Array.from(byKey.values()).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setAvailableForms(combined);
    } catch (err: any) {
      logger.error('Failed to load quick actions:', err);
      setError(err?.message || 'Failed to load quick actions');
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const didFetchForAuthRef = React.useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Allow a fresh load after the next successful login.
      didFetchForAuthRef.current = false;
      setQuickActions([]);
      setAvailableForms([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (didFetchForAuthRef.current) return;
    didFetchForAuthRef.current = true;
    void refreshQuickActions();
  }, [authLoading, isAuthenticated, refreshQuickActions]);

  const updateQuickActions = useCallback(async (items: QuickActionItem[]) => {
    try {
      setError(null);
      const response = await quickActionsService.updateQuickActions(items);
      setQuickActions(response.items);
    } catch (err: any) {
      logger.error('Failed to update quick actions:', err);
      setError(err.message || 'Failed to update quick actions');
      throw err;
    }
  }, []);

  const addQuickAction = useCallback(async (item: AvailableForm) => {
    const itemType = item.type === 'workflow' ? 'workflow' : 'form';

    const newAction: QuickActionItem = {
      id: `qa_${Date.now()}`,
      type: itemType,
      ...(itemType === 'workflow' ? { workflow_id: item.id } : { form_id: item.id }),
      label: item.name,
      icon: item.icon || (itemType === 'workflow' ? 'layers' : 'file-text'),
      order: quickActions.length,
    };

    const updatedActions = [...quickActions, newAction];
    await updateQuickActions(updatedActions);
  }, [quickActions, updateQuickActions]);

  const removeQuickAction = useCallback(async (actionId: string) => {
    const updatedActions = quickActions
      .filter(a => a.id !== actionId)
      .map((a, idx) => ({ ...a, order: idx }));
    await updateQuickActions(updatedActions);
  }, [quickActions, updateQuickActions]);

  const reorderQuickActions = useCallback(async (items: QuickActionItem[]) => {
    const reorderedItems = items.map((item, idx) => ({ ...item, order: idx }));
    await updateQuickActions(reorderedItems);
  }, [updateQuickActions]);

  const startFormSubmission = useCallback(async (formId: string): Promise<FormSubmission> => {
    const submission = await formSubmissionService.create(formId);
    setActiveSubmission(submission);
    setIsFormModalOpen(true);
    return submission;
  }, []);

  const resumeSubmission = useCallback(async (submissionId: string): Promise<void> => {
    const submission = await formSubmissionService.get(submissionId);
    setActiveSubmission(submission);
    setIsFormModalOpen(true);
  }, []);

  const closeSubmission = useCallback(() => {
    setActiveSubmission(null);
  }, []);

  const openEditor = useCallback(() => {
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const openFormModal = useCallback(async (formId: string) => {
    try {
      setError(null);
      logger.debug('[QuickActions] Opening form modal for formId:', formId);
      const submission = await startFormSubmission(formId);
      logger.debug('[QuickActions] Form submission created:', submission?.id);
    } catch (err: any) {
      logger.error('[QuickActions] Failed to start form submission:', err);
      const presentation = getApiErrorPresentation(err, { fallbackMessage: 'Failed to start form' });
      setError(presentation.friendlyMessage);

      // Alert the user since the modal won't open
      showAlert({
        type: 'error',
        title: 'Error',
        content: <ApiErrorContent error={err} fallbackMessage={presentation.friendlyMessage} />,
      });
    }
  }, [startFormSubmission]);

  const closeFormModal = useCallback(() => {
    setIsFormModalOpen(false);
    setActiveSubmission(null);
  }, []);

  const value: QuickActionsContextType = {
    quickActions,
    availableForms,
    isLoading,
    error,
    refreshQuickActions,
    updateQuickActions,
    addQuickAction,
    removeQuickAction,
    reorderQuickActions,
    activeSubmission,
    startFormSubmission,
    resumeSubmission,
    closeSubmission,
    isEditorOpen,
    openEditor,
    closeEditor,
    isFormModalOpen,
    openFormModal,
    closeFormModal,
  };

  return (
    <QuickActionsContext.Provider value={value}>
      {children}
    </QuickActionsContext.Provider>
  );
};

export default QuickActionsContext;
