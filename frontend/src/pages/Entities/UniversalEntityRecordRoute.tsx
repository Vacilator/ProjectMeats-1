import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import UniversalEntityRecordPage from './UniversalEntityRecordPage';

type RouteParams = {
  entityType?: string;
  id?: string;
};

const basePathFor = (raw: string): string => {
  const t = String(raw || '').trim().toLowerCase();

  if (t === 'supplier' || t === 'suppliers') return '/suppliers';
  if (t === 'customer' || t === 'customers') return '/customers';
  if (t === 'contact' || t === 'contacts') return '/contacts';
  if (t === 'plant' || t === 'plants') return '/suppliers/plants';
  if (t === 'location' || t === 'locations') return '/customers/locations';
  if (t === 'purchase_order' || t === 'purchase-orders' || t === 'purchase_orders') return '/purchase-orders';
  if (t === 'sales_order' || t === 'sales-orders' || t === 'sales_orders') return '/sales-orders';
  if (t === 'carrier' || t === 'carriers') return '/carriers';
  if (t === 'inquiry' || t === 'inquiries') return '/inquiries';
  if (t === 'invoice' || t === 'invoices') return '/accounting/receivables/invoices';
  if (t === 'claim' || t === 'claims') return '/accounting/claims';

  return '/cockpit';
};

type UniversalEntityRecordRouteProps = {
  mode?: 'view' | 'edit';
};

export const UniversalEntityRecordRoute: React.FC<UniversalEntityRecordRouteProps> = ({
  mode = 'view',
}) => {
  const { entityType } = useParams<RouteParams>();

  const basePath = useMemo(() => basePathFor(String(entityType || '')), [entityType]);

  return (
    <UniversalEntityRecordPage
      entityType={String(entityType || '')}
      basePath={basePath}
      mode={mode}
    />
  );
};

export default UniversalEntityRecordRoute;
