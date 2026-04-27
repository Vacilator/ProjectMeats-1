import React, { useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Spin } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard } from '@/components/Cockpit';
import { EntityFormSurface } from '@/components/Shared';
import { apiClient } from '@/services/apiService';

type RouteParams = { customerId?: string; locationId?: string; contactId?: string };

type CustomerRow = { id: number; name?: string };

type LocationRow = { id: number; name?: string };

type ContactRow = { id: number; first_name?: string; last_name?: string };

export const LocationContactDetail: React.FC = () => {
  const navigate = useNavigate();
  const { customerId, locationId, contactId } = useParams<RouteParams>();

  const cid = String(customerId || '').trim();
  const lid = String(locationId || '').trim();
  const coid = String(contactId || '').trim();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [contact, setContact] = useState<ContactRow | null>(null);

  useEffect(() => {
    if (!cid || !lid || !coid) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [customerResp, locationResp, contactResp] = await Promise.all([
          apiClient.get(`customers/${cid}/`),
          apiClient.get(`locations/${lid}/`),
          apiClient.get(`contacts/${coid}/`),
        ]);

        if (!mounted) return;
        setCustomer((customerResp.data as CustomerRow) || null);
        setLocation((locationResp.data as LocationRow) || null);
        setContact((contactResp.data as ContactRow) || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [cid, lid, coid]);

  const contactLabel = useMemo(() => {
    const name = `${String(contact?.first_name || '').trim()} ${String(contact?.last_name || '').trim()}`.trim();
    return name || (coid ? `Contact #${coid}` : 'Contact');
  }, [coid, contact?.first_name, contact?.last_name]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Breadcrumb
            items={[
              {
                title: (
                  <span>
                    Customer:{' '}
                    <Link to={cid ? `/customers/${cid}` : '/customers'}>
                      {String(customer?.name || '').trim() || (cid ? `Customer #${cid}` : 'Customers')}
                    </Link>
                  </span>
                ),
              },
              {
                title: (
                  <span>
                    Locations:{' '}
                    <Link to={`/customers/${cid}/locations/${lid}`}>
                      {String(location?.name || '').trim() || (lid ? `Location #${lid}` : 'Locations')}
                    </Link>
                  </span>
                ),
              },
              { title: <span style={{ fontWeight: 700 }}>{contactLabel}</span> },
            ]}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Card>
            <Spin />
          </Card>
        ) : (
          <>
            <AIOverviewCard entityType="contact" entityId={coid} />
            <EntityFormSurface
              entityType="contact"
              mode="view"
              variant="inline"
              isOpen={true}
              entityId={coid}
              onClose={() => navigate(`/customers/${cid}/locations/${lid}`)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default LocationContactDetail;
