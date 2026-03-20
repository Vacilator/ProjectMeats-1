import React from 'react';
import { CreditCard } from 'lucide-react';
import { AdminPage, EmptyState } from '@/components/Admin';

const BillingPage: React.FC = () => {
  return (
    <AdminPage
      title="Billing"
      description="Subscription, invoices, and payment methods."
      icon={<CreditCard size={18} />}
    >
      <EmptyState
        icon="💳"
        title="Billing coming soon"
        message="This area will allow tenant owners to manage subscriptions, payment methods, and invoices."
      />
    </AdminPage>
  );
};

export default BillingPage;
