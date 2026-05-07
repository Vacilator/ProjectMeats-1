/**
 * Node Debugger Panel Component
 * 
 * Phase 4: Node Debugger Tab
 * Allows users to test node logic with mock data before saving.
 * 
 * Features:
 * - Input mock JSON context for testing
 * - Execute single node's backend logic simulation
 * - Display result preview
 * - Show validation errors
 * - Does NOT affect saved workflow data
 * - Visual diff between input and output
 * 
 * Usage:
 * ```typescript
 * <NodeDebuggerPanel
 *   node={selectedNode}
 *   workflow={currentWorkflow}
 *   onClose={() => setShowDebugger(false)}
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 4 Node Debugger Implementation
 */

import React, { Suspense, useMemo, useState } from 'react';
import styled from 'styled-components';
import { lazyWithChunkRecovery } from '@/utils/chunkLoadRecovery';

const MonacoEditor = lazyWithChunkRecovery(
  () => import('@monaco-editor/react'),
  'NodeDebuggerPanel.MonacoEditor'
);
import { 
  Play, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  X, 
  Code, 
  Zap,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Node } from '@xyflow/react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface NodeDebuggerPanelProps {
  /** Node to debug */
  node: Node;
  
  /** Workflow context */
  workflow?: any;
  
  /** Called when panel closes */
  onClose: () => void;
}

interface DebugResult {
  success: boolean;
  output: any;
  errors?: string[];
  warnings?: string[];
  executionTime?: number;
}

// ============================================================================
// Main Component
// ============================================================================

export const NodeDebuggerPanel: React.FC<NodeDebuggerPanelProps> = ({
  node,
  workflow,
  onClose,
}) => {
  const [mockContext, setMockContext] = useState<string>(
    JSON.stringify(
      {
        previousNodes: {},
        currentNode: node.id,
        variables: {},
      },
      null,
      2
    )
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');
  
  // Parse mock context to check validity
  const isValidJSON = useMemo(() => {
    try {
      JSON.parse(mockContext);
      return true;
    } catch {
      return false;
    }
  }, [mockContext]);
  
  // Simulate node execution
  const handleExecute = async () => {
    if (!isValidJSON) {
      setResult({
        success: false,
        output: null,
        errors: ['Invalid JSON in mock context'],
      });
      return;
    }
    
    setIsExecuting(true);
    setActiveTab('output');
    
    try {
      const context = JSON.parse(mockContext);
      const startTime = Date.now();
      
      // Simulate node execution logic based on node type
      const output = await simulateNodeExecution(node, context);
      
      const executionTime = Date.now() - startTime;
      
      setResult({
        success: true,
        output,
        executionTime,
        warnings: output._warnings || [],
      });
    } catch (error: any) {
      setResult({
        success: false,
        output: null,
        errors: [error.message || 'Execution failed'],
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  // Reset debugger
  const handleReset = () => {
    setResult(null);
    setActiveTab('input');
    setMockContext(
      JSON.stringify(
        {
          previousNodes: {},
          currentNode: node.id,
          variables: {},
        },
        null,
        2
      )
    );
  };
  
  return (
    <PanelContainer data-config-panel>
      {/* Header */}
      <PanelHeader>
        <HeaderTitle>
          <Zap size={18} />
          <span>Node Debugger</span>
        </HeaderTitle>
        <HeaderActions>
          <IconButton onClick={handleReset} title="Reset">
            <RefreshCw size={16} />
          </IconButton>
          <IconButton onClick={onClose} title="Close">
            <X size={16} />
          </IconButton>
        </HeaderActions>
      </PanelHeader>
      
      {/* Node Info */}
      <NodeInfo>
        <NodeInfoLabel>Testing Node:</NodeInfoLabel>
        <NodeInfoValue>
          <strong>{String((node.data as any)?.label ?? node.id)}</strong>
          <small>({node.type})</small>
        </NodeInfoValue>
      </NodeInfo>
      
      {/* Warning Banner */}
      <WarningBanner>
        <Info size={16} />
        <span>
          This debugger simulates node execution. No data will be saved to the workflow.
        </span>
      </WarningBanner>
      
      {/* Tabs */}
      <TabContainer>
        <Tab $active={activeTab === 'input'} onClick={() => setActiveTab('input')}>
          <Code size={14} />
          <span>Mock Input</span>
        </Tab>
        <Tab $active={activeTab === 'output'} onClick={() => setActiveTab('output')}>
          <ArrowRight size={14} />
          <span>Output</span>
        </Tab>
      </TabContainer>
      
      {/* Content */}
      <ContentContainer>
        {activeTab === 'input' && (
          <EditorContainer>
            <EditorLabel>
              Mock Context (JSON)
              {!isValidJSON && (
                <ErrorBadge>
                  <AlertCircle size={12} />
                  Invalid JSON
                </ErrorBadge>
              )}
            </EditorLabel>
            <Suspense
              fallback={
                <FallbackTextarea
                  value={mockContext}
                  onChange={(e) => setMockContext(e.target.value)}
                  spellCheck={false}
                />
              }
            >
              <MonacoEditor
                height="400px"
                defaultLanguage="json"
                value={mockContext}
                onChange={(value) => setMockContext(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </Suspense>
          </EditorContainer>
        )}
        
        {activeTab === 'output' && (
          <OutputContainer>
            {result === null ? (
              <EmptyState>
                <Play size={48} style={{ opacity: 0.3 }} />
                <p>Click "Execute" to test this node</p>
                <small>Results will appear here</small>
              </EmptyState>
            ) : (
              <>
                {/* Status Banner */}
                <StatusBanner $success={result.success}>
                  {result.success ? (
                    <>
                      <CheckCircle size={16} />
                      <span>Execution Successful</span>
                      {result.executionTime !== undefined && (
                        <small>({result.executionTime}ms)</small>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      <span>Execution Failed</span>
                    </>
                  )}
                </StatusBanner>
                
                {/* Errors */}
                {result.errors && result.errors.length > 0 && (
                  <ErrorList>
                    {result.errors.map((error, index) => (
                      <ErrorItem key={index}>
                        <AlertCircle size={14} />
                        <span>{error}</span>
                      </ErrorItem>
                    ))}
                  </ErrorList>
                )}
                
                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <WarningList>
                    {result.warnings.map((warning, index) => (
                      <WarningItem key={index}>
                        <AlertCircle size={14} />
                        <span>{warning}</span>
                      </WarningItem>
                    ))}
                  </WarningList>
                )}
                
                {/* Output Data */}
                {result.output !== null && (
                  <EditorContainer>
                    <EditorLabel>Output Data</EditorLabel>
                    <Suspense
                      fallback={
                        <FallbackTextarea
                          value={JSON.stringify(result.output, null, 2)}
                          onChange={() => {
                            // read-only
                          }}
                          spellCheck={false}
                          readOnly
                        />
                      }
                    >
                      <MonacoEditor
                        height="300px"
                        defaultLanguage="json"
                        value={JSON.stringify(result.output, null, 2)}
                        theme="vs-dark"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                        }}
                      />
                    </Suspense>
                  </EditorContainer>
                )}
              </>
            )}
          </OutputContainer>
        )}
      </ContentContainer>
      
      {/* Footer */}
      <PanelFooter>
        <ExecuteButton
          onClick={handleExecute}
          disabled={!isValidJSON || isExecuting}
        >
          {isExecuting ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span>Execute Node</span>
            </>
          )}
        </ExecuteButton>
      </PanelFooter>
    </PanelContainer>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulate node execution based on node type
 * This is a mock implementation - in production, this would call the backend API
 */
async function simulateNodeExecution(node: Node, context: any): Promise<any> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const nodeType = node.type;
  const nodeData = node.data;
  
  // Mock execution logic based on node type
  switch (nodeType) {
    case 'form':
      return {
        formData: {
          ...context.variables,
          submittedAt: new Date().toISOString(),
        },
        _warnings: Array.isArray((nodeData as any)?.fields) && (nodeData as any).fields.length === 0 ? ['No fields configured'] : [],
      };
      
    case 'condition':
      return {
        branchTaken: 'true',
        conditionResult: true,
        evaluatedAt: new Date().toISOString(),
      };
      
    case 'action':
      return {
        status: 'completed',
        result: {
          message: 'Action executed successfully',
          data: nodeData?.config || {},
        },
        executedAt: new Date().toISOString(),
      };
      
    default:
      return {
        nodeId: node.id,
        nodeType,
        message: 'Mock execution completed',
        context,
      };
  }
}

// ============================================================================
// Styled Components
// ============================================================================

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-surface));
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const NodeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const NodeInfoLabel = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const NodeInfoValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  
  small {
    opacity: 0.6;
  }
`;

const WarningBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(var(--color-warning), 0.1);
  border-bottom: 1px solid rgb(var(--color-warning));
  color: rgb(var(--color-warning));
  font-size: 13px;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  border: none;
  background: ${props => props.$active ? 'rgb(var(--color-surface))' : 'transparent'};
  border-bottom: 2px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 14px;
  font-weight: ${props => props.$active ? '600' : '400'};
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
  }
`;

const ContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const FallbackTextarea = styled.textarea`
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
`;

const EditorContainer = styled.div`
  margin-bottom: 20px;
`;

const EditorLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ErrorBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(var(--color-error), 0.1);
  border-radius: 4px;
  color: rgb(var(--color-error));
  font-size: 11px;
  font-weight: 500;
`;

const OutputContainer = styled.div`
  min-height: 400px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  
  p {
    margin: 16px 0 4px;
    font-size: 14px;
  }
  
  small {
    font-size: 12px;
    opacity: 0.7;
  }
`;

const StatusBanner = styled.div<{ $success: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 6px;
  background: ${props => props.$success ? 'rgba(var(--color-success), 0.1)' : 'rgba(var(--color-error), 0.1)'};
  border: 1px solid ${props => props.$success ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))'};
  color: ${props => props.$success ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))'};
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
  
  small {
    margin-left: auto;
    opacity: 0.7;
  }
`;

const ErrorList = styled.div`
  margin-bottom: 16px;
`;

const ErrorItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--color-error), 0.05);
  border-left: 3px solid rgb(var(--color-error));
  color: rgb(var(--color-error));
  font-size: 13px;
  margin-bottom: 8px;
`;

const WarningList = styled.div`
  margin-bottom: 16px;
`;

const WarningItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--color-warning), 0.05);
  border-left: 3px solid rgb(var(--color-warning));
  color: rgb(var(--color-warning));
  font-size: 13px;
  margin-bottom: 8px;
`;

const PanelFooter = styled.div`
  padding: 16px 20px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const ExecuteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 20px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover:not(:disabled) {
    background: rgb(var(--color-primary-dark));
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
