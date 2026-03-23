import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';

import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, EmptyState, LoadingSkeleton } from '@/components/Admin';

const { Text } = Typography;

interface TenantCurrent {
  id: string;
  name: string;
  user_count: number;
}

type InvoiceStatus = 'Paid' | 'Due' | 'Failed';

interface InvoiceRow {
  key: string;
  date: string;
  invoiceNumber: string;
  amount: string;
  status: InvoiceStatus;
}

const BillingPage: React.FC = () => {
  const currentTenantQuery = useQuery<TenantCurrent>({
    queryKey: ['tenants', 'current', 'billing-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/tenants/current/');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const tenant = currentTenantQuery.data;

  // Mock subscription/payment/invoice data for initial dashboard render.
  const planName = 'Enterprise Tier';
  const billingCycle = 'Monthly';
  const nextBillingDate = '2026-04-01';
  const userLimit = 50;
  const activeUsers = tenant?.user_count ?? 0;

  const paymentMethod = {
    brand: 'Visa',
    last4: '4242',
    exp: '12/27',
  };

  const invoices: InvoiceRow[] = [
    {
      key: 'inv_2026_03',
      date: '2026-03-01',
      invoiceNumber: 'PM-INV-2026-0003',
      amount: '$1,250.00',
      status: 'Paid',
    },
    {
      key: 'inv_2026_02',
      date: '2026-02-01',
      invoiceNumber: 'PM-INV-2026-0002',
      amount: '$1,250.00',
      status: 'Paid',
    },
    {
      key: 'inv_2026_01',
      date: '2026-01-01',
      invoiceNumber: 'PM-INV-2026-0001',
      amount: '$1,250.00',
      status: 'Paid',
    },
  ];

  const invoiceColumns: ColumnsType<InvoiceRow> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (iso: string) => <Text>{new Date(iso).toLocaleDateString()}</Text>,
    },
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (val: string) => <code>{val}</code>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: InvoiceStatus) => {
        const color = status === 'Paid' ? 'green' : status === 'Due' ? 'gold' : 'red';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'PDF',
      key: 'pdf',
      width: 90,
      render: () => (
        <Button
          type="link"
          icon={<DownloadOutlined />}
          onClick={() => message.info('Invoice PDF download will be available soon.')}
        >
          PDF
        </Button>
      ),
    },
  ];

  return (
    <AdminPage
      title="Billing"
      description="Subscription, payment method, and invoice history."
      icon="💳"
    >
      <AdminGuard
        feature="billing"
        allow={(p) => p.can_manage_billing}
        loadingFallback={<LoadingSkeleton type="card" rows={2} />}
      >
        {currentTenantQuery.isLoading ? (
          <LoadingSkeleton type="card" rows={3} />
        ) : currentTenantQuery.isError ? (
          <EmptyState
            icon="💳"
            title="Billing unavailable"
            message="We couldn't load your tenant context. Please refresh and try again."
          />
        ) : !tenant ? (
          <EmptyState
            icon="🏢"
            title="No tenant"
            message="No active tenant was found for your account."
          />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card
                  title="Current Subscription"
                  extra={
                    <Button
                      type="primary"
                      onClick={() => message.info('Plan management will be connected shortly.')}
                    >
                      Manage Plan
                    </Button>
                  }
                >
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Statistic title="Plan" value={planName} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="Billing Cycle" value={billingCycle} />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Next Billing Date"
                        value={new Date(nextBillingDate).toLocaleDateString()}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Active Users"
                        value={`${activeUsers}/${userLimit}`}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card
                  title="Payment Method"
                  extra={
                    <Button onClick={() => message.info('Payment method updates will be available soon.')}
                    >
                      Update Payment Method
                    </Button>
                  }
                >
                  <Space direction="vertical" size={4}>
                    <Text strong>
                      {paymentMethod.brand} ending in {paymentMethod.last4}
                    </Text>
                    <Text type="secondary">Expires {paymentMethod.exp}</Text>
                    <Text type="secondary">Tenant: {tenant.name}</Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card title="Billing History">
              <Table
                columns={invoiceColumns}
                dataSource={invoices}
                pagination={false}
                size="middle"
              />
            </Card>
          </Space>
        )}
      </AdminGuard>
    </AdminPage>
  );
};

export default BillingPage;
