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
import { withTenantQueryKey } from '@/utils/queryKeys';

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
  billingPortalUrl: string;
}

const BILLING_CONFIG_KEYS = {
  planName: 'billing.plan_name',
  billingCycle: 'billing.billing_cycle',
  userLimit: 'billing.user_limit',

  /** If provided, the UI will open this URL to manage payment methods (e.g., Stripe customer portal). */
  billingPortalUrl: 'billing.portal_url',

  // Optional display-only fields (can be populated by an external billing integration later).
  paymentBrand: 'billing.payment_method_brand',
  paymentLast4: 'billing.payment_method_last4',
  paymentExp: 'billing.payment_method_exp',
} as const;

const BillingPage: React.FC = () => {
  const currentTenantQuery = useQuery<TenantCurrent>({
    queryKey: withTenantQueryKey('tenants', 'current', 'billing-dashboard'),
    queryFn: async () => {
      const res = await apiClient.get('/tenants/current/');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const tenant = currentTenantQuery.data;

  const billingConfigsQuery = useQuery<TenantConfiguration[]>({
    queryKey: withTenantQueryKey('tenant-configurations', 'billing'),
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

  const billingPortalUrl = billingConfigByKey.get(BILLING_CONFIG_KEYS.billingPortalUrl)?.value || '';

  const paymentBrand = billingConfigByKey.get(BILLING_CONFIG_KEYS.paymentBrand)?.value || '';
  const paymentLast4 = billingConfigByKey.get(BILLING_CONFIG_KEYS.paymentLast4)?.value || '';
  const paymentExp = billingConfigByKey.get(BILLING_CONFIG_KEYS.paymentExp)?.value || '';

  const planOptions = useMemo(() => {
    // Intentionally fixed choices: you can select a plan, but you can't edit plan names.
    const defaults = ['Starter', 'Growth', 'Enterprise Tier'];
    const unique = new Set<string>([...defaults, planName].filter(Boolean));
    return Array.from(unique).map((value) => ({ value, label: value }));
  }, [planName]);

  const nextBillingDate = '2026-04-01';
  const activeUsers = tenant?.user_count ?? 0;

  const subscriptionInvoicesQuery = useQuery<any[]>({
    queryKey: withTenantQueryKey('invoices', 'subscription', tenant?.id),
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const res = await apiClient.get('/invoices/', { params: { is_subscription: true } });
      const raw = res.data as unknown;
      const data = Array.isArray(raw)
        ? raw
        : typeof raw === 'object' && raw !== null && Array.isArray((raw as any).results)
          ? (raw as any).results
          : [];
      return data as any[];
    },
    staleTime: 60 * 1000,
  });

  const invoices: InvoiceRow[] = useMemo(() => {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    const normalizeStatus = (row: any): InvoiceStatus => {
      const payment = String(row?.payment_status || '').toLowerCase();
      const status = String(row?.status || '').toLowerCase();

      if (payment === 'paid' || status === 'paid') return 'Paid';
      if (status === 'cancelled') return 'Failed';
      return 'Due';
    };

    return (subscriptionInvoicesQuery.data || []).map((row: any) => {
      const total = Number(row?.total_amount ?? 0);
      const amount = Number.isFinite(total) ? fmt.format(total) : String(row?.total_amount ?? '');
      const date = String(row?.date_time_stamp || row?.created_on || '');

      return {
        key: String(row?.id || row?.invoice_number || Math.random()),
        date,
        invoiceNumber: String(row?.invoice_number || ''),
        amount,
        status: normalizeStatus(row),
      };
    });
  }, [subscriptionInvoicesQuery.data]);

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
      billingPortalUrl,
    });
    setIsPaymentMethodOpen(true);
  };

  const openBillingPortal = () => {
    const url = String(billingPortalUrl || '').trim();
    if (!url) {
      openPaymentMethod();
      return;
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      message.error('Failed to open billing portal.');
    }
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
    } catch (e: unknown) {
      const errObj = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      if (errObj.errorFields) return; // antd validation
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
        key: BILLING_CONFIG_KEYS.billingPortalUrl,
        display_name: 'Billing Portal URL',
        description:
          'URL to a secure billing portal (e.g., Stripe customer portal) for managing payment methods.',
        value: String(values.billingPortalUrl || '').trim(),
        data_type: 'string',
        default_value: '',
      });

      await billingConfigsQuery.refetch();
      message.success('Billing portal saved.');
      setIsPaymentMethodOpen(false);
    } catch (e: unknown) {
      const errObj = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      if (errObj.errorFields) return;
      message.error('Failed to save billing portal.');
    } finally {
      setIsSavingPaymentMethod(false);
    }
  };


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
        destroyOnHidden
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
        title="Manage Payment Method"
        open={isPaymentMethodOpen}
        onCancel={() => setIsPaymentMethodOpen(false)}
        onOk={() => void savePaymentMethod()}
        okText="Save"
        confirmLoading={isSavingPaymentMethod}
        destroyOnHidden
      >
        <Form form={paymentMethodForm} layout="vertical" preserve={false}>
          <Form.Item
            label="Billing portal URL"
            name="billingPortalUrl"
            rules={[
              {
                required: true,
                message: 'Add a billing portal URL to manage payment methods securely (no card data stored in ProjectMeats).',
              },
              { type: 'url', message: 'Enter a valid URL (https://...)' },
            ]}
          >
            <Input placeholder="https://billing.example.com/portal" />
          </Form.Item>

          <Text type="secondary">
            This opens your secure billing portal (e.g., Stripe customer portal) to update cards.
            ProjectMeats does not store card details.
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
                  extra={
                    <Button onClick={openBillingPortal}>
                      {billingPortalUrl ? 'Manage Payment Method' : 'Set Billing Portal'}
                    </Button>
                  }
                >
                  <Space direction="vertical" size={4}>
                    {billingPortalUrl ? (
                      <>
                        <Text strong>Managed in billing portal</Text>
                        <Text type="secondary">Open your billing portal to update payment methods.</Text>
                      </>
                    ) : (
                      <>
                        <Text strong>No billing portal configured</Text>
                        <Text type="secondary">
                          Add a secure billing portal URL to manage payment methods (no card data stored in ProjectMeats).
                        </Text>
                      </>
                    )}

                    {paymentBrand && paymentLast4 ? (
                      <Text type="secondary">
                        {paymentBrand} ending in {paymentLast4}
                        {paymentExp ? ` • Expires ${paymentExp}` : ''}
                      </Text>
                    ) : (
                      <Text type="secondary">Payment details will appear once connected.</Text>
                    )}
                    <Text type="secondary">Tenant: {tenant.name}</Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card title="Billing History">
              <Table
                columns={invoiceColumns}
                dataSource={invoices}
                loading={subscriptionInvoicesQuery.isLoading}
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
