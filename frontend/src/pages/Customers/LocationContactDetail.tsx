import React, { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Spin, Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { ActivityFeed } from '@/components/Shared';
import { businessApi } from '@/services/businessApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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
  useDocumentTitle('Contact Detail');

  const [loading, setLoading] = useState(true);
  const [_customer, setCustomer] = useState<CustomerRow | null>(null);
  const [_location, setLocation] = useState<LocationRow | null>(null);
  const [_contact, setContact] = useState<ContactRow | null>(null);

  useEffect(() => {
    if (!cid || !lid || !coid) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [customerResp, locationResp, contactResp] = await Promise.all([
          businessApi.get(`customers/${cid}/`),
          businessApi.get(`locations/${lid}/`),
          businessApi.get(`contacts/${coid}/`),
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
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Card>
            <Spin />
          </Card>
        ) : (
          <Tabs
            items={[
              {
                key: 'profile',
                label: 'Profile',
                children: (
                  <>
                    <AIOverviewCard entityType="contact" entityId={coid} />
                    <EntityProfileHeader
                      entityType="contact"
                      entityId={coid}
                      variant="full"
                      onNavigateToEntity={handleNavigateToEntity}
                    />
                  </>
                ),
              },
              {
                key: 'activity',
                label: 'Activity',
                children: coid ? (
                  <ActivityFeed entityType="contact" entityId={coid} showCreateForm maxHeight="520px" />
                ) : (
                  <Empty description="Activity unavailable" />
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default LocationContactDetail;
