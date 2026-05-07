/**
 * Performance Monitoring Overlay (Development Only)
 * 
 * Displays real-time performance metrics in dev mode:
 * - Core Web Vitals (LCP, FID)
 * - Memory usage
 * - Network requests
 * - Long tasks
 */

import React, { useState } from 'react';
import { Card, Typography, Space, Button, Statistic, Row, Col, Tag } from 'antd';
import { Activity, X, TrendingUp, TrendingDown } from 'lucide-react';
import { usePerformanceDashboard } from '../../hooks/usePerformanceMonitoring';

const { Text } = Typography;

export const PerformanceOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { lcp, fid, memoryUsage, networkMetrics } = usePerformanceDashboard();
  
  // Only show in development
  const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';
  if (!isDev) return null;

  if (!visible) {
    return (
      <Button
        type="primary"
        icon={<Activity size={16} />}
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          borderRadius: 20
        }}
      >
        Performance
      </Button>
    );
  }

  // Determine LCP status
  const lcpStatus = !lcp ? 'unknown' : lcp < 2500 ? 'good' : lcp < 4000 ? 'needs-improvement' : 'poor';
  const lcpColor = lcpStatus === 'good' ? 'rgb(var(--color-success))' : lcpStatus === 'needs-improvement' ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))';

  // Determine FID status
  const fidStatus = !fid ? 'unknown' : fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor';
  const fidColor = fidStatus === 'good' ? 'rgb(var(--color-success))' : fidStatus === 'needs-improvement' ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))';

  // Memory status
  const memoryStatus = !memoryUsage ? 'unknown' : memoryUsage < 50 ? 'good' : memoryUsage < 100 ? 'needs-improvement' : 'poor';
  const memoryColor = memoryStatus === 'good' ? 'rgb(var(--color-success))' : memoryStatus === 'needs-improvement' ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))';

  return (
    <Card
      title={
        <Space>
          <Activity size={16} />
          <Text strong>Performance Metrics</Text>
        </Space>
      }
      extra={
        <Button
          type="text"
          icon={<X size={16} />}
          onClick={() => setVisible(false)}
        />
      }
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 400,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxHeight: 'calc(100vh - 40px)',
        overflow: 'auto'
      }}
      size="small"
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Core Web Vitals */}
        <Card type="inner" title="Core Web Vitals" size="small">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="LCP (Largest Contentful Paint)"
                value={lcp ? (lcp / 1000).toFixed(2) : '--'}
                suffix="s"
                valueStyle={{ color: lcpColor, fontSize: 18 }}
                prefix={
                  lcpStatus === 'good' ? <TrendingUp size={14} /> :
                  lcpStatus === 'poor' ? <TrendingDown size={14} /> : null
                }
              />
              <Tag color={lcpStatus === 'good' ? 'success' : lcpStatus === 'needs-improvement' ? 'warning' : 'error'}>
                {lcpStatus}
              </Tag>
            </Col>
            <Col span={12}>
              <Statistic
                title="FID (First Input Delay)"
                value={fid ? fid.toFixed(0) : '--'}
                suffix="ms"
                valueStyle={{ color: fidColor, fontSize: 18 }}
                prefix={
                  fidStatus === 'good' ? <TrendingUp size={14} /> :
                  fidStatus === 'poor' ? <TrendingDown size={14} /> : null
                }
              />
              <Tag color={fidStatus === 'good' ? 'success' : fidStatus === 'needs-improvement' ? 'warning' : 'error'}>
                {fidStatus}
              </Tag>
            </Col>
          </Row>
        </Card>

        {/* Memory Usage */}
        <Card type="inner" title="Memory" size="small">
          <Statistic
            title="JS Heap Size"
            value={memoryUsage ? memoryUsage.toFixed(2) : '--'}
            suffix="MB"
            valueStyle={{ color: memoryColor }}
          />
          <Tag color={memoryStatus === 'good' ? 'success' : memoryStatus === 'needs-improvement' ? 'warning' : 'error'}>
            {memoryStatus}
          </Tag>
        </Card>

        {/* Network Metrics */}
        <Card type="inner" title="Network" size="small">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">Requests:</Text>
                <br />
                <Text strong>{networkMetrics.requestCount}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Avg Latency:</Text>
                <br />
                <Text strong>{networkMetrics.avgLatency.toFixed(0)}ms</Text>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">Transfer:</Text>
                <br />
                <Text strong>{(networkMetrics.totalTransferSize / 1024 / 1024).toFixed(2)}MB</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Failed:</Text>
                <br />
                <Text strong style={{ color: networkMetrics.failedRequests > 0 ? 'rgb(var(--color-error))' : 'rgb(var(--color-success))' }}>
                  {networkMetrics.failedRequests}
                </Text>
              </Col>
            </Row>
          </Space>
        </Card>

        {/* Recommendations */}
        {(lcpStatus !== 'good' || fidStatus !== 'good' || memoryStatus !== 'good') && (
          <Card type="inner" title="Recommendations" size="small">
            <Space direction="vertical" size="small">
              {lcpStatus !== 'good' && (
                <Text type="warning">• Optimize images and defer offscreen content</Text>
              )}
              {fidStatus !== 'good' && (
                <Text type="warning">• Reduce JavaScript execution time</Text>
              )}
              {memoryStatus !== 'good' && (
                <Text type="danger">• Potential memory leak detected</Text>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );
};
