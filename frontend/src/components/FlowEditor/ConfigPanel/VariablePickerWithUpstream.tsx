/**
 * Variable Picker with Upstream Support
 * 
 * Phase C.3: Enhanced Variable Picker that uses graph-based upstream variable detection
 * instead of relying on WorkflowContext (which may not be initialized).
 * 
 * Features:
 * - Automatic detection of upstream Form Step Single nodes
 * - Graph traversal to find all available variables
 * - Type-aware field suggestions
 * - Distance-based grouping (direct parents first)
 * - Search/filter capability
 * - Keyboard navigation
 * - Click to insert {{nodeId.fieldName}} template
 * 
 * Usage:
 * ```typescript
 * <VariablePickerWithUpstream
 *   currentNodeId="node-123"
 *   nodes={nodes}
 *   edges={edges}
 *   isOpen={showPicker}
 *   onSelect={(template) => insertVariable(template)}
 *   onClose={() => setShowPicker(false)}
 *   position={{ top: 100, left: 200 }}
 * />
 * ```
 * 
 * Created: 2026-02-17 - Phase C.3 Upstream Variable Propagation
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { 
  Search, 
  ChevronRight, 
  Type, 
  Hash, 
  Calendar, 
  ToggleLeft, 
  List, 
  FileText,
  Mail,
  Phone,
  Link as LinkIcon,
  File,
  Code,
  AlertCircle,
} from 'lucide-react';
import { useUpstreamVariables, UpstreamVariable } from '../hooks/useUpstreamVariables';
// ============================================================================
// TypeScript Interfaces
// ============================================================================

import {
  EmptyState,
  EmptyIcon,
  EmptyText,
} from './shared/StyledComponents';

interface VariablePickerWithUpstreamProps {
  /** Current node ID (to find upstream variables for) */
  currentNodeId: string;
  
  /** All nodes in workflow */
  nodes: Node[];
  
  /** All edges in workflow */
  edges: Edge[];
  
  /** Whether picker is visible */
  isOpen: boolean;
  
  /** Called when user selects a variable */
  onSelect: (template: string, variable: UpstreamVariable) => void;
  
  /** Called when picker should close */
  onClose: () => void;
  
  /** Position for popover */
  position?: { top: number; left: number };
  
  /** Optional initial search query */
  searchQuery?: string;
  
  /** Optional field type filter */
  fieldTypeFilter?: UpstreamVariable['fieldType'][];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTypeIcon(type: UpstreamVariable['fieldType']): React.ReactNode {
  const iconMap: Record<UpstreamVariable['fieldType'], React.ReactNode> = {
    string: <Type size={14} />,
    number: <Hash size={14} />,
    date: <Calendar size={14} />,
    boolean: <ToggleLeft size={14} />,
    select: <List size={14} />,
    file: <File size={14} />,
    textarea: <FileText size={14} />,
    email: <Mail size={14} />,
    phone: <Phone size={14} />,
    url: <LinkIcon size={14} />,
    json: <Code size={14} />,
  };
  
  return iconMap[type] || <Type size={14} />;
}

function getTypeColor(type: UpstreamVariable['fieldType']): string {
  const colorMap: Record<UpstreamVariable['fieldType'], string> = {
    string: '#6366f1',
    number: '#10b981',
    date: '#f59e0b',
    boolean: '#8b5cf6',
    select: '#3b82f6',
    file: '#ef4444',
    textarea: '#6366f1',
    email: '#06b6d4',
    phone: '#14b8a6',
    url: '#3b82f6',
    json: '#84cc16',
  };
  
  return colorMap[type] || '#6366f1';
}

// ============================================================================
// Styled Components
// ============================================================================

const PickerContainer = styled.div<{ $position?: { top: number; left: number } }>`
  position: fixed;
  top: ${props => props.$position?.top ?? 100}px;
  left: ${props => props.$position?.left ?? 200}px;
  width: 420px;
  max-height: 500px;
  background: white;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--font-family-body);
`;

const Header = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgb(var(--color-surface));
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Count = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const SearchContainer = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  
  svg {
    color: rgb(var(--color-text-secondary));
  }
`;

const Input = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const VariableList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
`;

const NodeGroup = styled.div`
  margin-bottom: 8px;
`;

const NodeHeader = styled.div`
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgb(var(--color-surface));
  border-top: 1px solid rgb(var(--color-border-light));
  border-bottom: 1px solid rgb(var(--color-border-light));
`;

const DistanceBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgb(var(--color-surface-hover));
  font-size: 10px;
  font-weight: 500;
  color: rgb(var(--color-text-tertiary));
`;

const VariableItem = styled.div<{ $selected?: boolean }>`
  padding: 10px 16px 10px 28px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  background: ${props => props.$selected ? 'rgb(var(--color-primary-light))' : 'transparent'};
  transition: background-color 0.15s ease;
  
  &:hover {
    background: ${props => props.$selected ? 'rgb(var(--color-primary-light))' : 'rgb(var(--color-surface-hover))'};
  }
`;

const TypeIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  flex-shrink: 0;
`;

const FieldInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FieldLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FieldName = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-family: var(--font-family-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Template = styled.div`
  font-size: 11px;
  font-family: var(--font-family-mono);
  color: rgb(var(--color-text-secondary));
  background: rgb(var(--color-surface));
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
`;









const Footer = styled.div`
  padding: 8px 16px;
  border-top: 1px solid rgb(var(--color-border));
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  background: rgb(var(--color-surface));
  text-align: center;
`;

// ============================================================================
// Main Component
// ============================================================================

export const VariablePickerWithUpstream: React.FC<VariablePickerWithUpstreamProps> = ({
  currentNodeId,
  nodes,
  edges,
  isOpen,
  onSelect,
  onClose,
  position,
  searchQuery = '',
  fieldTypeFilter,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const search = searchQuery || internalSearch;
  
  // Get upstream variables using the hook
  const { variables, variablesByNode, loading, error } = useUpstreamVariables({
    currentNodeId,
    nodes,
    edges,
  });
  
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
      const target = e.target;
      if (pickerRef.current && target instanceof globalThis.Node && !pickerRef.current.contains(target)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);
  
  // Filter variables by search and type
  const filteredVariables = useMemo(() => {
    let filtered = variables;
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(v => 
        v.nodeName.toLowerCase().includes(searchLower) ||
        v.fieldName.toLowerCase().includes(searchLower) ||
        v.fieldLabel.toLowerCase().includes(searchLower) ||
        v.template.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by field type
    if (fieldTypeFilter && fieldTypeFilter.length > 0) {
      filtered = filtered.filter(v => fieldTypeFilter.includes(v.fieldType));
    }
    
    return filtered;
  }, [variables, search, fieldTypeFilter]);
  
  // Group filtered variables by node
  const filteredGroupedVariables = useMemo(() => {
    const groups: Record<string, UpstreamVariable[]> = {};
    
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
          handleSelect(filteredVariables[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredVariables, selectedIndex]);
  
  if (!isOpen) return null;
  
  const handleSelect = (variable: UpstreamVariable) => {
    onSelect(variable.template, variable);
    onClose();
  };
  
  let currentIndex = 0;
  
  return (
    <PickerContainer ref={pickerRef} $position={position}>
      {/* Header */}
      <Header>
        <Title>Available Variables</Title>
        <Count>{filteredVariables.length} {filteredVariables.length === 1 ? 'variable' : 'variables'}</Count>
      </Header>
      
      {/* Search Input */}
      <SearchContainer>
        <Search size={16} />
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search variables..."
          value={internalSearch}
          onChange={(e) => setInternalSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </SearchContainer>
      
      {/* Variable List */}
      <VariableList>
        {error && (
          <EmptyState>
            <EmptyIcon><AlertCircle /></EmptyIcon>
            <EmptyText>Error Loading Variables</EmptyText>
            <EmptyText>{error}</EmptyText>
          </EmptyState>
        )}
        
        {!error && filteredVariables.length === 0 && (
          <EmptyState>
            <EmptyIcon><Search /></EmptyIcon>
            <EmptyText>No Variables Found</EmptyText>
            <EmptyText>
              {search ? `No variables match "${search}"` : 'No upstream Form Step nodes found'}
            </EmptyText>
          </EmptyState>
        )}
        
        {!error && filteredVariables.length > 0 && Object.entries(filteredGroupedVariables).map(([nodeId, nodeVariables]) => {
          const firstVar = nodeVariables[0];
          
          return (
            <NodeGroup key={nodeId}>
              <NodeHeader>
                <ChevronRight size={14} />
                <span>{firstVar.nodeName}</span>
                <DistanceBadge>{firstVar.distance} step{firstVar.distance > 1 ? 's' : ''} back</DistanceBadge>
              </NodeHeader>
              
              {nodeVariables.map(variable => {
                const isSelected = currentIndex === selectedIndex;
                const itemIndex = currentIndex++;
                
                return (
                  <VariableItem
                    key={`${variable.nodeId}-${variable.fieldName}`}
                    $selected={isSelected}
                    onClick={() => handleSelect(variable)}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                  >
                    <TypeIcon $color={getTypeColor(variable.fieldType)}>
                      {getTypeIcon(variable.fieldType)}
                    </TypeIcon>
                    
                    <FieldInfo>
                      <FieldLabel>
                        {variable.fieldLabel}
                        {variable.required && <span style={{ color: 'rgb(var(--color-error))' }}> *</span>}
                      </FieldLabel>
                      <FieldName>{variable.fieldName}</FieldName>
                    </FieldInfo>
                    
                    <Template>{variable.template}</Template>
                  </VariableItem>
                );
              })}
            </NodeGroup>
          );
        })}
      </VariableList>
      
      {/* Footer */}
      <Footer>
        Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate • <kbd>Enter</kbd> to select • <kbd>Esc</kbd> to close
      </Footer>
    </PickerContainer>
  );
};

export default VariablePickerWithUpstream;
