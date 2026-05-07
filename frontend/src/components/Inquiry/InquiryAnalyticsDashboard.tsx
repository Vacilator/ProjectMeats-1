/**
 * InquiryAnalyticsDashboard
 * 
 * Win/Loss reporting dashboard for inquiry analytics.
 * Features:
 * - Win rate metrics
 * - Value tracking (won/lost)
 * - Trend charts
 * - Competitor analysis
 * - Source breakdown
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsData {
  period: string;
  date_range: {
    start: string;
    end: string;
  };
  summary: {
    total_inquiries: number;
    pending: number;
    won: number;
    lost: number;
    win_rate: number;
    total_won_value: number;
    total_lost_value: number;
    avg_deal_size: number;
    avg_days_to_close: number | null;
  };
  status_distribution: Array<{ status: string; count: number }>;
  trend: Array<{
    week: string;
    total: number;
    accepted: number;
    rejected: number;
  }>;
  source_breakdown: Array<{
    source_type: string;
    count: number;
    won: number;
  }>;
  top_competitors: Array<{ name: string; count: number }>;
  recent_win_reasons: string[];
  recent_loss_reasons: string[];
}

interface InquiryAnalyticsDashboardProps {
  entityType?: 'supplier' | 'customer';
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 1.5rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PeriodSelector = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const PeriodButton = styled.button<{ $active: boolean }>`
  padding: 0.5rem 1rem;
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const MetricCard = styled.div<{ $variant?: 'success' | 'danger' | 'primary' | 'warning' }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  
  .label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgb(var(--color-text-secondary));
    margin-bottom: 0.5rem;
  }
  
  .value {
    font-size: 1.75rem;
    font-weight: 700;
    color: ${props => {
      switch (props.$variant) {
        case 'success': return 'rgb(var(--color-success))';
        case 'danger': return 'rgb(var(--color-error))';
        case 'primary': return 'rgb(var(--color-primary))';
        case 'warning': return 'rgb(var(--color-warning))';
        default: return 'rgb(var(--color-text-primary))';
      }
    }};
  }
  
  .subtext {
    font-size: 0.75rem;
    color: rgb(var(--color-text-secondary));
    margin-top: 0.25rem;
  }
`;

const WinRateCard = styled(MetricCard)`
  position: relative;
  overflow: hidden;
  
  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    background: rgb(var(--color-success));
    transition: width 0.5s ease;
  }
`;

const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
`;

const Section = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1.25rem;
`;

const SectionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TrendChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 120px;
  padding-top: 1rem;
`;

const TrendBar = styled.div<{ $height: number; $variant: 'total' | 'won' | 'lost' }>`
  flex: 1;
  min-width: 30px;
  height: ${props => props.$height}%;
  background: ${props => {
    switch (props.$variant) {
      case 'won': return 'rgb(var(--color-success))';
      case 'lost': return 'rgb(var(--color-error))';
      default: return 'rgba(var(--color-primary), 0.3)';
    }
  }};
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: height 0.3s ease;
  position: relative;
  
  &:hover {
    opacity: 0.8;
  }
`;

const TrendLegend = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
  
  .item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
`;

const SourceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SourceItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  
  .icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--color-primary), 0.1);
    border-radius: var(--radius-sm);
    font-size: 1rem;
  }
  
  .info {
    flex: 1;
    
    .name {
      font-size: 0.875rem;
      font-weight: 500;
      color: rgb(var(--color-text-primary));
    }
    
    .stats {
      font-size: 0.75rem;
      color: rgb(var(--color-text-secondary));
    }
  }
  
  .count {
    font-size: 1rem;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
  }
`;

const CompetitorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CompetitorItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: rgba(var(--color-primary), 0.05);
  border-radius: var(--radius-sm);
  
  .name {
    font-size: 0.875rem;
    color: rgb(var(--color-text-primary));
  }
  
  .count {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-xs);
  }
`;

const ReasonsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
`;

const ReasonItem = styled.div<{ $variant: 'win' | 'loss' }>`
  padding: 0.5rem 0.75rem;
  background: ${props => props.$variant === 'win' 
    ? 'rgba(var(--color-success), 0.05)' 
    : 'rgba(var(--color-error), 0.05)'};
  border-left: 3px solid ${props => props.$variant === 'win' 
    ? 'rgb(var(--color-success))' 
    : 'rgb(var(--color-error))'};
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 0.8125rem;
  color: rgb(var(--color-text-primary));
`;

const StatusDistribution = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  background: ${props => {
    switch (props.$status) {
      case 'draft': return 'rgba(156, 163, 175, 0.1)';
      case 'pending': return 'rgba(var(--color-warning), 0.1)';
      case 'quoted': return 'rgba(var(--color-info), 0.1)';
      case 'accepted': return 'rgba(var(--color-success), 0.1)';
      case 'rejected': return 'rgba(var(--color-error), 0.1)';
      case 'fulfilled': return 'rgba(147, 51, 234, 0.1)';
      case 'cancelled': return 'rgba(var(--color-neutral), 0.1)';
      default: return 'rgba(156, 163, 175, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'draft': return 'rgb(var(--color-neutral))';
      case 'pending': return 'rgb(180, 83, 9)';
      case 'quoted': return 'rgb(var(--color-info))';
      case 'accepted': return 'rgb(var(--color-success))';
      case 'rejected': return 'rgb(var(--color-error))';
      case 'fulfilled': return 'rgb(126, 34, 206)';
      case 'cancelled': return 'rgb(var(--color-neutral))';
      default: return 'rgb(var(--color-neutral))';
    }
  }};
  
  .count {
    margin-left: 0.5rem;
    font-weight: 700;
  }
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getSourceIcon = (source: string): string => {
  switch (source) {
    case 'scheduled_call': return '📞';
    case 'inbound_call': return '📲';
    case 'email': return '📧';
    case 'website': return '🌐';
    case 'trade_show': return '🎪';
    case 'referral': return '🤝';
    default: return '📋';
  }
};

const formatSourceName = (source: string): string => {
  return source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ============================================================================
// Component
// ============================================================================

export const InquiryAnalyticsDashboard: React.FC<InquiryAnalyticsDashboardProps> = ({
  entityType,
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { period };
      if (entityType) params.entity_type = entityType;
      
      const response = await apiClient.get('/inquiries/analytics/', { params });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [period, entityType]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return (
      <Container>
        <LoadingState>Loading analytics...</LoadingState>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container>
        <EmptyState>Failed to load analytics data</EmptyState>
      </Container>
    );
  }

  const maxTrendValue = Math.max(
    ...data.trend.map(t => t.total),
    1
  );

  return (
    <Container>
      <Header>
        <Title>📊 Win/Loss Analytics</Title>
        <PeriodSelector>
          {(['week', 'month', 'quarter', 'year'] as const).map(p => (
            <PeriodButton
              key={p}
              $active={period === p}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </PeriodButton>
          ))}
        </PeriodSelector>
      </Header>

      {/* Key Metrics */}
      <MetricsGrid>
        <MetricCard>
          <div className="label">Total Inquiries</div>
          <div className="value">{data.summary.total_inquiries}</div>
          <div className="subtext">{data.summary.pending} pending</div>
        </MetricCard>
        
        <WinRateCard $variant="success">
          <div className="label">Win Rate</div>
          <div className="value">{data.summary.win_rate}%</div>
          <div className="subtext">
            {data.summary.won} won / {data.summary.lost} lost
          </div>
          <div className="progress-bar" style={{ width: `${data.summary.win_rate}%` }} />
        </WinRateCard>
        
        <MetricCard $variant="success">
          <div className="label">Total Won Value</div>
          <div className="value">{formatCurrency(data.summary.total_won_value)}</div>
          <div className="subtext">Avg: {formatCurrency(data.summary.avg_deal_size)}</div>
        </MetricCard>
        
        <MetricCard $variant="danger">
          <div className="label">Total Lost Value</div>
          <div className="value">{formatCurrency(data.summary.total_lost_value)}</div>
        </MetricCard>
        
        {data.summary.avg_days_to_close && (
          <MetricCard>
            <div className="label">Avg. Days to Close</div>
            <div className="value">{data.summary.avg_days_to_close}</div>
            <div className="subtext">days</div>
          </MetricCard>
        )}
      </MetricsGrid>

      <SectionGrid>
        {/* Trend Chart */}
        <Section>
          <SectionTitle>📈 Weekly Trend</SectionTitle>
          {data.trend.length > 0 ? (
            <>
              <TrendChart>
                {data.trend.map((week, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'stretch' }}>
                    <TrendBar 
                      $height={(week.accepted / maxTrendValue) * 100} 
                      $variant="won"
                      title={`Won: ${week.accepted}`}
                    />
                    <TrendBar 
                      $height={(week.rejected / maxTrendValue) * 100} 
                      $variant="lost"
                      title={`Lost: ${week.rejected}`}
                    />
                  </div>
                ))}
              </TrendChart>
              <TrendLegend>
                <span className="item">
                  <span className="dot" style={{ background: 'rgb(var(--color-success))' }} />
                  Won
                </span>
                <span className="item">
                  <span className="dot" style={{ background: 'rgb(var(--color-error))' }} />
                  Lost
                </span>
              </TrendLegend>
            </>
          ) : (
            <EmptyState>No trend data available</EmptyState>
          )}
        </Section>

        {/* Status Distribution */}
        <Section>
          <SectionTitle>📊 Status Distribution</SectionTitle>
          <StatusDistribution>
            {data.status_distribution.map(item => (
              <StatusBadge key={item.status} $status={item.status}>
                {item.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                <span className="count">{item.count}</span>
              </StatusBadge>
            ))}
          </StatusDistribution>
        </Section>

        {/* Source Breakdown */}
        <Section>
          <SectionTitle>📥 Inquiry Sources</SectionTitle>
          {data.source_breakdown.length > 0 ? (
            <SourceList>
              {data.source_breakdown.map(source => (
                <SourceItem key={source.source_type}>
                  <span className="icon">{getSourceIcon(source.source_type)}</span>
                  <div className="info">
                    <div className="name">{formatSourceName(source.source_type)}</div>
                    <div className="stats">
                      {source.won} won ({source.count > 0 ? Math.round((source.won / source.count) * 100) : 0}% win rate)
                    </div>
                  </div>
                  <span className="count">{source.count}</span>
                </SourceItem>
              ))}
            </SourceList>
          ) : (
            <EmptyState>No source data available</EmptyState>
          )}
        </Section>

        {/* Top Competitors */}
        <Section>
          <SectionTitle>🏆 Top Competitors</SectionTitle>
          {data.top_competitors.length > 0 ? (
            <CompetitorList>
              {data.top_competitors.map((comp, idx) => (
                <CompetitorItem key={idx}>
                  <span className="name">{comp.name}</span>
                  <span className="count">{comp.count} deals</span>
                </CompetitorItem>
              ))}
            </CompetitorList>
          ) : (
            <EmptyState>No competitor data tracked</EmptyState>
          )}
        </Section>

        {/* Win Reasons */}
        <Section>
          <SectionTitle>✅ Recent Win Reasons</SectionTitle>
          {data.recent_win_reasons.length > 0 ? (
            <ReasonsList>
              {data.recent_win_reasons.map((reason, idx) => (
                <ReasonItem key={idx} $variant="win">
                  {reason}
                </ReasonItem>
              ))}
            </ReasonsList>
          ) : (
            <EmptyState>No win reasons recorded</EmptyState>
          )}
        </Section>

        {/* Loss Reasons */}
        <Section>
          <SectionTitle>❌ Recent Loss Reasons</SectionTitle>
          {data.recent_loss_reasons.length > 0 ? (
            <ReasonsList>
              {data.recent_loss_reasons.map((reason, idx) => (
                <ReasonItem key={idx} $variant="loss">
                  {reason}
                </ReasonItem>
              ))}
            </ReasonsList>
          ) : (
            <EmptyState>No loss reasons recorded</EmptyState>
          )}
        </Section>
      </SectionGrid>
    </Container>
  );
};

export default InquiryAnalyticsDashboard;
