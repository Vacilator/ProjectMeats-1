/**
 * AI Confidence Scoring Widget (AUTO-21.2)
 *
 * Displays AI parsing confidence metrics for email ingestion:
 * - Average confidence (last 30 days)
 * - Emails processed / action required counts
 * - High vs low confidence breakdown
 *
 * Theme Compliance:
 * - Uses CSS custom properties
 * - No hardcoded colors
 */
import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { businessApi } from '../../services/businessApi';
import { logger } from '../../utils/logger';

interface ConfidenceMetrics {
  average_confidence: number;
  total_processed: number;
  high_confidence_count: number;
  low_confidence_count: number;
  action_required_count: number;
  auto_processed_count: number;
}

const DEFAULT_METRICS: ConfidenceMetrics = {
  average_confidence: 0,
  total_processed: 0,
  high_confidence_count: 0,
  low_confidence_count: 0,
  action_required_count: 0,
  auto_processed_count: 0,
};

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const MetricCard = styled.div<{ $accent: string }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-left: 3px solid ${props => props.$accent};
`;

const MetricValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const MetricLabel = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ConfidenceBar = styled.div`
  margin-top: 12px;
  padding: 12px;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
`;

const BarTrack = styled.div`
  height: 8px;
  border-radius: 4px;
  background: rgb(var(--color-border));
  overflow: hidden;
  margin-top: 8px;
`;

const BarFill = styled.div<{ $width: number; $color: string }>`
  height: 100%;
  width: ${props => props.$width}%;
  background: ${props => props.$color};
  border-radius: 4px;
  transition: width 0.5s ease;
`;

const BarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BarTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
`;

const BarPercent = styled.span<{ $color: string }>`
  font-size: 14px;
  font-weight: 700;
  color: ${props => props.$color};
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

function getConfidenceColor(score: number): string {
  if (score >= 0.98) return 'rgb(var(--color-success))';
  if (score >= 0.90) return 'rgb(var(--color-warning))';
  return 'rgb(var(--color-error))';
}

export const ConfidenceScoringWidget: React.FC = () => {
  const [metrics, setMetrics] = useState<ConfidenceMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await businessApi.get('ai-assistant/confidence-metrics/');
      setMetrics(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // API not deployed yet — show zeros gracefully
        setMetrics(DEFAULT_METRICS);
      } else {
        setError('Failed to load metrics');
        logger.error('ConfidenceScoringWidget fetch error', { component: 'ConfidenceScoringWidget' }, err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000); // refresh every 5min
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const avgPct = Math.round(metrics.average_confidence * 100);
  const confidenceColor = getConfidenceColor(metrics.average_confidence);

  return (
    <WidgetCard
      title="AI Confidence"
      icon={<Brain size={16} />}
      loading={loading}
      error={error}
      onRefresh={fetchMetrics}
      actions={
        <button
          onClick={fetchMetrics}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'rgb(var(--color-text-tertiary))',
          }}
          aria-label="Refresh confidence metrics"
        >
          <RefreshCw size={14} />
        </button>
      }
    >
      <ConfidenceBar>
        <BarHeader>
          <BarTitle>Average Confidence</BarTitle>
          <BarPercent $color={confidenceColor}>{avgPct}%</BarPercent>
        </BarHeader>
        <BarTrack>
          <BarFill $width={avgPct} $color={confidenceColor} />
        </BarTrack>
        <StatusRow>
          {avgPct >= 98 ? (
            <><CheckCircle size={12} /> Auto-processing enabled</>
          ) : avgPct >= 90 ? (
            <><TrendingUp size={12} /> Near threshold (98%)</>
          ) : (
            <><AlertTriangle size={12} /> Below threshold — human review active</>
          )}
        </StatusRow>
      </ConfidenceBar>

      <MetricsGrid>
        <MetricCard $accent="rgb(var(--color-success))">
          <MetricValue>{metrics.auto_processed_count}</MetricValue>
          <MetricLabel>Auto-processed</MetricLabel>
        </MetricCard>
        <MetricCard $accent="rgb(var(--color-warning))">
          <MetricValue>{metrics.action_required_count}</MetricValue>
          <MetricLabel>Needs Review</MetricLabel>
        </MetricCard>
        <MetricCard $accent="rgb(var(--color-info))">
          <MetricValue>{metrics.total_processed}</MetricValue>
          <MetricLabel>Total Processed</MetricLabel>
        </MetricCard>
        <MetricCard $accent="rgb(var(--color-primary))">
          <MetricValue>{metrics.high_confidence_count}</MetricValue>
          <MetricLabel>High Confidence</MetricLabel>
        </MetricCard>
      </MetricsGrid>
    </WidgetCard>
  );
};

export default ConfidenceScoringWidget;
