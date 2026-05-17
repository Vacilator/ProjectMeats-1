/**
 * Metrics Dashboard Component
 *
 * Visual KPIs and analytics for workflows and forms.
 * Industry-standard metrics inspired by Shopify, Stripe dashboards.
 *
 * Features:
 * - Workflow completion rates
 * - Form submission statistics
 * - Real-time usage trends
 * - Performance health indicators
 *
 * Created: 2026-02-26 - Gap Analysis Phase 4.2
 */
import React from 'react';
import dayjs from 'dayjs';
import styled from 'styled-components';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface WorkflowMetrics {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  completed_executions: number;
  failed_executions: number;
  in_progress_executions: number;
  avg_completion_time: number;
  completion_rate: number;
  daily_usage: DailyUsage[];
  workflow_health: WorkflowHealth[];
}

interface FormMetrics {
  total_forms: number;
  total_submissions: number;
  avg_fields_per_form: number;
  most_used_forms: FormUsage[];
}

interface DailyUsage {
  date: string;
  executions: number;
  completions: number;
  failures: number;
}

interface WorkflowHealth {
  workflow_name: string;
  success_rate: number;
  execution_count: number;
  avg_duration: number;
}

interface FormUsage {
  form_name: string;
  submission_count: number;
  last_used: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const KPICard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--color-overlay), 0.1);
  }
`;

const KPIHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const KPILabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const KPIIcon = styled.div<{ $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: ${props => props.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-inverse));
`;

const KPIValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const KPIChange = styled.div<{ $positive: boolean }>`
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.$positive ? 'rgb(var(--color-success))' : 'rgb(var(--color-error))'};

  svg {
    margin-right: 4px;
  }
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 32px;
`;

const ChartCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 24px;
`;

const ChartTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 20px;
`;

const TableCard = styled(ChartCard)`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHead = styled.thead`
  background: rgb(var(--color-surface-elevated));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const TableRow = styled.tr`
  border-bottom: 1px solid rgb(var(--color-border));

  &:hover {
    background: rgba(var(--color-primary), 0.05);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TableCell = styled.td`
  padding: 12px 16px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const HealthBadge = styled.span<{ $health: 'good' | 'warning' | 'critical' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.$health) {
      case 'good': return 'rgba(var(--color-success), 0.1)';
      case 'warning': return 'rgba(var(--color-warning), 0.1)';
      case 'critical': return 'rgba(var(--color-error), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$health) {
      case 'good': return 'rgb(var(--color-success))';
      case 'warning': return 'rgb(var(--color-warning))';
      case 'critical': return 'rgb(var(--color-error))';
    }
  }};
`;

// ============================================================================
// Component
// ============================================================================

export const Metrics: React.FC = () => {
  // Mock data (replace with actual API calls when backend is ready)
  const workflowMetrics: WorkflowMetrics = {
    total_workflows: 42,
    active_workflows: 28,
    total_executions: 1247,
    completed_executions: 1089,
    failed_executions: 98,
    in_progress_executions: 60,
    avg_completion_time: 142,
    completion_rate: 87.3,
    daily_usage: generateMockDailyData(30),
    workflow_health: generateMockHealthData(),
  };

  const formMetrics: FormMetrics = {
    total_forms: 18,
    total_submissions: 894,
    avg_fields_per_form: 8.5,
    most_used_forms: [
      { form_name: 'Customer Inquiry', submission_count: 342, last_used: '2026-02-26' },
      { form_name: 'Order Request', submission_count: 278, last_used: '2026-02-25' },
      { form_name: 'Supplier Registration', submission_count: 156, last_used: '2026-02-24' },
    ],
  };

  return (
    <Container>
      <Header>
        <Title>Analytics Dashboard</Title>
        <Subtitle>Track workflow performance and form usage across your organization</Subtitle>
      </Header>

      {/* KPI Cards */}
      <KPIGrid>
        <KPICard>
          <KPIHeader>
            <KPILabel>Total Executions</KPILabel>
            <KPIIcon $color="rgb(var(--color-info))">
              <Activity size={20} />
            </KPIIcon>
          </KPIHeader>
          <KPIValue>{workflowMetrics.total_executions.toLocaleString()}</KPIValue>
          <KPIChange $positive={true}>
            <TrendingUp size={14} />
            +12.5% from last period
          </KPIChange>
        </KPICard>

        <KPICard>
          <KPIHeader>
            <KPILabel>Completion Rate</KPILabel>
            <KPIIcon $color="rgb(var(--color-success))">
              <CheckCircle size={20} />
            </KPIIcon>
          </KPIHeader>
          <KPIValue>{workflowMetrics.completion_rate.toFixed(1)}%</KPIValue>
          <KPIChange $positive={true}>
            <TrendingUp size={14} />
            +3.2% from last period
          </KPIChange>
        </KPICard>

        <KPICard>
          <KPIHeader>
            <KPILabel>Avg Completion Time</KPILabel>
            <KPIIcon $color="rgb(var(--color-warning))">
              <Clock size={20} />
            </KPIIcon>
          </KPIHeader>
          <KPIValue>{formatDuration(workflowMetrics.avg_completion_time)}</KPIValue>
          <KPIChange $positive={false}>
            <TrendingDown size={14} />
            8.1% faster
          </KPIChange>
        </KPICard>

        <KPICard>
          <KPIHeader>
            <KPILabel>Form Submissions</KPILabel>
            <KPIIcon $color="rgb(var(--color-accent))">
              <FileText size={20} />
            </KPIIcon>
          </KPIHeader>
          <KPIValue>{formMetrics.total_submissions.toLocaleString()}</KPIValue>
          <KPIChange $positive={true}>
            <TrendingUp size={14} />
            +18.7% from last period
          </KPIChange>
        </KPICard>
      </KPIGrid>

      {/* Charts */}
      <ChartsGrid>
        {/* Daily Usage Trend */}
        <ChartCard>
          <ChartTitle>Daily Usage Trends (Last 30 Days)</ChartTitle>
          <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1} debounce={150}>
            <LineChart data={workflowMetrics.daily_usage}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--color-overlay),0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="executions"
                stroke="rgb(var(--color-info))"
                strokeWidth={2}
                name="Total Executions"
              />
              <Line
                type="monotone"
                dataKey="completions"
                stroke="rgb(var(--color-success))"
                strokeWidth={2}
                name="Completions"
              />
              <Line
                type="monotone"
                dataKey="failures"
                stroke="rgb(var(--color-error))"
                strokeWidth={2}
                name="Failures"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Execution Status Bar Chart */}
        <ChartCard>
          <ChartTitle>Execution Status Distribution</ChartTitle>
          <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1} debounce={150}>
            <BarChart data={[
              { name: 'Completed', value: workflowMetrics.completed_executions },
              { name: 'In Progress', value: workflowMetrics.in_progress_executions },
              { name: 'Failed', value: workflowMetrics.failed_executions },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--color-overlay),0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="rgb(var(--color-info))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Workflow Health Table */}
        <TableCard>
          <ChartTitle>Workflow Health Overview</ChartTitle>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Workflow Name</TableHeader>
                <TableHeader>Success Rate</TableHeader>
                <TableHeader>Executions</TableHeader>
                <TableHeader>Avg Duration</TableHeader>
                <TableHeader>Health</TableHeader>
              </TableRow>
            </TableHead>
            <tbody>
              {workflowMetrics.workflow_health.map((workflow, index) => {
                const health =
                  workflow.success_rate >= 90 ? 'good' :
                  workflow.success_rate >= 70 ? 'warning' : 'critical';

                return (
                  <TableRow key={index}>
                    <TableCell>{workflow.workflow_name}</TableCell>
                    <TableCell>{workflow.success_rate.toFixed(1)}%</TableCell>
                    <TableCell>{workflow.execution_count}</TableCell>
                    <TableCell>{formatDuration(workflow.avg_duration)}</TableCell>
                    <TableCell>
                      <HealthBadge $health={health}>
                        {health === 'good' && '✓ Healthy'}
                        {health === 'warning' && '⚠ Warning'}
                        {health === 'critical' && '✕ Critical'}
                      </HealthBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </TableCard>

        {/* Most Used Forms Table */}
        <TableCard>
          <ChartTitle>Most Used Forms</ChartTitle>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Form Name</TableHeader>
                <TableHeader>Submissions</TableHeader>
                <TableHeader>Last Used</TableHeader>
              </TableRow>
            </TableHead>
            <tbody>
              {formMetrics.most_used_forms.map((form, index) => (
                <TableRow key={index}>
                  <TableCell>{form.form_name}</TableCell>
                  <TableCell>{form.submission_count}</TableCell>
                  <TableCell>{dayjs(form.last_used).format('MMM D, YYYY')}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </TableCard>
      </ChartsGrid>
    </Container>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function generateMockDailyData(days: number): DailyUsage[] {
  const data: DailyUsage[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const executions = Math.floor(Math.random() * 50) + 20;
    const completions = Math.floor(executions * (0.8 + Math.random() * 0.15));
    const failures = executions - completions;

    data.push({
      date: date.toISOString().split('T')[0].slice(5),
      executions,
      completions,
      failures,
    });
  }

  return data;
}

function generateMockHealthData(): WorkflowHealth[] {
  return [
    { workflow_name: 'Customer Onboarding', success_rate: 94.2, execution_count: 234, avg_duration: 180 },
    { workflow_name: 'Order Processing', success_rate: 88.7, execution_count: 567, avg_duration: 142 },
    { workflow_name: 'Email Notification', success_rate: 97.1, execution_count: 892, avg_duration: 3 },
    { workflow_name: 'Data Validation', success_rate: 76.4, execution_count: 123, avg_duration: 45 },
    { workflow_name: 'Report Generation', success_rate: 91.8, execution_count: 78, avg_duration: 320 },
  ];
}
