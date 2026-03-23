/**
 * Cockpit Navigation Context
 * 
 * Tracks user navigation path through search results and entity exploration.
 * Provides breadcrumb trail for "mind-map" style navigation.
 * 
 * Created: 2026-02-23 - Cockpit Phase 2A Final
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface NavigationStep {
  id: string;
  type: string;
  label: string;
  subtitle?: string;
  timestamp: number;
}

export interface CockpitNavigationContextType {
  path: NavigationStep[];
  addStep: (step: Omit<NavigationStep, 'timestamp'>) => void;
  goBack: (steps?: number) => void;
  goToStep: (index: number) => void;
  clearPath: () => void;
  recentPaths: NavigationStep[][];
  saveCurrentPath: () => void;
}

// ============================================================================
// Context
// ============================================================================

const CockpitNavigationContext = createContext<CockpitNavigationContextType | undefined>(undefined);

export const useCockpitNavigation = () => {
  const context = useContext(CockpitNavigationContext);
  if (!context) {
    throw new Error('useCockpitNavigation must be used within CockpitNavigationProvider');
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

const MAX_PATH_LENGTH = 10;
const MAX_RECENT_PATHS = 5;

export const CockpitNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [path, setPath] = useState<NavigationStep[]>([]);
  const [recentPaths, setRecentPaths] = useState<NavigationStep[][]>([]);

  // Load recent paths from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('cockpit_recent_paths');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Backward-compatible: older sessions may have numeric IDs.
        const normalized: NavigationStep[][] = Array.isArray(parsed)
          ? parsed.map((p: any[]) =>
              (Array.isArray(p) ? p : []).map((s: any) => ({
                ...s,
                id: String(s?.id ?? ''),
              }))
            )
          : [];
        setRecentPaths(normalized);
      }
    } catch (error) {
      console.error('[CockpitNavigation] Failed to load recent paths:', error);
    }
  }, []);

  // Save recent paths to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('cockpit_recent_paths', JSON.stringify(recentPaths));
    } catch (error) {
      console.error('[CockpitNavigation] Failed to save recent paths:', error);
    }
  }, [recentPaths]);

  const addStep = useCallback((step: Omit<NavigationStep, 'timestamp'>) => {
    setPath(prev => {
      const newPath = [
        ...prev,
        {
          ...step,
          timestamp: Date.now(),
        },
      ].slice(-MAX_PATH_LENGTH); // Keep only last N steps
      return newPath;
    });
  }, []);

  const goBack = useCallback((steps: number = 1) => {
    setPath(prev => prev.slice(0, -steps));
  }, []);

  const goToStep = useCallback((index: number) => {
    setPath(prev => prev.slice(0, index + 1));
  }, []);

  const clearPath = useCallback(() => {
    setPath([]);
  }, []);

  const saveCurrentPath = useCallback(() => {
    if (path.length === 0) return;
    
    setRecentPaths(prev => {
      const newRecent = [path, ...prev]
        .slice(0, MAX_RECENT_PATHS);
      return newRecent;
    });
  }, [path]);

  const value: CockpitNavigationContextType = {
    path,
    addStep,
    goBack,
    goToStep,
    clearPath,
    recentPaths,
    saveCurrentPath,
  };

  return (
    <CockpitNavigationContext.Provider value={value}>
      {children}
    </CockpitNavigationContext.Provider>
  );
};

export default CockpitNavigationContext;
