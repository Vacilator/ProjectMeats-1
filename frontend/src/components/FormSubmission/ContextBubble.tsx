/**
 * Context Bubble Component
 * 
 * Phase 5: Context Inheritance
 * Shows available data from previous workflow nodes.
 * 
 * Features:
 * - Lists all nodes with data in workflow context
 * - Groups fields by node
 * - Shows field types and current values
 * - Click to insert {{nodeId.fieldKey}} template
 * - Search/filter capabilities
 * - Visual indicator of data types
 * 
 * Usage:
 * ```typescript
 * <ContextBubble
 *   context={workflowContext}
 *   onInsert={(template) => insertIntoField(template)}
 *   position="right"
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 5 Context Inheritance Implementation
 */

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { 
  Database, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  ChevronUp,
  Copy, 
  CheckCircle,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  FileText,
} from 'lucide-react';
import { WorkflowContext, AvailableDataNode } from './hooks/useWorkflowContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ContextBubbleProps {
  /** Workflow context */
  context: WorkflowContext;
  
  /** Called when user clicks to insert a template */
  onInsert?: (template: string) => void;
  
  /** Position of the bubble */
  position?: 'right' | 'left' | 'floating';
  
  /** Show compact view */
  compact?: boolean;
  
  /** Show inherited data panel (Phase 4 enhancement) */
  showInheritedData?: boolean;
  
  /** Current step ID for showing inheritance chain */
  currentStepId?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const BubbleContainer = styled.div<{ $position: string; $compact: boolean }>`
  ${props => {
    if (props.$position === 'floating') {
      return `
        position: fixed;
        top: 100px;
        right: 520px;
        max-width: 320px;
        max-height: 500px;
        z-index: 900;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      `;
    } else {
      return `
        width: 100%;
        max-height: ${props.$compact ? '300px' : '500px'};
      `;
    }
  }}
  
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const BubbleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgb(var(--color-surface-hover));
  border-bottom: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-primary));
  font-weight: 600;
  font-size: 14px;
  
  svg {
    width: 18px;
    height: 18px;
    color: rgb(var(--color-primary));
  }
`;

const SearchBox = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const NodesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const NodeGroup = styled.div`
  margin-bottom: 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const NodeHeader = styled.button<{ $expanded: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgb(var(--color-surface-hover));
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-surface-active));
  }
  
  svg {
    width: 16px;
    height: 16px;
    color: rgb(var(--color-text-secondary));
    flex-shrink: 0;
  }
`;

const NodeLabel = styled.span`
  flex: 1;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const NodeBadge = styled.span`
  padding: 2px 6px;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
`;

const FieldsList = styled.div<{ $show: boolean }>`
  display: ${props => props.$show ? 'block' : 'none'};
  background: rgb(var(--color-surface));
`;

const FieldItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: none;
  border-top: 1px solid rgb(var(--color-border));
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
    
    .copy-icon {
      opacity: 1;
    }
  }
  
  &:active {
    background: rgb(var(--color-surface-active));
  }
`;

const FieldIcon = styled.div`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    width: 16px;
    height: 16px;
    color: rgb(var(--color-text-tertiary));
  }
`;

const FieldInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FieldLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FieldValue = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const CopyIcon = styled.div`
  opacity: 0;
  transition: opacity 0.2s;
  
  svg {
    width: 14px;
    height: 14px;
    color: rgb(var(--color-primary));
  }
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

const EmptyIcon = styled.div`
  margin-bottom: 12px;
  
  svg {
    width: 48px;
    height: 48px;
    color: rgb(var(--color-text-tertiary));
    opacity: 0.5;
  }
`;

// Phase 4 Enhancement: Inherited Data Panel
const InheritanceToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 4px 8px;
  background: rgb(var(--color-primary) / 0.1);
  border: 1px solid rgb(var(--color-primary));
  border-radius: var(--radius-sm);
  color: rgb(var(--color-primary));
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-primary) / 0.15);
  }
  
  svg {
    width: 12px;
    height: 12px;
  }
`;

const InheritancePanel = styled.div`
  max-height: 300px;
  overflow-y: auto;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const InheritancePanelHeader = styled.div`
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const InheritanceStep = styled.div`
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:last-child {
    border-bottom: none;
  }
`;

const InheritanceStepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgb(var(--color-surface));
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  
  small {
    opacity: 0.6;
    font-weight: normal;
  }
`;

const InheritanceStepData = styled.div`
  padding: 8px 16px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  background: rgb(var(--color-surface));
  
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

function getFieldTypeIcon(type: string) {
  switch (type) {
    case 'string':
      return <Type />;
    case 'number':
      return <Hash />;
    case 'boolean':
      return <ToggleLeft />;
    case 'object':
      return <List />;
    case 'array':
      return <List />;
    default:
      return <FileText />;
  }
}

function formatFieldValue(value: any): string {
  if (value == null) return 'null';
  if (typeof value === 'string') return `"${value.substring(0, 30)}${value.length > 30 ? '...' : ''}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
  return String(value);
}

// ============================================================================
// Component
// ============================================================================

export const ContextBubble: React.FC<ContextBubbleProps> = ({
  context,
  onInsert,
  position = 'right',
  compact = false,
  showInheritedData = false,
  currentStepId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [showInheritancePanel, setShowInheritancePanel] = useState(false);

  // Filter available data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return context.availableData;
    
    const query = searchQuery.toLowerCase();
    return context.availableData
      .map(node => ({
        ...node,
        fields: node.fields.filter(field =>
          field.key.toLowerCase().includes(query) ||
          field.label?.toLowerCase().includes(query)
        ),
      }))
      .filter(node => node.fields.length > 0);
  }, [context.availableData, searchQuery]);
  
  // Get inheritance chain for current step
  const inheritanceChain = useMemo(() => {
    if (!currentStepId || !showInheritedData) return [];
    
    const currentIndex = context.nodes.findIndex(n => n.id === currentStepId);
    if (currentIndex <= 0) return [];
    
    // Get all previous nodes that have data
    return context.nodes
      .slice(0, currentIndex)
      .filter(node => context.data[node.id])
      .map(node => ({
        id: node.id,
        label: node.data?.label || node.id,
        type: node.type || 'unknown',
        data: context.data[node.id],
      }));
  }, [context, currentStepId, showInheritedData]);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Handle field click
  const handleFieldClick = (nodeId: string, fieldKey: string) => {
    const template = `{{${nodeId}.${fieldKey}}}`;
    
    if (onInsert) {
      onInsert(template);
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(template);
    setCopiedTemplate(template);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  return (
    <BubbleContainer $position={position} $compact={compact}>
      <BubbleHeader>
        <Database />
        <span>Available Data</span>
        {showInheritedData && inheritanceChain.length > 0 && (
          <InheritanceToggle
            onClick={() => setShowInheritancePanel(!showInheritancePanel)}
            title="Toggle inherited data panel"
          >
            {showInheritancePanel ? <ChevronUp /> : <ChevronDown />}
            <small>{inheritanceChain.length} inherited</small>
          </InheritanceToggle>
        )}
      </BubbleHeader>
      
      {/* Inherited Data Panel (Phase 4 enhancement) */}
      {showInheritedData && showInheritancePanel && inheritanceChain.length > 0 && (
        <InheritancePanel>
          <InheritancePanelHeader>
            Inherited from Previous Steps
          </InheritancePanelHeader>
          {inheritanceChain.map((step, index) => (
            <InheritanceStep key={step.id}>
              <InheritanceStepHeader>
                <span>Step {index + 1}: {String(step.label ?? step.id ?? '')}</span>
                <small>({step.type})</small>
              </InheritanceStepHeader>
              <InheritanceStepData>
                <pre>{JSON.stringify(step.data, null, 2)}</pre>
              </InheritanceStepData>
            </InheritanceStep>
          ))}
        </InheritancePanel>
      )}
      
      <SearchBox>
        <SearchInput
          type="text"
          placeholder="Search fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </SearchBox>
      
      <NodesContainer>
        {filteredData.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <Database />
            </EmptyIcon>
            {searchQuery 
              ? 'No fields match your search'
              : 'No data available yet. Complete previous steps to see data here.'
            }
          </EmptyState>
        ) : (
          filteredData.map(node => {
            const isExpanded = expandedNodes.has(node.nodeId);
            
            return (
              <NodeGroup key={node.nodeId}>
                <NodeHeader 
                  $expanded={isExpanded}
                  onClick={() => toggleNode(node.nodeId)}
                >
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                  <NodeLabel>{node.nodeLabel}</NodeLabel>
                  <NodeBadge>{node.fields.length}</NodeBadge>
                </NodeHeader>
                
                <FieldsList $show={isExpanded}>
                  {node.fields.map(field => (
                    <FieldItem
                      key={field.key}
                      onClick={() => handleFieldClick(node.nodeId, field.key)}
                      title={`Click to insert {{${node.nodeId}.${field.key}}}`}
                    >
                      <FieldIcon>
                        {getFieldTypeIcon(field.type || 'string')}
                      </FieldIcon>
                      
                      <FieldInfo>
                        <FieldLabel>{field.label || field.key}</FieldLabel>
                        <FieldValue>{formatFieldValue(field.value)}</FieldValue>
                      </FieldInfo>
                      
                      <CopyIcon className="copy-icon">
                        {copiedTemplate === `{{${node.nodeId}.${field.key}}}` ? (
                          <CheckCircle />
                        ) : (
                          <Copy />
                        )}
                      </CopyIcon>
                    </FieldItem>
                  ))}
                </FieldsList>
              </NodeGroup>
            );
          })
        )}
      </NodesContainer>
    </BubbleContainer>
  );
};

export default ContextBubble;
