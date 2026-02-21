/**
 * Variable Picker Component
 * 
 * Reusable component for selecting variables from upstream nodes.
 * Features: Grouped display, search, type filtering, visual chips.
 * 
 * Created: 2026-02-21
 * Phase: 5 - Smart Features
 */

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, X, Database, FileText, Mail, Package, Layers } from 'lucide-react';

/**
 * Variable definition from upstream nodes
 */
export interface Variable {
  id: string;
  name: string;
  displayName: string;
  type: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  path: string; // e.g., "step1.customerName"
  description?: string;
  sampleValue?: any;
}

/**
 * Props for VariablePicker
 */
interface VariablePickerProps {
  variables: Variable[];
  onSelect: (variable: Variable) => void;
  selectedVariables?: Variable[];
  placeholder?: string;
  typeFilter?: string[]; // Filter by variable types
  showSearch?: boolean;
  maxHeight?: string;
}

/**
 * Styled Components
 */
const Container = styled.div<{ maxHeight?: string }>`
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  max-height: ${props => props.maxHeight || '400px'};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SearchBox = styled.div`
  padding: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgb(var(--color-surface-hover));
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const VariableList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const NodeGroup = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgb(var(--color-surface-hover));
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  
  svg {
    color: rgb(var(--color-text-secondary));
  }
`;

const VariableItem = styled.button<{ selected?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.selected 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: 6px;
  background: ${props => props.selected 
    ? 'rgba(var(--color-primary), 0.1)' 
    : 'rgb(var(--color-surface))'};
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const VariableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const VariableName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  font-family: 'Courier New', monospace;
`;

const TypeBadge = styled.span`
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: rgb(var(--color-surface-hover));
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
`;

const VariablePath = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-family: 'Courier New', monospace;
`;

const VariableDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 4px;
`;

const SampleValue = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  font-family: 'Courier New', monospace;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgb(var(--color-surface-hover));
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

/**
 * Get icon for node type
 */
const getNodeIcon = (nodeType: string) => {
  switch (nodeType) {
    case 'form':
    case 'formStepSingle':
      return FileText;
    case 'formProcess':
    case 'formProcessGroup':
      return Layers;
    case 'createRecord':
      return Database;
    case 'outlookEmail':
      return Mail;
    default:
      return Package;
  }
};

/**
 * VariablePicker Component
 */
export const VariablePicker: React.FC<VariablePickerProps> = ({
  variables,
  onSelect,
  selectedVariables = [],
  placeholder = 'Search variables...',
  typeFilter,
  showSearch = true,
  maxHeight
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter variables
  const filteredVariables = useMemo(() => {
    let filtered = variables;
    
    // Type filter
    if (typeFilter && typeFilter.length > 0) {
      filtered = filtered.filter(v => typeFilter.includes(v.type));
    }
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(term) ||
        v.displayName.toLowerCase().includes(term) ||
        v.nodeName.toLowerCase().includes(term) ||
        v.path.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [variables, typeFilter, searchTerm]);
  
  // Group by node
  const groupedVariables = useMemo(() => {
    const groups: Record<string, Variable[]> = {};
    
    filteredVariables.forEach(variable => {
      if (!groups[variable.nodeId]) {
        groups[variable.nodeId] = [];
      }
      groups[variable.nodeId].push(variable);
    });
    
    return groups;
  }, [filteredVariables]);
  
  // Check if variable is selected
  const isSelected = (variable: Variable) => {
    return selectedVariables.some(v => v.id === variable.id);
  };
  
  // Handle select
  const handleSelect = (variable: Variable) => {
    onSelect(variable);
  };
  
  return (
    <Container maxHeight={maxHeight}>
      {showSearch && (
        <SearchBox>
          <Search size={16} color="rgb(var(--color-text-secondary))" />
          <SearchInput
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                color: 'rgb(var(--color-text-secondary))'
              }}
            >
              <X size={16} />
            </button>
          )}
        </SearchBox>
      )}
      
      <VariableList>
        {Object.keys(groupedVariables).length === 0 ? (
          <EmptyState>
            {searchTerm ? 'No variables match your search' : 'No variables available'}
          </EmptyState>
        ) : (
          Object.entries(groupedVariables).map(([nodeId, vars]) => {
            const firstVar = vars[0];
            const Icon = getNodeIcon(firstVar.nodeType);
            
            return (
              <NodeGroup key={nodeId}>
                <NodeHeader>
                  <Icon size={14} />
                  {firstVar.nodeName}
                </NodeHeader>
                
                {vars.map(variable => (
                  <VariableItem
                    key={variable.id}
                    selected={isSelected(variable)}
                    onClick={() => handleSelect(variable)}
                  >
                    <VariableHeader>
                      <VariableName>{variable.displayName}</VariableName>
                      <TypeBadge>{variable.type}</TypeBadge>
                    </VariableHeader>
                    
                    <VariablePath>{variable.path}</VariablePath>
                    
                    {variable.description && (
                      <VariableDescription>{variable.description}</VariableDescription>
                    )}
                    
                    {variable.sampleValue !== undefined && (
                      <SampleValue>
                        Sample: {JSON.stringify(variable.sampleValue)}
                      </SampleValue>
                    )}
                  </VariableItem>
                ))}
              </NodeGroup>
            );
          })
        )}
      </VariableList>
    </Container>
  );
};
