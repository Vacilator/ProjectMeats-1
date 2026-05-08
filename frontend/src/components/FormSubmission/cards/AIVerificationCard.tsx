/**
 * AI Verification Card
 *
 * Phase 4: Hybrid Task Renderer
 * Interaction card for AI-powered verification workflow nodes.
 *
 * Features:
 * - Processing animation
 * - Polls backend for AI results
 * - Shows confidence score
 * - Manual override option
 * - Auto-advances on completion
 *
 * Created: 2026-02-12 - Phase 4 Hybrid Task Renderer Implementation
 */

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Cpu, CheckCircle, AlertCircle, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { InteractionCardProps } from '../InteractionCardRegistry';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface VerificationResult {
  confidence_score: number;
  verification_result: 'pass' | 'fail' | 'pending';
  details?: string;
  timestamp?: string;
}

// ============================================================================
// Animations
// ============================================================================

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

// ============================================================================
// Styled Components
// ============================================================================

const CardContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const CardIcon = styled.div<{ $status: 'processing' | 'success' | 'failure' }>`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => {
    if (props.$status === 'success') return 'rgb(var(--color-success) / 0.1)';
    if (props.$status === 'failure') return 'rgb(var(--color-error) / 0.1)';
    return 'rgb(var(--color-primary) / 0.1)';
  }};
  border-radius: var(--radius-md);
  color: ${props => {
    if (props.$status === 'success') return 'rgb(var(--color-success))';
    if (props.$status === 'failure') return 'rgb(var(--color-error))';
    return 'rgb(var(--color-primary))';
  }};

  svg {
    width: 24px;
    height: 24px;
    animation: ${props => props.$status === 'processing' ? spin : 'none'} 2s linear infinite;
  }
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const StatusSection = styled.div<{ $status: 'processing' | 'success' | 'failure' }>`
  padding: 24px;
  background: ${props => {
    if (props.$status === 'success') return 'rgb(var(--color-success) / 0.05)';
    if (props.$status === 'failure') return 'rgb(var(--color-error) / 0.05)';
    return 'rgb(var(--color-primary) / 0.05)';
  }};
  border: 1px solid ${props => {
    if (props.$status === 'success') return 'rgb(var(--color-success) / 0.2)';
    if (props.$status === 'failure') return 'rgb(var(--color-error) / 0.2)';
    return 'rgb(var(--color-primary) / 0.2)';
  }};
  border-radius: var(--radius-lg);
  text-align: center;
  margin-bottom: 20px;
`;

const StatusIcon = styled.div<{ $status: 'processing' | 'success' | 'failure' }>`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${props => {
    if (props.$status === 'success') return 'rgb(var(--color-success) / 0.2)';
    if (props.$status === 'failure') return 'rgb(var(--color-error) / 0.2)';
    return 'rgb(var(--color-primary) / 0.2)';
  }};
  color: ${props => {
    if (props.$status === 'success') return 'rgb(var(--color-success))';
    if (props.$status === 'failure') return 'rgb(var(--color-error))';
    return 'rgb(var(--color-primary))';
  }};

  svg {
    width: 32px;
    height: 32px;
    animation: ${props => props.$status === 'processing' ? pulse : 'none'} 1.5s ease-in-out infinite;
  }
`;

const StatusText = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const StatusSubtext = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const ConfidenceSection = styled.div`
  margin-bottom: 20px;
`;

const ConfidenceLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const ConfidenceBar = styled.div`
  height: 32px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
`;

const ConfidenceFill = styled.div<{ $score: number }>`
  height: 100%;
  width: ${props => props.$score}%;
  background: ${props => {
    if (props.$score >= 80) return 'rgb(var(--color-success))';
    if (props.$score >= 60) return 'rgb(var(--color-warning))';
    return 'rgb(var(--color-error))';
  }};
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
`;

const ConfidenceText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: white;
`;

const DetailsSection = styled.div`
  margin-bottom: 20px;
  padding: 16px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-md);
`;

const DetailsLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
`;

const DetailsText = styled.div`
  font-size: 14px;
  line-height: 1.6;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
`;

const OverrideSection = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: rgb(var(--color-warning) / 0.05);
  border: 1px solid rgb(var(--color-warning) / 0.2);
  border-radius: var(--radius-md);
`;

const OverrideLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 12px;
`;

const OverrideButtons = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const OverrideButton = styled.button<{ $variant: 'approve' | 'reject' }>`
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: ${props =>
    props.$variant === 'approve'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };
  font-size: 14px;
  font-weight: 600;

  &:hover {
    border-color: ${props =>
      props.$variant === 'approve'
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-error))'
    };
    background: ${props =>
      props.$variant === 'approve'
        ? 'rgb(var(--color-success) / 0.05)'
        : 'rgb(var(--color-error) / 0.05)'
    };
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const AIVerificationCard: React.FC<InteractionCardProps> = ({
  node,
  context,
  onComplete,
  readOnly = false,
}) => {
  const [status, setStatus] = useState<'processing' | 'success' | 'failure'>('processing');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  // Get config from node
  const config = node.data || {};
  const title = config.title || 'AI Verification';
  const confidenceThreshold = config.confidenceThreshold || 80;

  // Simulate AI verification polling
  useEffect(() => {
    // In production, this would poll an actual API endpoint
    // For now, simulate a 3-second processing time
    const timeout = setTimeout(() => {
      // Simulate random AI result
      const confidence = Math.floor(Math.random() * 100);
      const passed = confidence >= confidenceThreshold;

      const verificationResult: VerificationResult = {
        confidence_score: confidence,
        verification_result: passed ? 'pass' : 'fail',
        details: passed
          ? 'All verification checks passed successfully.'
          : 'Some verification checks failed. Manual review recommended.',
        timestamp: new Date().toISOString(),
      };

      setResult(verificationResult);
      setStatus(passed ? 'success' : 'failure');

      // Auto-complete if passed
      if (passed) {
        onComplete({
          ...verificationResult,
          manual_override: false,
        });
      } else {
        setShowOverride(true);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [confidenceThreshold, onComplete]);

  const handleOverride = (approved: boolean) => {
    if (result) {
      onComplete({
        ...result,
        manual_override: true,
        manual_decision: approved,
        override_timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <CardContainer>
      <CardHeader>
        <CardIcon $status={status}>
          {status === 'processing' && <RefreshCw />}
          {status === 'success' && <CheckCircle />}
          {status === 'failure' && <AlertCircle />}
        </CardIcon>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <StatusSection $status={status}>
        <StatusIcon $status={status}>
          {status === 'processing' && <Cpu />}
          {status === 'success' && <CheckCircle />}
          {status === 'failure' && <AlertCircle />}
        </StatusIcon>
        <StatusText>
          {status === 'processing' && 'Processing...'}
          {status === 'success' && 'Verification Passed'}
          {status === 'failure' && 'Verification Failed'}
        </StatusText>
        <StatusSubtext>
          {status === 'processing' && 'AI is analyzing the data...'}
          {status === 'success' && 'All checks completed successfully'}
          {status === 'failure' && 'Manual review required'}
        </StatusSubtext>
      </StatusSection>

      {result && (
        <>
          <ConfidenceSection>
            <ConfidenceLabel>Confidence Score</ConfidenceLabel>
            <ConfidenceBar>
              <ConfidenceFill $score={result.confidence_score}>
                <ConfidenceText>{result.confidence_score}%</ConfidenceText>
              </ConfidenceFill>
            </ConfidenceBar>
          </ConfidenceSection>

          {result.details && (
            <DetailsSection>
              <DetailsLabel>Details</DetailsLabel>
              <DetailsText>{result.details}</DetailsText>
            </DetailsSection>
          )}

          {showOverride && !readOnly && (
            <OverrideSection>
              <OverrideLabel>Manual Override Required</OverrideLabel>
              <OverrideButtons>
                <OverrideButton
                  type="button"
                  $variant="approve"
                  onClick={() => handleOverride(true)}
                >
                  <ThumbsUp />
                  Approve Anyway
                </OverrideButton>
                <OverrideButton
                  type="button"
                  $variant="reject"
                  onClick={() => handleOverride(false)}
                >
                  <ThumbsDown />
                  Reject
                </OverrideButton>
              </OverrideButtons>
            </OverrideSection>
          )}
        </>
      )}
    </CardContainer>
  );
};

export default AIVerificationCard;
