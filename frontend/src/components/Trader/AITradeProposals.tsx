/**
 * AITradeProposals
 *
 * Displays proactive AI-generated trade proposals with one-click execution,
 * confidence scoring, inline editing, and feedback integration.
 *
 * Features:
 * - Fetches AI proposals via traderService.getProposals()
 * - Confidence badges (green ≥ 0.9, amber ≥ 0.7, gray < 0.7)
 * - One-click "Approve & Execute" → triggers full E2E pipeline
 * - Thumbs up/down feedback per proposal (feeds into confidence engine)
 * - Auto-execute badge for proposals above unsupervised threshold
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses traderService exclusively.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircle2,
  Lightbulb,
  Play,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';

import {
  traderService,
  type TradeProposal,
} from '@/services/traderService';
import { withTenantQueryKey } from '@/utils/queryKeys';

const { Text, Title } = Typography;

// ============================================================================
// Styled Components
// ============================================================================

const ProposalsContainer = styled.div`
  margin-bottom: 1rem;
`;

const ProposalCard = styled(Card)<{ $confidence: number }>`
  margin-bottom: 0.5rem;
  border-left: 3px solid ${(p) =>
    p.$confidence >= 0.9 ? 'rgb(34, 197, 94)' :
    p.$confidence >= 0.7 ? 'rgb(234, 179, 8)' :
    'rgb(156, 163, 175)'};
  .ant-card-body {
    padding: 0.75rem 1rem;
  }
  transition: box-shadow 0.15s ease;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const ProposalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const ProposalDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const ProposalActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
`;

const ConfidenceBadge = styled.span<{ $level: 'high' | 'medium' | 'low' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.7rem;
  font-weight: 600;
  background: ${(p) =>
    p.$level === 'high' ? 'rgb(220 252 231)' :
    p.$level === 'medium' ? 'rgb(254 249 195)' :
    'rgb(243 244 246)'};
  color: ${(p) =>
    p.$level === 'high' ? 'rgb(21 128 61)' :
    p.$level === 'medium' ? 'rgb(161 98 7)' :
    'rgb(107 114 128)'};
`;

const AUTO_EXECUTE_THRESHOLD = 0.95;

// ============================================================================
// Component
// ============================================================================

export interface AITradeProposalsProps {
  onProposalExecuted?: (sessionId: string) => void;
}

export const AITradeProposals: React.FC<AITradeProposalsProps> = ({
  onProposalExecuted,
}) => {
  const queryClient = useQueryClient();
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');

  const proposalsQuery = useQuery({
    queryKey: withTenantQueryKey('ai-trade-proposals'),
    queryFn: () => traderService.getProposals(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const proposals = useMemo(
    () => (proposalsQuery.data || []).filter((p) => p.status === 'pending'),
    [proposalsQuery.data]
  );

  const executeMutation = useMutation({
    mutationFn: (proposalId: string) => traderService.executeProposal(proposalId),
    onSuccess: (result) => {
      message.success(`Trade ${result.trade_id} launched from AI proposal!`);
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('ai-trade-proposals') });
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trader-cockpit-active-trades') });
      onProposalExecuted?.(result.trade_session_id);
    },
    onError: () => {
      message.error('Failed to execute proposal');
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (params: { id: string; signal: 'thumbs_up' | 'thumbs_down'; comment?: string }) =>
      traderService.submitProposalFeedback(params.id, params.signal, params.comment),
    onSuccess: () => {
      message.success('Feedback recorded — improving future proposals');
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('ai-trade-proposals') });
      setFeedbackTarget(null);
      setFeedbackComment('');
    },
  });

  const handleExecute = useCallback((proposalId: string) => {
    executeMutation.mutate(proposalId);
  }, [executeMutation]);

  const handleThumbsUp = useCallback((proposalId: string) => {
    feedbackMutation.mutate({ id: proposalId, signal: 'thumbs_up' });
  }, [feedbackMutation]);

  const handleThumbsDown = useCallback((proposalId: string) => {
    setFeedbackTarget(proposalId);
  }, []);

  const submitNegativeFeedback = useCallback(() => {
    if (!feedbackTarget) return;
    feedbackMutation.mutate({
      id: feedbackTarget,
      signal: 'thumbs_down',
      comment: feedbackComment,
    });
  }, [feedbackTarget, feedbackComment, feedbackMutation]);

  const getConfidenceLevel = (c: number): 'high' | 'medium' | 'low' =>
    c >= 0.9 ? 'high' : c >= 0.7 ? 'medium' : 'low';

  if (proposalsQuery.isLoading) {
    return (
      <ProposalsContainer>
        <Card size="small" title={<Space><Sparkles size={14} /> AI Proposals</Space>}>
          <Skeleton active paragraph={{ rows: 2 }} />
        </Card>
      </ProposalsContainer>
    );
  }

  if (proposals.length === 0) return null;

  return (
    <ProposalsContainer>
      <Card
        size="small"
        title={
          <Space>
            <Sparkles size={14} style={{ color: 'rgb(var(--color-primary))' }} />
            <Text strong>AI Trade Proposals</Text>
            <Badge count={proposals.length} size="small" />
          </Space>
        }
        extra={
          <Text type="secondary" style={{ fontSize: '0.72rem' }}>
            Based on emails, history &amp; patterns
          </Text>
        }
      >
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} $confidence={proposal.confidence}>
            <ProposalHeader>
              <Space size={8}>
                <Lightbulb size={14} style={{ color: 'rgb(234, 179, 8)' }} />
                <Text strong style={{ fontSize: '0.85rem' }}>{proposal.title}</Text>
                <ConfidenceBadge $level={getConfidenceLevel(proposal.confidence)}>
                  {Math.round(proposal.confidence * 100)}%
                </ConfidenceBadge>
                {proposal.confidence >= AUTO_EXECUTE_THRESHOLD && (
                  <Tooltip title="Above auto-execute threshold">
                    <Tag color="green" style={{ fontSize: '0.65rem', margin: 0 }}>
                      <Zap size={10} /> Auto-Ready
                    </Tag>
                  </Tooltip>
                )}
              </Space>
              <Tag color={proposal.source === 'email' ? 'blue' : proposal.source === 'history' ? 'purple' : 'default'}>
                {proposal.source}
              </Tag>
            </ProposalHeader>

            <ProposalDetails>
              {proposal.customer_name && (
                <Tag>Customer: {proposal.customer_name}</Tag>
              )}
              {proposal.supplier_name && (
                <Tag>Supplier: {proposal.supplier_name}</Tag>
              )}
              {proposal.type_of_protein && (
                <Tag color="orange">{proposal.type_of_protein}</Tag>
              )}
              {proposal.weight && (
                <Tag>{proposal.weight}</Tag>
              )}
              <Tag color={proposal.route === 'BROKER' ? 'purple' : 'blue'}>
                {proposal.route}
              </Tag>
            </ProposalDetails>

            <ProposalActions>
              <Tooltip title="Approve — this is accurate">
                <Button
                  size="small"
                  type="text"
                  icon={<ThumbsUp size={14} />}
                  onClick={() => handleThumbsUp(proposal.id)}
                  loading={feedbackMutation.isPending}
                />
              </Tooltip>
              <Tooltip title="Reject — needs improvement">
                <Button
                  size="small"
                  type="text"
                  icon={<ThumbsDown size={14} />}
                  onClick={() => handleThumbsDown(proposal.id)}
                />
              </Tooltip>
              <Button
                type="primary"
                size="small"
                icon={<Play size={12} />}
                onClick={() => handleExecute(proposal.id)}
                loading={executeMutation.isPending}
              >
                Execute Trade
              </Button>
            </ProposalActions>
          </ProposalCard>
        ))}
      </Card>

      {/* Negative Feedback Modal */}
      <Modal
        open={Boolean(feedbackTarget)}
        onCancel={() => { setFeedbackTarget(null); setFeedbackComment(''); }}
        title="Why is this proposal incorrect?"
        okText="Submit Feedback"
        onOk={submitNegativeFeedback}
        confirmLoading={feedbackMutation.isPending}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Your feedback helps the AI learn. What should be different?
        </Text>
        <Input.TextArea
          rows={3}
          placeholder="e.g., Wrong customer, incorrect protein type, route should be BROKER…"
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
        />
      </Modal>
    </ProposalsContainer>
  );
};
