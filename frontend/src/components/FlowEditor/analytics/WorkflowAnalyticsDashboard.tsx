/**
 * Workflow Analytics Dashboard
 * 
 * Real-time metrics, charts, and insights for workflow execution.
 * Shows success rates, duration trends, action performance, and error analysis.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Space,
  Typography,
  Select,
  DatePicker,
  Spin,
  Empty,
  Tag,
  Tooltip
} from 'antd';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import { businessApi } from '../../../services/businessApi';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface WorkflowMetrics {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  avg_duration_seconds: number;
  success_rate: number;
  executions_by_day: Array<{
    date: string;
    count: number;
    successful: number;
    failed: number;
  }>;
  executions_by_hour: Array<{
    hour: number;
    count: number;
  }>;
  action_performance: Array<{
    action_type: string;
    count: number;
    avg_duration: number;
    success_rate: number;
  }>;
  error_breakdown: Array<{
    error_type: string;
    count: number;
    percentage: number;
  }>;
}

interface WorkflowAnalyticsDashboardProps {
  workflowId?: string;
  dateRange?: [Date, Date];
}

const STATUS_COLORS = {
  success: 'rgb(34, 197, 94)',
  failure: 'rgb(239, 68, 68)',
  pending: 'rgb(234, 179, 8)',
  running: 'rgb(59, 130, 246)'
};

const CHART_COLORS = ['rgb(var(--color-primary))', 'rgb(var(--color-info))', 'rgb(var(--color-info))', 'rgb(var(--color-info))'];

export const WorkflowAnalyticsDashboard: React.FC<WorkflowAnalyticsDashboardProps> = ({
  workflowId,
  dateRange: initialDateRange
}) => {
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(workflowId);
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([]);
  const [dateRange, setDateRange] = useState<[Date, Date] | undefined>(initialDateRange);
  const [timeframe, setTimeframe] = useState<string>('30d');

  /**
   * Get current tenant ID from localStorage
   */
  const getTenantId = (): string | null => {
    return localStorage.getItem('tenantId');
  };

  // Fetch available workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      const tenantId = getTenantId();
      if (!tenantId) return;
      
      try {
        const response = await businessApi.get(`/tenants/${tenantId}/workflows/`);
        setWorkflows(response.data.results || []);
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
      }
    };

    fetchWorkflows();
  }, []);

  // Fetch analytics data
  useEffect(() => {
    const fetchMetrics = async () => {
      const tenantId = getTenantId();
      if (!tenantId || !selectedWorkflowId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params: any = {};
        
        if (dateRange) {
          params.start_date = dateRange[0].toISOString();
          params.end_date = dateRange[1].toISOString();
        } else {
          params.timeframe = timeframe;
        }

        const response = await businessApi.get(
          `/tenants/${tenantId}/workflows/${selectedWorkflowId}/analytics/`,
          { params }
        );
        
        setMetrics(response.data);
      } catch (error) {
        console.error('Failed to fetch workflow metrics:', error);
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedWorkflowId, dateRange, timeframe]);

  const renderKPIs = () => {
    if (!metrics) return null;

    const successRate = metrics.success_rate || 0;
    const avgDuration = metrics.avg_duration_seconds || 0;
    const totalExecutions = metrics.total_executions || 0;
    
    // Calculate trend (mock - would need historical data)
    const successTrend = successRate > 90 ? 'up' : successRate < 70 ? 'down' : 'stable';
    const durationTrend = avgDuration < 10 ? 'up' : avgDuration > 30 ? 'down' : 'stable';

    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Executions"
              value={totalExecutions}
              prefix={<Activity size={20} style={{ color: 'rgb(var(--color-primary))' }} />}
              valueStyle={{ color: 'rgb(var(--color-primary))' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Success Rate"
              value={successRate}
              precision={1}
              suffix="%"
              prefix={
                successTrend === 'up' ? (
                  <TrendingUp size={20} style={{ color: STATUS_COLORS.success }} />
                ) : successTrend === 'down' ? (
                  <TrendingDown size={20} style={{ color: STATUS_COLORS.failure }} />
                ) : (
                  <CheckCircle size={20} style={{ color: STATUS_COLORS.success }} />
                )
              }
              valueStyle={{ color: STATUS_COLORS.success }}
            />
            <Progress
              percent={successRate}
              strokeColor={STATUS_COLORS.success}
              trailColor={STATUS_COLORS.failure}
              showInfo={false}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={avgDuration}
              precision={2}
              suffix="s"
              prefix={
                durationTrend === 'up' ? (
                  <TrendingUp size={20} style={{ color: STATUS_COLORS.success }} />
                ) : durationTrend === 'down' ? (
                  <TrendingDown size={20} style={{ color: STATUS_COLORS.failure }} />
                ) : (
                  <Clock size={20} style={{ color: 'rgb(var(--color-primary))' }} />
                )
              }
              valueStyle={{ color: 'rgb(var(--color-primary))' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Failed Executions"
              value={metrics.failed_executions || 0}
              prefix={<XCircle size={20} style={{ color: STATUS_COLORS.failure }} />}
              valueStyle={{ color: STATUS_COLORS.failure }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {totalExecutions > 0
                ? `${((metrics.failed_executions / totalExecutions) * 100).toFixed(1)}% of total`
                : 'No executions'}
            </Text>
          </Card>
        </Col>
      </Row>
    );
  };

  const renderExecutionTrends = () => {
    if (!metrics?.executions_by_day?.length) return null;

    return (
      <Card title="Execution Trends" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics.executions_by_day}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="successful" 
              stroke={STATUS_COLORS.success} 
              name="Successful"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="failed" 
              stroke={STATUS_COLORS.failure} 
              name="Failed"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  };

  const renderHourlyDistribution = () => {
    if (!metrics?.executions_by_hour?.length) return null;

    return (
      <Card title="Execution Distribution (24h)" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={metrics.executions_by_hour}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="hour" 
              tickFormatter={(hour) => `${hour}:00`}
            />
            <YAxis />
            <RechartsTooltip />
            <Bar dataKey="count" fill="rgb(var(--color-primary))" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  };

  const renderActionPerformance = () => {
    if (!metrics?.action_performance?.length) return null;

    const columns = [
      {
        title: 'Action Type',
        dataIndex: 'action_type',
        key: 'action_type',
        render: (type: string) => (
          <Space>
            <Zap size={14} />
            <Text strong>{type}</Text>
          </Space>
        )
      },
      {
        title: 'Executions',
        dataIndex: 'count',
        key: 'count',
        sorter: (a: any, b: any) => a.count - b.count
      },
      {
        title: 'Avg Duration',
        dataIndex: 'avg_duration',
        key: 'avg_duration',
        render: (duration: number) => `${duration.toFixed(2)}s`,
        sorter: (a: any, b: any) => a.avg_duration - b.avg_duration
      },
      {
        title: 'Success Rate',
        dataIndex: 'success_rate',
        key: 'success_rate',
        render: (rate: number) => (
          <Tooltip title={`${rate.toFixed(1)}%`}>
            <Progress 
              percent={rate} 
              strokeColor={rate > 90 ? STATUS_COLORS.success : rate > 70 ? STATUS_COLORS.pending : STATUS_COLORS.failure}
              size="small"
            />
          </Tooltip>
        ),
        sorter: (a: any, b: any) => a.success_rate - b.success_rate
      }
    ];

    return (
      <Card title="Action Performance" style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={metrics.action_performance}
          rowKey="action_type"
          pagination={false}
          size="small"
        />
      </Card>
    );
  };

  const renderErrorBreakdown = () => {
    if (!metrics?.error_breakdown?.length) return null;

    const pieData = metrics.error_breakdown.map((item, index) => ({
      name: item.error_type,
      value: item.count,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));

    return (
      <Card title="Error Breakdown" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(((percent ?? 0) * 100)).toFixed(0)}%`}
                  outerRadius={80}
                  fill="rgb(var(--color-info))"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Col>
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {metrics.error_breakdown.map((error, index) => (
                <Card size="small" key={error.error_type}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag color={CHART_COLORS[index % CHART_COLORS.length]}>
                        <AlertCircle size={12} style={{ marginRight: 4 }} />
                        {error.error_type}
                      </Tag>
                      <Text strong>{error.count} errors</Text>
                    </Space>
                    <Progress 
                      percent={error.percentage} 
                      strokeColor={CHART_COLORS[index % CHART_COLORS.length]}
                      showInfo={false}
                      size="small"
                    />
                  </Space>
                </Card>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: 24, background: 'rgb(var(--color-bg-secondary))', minHeight: '100vh' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col flex="auto">
              <Title level={3} style={{ margin: 0 }}>
                <Activity size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Workflow Analytics
              </Title>
            </Col>
            <Col>
              <Space>
                <Select
                  style={{ width: 250 }}
                  placeholder="Select workflow"
                  value={selectedWorkflowId}
                  onChange={setSelectedWorkflowId}
                  showSearch
                  optionFilterProp="children"
                >
                  {workflows.map(wf => (
                    <Option key={wf.id} value={wf.id}>
                      {wf.name}
                    </Option>
                  ))}
                </Select>
                
                <Select
                  style={{ width: 150 }}
                  value={timeframe}
                  onChange={(value) => {
                    setTimeframe(value);
                    setDateRange(undefined);
                  }}
                >
                  <Option value="7d">Last 7 days</Option>
                  <Option value="30d">Last 30 days</Option>
                  <Option value="90d">Last 90 days</Option>
                </Select>
                
                <RangePicker
                  onChange={(dates) => {
                    if (dates) {
                      setDateRange([dates[0]!.toDate(), dates[1]!.toDate()]);
                      setTimeframe('');
                    }
                  }}
                />
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Content */}
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Loading analytics...</Text>
              </div>
            </div>
          </Card>
        ) : !selectedWorkflowId ? (
          <Card>
            <Empty
              description="Select a workflow to view analytics"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : !metrics ? (
          <Card>
            <Empty
              description="No execution data available for this workflow"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : (
          <>
            {renderKPIs()}
            {renderExecutionTrends()}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={12}>
                {renderHourlyDistribution()}
              </Col>
              <Col xs={24} lg={12}>
                {renderErrorBreakdown()}
              </Col>
            </Row>
            {renderActionPerformance()}
          </>
        )}
      </Space>
    </div>
  );
};
