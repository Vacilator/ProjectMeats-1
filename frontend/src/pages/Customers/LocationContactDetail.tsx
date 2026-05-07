import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Spin } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { apiClient } from '@/services/apiService';
import { resolveEntityDisplay } from '@/utils/entityDisplay';

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
    return resolveEntityDisplay(
      { first_name: contact?.first_name, last_name: contact?.last_name, id: coid },
      { entityType: 'contact', fallbackStyle: 'id' }
    );
  }, [coid, contact?.first_name, contact?.last_name]);

  const customerDisplay = useMemo(
    () =>
      resolveEntityDisplay(
        { name: customer?.name, id: cid },
        { entityType: 'customer', fallbackStyle: 'id' }
      ),
    [cid, customer?.name]
  );

  const locationDisplay = useMemo(
    () =>
      resolveEntityDisplay(
        { name: location?.name, id: lid },
        { entityType: 'location', fallbackStyle: 'id' }
      ),
    [lid, location?.name]
  );

  const handleNavigateToEntity = useCallback(
    (entityType: string, entityId: string, _label: string) => {
      const type = String(entityType || '').trim().toLowerCase();
      const nextId = String(entityId || '').trim();
      if (!type || !nextId) return;

      if (type === 'customer') {
        navigate(`/customers/${nextId}`);
        return;
      }

      if (type === 'location') {
        navigate(cid ? `/customers/${cid}/locations/${nextId}` : `/locations/${nextId}`);
        return;
      }

      if (type === 'contact') {
        navigate(`/records/contact/${encodeURIComponent(nextId)}`);
        return;
      }

      if (type === 'supplier') {
        navigate(`/suppliers/${nextId}`);
        return;
      }

      if (type === 'plant') {
        navigate(`/plants/${nextId}`);
        return;
      }

      navigate(`/${type}/${nextId}`);
    },
    [cid, navigate]
  );

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
                      <span title={customerDisplay.tooltip || customerDisplay.text}>
                        {customerDisplay.text}
                      </span>
                    </Link>
                  </span>
                ),
              },
              {
                title: (
                  <span>
                    Locations:{' '}
                    <Link to={`/customers/${cid}/locations/${lid}`}>
                      <span title={locationDisplay.tooltip || locationDisplay.text}>
                        {locationDisplay.text}
                      </span>
                    </Link>
                  </span>
                ),
              },
              {
                title: (
                  <span style={{ fontWeight: 700 }} title={contactLabel.tooltip || contactLabel.text}>
                    {contactLabel.text}
                  </span>
                ),
              },
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
            <EntityProfileHeader
              entityType="contact"
              entityId={coid}
              variant="full"
              onNavigateToEntity={handleNavigateToEntity}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default LocationContactDetail;
