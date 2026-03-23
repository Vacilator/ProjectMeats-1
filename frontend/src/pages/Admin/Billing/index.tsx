import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Save, RefreshCw } from 'lucide-react';

import { apiClient } from '@/services/apiService';
import {
  AdminGuard,
  AdminPage,
  AdminSection,
  EmptyState,
  LoadingSkeleton,
} from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

interface TenantCurrent {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  website: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  is_trial_expired: boolean;
  user_count: number;
}

const BillingPage: React.FC = () => {
  const toast = useToast();

  const currentTenantQuery = useQuery<TenantCurrent>({
    queryKey: ['tenants', 'current', 'billing'],
    queryFn: async () => {
      const res = await apiClient.get('/tenants/current/');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const tenant = currentTenantQuery.data;

  const [form, setForm] = useState({
    contact_email: '',
    contact_phone: '',
    address: '',
    website: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setForm({
      contact_email: tenant.contact_email || '',
      contact_phone: tenant.contact_phone || '',
      address: tenant.address || '',
      website: tenant.website || '',
    });
  }, [tenant]);

  const hasChanges = useMemo(() => {
    if (!tenant) return false;
    return (
      (form.contact_email || '') !== (tenant.contact_email || '') ||
      (form.contact_phone || '') !== (tenant.contact_phone || '') ||
      (form.address || '') !== (tenant.address || '') ||
      (form.website || '') !== (tenant.website || '')
    );
  }, [form, tenant]);

  const save = async () => {
    if (!tenant) return;
    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.patch(`/tenants/${tenant.id}/`, {
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        address: form.address,
        website: form.website,
      });

      toast.success('Billing contact details updated');
      await currentTenantQuery.refetch();
    } catch (err: any) {
      console.error('[Billing] Failed to save:', err);
      toast.error(err?.response?.data?.error || 'Failed to save billing details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPage
      title="Billing"
      description="Subscription status and billing contact details."
      icon={<CreditCard size={18} />}
      actions={
        <Actions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => currentTenantQuery.refetch()}
            disabled={currentTenantQuery.isLoading}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={!hasChanges || isSaving || currentTenantQuery.isLoading}
            title={!hasChanges ? 'No changes' : undefined}
          >
            <Save size={14} /> {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </Actions>
      }
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
            message="We couldn't load your tenant billing context. Please refresh and try again."
          />
        ) : !tenant ? (
          <EmptyState
            icon="🏢"
            title="No tenant"
            message="No active tenant was found for your account."
          />
        ) : (
          <Grid>
            <AdminSection title="Subscription Status" description="Current tenant plan state.">
              <KeyValue>
                <Row>
                  <Key>Tenant</Key>
                  <Value>{tenant.name}</Value>
                </Row>
                <Row>
                  <Key>Users</Key>
                  <Value>{tenant.user_count}</Value>
                </Row>
                <Row>
                  <Key>Trial</Key>
                  <Value>
                    {tenant.is_trial ? (tenant.is_trial_expired ? 'Expired' : 'Active') : 'Not on trial'}
                  </Value>
                </Row>
                <Row>
                  <Key>Trial ends</Key>
                  <Value>{tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : '—'}</Value>
                </Row>
              </KeyValue>
              <Hint>
                Subscription management (plans, invoices, payment methods) is being finalized. In the meantime, keep
                your billing contact details up to date below.
              </Hint>
            </AdminSection>

            <AdminSection title="Billing Contact" description="Used for invoices and account communications.">
              <Form>
                <Field>
                  <Label htmlFor="contact_email">Billing email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                    placeholder="billing@yourcompany.com"
                  />
                </Field>

                <Field>
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
                    placeholder="+1 (555) 555-5555"
                  />
                </Field>

                <Field>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://yourcompany.com"
                  />
                </Field>

                <Field>
                  <Label htmlFor="address">Address</Label>
                  <TextArea
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Billing address"
                    rows={4}
                  />
                </Field>
              </Form>
            </AdminSection>
          </Grid>
        )}
      </AdminGuard>
    </AdminPage>
  );
};

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const Grid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
`;

const KeyValue = styled.div`
  display: grid;
  gap: 10px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgba(var(--color-surface), 0.6);
`;

const Key = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  font-weight: 600;
`;

const Value = styled.div`
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  font-weight: 600;
  text-align: right;
`;

const Hint = styled.p`
  margin: 12px 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const Form = styled.div`
  display: grid;
  gap: 12px;
`;

const Field = styled.div`
  display: grid;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const TextArea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

export default BillingPage;
