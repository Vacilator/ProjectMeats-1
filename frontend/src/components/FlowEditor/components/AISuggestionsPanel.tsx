/**
 * AI Suggestions Panel
 * 
 * Displays intelligent node suggestions with confidence indicators.
 * Integrates with UnifiedFlowEditor to suggest next workflow steps.
 * 
 * Created: 2026-02-26 - Advanced Features
 */

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { AINodeSuggestionService, NodeSuggestion } from '@/services/aiNodeSuggestionService';
import { Sparkles, Plus, TrendingUp } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface AISuggestionsPanelProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  onAddNode: (nodeType: string, position?: { x: number; y: number }) => void;
  isVisible?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const Panel = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 320px;
  max-height: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgb(var(--color-border));
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: ${props => props.$isVisible ? 1 : 0};
  transform: ${props => props.$isVisible ? 'translateY(0)' : 'translateY(20px)'};
  pointer-events: ${props => props.$isVisible ? 'auto' : 'none'};
  z-index: 100;
`;

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: linear-gradient(135deg, rgba(var(--color-primary), 0.05), rgba(var(--color-primary), 0.02));
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  
  svg {
    color: rgb(var(--color-primary));
  }
`;

const HeaderSubtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const SuggestionsList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgb(var(--color-background));
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 3px;
    
    &:hover {
      background: rgb(var(--color-text-secondary));
    }
  }
`;

const SuggestionItem = styled.button`
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-bottom: 1px solid rgb(var(--color-border-light));
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
  }
  
  &:active {
    background: rgba(var(--color-primary), 0.1);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const SuggestionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const SuggestionLabel = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ConfidenceBadge = styled.div<{ $confidence: number }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: ${props => {
    if (props.$confidence >= 0.8) return 'rgba(34, 197, 94, 0.15)';
    if (props.$confidence >= 0.6) return 'rgba(234, 179, 8, 0.15)';
    return 'rgba(59, 130, 246, 0.15)';
  }};
  color: ${props => {
    if (props.$confidence >= 0.8) return 'rgb(22, 163, 74)';
    if (props.$confidence >= 0.6) return 'rgb(202, 138, 4)';
    return 'rgb(37, 99, 235)';
  }};
`;

const SuggestionDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 4px;
  line-height: 1.4;
`;

const SuggestionReason = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  font-style: italic;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  
  svg {
    margin-bottom: 12px;
    opacity: 0.5;
  }
  
  .message {
    font-size: 13px;
    line-height: 1.5;
  }
`;

const AddIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  
  ${SuggestionItem}:hover & {
    background: rgb(var(--color-primary));
    color: white;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const AISuggestionsPanel: React.FC<AISuggestionsPanelProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onAddNode,
  isVisible = true,
}) => {
  // Generate suggestions based on current workflow
  const suggestions = useMemo(() => {
    return AINodeSuggestionService.getSuggestions(nodes, edges, selectedNodeId);
  }, [nodes, edges, selectedNodeId]);
  
  const handleAddNode = (suggestion: NodeSuggestion) => {
    onAddNode(suggestion.nodeType, suggestion.position);
  };
  
  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };
  
  return (
    <Panel $isVisible={isVisible}>
      <Header>
        <HeaderTitle>
          <Sparkles size={16} />
          AI Suggestions
        </HeaderTitle>
        <HeaderSubtitle>
          {suggestions.length > 0 
            ? 'Intelligent next steps for your workflow'
            : 'Build your workflow to see suggestions'}
        </HeaderSubtitle>
      </Header>
      
      <SuggestionsList>
        {suggestions.length === 0 ? (
          <EmptyState>
            <Sparkles size={32} />
            <div className="message">
              Add nodes to your workflow
              <br />
              to get intelligent suggestions
            </div>
          </EmptyState>
        ) : (
          suggestions.map((suggestion, index) => (
            <SuggestionItem
              key={`${suggestion.nodeType}-${index}`}
              onClick={() => handleAddNode(suggestion)}
              title="Click to add this node to canvas"
            >
              <SuggestionHeader>
                <SuggestionLabel>
                  <AddIcon>
                    <Plus size={14} />
                  </AddIcon>
                  {suggestion.label}
                </SuggestionLabel>
                <ConfidenceBadge $confidence={suggestion.confidence}>
                  <TrendingUp size={10} />
                  {formatConfidence(suggestion.confidence)}
                </ConfidenceBadge>
              </SuggestionHeader>
              <SuggestionDescription>
                {suggestion.description}
              </SuggestionDescription>
              <SuggestionReason>
                💡 {suggestion.reason}
              </SuggestionReason>
            </SuggestionItem>
          ))
        )}
      </SuggestionsList>
    </Panel>
  );
};
