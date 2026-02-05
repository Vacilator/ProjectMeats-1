/**
 * Quick Actions Context
 *
 * Global state management for Quick Actions feature.
 * Handles loading, caching, and updating user's quick actions.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  const [quickActions, setQuickActions] = useState<QuickActionItem[]>([]);
  const [availableForms, setAvailableForms] = useState<AvailableForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeSubmission, setActiveSubmission] = useState<FormSubmission | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Load quick actions on mount
  const refreshQuickActions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [actionsResponse, formsResponse] = await Promise.all([
        quickActionsService.getQuickActions(),
        quickActionsService.getAvailableForms(),
      ]);
      
      setQuickActions(actionsResponse.items || []);
      // Ensure formsResponse is always an array
      setAvailableForms(Array.isArray(formsResponse) ? formsResponse : []);
    } catch (err: any) {
      console.error('Failed to load quick actions:', err);
      setError(err.message || 'Failed to load quick actions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only load if user is authenticated
    const token = localStorage.getItem('authToken');
    if (token) {
      refreshQuickActions();
    } else {
      setIsLoading(false);
    }
  }, [refreshQuickActions]);

  const updateQuickActions = useCallback(async (items: QuickActionItem[]) => {
    try {
      setError(null);
      const response = await quickActionsService.updateQuickActions(items);
      setQuickActions(response.items);
    } catch (err: any) {
      console.error('Failed to update quick actions:', err);
      setError(err.message || 'Failed to update quick actions');
      throw err;
    }
  }, []);

  const addQuickAction = useCallback(async (form: AvailableForm) => {
    const newAction: QuickActionItem = {
      id: `qa_${Date.now()}`,
      type: 'form',
      form_id: form.id,
      label: form.name,
      icon: form.icon || 'file-text',  // Keep original icon or default to file-text
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
      console.log('[QuickActions] Opening form modal for formId:', formId);
      const submission = await startFormSubmission(formId);
      console.log('[QuickActions] Form submission created:', submission?.id);
    } catch (err: any) {
      console.error('[QuickActions] Failed to start form submission:', err);
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to start form';
      setError(errorMsg);
      // Alert the user since the modal won't open
      alert(`Error: ${errorMsg}`);
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
