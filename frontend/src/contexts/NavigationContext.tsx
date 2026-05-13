import React, { createContext, useContext, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export interface NavigationHierarchyEntry {
  entityType: string;
  entityId: string;
  label: string;
  routeTo: string;
}

interface NavigationContextType {
  currentModule: string;
  moduleData: { [key: string]: Record<string, unknown> };
  setModuleData: (module: string, data: Record<string, unknown>) => void;
  clearModuleData: (module: string) => void;
  breadcrumbPath: string[];
  setBreadcrumbPath: (path: string[]) => void;
  hierarchyStack: NavigationHierarchyEntry[];
  setHierarchyStack: (stack: NavigationHierarchyEntry[]) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const location = useLocation();
  const [moduleData, setModuleDataState] = useState<{
    [key: string]: Record<string, unknown>;
  }>({});
  const [breadcrumbPath, setBreadcrumbPath] = useState<string[]>([]);
  const [hierarchyStack, setHierarchyStackState] = useState<NavigationHierarchyEntry[]>([]);
  // Initialize sidebarOpen from localStorage 'sidebarKeepOpen' preference
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem('sidebarKeepOpen') === 'true';
  });

  // Get current module from location
  const currentModule = location.pathname.split('/')[1] || 'dashboard';

  const setModuleData = useCallback((module: string, data: Record<string, unknown>) => {
    setModuleDataState((prev) => ({
      ...prev,
      [module]: { ...prev[module], ...data },
    }));
  }, []);

  const clearModuleData = useCallback((module: string) => {
    setModuleDataState((prev) => {
      const newData = { ...prev };
      delete newData[module];
      return newData;
    });
  }, []);

  const updateBreadcrumbPath = useCallback((path: string[]) => {
    setBreadcrumbPath((prev) => (areStringArraysEqual(prev, path) ? prev : path));
  }, []);

  const setHierarchyStack = useCallback((stack: NavigationHierarchyEntry[]) => {
    setHierarchyStackState((prev) => (areHierarchyStacksEqual(prev, stack) ? prev : stack));
  }, []);

  const value: NavigationContextType = {
    currentModule,
    moduleData,
    setModuleData,
    clearModuleData,
    breadcrumbPath,
    setBreadcrumbPath: updateBreadcrumbPath,
    hierarchyStack,
    setHierarchyStack,
    sidebarOpen,
    setSidebarOpen,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

const areStringArraysEqual = (left: string[], right: string[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
};

const areHierarchyStacksEqual = (
  left: NavigationHierarchyEntry[],
  right: NavigationHierarchyEntry[]
): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  return left.every((entry, index) => {
    const other = right[index];
    return (
      entry.entityType === other.entityType &&
      entry.entityId === other.entityId &&
      entry.label === other.label &&
      entry.routeTo === other.routeTo
    );
  });
};
