/**
 * AutoMappingSuggestions Component
 *
 * Displays field mapping suggestions and allows users to accept/reject them.
 * Part of Smart Auto-Map Phase 3 implementation.
 *
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import React from 'react';
import styled from 'styled-components';
import { Button, Spin, Alert, Tag, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  LinkOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { FieldMappingSuggestion } from '../utils/autoMappingService';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 1rem;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SuggestionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SuggestionCard = styled.div<{ $score: number }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: ${props =>
    props.$score >= 0.9
      ? 'rgba(var(--color-success), 0.05)'
      : 'rgb(var(--color-background-secondary))'
  };
  border: 1px solid ${props =>
    props.$score >= 0.9
      ? 'rgba(var(--color-success), 0.2)'
      : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.05);
  }
`;

const SuggestionContent = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const FieldMapping = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
`;

const FieldName = styled.span`
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const FieldLabel = styled.span`
  color: rgb(var(--color-text-secondary));
  font-size: 0.75rem;
`;

const MatchInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const EmptyState = styled.div`
  padding: 2rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

const Footer = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const InfoText = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

export interface AutoMappingSuggestionsProps {
  suggestions: FieldMappingSuggestion[];
  loading?: boolean;
  error?: string | null;
  onAccept: (suggestion: FieldMappingSuggestion) => void;
  onReject: (suggestionId: string) => void;
  onApplyAll?: () => void;
  onClose?: () => void;
}

export const AutoMappingSuggestionsPanel: React.FC<AutoMappingSuggestionsProps> = ({
  suggestions,
  loading = false,
  error = null,
  onAccept,
  onReject,
  onApplyAll,
  onClose,
}) => {
  const autoSuggestions = suggestions.filter(s => s.autoApply);
  const manualSuggestions = suggestions.filter(s => !s.autoApply);

  const getMatchReasonLabel = (reason: FieldMappingSuggestion['matchReason']) => {
    switch (reason) {
      case 'exact_name':
        return 'Exact Match';
      case 'normalized_name':
        return 'Similar Name';
      case 'fuzzy_name':
        return 'Fuzzy Match';
      case 'type_compatible':
        return 'Type Compatible';
      default:
        return 'Match';
    }
  };

  const getMatchReasonColor = (reason: FieldMappingSuggestion['matchReason']) => {
    switch (reason) {
      case 'exact_name':
        return 'green';
      case 'normalized_name':
        return 'blue';
      case 'fuzzy_name':
        return 'orange';
      case 'type_compatible':
        return 'purple';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Container>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spin tip="Analyzing field mappings..." />
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert
          type="error"
          message="Failed to generate suggestions"
          description={error}
          showIcon
        />
      </Container>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Container>
        <EmptyState>
          <InfoCircleOutlined style={{ fontSize: '2rem', marginBottom: '0.5rem' }} />
          <div>No field mapping suggestions available</div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Connect this node to upstream nodes or add fields to get suggestions
          </div>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>
          <ThunderboltOutlined style={{ color: 'rgb(var(--color-primary))' }} />
          Smart Auto-Map Suggestions
          <Tooltip title="AI-powered field mapping suggestions based on upstream nodes">
            <InfoCircleOutlined style={{ color: 'rgb(var(--color-text-secondary))' }} />
          </Tooltip>
        </Title>
        {onClose && (
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        )}
      </Header>

      <SuggestionsList>
        {suggestions.map(suggestion => (
          <SuggestionCard key={suggestion.id} $score={suggestion.matchScore}>
            <SuggestionContent>
              <FieldMapping>
                <FieldName>{suggestion.targetFieldName}</FieldName>
                <LinkOutlined style={{ color: 'rgb(var(--color-text-secondary))' }} />
                <FieldName>{suggestion.sourceFieldName}</FieldName>
                <FieldLabel>({suggestion.sourceFieldLabel})</FieldLabel>
              </FieldMapping>

              <MatchInfo>
                <Tag color={getMatchReasonColor(suggestion.matchReason)} style={{ fontSize: '0.7rem' }}>
                  {getMatchReasonLabel(suggestion.matchReason)}
                </Tag>
                <Tag color={suggestion.matchScore >= 0.9 ? 'green' : 'default'} style={{ fontSize: '0.7rem' }}>
                  {Math.round(suggestion.matchScore * 100)}% Match
                </Tag>
                {suggestion.autoApply && (
                  <Tag color="blue" style={{ fontSize: '0.7rem' }}>
                    Auto
                  </Tag>
                )}
              </MatchInfo>
            </SuggestionContent>

            <Actions>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAccept(suggestion);
                }}
              >
                Apply
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onReject(suggestion.id);
                }}
              >
                Reject
              </Button>
            </Actions>
          </SuggestionCard>
        ))}
      </SuggestionsList>

      {autoSuggestions.length > 0 && onApplyAll && (
        <Footer>
          <InfoText>
            {autoSuggestions.length} high-confidence {autoSuggestions.length === 1 ? 'match' : 'matches'} (≥90%)
          </InfoText>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onApplyAll();
            }}
          >
            Apply All Auto-Mappings ({autoSuggestions.length})
          </Button>
        </Footer>
      )}
    </Container>
  );
};
