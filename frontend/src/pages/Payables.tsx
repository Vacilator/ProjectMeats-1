/**
 * Payables Page
 *
 * Manages accounts payable to suppliers
 */
import React from 'react';
import { ComingSoon } from './ComingSoon';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const Payables: React.FC = () => {
  useDocumentTitle('Payables');
  return (
    <ComingSoon
      title="Accounts Payable"
      icon="💸"
      description="Manage supplier invoices, payment scheduling, claims, and purchase order reconciliation."
      features={[
        'Invoice tracking and approval workflows',
        'Payment scheduling and reminders',
        'Claim management and dispute resolution',
        'PO reconciliation and matching',
      ]}
    />
  );
};

export default Payables;
