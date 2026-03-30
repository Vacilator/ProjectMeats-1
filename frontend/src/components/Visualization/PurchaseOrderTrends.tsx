import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import styled from 'styled-components';

interface PurchaseOrderTrendData {
  date: string;
  orders: number;
  value: number;
  averageValue: number;
}

interface PurchaseOrderTrendsProps {
  data: PurchaseOrderTrendData[];
  height?: number;
}

const PurchaseOrderTrends: React.FC<PurchaseOrderTrendsProps> = ({ data, height = 300 }) => {
  return (
    <ChartContainer>
      <ChartTitle>Purchase Order Trends</ChartTitle>
      <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={0} debounce={150}>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip
            formatter={(value, name) => {
              const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
              const label = typeof name === 'string' ? name : String(name ?? '');

              if (label === 'value' || label === 'averageValue') {
                return [
                  `$${numericValue.toLocaleString()}`,
                  label === 'value' ? 'Total Value' : 'Average Value',
                ];
              }

              return [numericValue, 'Orders'];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="orders"
            stroke={`rgb(var(--color-info))`}
            strokeWidth={2}
            name="Number of Orders"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="value"
            stroke={`rgb(var(--color-success))`}
            strokeWidth={2}
            name="Total Value ($)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="averageValue"
            stroke={`rgb(var(--color-warning))`}
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Average Order Value ($)"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

const ChartContainer = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
`;

const ChartTitle = styled.h3`
  margin: 0 0 20px 0;
  color: rgb(var(--color-text-primary));
  font-size: 18px;
  font-weight: 600;
`;

export default PurchaseOrderTrends;
