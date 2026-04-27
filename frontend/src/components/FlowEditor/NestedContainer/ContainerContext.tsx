/**
 * Container Context for Nested Flow Management
 * 
 * Manages navigation and state for nested container views.
 * Allows entering/exiting containers to edit their internal flows.
 * 
 * Created: 2026-02-07
 */
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Node, Edge } from '@xyflow/react';

import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface ContainerState {
  containerId: string;
  nodes: Node[];
  edges: Edge[];
  containerName: string;
}

interface ContainerContextType {
  // Current container being edited (null = main canvas)
  currentContainer: string | null;
  
  // Navigation stack (breadcrumb trail)
  containerStack: ContainerState[];
  
  // Enter a container to edit its contents
  enterContainer: (containerId: string, containerName: string, nodes: Node[], edges: Edge[]) => void;
  
  // Exit current container back to parent
  exitContainer: () => void;
  
  // Exit all the way to main canvas
  exitToMain: () => void;
  
  // Check if currently inside a container
  isInContainer: () => boolean;
  
  // Get breadcrumb trail
  getBreadcrumbs: () => { id: string | null; name: string }[];
}

// ============================================================================
// Context
// ============================================================================

const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

export const useContainerContext = () => {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error('useContainerContext must be used within ContainerContextProvider');
  }
  return context;
};

// ============================================================================
// Provider Component
// ============================================================================

interface ContainerContextProviderProps {
  children: ReactNode;
}

export const ContainerContextProvider: React.FC<ContainerContextProviderProps> = ({ children }) => {
  const [containerStack, setContainerStack] = useState<ContainerState[]>([]);
  
  const currentContainer = useMemo(() => {
    return containerStack.length > 0 ? containerStack[containerStack.length - 1].containerId : null;
  }, [containerStack]);
  
  const enterContainer = useCallback((
    containerId: string,
    containerName: string,
    nodes: Node[],
    edges: Edge[]
  ) => {
    logger.debug('Entering container', {
      component: 'ContainerContext',
      metadata: { containerId, containerName },
    });
    setContainerStack(prev => [...prev, {
      containerId,
      containerName,
      nodes,
      edges,
    }]);
  }, []);
  
  const exitContainer = useCallback(() => {
    logger.debug('Exiting container', { component: 'ContainerContext' });
    setContainerStack(prev => prev.slice(0, -1));
  }, []);
  
  const exitToMain = useCallback(() => {
    logger.debug('Exiting to main canvas', { component: 'ContainerContext' });
    setContainerStack([]);
  }, []);
  
  const isInContainer = useCallback(() => {
    return containerStack.length > 0;
  }, [containerStack]);
  
  const getBreadcrumbs = useCallback(() => {
    const breadcrumbs: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Main Canvas' }];
    containerStack.forEach((state) => {
      breadcrumbs.push({ id: state.containerId, name: state.containerName });
    });
    return breadcrumbs;
  }, [containerStack]);
  
  const value = useMemo<ContainerContextType>(() => {
    return {
      currentContainer,
      containerStack,
      enterContainer,
      exitContainer,
      exitToMain,
      isInContainer,
      getBreadcrumbs,
    };
  }, [
    currentContainer,
    containerStack,
    enterContainer,
    exitContainer,
    exitToMain,
    isInContainer,
    getBreadcrumbs,
  ]);
  
  return (
    <ContainerContext.Provider value={value}>
      {children}
    </ContainerContext.Provider>
  );
};
