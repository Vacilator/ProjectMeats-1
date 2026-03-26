import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
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

interface TenantConfiguration {
  id: string;
  key: string;
  value: string;
  category: string;
  data_type: 'string' | 'integer' | 'float' | 'boolean' | 'json';
}

interface ManagePlanFormValues {
  planName: string;
  billingCycle: 'Monthly' | 'Annual';
  userLimit: number;
}

interface PaymentMethodFormValues {
  brand: string;
  last4: string;
  exp: string;
}

const BILLING_CONFIG_KEYS = {
  planName: 'billing.plan_name',
  billingCycle: 'billing.billing_cycle',
  userLimit: 'billing.user_limit',
  paymentBrand: 'billing.payment_method_brand',
  paymentLast4: 'billing.payment_method_last4',
  paymentExp: 'billing.payment_method_exp',
} as const;

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

  const billingConfigsQuery = useQuery<TenantConfiguration[]>({
    queryKey: ['tenant-configurations', 'billing'],
    queryFn: async () => {
      const res = await apiClient.get('/configurations/', { params: { search: 'billing.' } });
      const raw = res.data as unknown;
      const data = Array.isArray(raw)
        ? raw
        : typeof raw === 'object' && raw !== null && Array.isArray((raw as any).results)
          ? (raw as any).results
          : [];
      return data as TenantConfiguration[];
    },
    staleTime: 60 * 1000,
  });

  const billingConfigByKey = useMemo(() => {
    const map = new Map<string, TenantConfiguration>();
    (billingConfigsQuery.data || []).forEach((c) => {
      if (c?.key) map.set(c.key, c);
    });
    return map;
  }, [billingConfigsQuery.data]);

  const planName = billingConfigByKey.get(BILLING_CONFIG_KEYS.planName)?.value || 'Enterprise Tier';
  const billingCycle =
    (billingConfigByKey.get(BILLING_CONFIG_KEYS.billingCycle)?.value as
      | ManagePlanFormValues['billingCycle']
      | undefined) || 'Monthly';
  const userLimit = Number(billingConfigByKey.get(BILLING_CONFIG_KEYS.userLimit)?.value || 50);

  const paymentBrand = billingConfigByKey.get(BILLING_CONFIG_KEYS.paymentBrand)?.value || 'Visa';
  const paymentLast4 = billingConfigByKey.get(BILLING_CONFIG_KEYS.paymentLast4)?.value || '4242';
  const paymentExp = billingConfigByKey.get(BILLING_CONFIG_KEYS.paymentExp)?.value || '12/27';

  const planOptions = useMemo(() => {
    const defaults = ['Starter', 'Growth', 'Enterprise Tier'];
    const unique = new Set<string>([...defaults, planName].filter(Boolean));
    return Array.from(unique).map((value) => ({ value, label: value }));
  }, [planName]);

  // Mock subscription/invoice data for initial dashboard render.
  const nextBillingDate = '2026-04-01';
  const activeUsers = tenant?.user_count ?? 0;

  const [isManagePlanOpen, setIsManagePlanOpen] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [managePlanForm] = Form.useForm<ManagePlanFormValues>();

  const [isPaymentMethodOpen, setIsPaymentMethodOpen] = useState(false);
  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false);
  const [paymentMethodForm] = Form.useForm<PaymentMethodFormValues>();

  const openManagePlan = () => {
    managePlanForm.setFieldsValue({
      planName,
      billingCycle: billingCycle === 'Annual' ? 'Annual' : 'Monthly',
      userLimit: Number.isFinite(userLimit) ? userLimit : 50,
    });
    setIsManagePlanOpen(true);
  };

  const openPaymentMethod = () => {
    paymentMethodForm.setFieldsValue({
      brand: paymentBrand,
      last4: paymentLast4,
      exp: paymentExp,
    });
    setIsPaymentMethodOpen(true);
  };

  const upsertConfig = async (cfg: {
    key: string;
    value: string;
    display_name: string;
    description: string;
    data_type: TenantConfiguration['data_type'];
    category: string;
    default_value?: string;
  }) => {
    const existing = billingConfigByKey.get(cfg.key);

    if (existing?.id) {
      await apiClient.patch(`/configurations/${existing.id}/`, { value: cfg.value });
      return;
    }

    await apiClient.post('/configurations/', {
      category: cfg.category,
      key: cfg.key,
      display_name: cfg.display_name,
      description: cfg.description,
      value: cfg.value,
      data_type: cfg.data_type,
      default_value: cfg.default_value ?? '',
      is_system: false,
      is_required: false,
    });
  };

  const savePlan = async () => {
    try {
      const values = await managePlanForm.validateFields();
      setIsSavingPlan(true);

      await upsertConfig({
        category: 'integrations',
        key: BILLING_CONFIG_KEYS.planName,
        display_name: 'Billing Plan Name',
        description: 'Selected tenant billing plan shown in the Admin Workspace Billing dashboard.',
        value: values.planName.trim() || 'Enterprise Tier',
        data_type: 'string',
        default_value: 'Enterprise Tier',
      });

      await upsertConfig({
        category: 'integrations',
        key: BILLING_CONFIG_KEYS.billingCycle,
        display_name: 'Billing Cycle',
        description: 'Billing cycle for the tenant plan (Monthly or Annual).',
        value: values.billingCycle,
        data_type: 'string',
        default_value: 'Monthly',
      });

      await upsertConfig({
        category: 'integrations',
        key: BILLING_CONFIG_KEYS.userLimit,
        display_name: 'Plan User Limit',
        description:
          'Maximum active users allowed by the tenant billing plan (display-only unless enforced elsewhere).',
        value: String(values.userLimit),
        data_type: 'integer',
        default_value: '50',
      });

      await billingConfigsQuery.refetch();
      message.success('Plan updated.');
      setIsManagePlanOpen(false);
    } catch (e: any) {
      if (e?.errorFields) return; // antd validation
      message.error('Failed to update plan.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const savePaymentMethod = async () => {
    try {
      const values = await paymentMethodForm.validateFields();
      setIsSavingPaymentMethod(true);

      await upsertConfig({
        category: 'integrations',
        key: BILLING_CONFIG_KEYS.paymentBrand,
        display_name: 'Payment Method Brand',
        description: 'Card brand shown in the Admin Workspace Billing dashboard (display-only).',
        value: values.brand.trim(),
        data_type: 'string',
        default_value: 'Visa',
      });

      await upsertConfig({
        category: 'integrations',
        key: BILLING_CONFIG_KEYS.paymentLast4,
        display_name: 'Payment Method Last 4',
        description:
          'Last 4 digits of the payment method shown in the Billing dashboard (display-only).',
        value: values.last4.trim(),
        data_type: 'string',
        default_value: '4242',
      });

      await upsertConfig({
        category: 'integrations',
        key: BILLING_CONFIG_KEYS.paymentExp,
        display_name: 'Payment Method Expiration',
        description: 'Expiration (MM/YY) shown in the Billing dashboard (display-only).',
        value: values.exp.trim(),
        data_type: 'string',
        default_value: '12/27',
      });

      await billingConfigsQuery.refetch();
      message.success('Payment method updated.');
      setIsPaymentMethodOpen(false);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Failed to update payment method.');
    } finally {
      setIsSavingPaymentMethod(false);
    }
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
      <Modal
        title="Manage Plan"
        open={isManagePlanOpen}
        onCancel={() => setIsManagePlanOpen(false)}
        onOk={() => void savePlan()}
        okText="Save"
        confirmLoading={isSavingPlan}
        destroyOnClose
      >
        <Form form={managePlanForm} layout="vertical" preserve={false}>
          <Form.Item
            label="Plan"
            name="planName"
            rules={[{ required: true, message: 'Plan is required' }]}
          >
            <Select
              options={planOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select a plan"
            />
          </Form.Item>

          <Form.Item label="Billing cycle" name="billingCycle" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Annual', label: 'Annual' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="User limit"
            name="userLimit"
            rules={[
              { required: true, type: 'number', min: 1, message: 'User limit must be at least 1' },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Text type="secondary">
            This updates the tenant Billing dashboard display values via Tenant Configurations.
          </Text>
        </Form>
      </Modal>

      <Modal
        title="Update Payment Method"
        open={isPaymentMethodOpen}
        onCancel={() => setIsPaymentMethodOpen(false)}
        onOk={() => void savePaymentMethod()}
        okText="Save"
        confirmLoading={isSavingPaymentMethod}
        destroyOnClose
      >
        <Form form={paymentMethodForm} layout="vertical" preserve={false}>
          <Form.Item
            label="Brand"
            name="brand"
            rules={[{ required: true, message: 'Brand is required' }]}
          >
            <Input placeholder="e.g., Visa" />
          </Form.Item>

          <Form.Item
            label="Last 4"
            name="last4"
            rules={[
              { required: true, message: 'Last 4 digits are required' },
              { pattern: /^\d{4}$/, message: 'Enter exactly 4 digits' },
            ]}
          >
            <Input inputMode="numeric" maxLength={4} placeholder="4242" />
          </Form.Item>

          <Form.Item
            label="Expiration (MM/YY)"
            name="exp"
            rules={[
              { required: true, message: 'Expiration is required' },
              { pattern: /^(0[1-9]|1[0-2])\/(\d{2})$/, message: 'Use MM/YY format (e.g., 12/27)' },
            ]}
          >
            <Input placeholder="12/27" />
          </Form.Item>

          <Text type="secondary">
            Display-only for now. When Stripe/portal integration is enabled, this will be replaced
            by a secure customer portal flow.
          </Text>
        </Form>
      </Modal>
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
                      onClick={openManagePlan}
                      loading={billingConfigsQuery.isFetching}
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
                      <Statistic title="Active Users" value={`${activeUsers}/${userLimit}`} />
                    </Col>
                  </Row>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card
                  title="Payment Method"
                  extra={<Button onClick={openPaymentMethod}>Update Payment Method</Button>}
                >
                  <Space direction="vertical" size={4}>
                    <Text strong>
                      {paymentBrand} ending in {paymentLast4}
                    </Text>
                    <Text type="secondary">Expires {paymentExp}</Text>
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
