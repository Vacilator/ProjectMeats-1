/**
 * Dry Run Debugger (Phase 7)
 * 
 * Test individual workflow steps with mock data:
 * - Step-by-step execution simulation
 * - Mock input data (schema-derived)
 * - Live output context preview
 * - Variable inspection
 * - Feeds VariablePicker with sample data
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { Node, useReactFlow } from '@xyflow/react';
import { Play, StepForward, RotateCcw, Download, Eye, Code, SkipForward, FastForward, Pause } from 'lucide-react';
import { useFlowEditor } from '../context';

interface DryRunDebuggerProps {
  selectedNode: Node | null;
  onClose: () => void;
}

interface ExecutionStep {
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input: Record<string, any>;
  output: Record<string, any>;
  duration?: number;
  error?: string;
}

export const DryRunDebugger: React.FC<DryRunDebuggerProps> = ({
  selectedNode,
  onClose,
}) => {
  const [mockInput, setMockInput] = useState<Record<string, any>>({});
  const [executionHistory, setExecutionHistory] = useState<ExecutionStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'variables'>('output');
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');

  const { getNodes, getEdges } = useReactFlow();
  const {
    debug,
    startDebugSession,
    stopDebugSession,
    resetDebugSession,
    setDebugActiveNodeId,
    markNodesExecuted,
  } = useFlowEditor();

  // Generate mock input based on node schema
  useEffect(() => {
    if (selectedNode) {
      const mock = generateMockInput(selectedNode);
      setMockInput(mock);
    }
  }, [selectedNode]);

  // Auto-start a debug session when opened (Phase 9.4)
  useEffect(() => {
    if (!selectedNode) return;
    if (debug.isActive && debug.activeNodeId) return;
    startDebugSession(selectedNode.id);
  }, [debug.activeNodeId, debug.isActive, selectedNode, startDebugSession]);

  const getNodeById = useCallback((nodeId: string) => {
    return getNodes().find((n) => n.id === nodeId) || null;
  }, [getNodes]);

  const isTerminalNode = useCallback((node: Node | null) => {
    if (!node) return true;
    const t = String(node.type || '');
    return t.startsWith('terminal') || t.startsWith('end');
  }, []);

  const isContainerNode = useCallback((node: Node | null) => {
    if (!node) return false;
    return (
      node.type === 'formBook' ||
      node.type === 'formProcessGroup' ||
      node.type === 'formProcess' ||
      node.type === 'formMultiStepContainer'
    );
  }, []);

  const getContainerChildIds = useCallback((containerId: string) => {
    return getNodes()
      .filter((n) => n.parentId === containerId)
      .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
      .map((n) => n.id);
  }, [getNodes]);

  const getNextNodeIdStepInto = useCallback((fromNodeId: string) => {
    const fromNode = getNodeById(fromNodeId);

    // Step Into: for containers, enter first child (if any)
    if (isContainerNode(fromNode)) {
      const children = getContainerChildIds(fromNodeId);
      if (children.length > 0) return children[0];
    }

    const outgoing = getEdges().filter((e) => e.source === fromNodeId);
    outgoing.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return outgoing[0]?.target ?? null;
  }, [getContainerChildIds, getEdges, getNodeById, isContainerNode]);

  const getNextNodeIdStepOver = useCallback((fromNodeId: string) => {
    const fromNode = getNodeById(fromNodeId);

    // Step Over: for containers, skip internals and jump to first edge leaving the container.
    if (isContainerNode(fromNode)) {
      const childIds = new Set(getContainerChildIds(fromNodeId));
      const candidate = getEdges()
        .filter((e) => childIds.has(e.source) && !childIds.has(e.target))
        .sort((a, b) => (a.id || '').localeCompare(b.id || ''))[0];
      if (candidate?.target) return candidate.target;
    }

    const outgoing = getEdges().filter((e) => e.source === fromNodeId);
    outgoing.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return outgoing[0]?.target ?? null;
  }, [getContainerChildIds, getEdges, getNodeById, isContainerNode]);

  const stepInto = useCallback(() => {
    if (!selectedNode) return;

    if (!debug.isActive) {
      startDebugSession(selectedNode.id);
      return;
    }

    const currentId = debug.activeNodeId || selectedNode.id;
    const currentNode = getNodeById(currentId);

    if (!currentNode) return;
    if (isTerminalNode(currentNode)) {
      stopDebugSession();
      return;
    }

    // "Execute" current node
    markNodesExecuted([currentId]);

    const nextId = getNextNodeIdStepInto(currentId);
    if (!nextId) {
      stopDebugSession();
      return;
    }

    const nextNode = getNodeById(nextId);
    const hasBreakpoint = Boolean((nextNode?.data as any)?.hasBreakpoint);

    // Move cursor to next node; if it's a breakpoint, pause there.
    setDebugActiveNodeId(nextId);

    if (hasBreakpoint) return;
  }, [debug.activeNodeId, debug.isActive, getNextNodeIdStepInto, getNodeById, isTerminalNode, markNodesExecuted, selectedNode, setDebugActiveNodeId, startDebugSession, stopDebugSession]);

  const stepOver = useCallback(() => {
    if (!selectedNode) return;

    if (!debug.isActive) {
      startDebugSession(selectedNode.id);
      return;
    }

    const currentId = debug.activeNodeId || selectedNode.id;
    const currentNode = getNodeById(currentId);

    if (!currentNode) return;
    if (isTerminalNode(currentNode)) {
      stopDebugSession();
      return;
    }

    markNodesExecuted([currentId]);

    const nextId = getNextNodeIdStepOver(currentId);
    if (!nextId) {
      stopDebugSession();
      return;
    }

    const nextNode = getNodeById(nextId);
    const hasBreakpoint = Boolean((nextNode?.data as any)?.hasBreakpoint);
    setDebugActiveNodeId(nextId);
    if (hasBreakpoint) return;
  }, [debug.activeNodeId, debug.isActive, getNextNodeIdStepOver, getNodeById, isTerminalNode, markNodesExecuted, selectedNode, setDebugActiveNodeId, startDebugSession, stopDebugSession]);

  const handleContinue = useCallback(() => {
    if (!selectedNode) return;

    if (!debug.isActive) {
      startDebugSession(selectedNode.id);
      return;
    }

    let cursor = debug.activeNodeId || selectedNode.id;
    const executedNow: string[] = [];

    // Guard: avoid infinite loops
    const MAX_STEPS = 500;
    let steps = 0;

    while (steps < MAX_STEPS) {
      const currentNode = getNodeById(cursor);
      if (!currentNode) break;

      if (isTerminalNode(currentNode)) {
        stopDebugSession();
        break;
      }

      executedNow.push(cursor);

      const nextId = getNextNodeIdStepInto(cursor);
      if (!nextId) {
        stopDebugSession();
        break;
      }

      const nextNode = getNodeById(nextId);
      const hasBreakpoint = Boolean((nextNode?.data as any)?.hasBreakpoint);

      // Update cursor to next and stop if breakpoint
      setDebugActiveNodeId(nextId);
      if (hasBreakpoint) {
        break;
      }

      cursor = nextId;
      steps += 1;
    }

    markNodesExecuted(executedNow);
  }, [debug.activeNodeId, debug.isActive, getNextNodeIdStepInto, getNodeById, isTerminalNode, markNodesExecuted, selectedNode, setDebugActiveNodeId, startDebugSession, stopDebugSession]);

  const handleRunStep = async () => {
    if (!selectedNode) return;

    // Ensure debug session cursor is on this node
    if (!debug.isActive) startDebugSession(selectedNode.id);
    setDebugActiveNodeId(selectedNode.id);

    setIsRunning(true);
    const startTime = Date.now();

    // Simulate execution
    const step: ExecutionStep = {
      nodeId: selectedNode.id,
      nodeName: selectedNode.data?.label || selectedNode.id,
      status: 'running',
      input: mockInput,
      output: {},
    };

    setExecutionHistory((prev) => [...prev, step]);

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Generate mock output based on node type
    const output = generateMockOutput(selectedNode, mockInput);
    const duration = Date.now() - startTime;

    setExecutionHistory((prev) =>
      prev.map((s) =>
        s.nodeId === selectedNode.id && s.status === 'running'
          ? { ...s, status: 'success', output, duration }
          : s
      )
    );

    markNodesExecuted([selectedNode.id]);

    setIsRunning(false);
  };
  
  const handleReset = () => {
    setExecutionHistory([]);
  };
  
  const handleExportResults = () => {
    const results = {
      node: {
        id: selectedNode?.id,
        type: selectedNode?.type,
        label: selectedNode?.data?.label,
      },
      executionHistory,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dry-run-${selectedNode?.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (!selectedNode) {
    return (
      <DebuggerContainer>
        <EmptyState>
          <Eye size={48} color="rgb(var(--color-text-tertiary))" />
          <h3>No Node Selected</h3>
          <p>Select a node to test it with mock data</p>
        </EmptyState>
      </DebuggerContainer>
    );
  }
  
  const currentStep = executionHistory[executionHistory.length - 1];

  const executionVariables = useMemo(() => {
    const outputAny = (currentStep?.output ?? {}) as any;
    if (outputAny && typeof outputAny === 'object' && outputAny.variables) {
      return outputAny.variables;
    }

    // Scaffold: until real execution wiring is available, expose a meaningful "variables" view
    // by combining the mock input context and the latest step output.
    return {
      input: mockInput,
      output: currentStep?.output ?? {},
    };
  }, [currentStep, mockInput]);
  
  return (
    <DebuggerContainer>
      <DebuggerHeader>
        <NodeInfo>
          <NodeLabel>{selectedNode.data?.label || selectedNode.id}</NodeLabel>
          <NodeType>{selectedNode.type}</NodeType>
        </NodeInfo>
        <ActionButtons>
          <TabToggle>
            <ToggleButton
              $active={activeTab === 'output'}
              onClick={() => setActiveTab('output')}
            >
              <Eye size={16} />
              Output
            </ToggleButton>
            <ToggleButton
              $active={activeTab === 'variables'}
              onClick={() => setActiveTab('variables')}
            >
              <Code size={16} />
              Variables
            </ToggleButton>
          </TabToggle>

          <ViewToggle>
            <ToggleButton
              $active={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
            >
              <Eye size={16} />
              Preview
            </ToggleButton>
            <ToggleButton
              $active={viewMode === 'json'}
              onClick={() => setViewMode('json')}
            >
              <Code size={16} />
              JSON
            </ToggleButton>
          </ViewToggle>
          <IconButton onClick={handleExportResults} title="Export results">
            <Download size={18} />
          </IconButton>
          <IconButton onClick={handleReset} title="Reset">
            <RotateCcw size={18} />
          </IconButton>
        </ActionButtons>
      </DebuggerHeader>
      
      <DebuggerContent>
        {/* Mock Input Section */}
        <Section>
          <SectionTitle>Mock Input Data</SectionTitle>
          <InputEditor>
            {viewMode === 'preview' ? (
              <InputPreview>
                {Object.entries(mockInput).map(([key, value]) => (
                  <InputField key={key}>
                    <FieldLabel>{key}:</FieldLabel>
                    <FieldValue>
                      <input
                        type="text"
                        value={JSON.stringify(value)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            setMockInput(prev => ({ ...prev, [key]: parsed }));
                          } catch {
                            // Invalid JSON, ignore
                          }
                        }}
                      />
                    </FieldValue>
                  </InputField>
                ))}
              </InputPreview>
            ) : (
              <JsonEditor
                value={JSON.stringify(mockInput, null, 2)}
                onChange={(e) => {
                  try {
                    setMockInput(JSON.parse(e.target.value));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
              />
            )}
          </InputEditor>
        </Section>
        
        {/* Execution Controls */}
        <ExecutionControls>
          <RunButton onClick={handleRunStep} disabled={isRunning}>
            {isRunning ? (
              <>
                <span className="spinner">⏳</span>
                Running...
              </>
            ) : (
              <>
                <Play size={18} />
                Test This Step
              </>
            )}
          </RunButton>

          <StepButton onClick={stepInto} disabled={isRunning || !selectedNode} title="Step Into">
            <StepForward size={18} />
            Step Into
          </StepButton>

          <StepButton
            onClick={stepOver}
            disabled={isRunning || !selectedNode}
            title="Step Over"
          >
            <SkipForward size={18} />
            Step Over
          </StepButton>

          <StepButton
            onClick={handleContinue}
            disabled={isRunning || !selectedNode}
            title="Continue until breakpoint or terminal"
          >
            <FastForward size={18} />
            Continue
          </StepButton>

          <StepButton
            onClick={stopDebugSession}
            disabled={!debug.isActive}
            title="Stop debug session"
          >
            <Pause size={18} />
            Stop
          </StepButton>

          <StepButton
            onClick={resetDebugSession}
            disabled={!debug.isActive}
            title="Reset timeline"
          >
            <RotateCcw size={18} />
            Reset Timeline
          </StepButton>
        </ExecutionControls>
        
        {/* Output / Variables */}
        {currentStep && (
          <Section>
            <SectionTitle>
              {activeTab === 'output' ? 'Output' : 'Variables'}
              {activeTab === 'output' && currentStep.duration && (
                <DurationBadge>{currentStep.duration}ms</DurationBadge>
              )}
            </SectionTitle>

            {activeTab === 'output' ? (
              <OutputViewer>
                {currentStep.status === 'running' ? (
                  <LoadingState>
                    <div className="spinner">⏳</div>
                    <p>Executing...</p>
                  </LoadingState>
                ) : currentStep.status === 'error' ? (
                  <ErrorState>
                    <h4>Error</h4>
                    <pre>{currentStep.error}</pre>
                  </ErrorState>
                ) : (
                  <>
                    {viewMode === 'preview' ? (
                      <OutputPreview>
                        {Object.entries(currentStep.output).map(([key, value]) => (
                          <OutputField key={key}>
                            <FieldLabel>{key}:</FieldLabel>
                            <FieldValue>{JSON.stringify(value, null, 2)}</FieldValue>
                          </OutputField>
                        ))}
                      </OutputPreview>
                    ) : (
                      <JsonViewer>
                        {JSON.stringify(currentStep.output, null, 2)}
                      </JsonViewer>
                    )}
                  </>
                )}
              </OutputViewer>
            ) : (
              <OutputViewer>
                {viewMode === 'preview' ? (
                  <JsonTree value={executionVariables} />
                ) : (
                  <JsonViewer>{JSON.stringify(executionVariables, null, 2)}</JsonViewer>
                )}
              </OutputViewer>
            )}
          </Section>
        )}
        
        {/* Execution History */}
        {executionHistory.length > 0 && (
          <Section>
            <SectionTitle>Execution History ({executionHistory.length})</SectionTitle>
            <HistoryList>
              {executionHistory.map((step, index) => (
                <HistoryItem key={index} $status={step.status}>
                  <HistoryIcon $status={step.status}>
                    {step.status === 'running' && '⏳'}
                    {step.status === 'success' && '✓'}
                    {step.status === 'error' && '✗'}
                  </HistoryIcon>
                  <HistoryDetails>
                    <HistoryName>{step.nodeName}</HistoryName>
                    {step.duration && (
                      <HistoryDuration>{step.duration}ms</HistoryDuration>
                    )}
                  </HistoryDetails>
                </HistoryItem>
              ))}
            </HistoryList>
          </Section>
        )}
      </DebuggerContent>
    </DebuggerContainer>
  );
};

// Helper Functions

function generateMockInput(node: Node): Record<string, any> {
  const mock: Record<string, any> = {};
  
  // Standard workflow variables
  mock.workflowId = 'wf_123456';
  mock.executionId = 'exec_' + Date.now();
  mock.timestamp = new Date().toISOString();
  mock.userId = 'user_test';
  
  // Add upstream variables (simulated)
  mock.previousStepOutput = {
    status: 'success',
    message: 'Previous step completed',
    data: {
      customerName: 'John Doe',
      orderTotal: 1250.50,
      items: ['Product A', 'Product B'],
    },
  };
  
  // Add node-specific data from node.data
  Object.keys(node.data || {}).forEach(key => {
    if (!['label', 'type', 'position'].includes(key)) {
      mock[key] = node.data[key];
    }
  });
  
  return mock;
}

function generateMockOutput(node: Node, input: Record<string, any>): Record<string, any> {
  const output: Record<string, any> = {
    status: 'success',
    nodeId: node.id,
    executedAt: new Date().toISOString(),
  };
  
  // Type-specific outputs
  switch (node.type) {
    case 'form':
      output.formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
      };
      output.submittedAt = new Date().toISOString();
      break;
      
    case 'conditionIf':
      output.conditionMet = true;
      output.evaluatedRules = [
        { rule: 'orderTotal > 1000', result: true },
      ];
      break;
      
    case 'action':
      output.actionResult = {
        success: true,
        message: 'Action completed successfully',
        recordId: 'rec_' + Date.now(),
      };
      break;
      
    case 'trigger':
      output.triggered = true;
      output.triggerType = node.data.triggerType || 'manual';
      output.payload = input;
      break;
      
    default:
      output.message = 'Step executed successfully';
      output.data = { ...input };
  }
  
  return output;
}

// Styled Components

const DebuggerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background));
`;

const JsonTreeContainer = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.5;
`;

const JsonTreeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
`;

const JsonTreeToggle = styled.button`
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  width: 16px;

  &:hover {
    color: rgb(var(--color-primary));
  }
`;

const JsonTreeKey = styled.span`
  color: rgb(var(--color-text-secondary));
`;

const JsonTreeValue = styled.span`
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
  word-break: break-word;
`;

const JsonTreeIndent = styled.div<{ $level: number }>`
  padding-left: ${props => props.$level * 16}px;
`;

function JsonTree({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });

  const renderNode = (nodeValue: unknown, path: string, level: number, label?: string) => {
    const isObj = typeof nodeValue === 'object' && nodeValue !== null;
    const isArray = Array.isArray(nodeValue);
    const isExpandable = isObj;

    const isOpen = expanded[path] ?? false;

    const toggle = () => {
      setExpanded(prev => ({ ...prev, [path]: !isOpen }));
    };

    let summary: string;
    if (!isObj) {
      summary = JSON.stringify(nodeValue);
    } else if (isArray) {
      summary = `Array(${(nodeValue as any[]).length})`;
    } else {
      summary = `Object(${Object.keys(nodeValue as Record<string, unknown>).length})`;
    }

    const children: Array<{ key: string; val: unknown }> = [];
    if (isObj) {
      if (isArray) {
        (nodeValue as any[]).forEach((v, idx) => children.push({ key: String(idx), val: v }));
      } else {
        Object.entries(nodeValue as Record<string, unknown>).forEach(([k, v]) => children.push({ key: k, val: v }));
      }
    }

    return (
      <JsonTreeIndent key={path} $level={level}>
        <JsonTreeRow>
          {isExpandable ? (
            <JsonTreeToggle onClick={toggle} aria-label={isOpen ? 'Collapse' : 'Expand'}>
              {isOpen ? '▾' : '▸'}
            </JsonTreeToggle>
          ) : (
            <span style={{ width: 16, display: 'inline-block' }} />
          )}

          {label !== undefined && <JsonTreeKey>{label}:</JsonTreeKey>}
          <JsonTreeValue>{summary}</JsonTreeValue>
        </JsonTreeRow>

        {isExpandable && isOpen && (
          <div>
            {children.length === 0 ? (
              <JsonTreeIndent $level={level + 1}>
                <JsonTreeRow>
                  <span style={{ width: 16, display: 'inline-block' }} />
                  <JsonTreeValue>(empty)</JsonTreeValue>
                </JsonTreeRow>
              </JsonTreeIndent>
            ) : (
              children.map((c) => renderNode(c.val, `${path}.${c.key}`, level + 1, isArray ? `[${c.key}]` : c.key))
            )}
          </div>
        )}
      </JsonTreeIndent>
    );
  };

  return (
    <JsonTreeContainer>
      {renderNode(value, 'root', 0, undefined)}
    </JsonTreeContainer>
  );
}

const DebuggerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const NodeInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const NodeLabel = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const NodeType = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-family: 'Courier New', monospace;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TabToggle = styled.div`
  display: flex;
  background: rgb(var(--color-background));
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgb(var(--color-border));
`;

const ViewToggle = styled.div`
  display: flex;
  background: rgb(var(--color-background));
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgb(var(--color-border));
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'rgb(var(--color-text-secondary))'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.1)'};
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-primary), 0.1);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const DebuggerContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DurationBadge = styled.span`
  padding: 2px 8px;
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
`;

const InputEditor = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
`;

const InputPreview = styled.div`
  padding: 16px;
`;

const InputField = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FieldLabel = styled.label`
  min-width: 150px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
`;

const FieldValue = styled.div`
  flex: 1;
  
  input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgb(var(--color-border));
    border-radius: 4px;
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    font-size: 13px;
    font-family: 'Courier New', monospace;
    
    &:focus {
      outline: none;
      border-color: rgb(var(--color-primary));
    }
  }
`;

const JsonEditor = styled.textarea`
  width: 100%;
  min-height: 200px;
  padding: 16px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-family: 'Courier New', monospace;
  font-size: 13px;
  resize: vertical;
  
  &:focus {
    outline: none;
  }
`;

const ExecutionControls = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

const RunButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const StepButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(var(--color-primary), 0.1);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const OutputViewer = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  padding: 16px;
`;

const OutputPreview = styled.div``;

const OutputField = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const JsonViewer = styled.pre`
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
  word-break: break-word;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  
  .spinner {
    font-size: 32px;
    animation: spin 1s linear infinite;
  }
  
  p {
    margin-top: 16px;
    color: rgb(var(--color-text-secondary));
  }
`;

const ErrorState = styled.div`
  h4 {
    margin: 0 0 12px 0;
    color: rgb(239, 68, 68);
  }
  
  pre {
    margin: 0;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    color: rgb(239, 68, 68);
    font-size: 13px;
  }
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const HistoryItem = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
  }
`;

const HistoryIcon = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => {
    switch (props.$status) {
      case 'success': return 'rgba(34, 197, 94, 0.1)';
      case 'error': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgba(var(--color-primary), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'success': return 'rgb(34, 197, 94)';
      case 'error': return 'rgb(239, 68, 68)';
      default: return 'rgb(var(--color-primary))';
    }
  }};
  font-size: 16px;
  font-weight: bold;
`;

const HistoryDetails = styled.div`
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HistoryName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const HistoryDuration = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-family: 'Courier New', monospace;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
  
  h3 {
    margin: 16px 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
  }
  
  p {
    margin: 0;
    font-size: 14px;
    color: rgb(var(--color-text-secondary));
  }
`;
