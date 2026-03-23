import React from 'react';
import { CreditCard } from 'lucide-react';
import { AdminGuard, AdminPage, EmptyState } from '@/components/Admin';

const BillingPage: React.FC = () => {
  return (
    <AdminPage
      title="Billing"
      description="Subscription, invoices, and payment methods."
      icon={<CreditCard size={18} />}
    >
      <AdminGuard feature="billing" allow={(p) => p.can_manage_billing}>
        <EmptyState
          icon="💳"
          title="Billing coming soon"
          message="This area will allow tenant owners and admins to manage subscriptions, payment methods, and invoices."
        />
      </AdminGuard>
    </AdminPage>
  );
};

export default BillingPage;
