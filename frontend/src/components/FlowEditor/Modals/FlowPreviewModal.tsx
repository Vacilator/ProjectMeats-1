/**
 * FlowPreviewModal Component
 * 
 * End-to-end preview mode for hybrid workflow-form flows.
 * Simulates form submission and workflow execution with mock data.
 * 
 * Features:
 * - Step-by-step execution visualization
 * - Form field simulation with validation
 * - Real-time data flow tracking
 * - Node state visualization (pending, active, complete, error)
 * - Execution timeline with logs
 * 
 * Created: 2026-02-21 - Phase 1: Hybrid Functionality
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { X, Play, Pause, RotateCcw, FastForward, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { FormField } from '@/components/form-builder/types';

/**
 * Props for FlowPreviewModal
 */
interface FlowPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Execution state for a node
 */
interface NodeExecutionState {
  nodeId: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  startTime?: number;
  endTime?: number;
  data?: Record<string, any>;
  error?: string;
}

/**
 * Execution log entry
 */
interface LogEntry {
  timestamp: number;
  nodeId: string;
  nodeName: string;
  action: string;
  data?: any;
  level: 'info' | 'success' | 'warning' | 'error';
}

/**
 * Styled Components
 */
const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-in-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  width: 95vw;
  max-width: 1400px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' | 'ghost' | 'danger' }>`
  padding: ${props => props.variant === 'ghost' ? '8px' : '10px 16px'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;

  ${props => {
    if (props.variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        &:hover { opacity: 0.9; }
      `;
    } else if (props.variant === 'danger') {
      return `
        background: rgb(239, 68, 68);
        color: white;
        &:hover { opacity: 0.9; }
      `;
    } else {
      return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        &:hover { background: rgb(var(--color-surface-hover)); }
      `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Content = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 400px;
  overflow: hidden;
`;

const CanvasSection = styled.div`
  border-right: 1px solid rgb(var(--color-border));
  padding: 24px;
  overflow: auto;
  background: rgb(var(--color-background-secondary));
`;

const LogSection = styled.div`
  display: flex;
  flex-direction: column;
  background: rgb(var(--color-surface));
`;

const LogHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const LogList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LogItem = styled.div<{ level: 'info' | 'success' | 'warning' | 'error' }>`
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  background: ${props => {
    switch (props.level) {
      case 'success': return 'rgba(34, 197, 94, 0.1)';
      case 'warning': return 'rgba(234, 179, 8, 0.1)';
      case 'error': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgba(59, 130, 246, 0.1)';
    }
  }};
  border-left: 3px solid ${props => {
    switch (props.level) {
      case 'success': return 'rgb(34, 197, 94)';
      case 'warning': return 'rgb(234, 179, 8)';
      case 'error': return 'rgb(239, 68, 68)';
      default: return 'rgb(59, 130, 246)';
    }
  }};
`;

const LogTime = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 4px;
`;

const LogNode = styled.div`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const LogAction = styled.div`
  color: rgb(var(--color-text-secondary));
`;

const NodeGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PreviewNode = styled.div<{ status: NodeExecutionState['status'] }>`
  padding: 16px;
  border-radius: 8px;
  border: 2px solid ${props => {
    switch (props.status) {
      case 'active': return 'rgb(59, 130, 246)';
      case 'complete': return 'rgb(34, 197, 94)';
      case 'error': return 'rgb(239, 68, 68)';
      case 'skipped': return 'rgb(var(--color-text-tertiary))';
      default: return 'rgb(var(--color-border))';
    }
  }};
  background: ${props => {
    switch (props.status) {
      case 'active': return 'rgba(59, 130, 246, 0.1)';
      case 'complete': return 'rgba(34, 197, 94, 0.1)';
      case 'error': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgb(var(--color-surface))';
    }
  }};
  transition: all 0.3s ease;
  position: relative;

  ${props => props.status === 'active' && `
    animation: pulse 2s ease-in-out infinite;
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
    }
  `}
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const NodeName = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: rgb(var(--color-text-primary));
`;

const StatusBadge = styled.div<{ status: NodeExecutionState['status'] }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => {
    switch (props.status) {
      case 'active': return 'rgb(59, 130, 246)';
      case 'complete': return 'rgb(34, 197, 94)';
      case 'error': return 'rgb(239, 68, 68)';
      case 'skipped': return 'rgb(var(--color-text-tertiary))';
      default: return 'rgb(var(--color-border))';
    }
  }};
  color: white;
`;

const NodeData = styled.pre`
  font-size: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow-x: auto;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

/**
 * FlowPreviewModal Component
 */
export const FlowPreviewModal: React.FC<FlowPreviewModalProps> = React.memo(({
  isOpen,
  onClose,
}) => {
  const { getNodes, getEdges } = useReactFlow();

  const [isPlaying, setIsPlaying] = useState(false);
  const [executionStates, setExecutionStates] = useState<Record<string, NodeExecutionState>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);

  // Get execution order
  const executionOrder = useMemo(() => {
    const nodes = getNodes();
    const edges = getEdges();

    // Find root nodes (no incoming edges)
    const rootNodes = nodes.filter(node => 
      !edges.some(edge => edge.target === node.id)
    );

    // Simple topological sort
    const visited = new Set<string>();
    const order: Node[] = [];

    const visit = (node: Node) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      // Visit dependencies first
      const incomingEdges = edges.filter(e => e.target === node.id);
      incomingEdges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) visit(sourceNode);
      });

      order.push(node);
    };

    rootNodes.forEach(visit);
    
    return order;
  }, [getNodes, getEdges]);

  /**
   * Add log entry
   */
  const addLog = useCallback((entry: Omit<LogEntry, 'timestamp'>) => {
    setLogs((prev) => [...prev, { ...entry, timestamp: Date.now() }]);
  }, []);

  const getNodeName = useCallback((node: Node): string => {
    const label = (node.data as any)?.label;
    if (typeof label === 'string' && label.trim().length > 0) return label;
    return typeof node.type === 'string' && node.type.length > 0 ? node.type : 'Unknown';
  }, []);


  /**
   * Execute a single node
   */
  const executeNode = useCallback(async (node: Node) => {
    // Set to active
    setExecutionStates(prev => ({
      ...prev,
      [node.id]: {
        nodeId: node.id,
        status: 'active',
        startTime: Date.now(),
      },
    }));

    addLog({
      nodeId: node.id,
      nodeName: getNodeName(node),
      action: 'Executing node...',
      level: 'info',
    });

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock data based on node type
    const mockData: Record<string, any> = {};
    
    if (node.type?.includes('form')) {
      // Generate mock form data
      const fields = ((node.data as any)?.fields as FormField[]) || [];
      fields.forEach((field) => {
        mockData[field.id] = `Mock ${field.type} value`;
      });
    }

    // Mark as complete
    setExecutionStates(prev => ({
      ...prev,
      [node.id]: {
        ...prev[node.id],
        status: 'complete',
        endTime: Date.now(),
        data: mockData,
      },
    }));

    addLog({
      nodeId: node.id,
      nodeName: getNodeName(node),
      action: 'Node completed successfully',
      data: mockData,
      level: 'success',
    });
  }, [addLog, getNodeName]);

  /**
   * Execute flow step by step
   */
  const executeStep = useCallback(async () => {
    if (currentNodeIndex >= executionOrder.length) {
      setIsPlaying(false);
      addLog({
        nodeId: 'system',
        nodeName: 'System',
        action: 'Flow execution complete',
        level: 'success',
      });
      return;
    }

    const node = executionOrder[currentNodeIndex];
    await executeNode(node);
    setCurrentNodeIndex(prev => prev + 1);
  }, [currentNodeIndex, executionOrder, executeNode, addLog]);

  /**
   * Auto-play execution
   */
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      executeStep();
    }, 500);

    return () => clearTimeout(timer);
  }, [isPlaying, executeStep]);

  /**
   * Handle play/pause
   */
  const handlePlayPause = useCallback(() => {
    if (currentNodeIndex >= executionOrder.length) {
      // Reset if at end
      handleReset();
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [currentNodeIndex, executionOrder.length]);

  /**
   * Handle reset
   */
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setExecutionStates({});
    setLogs([]);
    setCurrentNodeIndex(0);
    
    addLog({
      nodeId: 'system',
      nodeName: 'System',
      action: 'Preview reset',
      level: 'info',
    });
  }, [addLog]);

  /**
   * Handle step forward
   */
  const handleStepForward = useCallback(() => {
    if (currentNodeIndex < executionOrder.length) {
      executeStep();
    }
  }, [currentNodeIndex, executionOrder.length, executeStep]);

  return (
    <Overlay isOpen={isOpen} onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>
            <Play size={20} />
            Flow Preview
          </Title>
          <Controls>
            <Button onClick={handleReset} aria-label="Reset preview">
              <RotateCcw size={16} />
              Reset
            </Button>
            <Button
              onClick={handleStepForward}
              disabled={currentNodeIndex >= executionOrder.length || isPlaying}
              aria-label="Step forward"
            >
              <FastForward size={16} />
              Step
            </Button>
            <Button
              variant="primary"
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button variant="ghost" onClick={onClose} aria-label="Close preview">
              <X size={20} />
            </Button>
          </Controls>
        </Header>

        <Content>
          <CanvasSection>
            <NodeGrid>
              {executionOrder.map(node => {
                const state = executionStates[node.id] || { nodeId: node.id, status: 'pending' };
                return (
                  <PreviewNode key={node.id} status={state.status}>
                    <NodeHeader>
                      <NodeName>{getNodeName(node)}</NodeName>
                      <StatusBadge status={state.status}>{state.status}</StatusBadge>
                    </NodeHeader>
                    {state.data && (
                      <NodeData>{JSON.stringify(state.data, null, 2)}</NodeData>
                    )}
                  </PreviewNode>
                );
              })}
            </NodeGrid>
          </CanvasSection>

          <LogSection>
            <LogHeader>Execution Log</LogHeader>
            <LogList>
              {logs.map((log, index) => (
                <LogItem key={index} level={log.level}>
                  <LogTime>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </LogTime>
                  <LogNode>{log.nodeName}</LogNode>
                  <LogAction>{log.action}</LogAction>
                  {log.data && (
                    <NodeData>{JSON.stringify(log.data, null, 2)}</NodeData>
                  )}
                </LogItem>
              ))}
            </LogList>
          </LogSection>
        </Content>
      </Modal>
    </Overlay>
  );
});

FlowPreviewModal.displayName = 'FlowPreviewModal';
