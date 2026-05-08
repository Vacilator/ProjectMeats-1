/**
 * AI Suggestions Panel
 *
 * Displays intelligent node suggestions with confidence indicators.
 * Integrates with UnifiedFlowEditor to suggest next workflow steps.
 *
 * Created: 2026-02-26 - Advanced Features
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { Skeleton } from 'antd';
import {
  AINodeSuggestionService,
  canonicalizeNodeTypeId,
  NodeSuggestion,
} from '@/services/aiNodeSuggestionService';
import { Sparkles, Plus, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { workformsApi } from '@/services/workformsApi';
import { useTranslation } from '@/i18n';
import { logger } from '@/utils/logger';

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
  background: rgb(var(--color-surface));
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(var(--color-overlay), 0.15);
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
  background: rgb(var(--color-surface));
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
    if (props.$confidence >= 0.8) return 'rgba(var(--color-success), 0.15)';
    if (props.$confidence >= 0.6) return 'rgba(var(--color-warning), 0.15)';
    return 'rgba(var(--color-info), 0.15)';
  }};
  color: ${props => {
    if (props.$confidence >= 0.8) return 'rgb(var(--color-success))';
    if (props.$confidence >= 0.6) return 'rgb(var(--color-warning))';
    return 'rgb(var(--color-info))';
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

const LoadingState = styled.div`
  padding: 16px;
`;

const ModeBadge = styled.span<{ $mode: 'ai' | 'static' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-left: 8px;
  background: ${props => props.$mode === 'ai'
    ? 'rgba(var(--color-primary), 0.1)'
    : 'rgba(var(--color-info), 0.1)'};
  color: ${props => props.$mode === 'ai'
    ? 'rgb(var(--color-primary))'
    : 'rgb(var(--color-info))'};

  svg {
    color: inherit;
  }
`;

const ErrorState = styled.div`
  padding: 24px 16px;
  text-align: center;

  svg {
    color: rgb(var(--color-error));
    margin-bottom: 8px;
  }

  .message {
    font-size: 12px;
    color: rgb(var(--color-text-secondary));
    margin-bottom: 8px;
  }

  .retry {
    font-size: 12px;
    color: rgb(var(--color-primary));
    cursor: pointer;
    text-decoration: underline;

    &:hover {
      color: rgb(var(--color-primary-hover));
    }
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
    color: rgb(var(--color-text-inverse));
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
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<NodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'ai' | 'static'>('ai');
  const [isCached, setIsCached] = useState(false);

  // Fetch AI suggestions when workflow changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (nodes.length === 0) {
        // Use local AI service for empty workflows
        const localSuggestions = AINodeSuggestionService.getSuggestions(nodes, edges, selectedNodeId);
        setSuggestions(localSuggestions);
        setMode('static');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Call backend API for AI-powered suggestions
        const { suggestions: apiSuggestions, confidence, mode: responseMode, cached } = await workformsApi.suggestNodes({
          current_flow: {
            nodes: nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
            edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
            selected_node: selectedNodeId
          },
          context: {
            node_count: nodes.length,
            edge_count: edges.length,
            has_selection: !!selectedNodeId
          }
        });

        // Convert API suggestions to NodeSuggestion format
        const formattedSuggestions: NodeSuggestion[] = apiSuggestions.map((s: any) => ({
          nodeType: canonicalizeNodeTypeId(s.type || ''),
          label: s.label,
          description: s.description,
          reason: s.reasoning || s.reason || 'Recommended based on workflow context',
          confidence: s.confidence || confidence || 0.7,
          position: s.position,
        }));

        setSuggestions(formattedSuggestions);
        setMode(responseMode === 'ai' || responseMode === 'static' ? responseMode : 'static');
        setIsCached(cached || false);
        setError(null);

      } catch (err: any) {
        logger.error('Failed to fetch AI suggestions:', err);

        // Graceful degradation: Use local AI service
        const fallbackSuggestions = AINodeSuggestionService.getSuggestions(nodes, edges, selectedNodeId);
        setSuggestions(fallbackSuggestions);
        setMode('static');
        setError(err.response?.data?.reason || 'Using static suggestions');
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce API calls
    const timeoutId = setTimeout(fetchSuggestions, 500);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, selectedNodeId]);

  const handleAddNode = (suggestion: NodeSuggestion) => {
    onAddNode(canonicalizeNodeTypeId(suggestion.nodeType), suggestion.position);
  };

  const handleRetry = () => {
    // Force re-fetch by clearing suggestions
    setSuggestions([]);
    setError(null);
  };

  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <Panel $isVisible={isVisible}>
      <Header>
        <HeaderTitle>
          <Sparkles size={16} />
          {t('aiPanel.title')}
          {mode && (
            <ModeBadge $mode={mode}>
              {mode === 'ai' ? <Zap size={10} /> : <AlertCircle size={10} />}
              {mode === 'ai' ? t('aiPanel.mode.ai') : t('aiPanel.mode.static')}
            </ModeBadge>
          )}
          {isCached && (
            <ModeBadge $mode="static">
              {t('aiPanel.mode.cached')}
            </ModeBadge>
          )}
        </HeaderTitle>
        <HeaderSubtitle>
          {isLoading
            ? t('aiPanel.analyzing')
            : suggestions.length > 0
              ? t('aiPanel.suggestions')
              : t('aiPanel.buildWorkflow')}
        </HeaderSubtitle>
      </Header>

      <SuggestionsList>
        {isLoading ? (
          <LoadingState>
            <Skeleton active paragraph={{ rows: 3 }} />
          </LoadingState>
        ) : error && suggestions.length === 0 ? (
          <ErrorState>
            <AlertCircle size={24} />
            <div className="message">{error}</div>
            <div className="retry" onClick={handleRetry}>
              {t('aiPanel.retry')}
            </div>
          </ErrorState>
        ) : suggestions.length === 0 ? (
          <EmptyState>
            <Sparkles size={32} />
            <div className="message">
              {t('aiPanel.addNodes')}
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
