import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Legacy route handler.
 *
 * Cockpit entity links should land on the canonical record page so Cockpit and
 * left-nav entity pages share the exact same UI/UX.
 */
export const CockpitEntityRedirect: React.FC = () => {
  const { entityType = '', entityId = '' } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const rawType = String(entityType ?? '').trim().toLowerCase();
    const canonicalType = rawType === 'customer' || rawType === 'customers'
      ? 'customer'
      : rawType === 'supplier' || rawType === 'suppliers'
        ? 'supplier'
        : rawType === 'plant' || rawType === 'plants'
          ? 'plant'
          : rawType === 'location' || rawType === 'locations'
            ? 'location'
            : rawType === 'contact' || rawType === 'contacts'
              ? 'contact'
              : rawType === 'purchase_order' || rawType === 'purchase_orders' || rawType === 'purchase-orders'
                ? 'purchase_order'
                : rawType === 'sales_order' || rawType === 'sales_orders' || rawType === 'sales-orders'
                  ? 'sales_order'
                  : rawType === 'inquiry' || rawType === 'inquiries'
                    ? 'inquiry'
                    : rawType === 'invoice' || rawType === 'invoices'
                      ? 'invoice'
                      : null;

    if (!canonicalType || !entityId) {
      navigate('/cockpit/dashboard', { replace: true });
      return;
    }

    navigate(`/records/${encodeURIComponent(canonicalType)}/${encodeURIComponent(String(entityId))}`, {
      replace: true,
    });
  }, [entityId, entityType, navigate]);

  return null;
};

export default CockpitEntityRedirect;
