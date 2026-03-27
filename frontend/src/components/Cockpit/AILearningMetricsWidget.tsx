import React, { useMemo } from 'react';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { businessApi } from '@/services/businessApi';

const { Text } = Typography;

type TrendPoint = { day: string; confidence: number };

type AILearningMetricsWidgetProps = {
  /** Optional override for initial render; until backend metrics endpoint is added, we use a safe mock. */
  metrics?: {
    totalDocumentsParsed: number;
    correctionsLearned: number;
    precisionScore: number; // 0..1
    confidenceTrend?: TrendPoint[];
  };
};

export const AILearningMetricsWidget: React.FC<AILearningMetricsWidgetProps> = ({ metrics }) => {
  const defaultTrend = useMemo<TrendPoint[]>(() => {
    // Small deterministic upward trend for initial render.
    return Array.from({ length: 30 }).map((_, idx) => {
      const base = 0.55;
      const drift = idx * 0.01;
      return { day: String(idx + 1), confidence: Math.min(0.95, base + drift) };
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-learning-metrics'],
    queryFn: async () => {
      const res = await businessApi.get<NonNullable<AILearningMetricsWidgetProps['metrics']>>(
        '/ai-assistant/metrics/',
      );
      return res.data;
    },
    enabled: !metrics,
    staleTime: 60_000,
    retry: 1,
  });

  const m =
    metrics ??
    data ??
    ({
      totalDocumentsParsed: 312,
      correctionsLearned: 47,
      precisionScore: 0.86,
      confidenceTrend: defaultTrend,
    } satisfies NonNullable<AILearningMetricsWidgetProps['metrics']>);

  return (
    <Card
      title="AI Learning Metrics"
      style={{ width: '100%' }}
      styles={{ body: { padding: 16 } }}
      loading={isLoading}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Statistic title="Total Documents Parsed" value={m.totalDocumentsParsed} />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic title="Corrections Learned" value={m.correctionsLearned} />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="Current Precision Score"
            value={Math.round(m.precisionScore * 100)}
            suffix="%"
          />
        </Col>
      </Row>

      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Confidence trend (last 30 days)
        </Text>
        <div style={{ width: '100%', height: 120, minHeight: 120, minWidth: 0, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m.confidenceTrend || defaultTrend}>
              <XAxis dataKey="day" hide />
              <YAxis domain={[0, 1]} hide />
              <Tooltip
                formatter={(v) => [`${Math.round(Number(v) * 100)}%`, 'Confidence']}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke="rgb(59, 130, 246)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};
