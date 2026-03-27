/**
 * Variable Picker Component
 * 
 * Phase 4: Visual Variable Picker (Zapier-style)
 * Popover that shows available variables from previous workflow nodes.
 * Triggered by typing {{ in text fields.
 * 
 * Features:
 * - Popover triggered by {{ typing
 * - Shows available variables from WorkflowContext
 * - Groups by node with icons
 * - Search/filter capability
 * - Click to insert {{nodeId.fieldKey}} template
 * - Keyboard navigation (up/down, enter)
 * - Type indicators (string, number, boolean, etc.)
 * 
 * Usage:
 * ```typescript
 * <VariablePicker
 *   context={workflowContext}
 *   isOpen={showPicker}
 *   onSelect={(template) => insertVariable(template)}
 *   onClose={() => setShowPicker(false)}
 *   position={{ top: 100, left: 200 }}
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 4 Visual Variable Picker Implementation
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { 
  Database, 
  Search, 
  ChevronRight, 
  Type, 
  Hash, 
  Calendar, 
  ToggleLeft, 
  List, 
  FileText,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { WorkflowContext, AvailableDataNode } from '../../FormSubmission/hooks/useWorkflowContext';
import {
  EmptyState,
  EmptyIcon,
  EmptyText,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface VariablePickerProps {
  /** Workflow context */
  context: WorkflowContext;
  
  /** Whether picker is visible */
  isOpen: boolean;
  
  /** Called when user selects a variable */
  onSelect: (template: string) => void;
  
  /** Called when picker should close */
  onClose: () => void;
  
  /** Position for popover */
  position?: { top: number; left: number };
  
  /** Optional search query */
  searchQuery?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTypeIcon(type: string): React.ReactNode {
  switch (type) {
    case 'string':
      return <Type size={14} />;
    case 'number':
      return <Hash size={14} />;
    case 'boolean':
      return <ToggleLeft size={14} />;
    case 'object':
      return <FileText size={14} />;
    case 'array':
      return <List size={14} />;
    default:
      return <FileText size={14} />;
  }
}

function getNodeTypeColor(nodeType: string): string {
  const colorMap: Record<string, string> = {
    trigger: 'rgb(var(--color-success))',
    form: 'rgb(var(--color-primary))',
    condition: 'rgb(var(--color-warning))',
    action: 'rgb(var(--color-info))',
    wait: 'rgb(var(--color-info))',
    document: 'rgb(var(--color-info))',
    loop: 'rgb(var(--color-warning))',
    default: 'rgb(var(--color-info))',
  };
  
  return colorMap[nodeType] || colorMap.default;
}

// ============================================================================
// Main Component
// ============================================================================

export const VariablePicker: React.FC<VariablePickerProps> = ({
  context,
  isOpen,
  onSelect,
  onClose,
  position,
  searchQuery = '',
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const search = searchQuery || internalSearch;
  
  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  
  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);
  
  const nodeIndexById = useMemo(() => {
    const m = new Map<string, number>();
    context.nodes.forEach((n, idx) => m.set(n.id, idx));
    return m;
  }, [context.nodes]);

  const currentNodeIndex = useMemo(() => {
    if (!context.currentNodeId) return -1;
    return nodeIndexById.get(context.currentNodeId) ?? -1;
  }, [context.currentNodeId, nodeIndexById]);

  const isPotentiallyOutOfScope = (nodeId: string) => {
    if (currentNodeIndex < 0) return false;
    const idx = nodeIndexById.get(nodeId);
    if (typeof idx !== 'number') return true;
    return idx >= currentNodeIndex;
  };

  // Filter and flatten available variables
  const filteredVariables = useMemo(() => {
    const variables: Array<{
      nodeId: string;
      nodeLabel: string;
      nodeType: string;
      fieldKey: string;
      fieldLabel: string;
      fieldType: string;
      template: string;
      potentiallyOutOfScope: boolean;
    }> = [];
    
    context.availableData.forEach(node => {
      node.fields.forEach(field => {
        const template = `{{${node.nodeId}.${field.key}}}`;
        
        // Filter by search query
        const searchLower = search.toLowerCase();
        if (search && !node.nodeLabel.toLowerCase().includes(searchLower) &&
            !field.key.toLowerCase().includes(searchLower) &&
            !(field.label || '').toLowerCase().includes(searchLower)) {
          return;
        }
        
        variables.push({
          nodeId: node.nodeId,
          nodeLabel: node.nodeLabel,
          nodeType: node.nodeType,
          fieldKey: field.key,
          fieldLabel: field.label || field.key,
          fieldType: field.type || 'string',
          template,
          potentiallyOutOfScope: isPotentiallyOutOfScope(node.nodeId),
        });
      });
    });
    
    return variables;
  }, [context.availableData, search, currentNodeIndex, nodeIndexById]);
  
  // Group variables by node
  const groupedVariables = useMemo(() => {
    const groups: Record<string, typeof filteredVariables> = {};
    
    filteredVariables.forEach(variable => {
      if (!groups[variable.nodeId]) {
        groups[variable.nodeId] = [];
      }
      groups[variable.nodeId].push(variable);
    });
    
    return groups;
  }, [filteredVariables]);
  
  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredVariables.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredVariables[selectedIndex]) {
          onSelect(filteredVariables[selectedIndex].template);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredVariables, selectedIndex, onSelect, onClose]);
  
  if (!isOpen) return null;
  
  const handleSelect = (template: string) => {
    onSelect(template);
    onClose();
  };
  
  let currentIndex = 0;
  
  return (
    <PickerContainer ref={pickerRef} $position={position}>
      {/* Search Input */}
      <SearchContainer>
        <Search size={16} />
        <SearchInput
          ref={searchInputRef}
          type="text"
          placeholder="Search variables..."
          value={internalSearch}
          onChange={(e) => setInternalSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </SearchContainer>
      
      {/* Variables List */}
      <VariablesList>
        {filteredVariables.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <Database size={32} />
            </EmptyIcon>
            <EmptyText>No variables available</EmptyText>
            <EmptyText style={{ fontSize: '12px', opacity: 0.7 }}>
              Execute previous nodes to see data
            </EmptyText>
          </EmptyState>
        ) : (
          Object.entries(groupedVariables).map(([nodeId, variables]) => {
            const firstVar = variables[0];
            const nodeColor = getNodeTypeColor(firstVar.nodeType);
            
            return (
              <NodeGroup key={nodeId}>
                <NodeGroupHeader $color={nodeColor}>
                  <Database size={14} />
                  <span>{firstVar.nodeLabel}</span>
                  <small>({firstVar.nodeType})</small>
                </NodeGroupHeader>
                
                {variables.map(variable => {
                  const isSelected = currentIndex === selectedIndex;
                  const itemIndex = currentIndex++;
                  
                  return (
                    <VariableItem
                      key={variable.template}
                      $selected={isSelected}
                      onClick={() => handleSelect(variable.template)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <VariableIcon>{getTypeIcon(variable.fieldType)}</VariableIcon>
                      <VariableContent>
                        <VariableLabel>{variable.fieldLabel}</VariableLabel>
                        <VariableKey>{variable.fieldKey}</VariableKey>
                      </VariableContent>
                      {variable.potentiallyOutOfScope && (
                        <ScopeWarning
                          title="Warning: This variable may not be evaluated before this step executes."
                        >
                          <AlertTriangle size={14} />
                        </ScopeWarning>
                      )}
                      <ArrowRight size={14} style={{ opacity: 0.3 }} />
                    </VariableItem>
                  );
                })}
              </NodeGroup>
            );
          })
        )}
      </VariablesList>
      
      {/* Footer */}
      {filteredVariables.length > 0 && (
        <PickerFooter>
          <small>
            ↑↓ Navigate · Enter Select · Esc Close
          </small>
        </PickerFooter>
      )}
    </PickerContainer>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const PickerContainer = styled.div<{ $position?: { top: number; left: number } }>`
  position: fixed;
  ${props => props.$position ? `
    top: ${props.$position.top}px;
    left: ${props.$position.left}px;
  ` : `
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  `}
  width: 400px;
  max-height: 500px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 10000;
  overflow: hidden;
`;

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-secondary));
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  outline: none;
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const VariablesList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 4px;
  }
`;



const NodeGroup = styled.div`
  margin-bottom: 12px;
`;

const NodeGroupHeader = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.$color};
  border-bottom: 1px solid ${props => props.$color}33;
  margin-bottom: 4px;
  
  small {
    margin-left: auto;
    opacity: 0.6;
    font-weight: normal;
  }
`;

const VariableItem = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  background: ${props => props.$selected ? 'rgb(var(--color-primary) / 0.1)' : 'transparent'};
  border: 1px solid ${props => props.$selected ? 'rgb(var(--color-primary))' : 'transparent'};
  transition: all 0.15s;
  
  &:hover {
    background: rgb(var(--color-primary) / 0.05);
  }
`;

const VariableIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
`;

const VariableContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const VariableLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VariableKey = styled.div`
  font-size: 11px;
  font-family: 'Monaco', 'Menlo', monospace;
  color: rgb(var(--color-text-secondary));
  opacity: 0.7;
`;

const ScopeWarning = styled.span`
  display: flex;
  align-items: center;
  color: rgb(234, 179, 8);
  opacity: 0.9;
`;

const PickerFooter = styled.div`
  padding: 8px 12px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  
  small {
    font-size: 11px;
    color: rgb(var(--color-text-secondary));
  }
`;
