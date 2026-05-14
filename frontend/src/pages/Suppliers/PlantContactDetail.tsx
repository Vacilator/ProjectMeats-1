import React, { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Spin, Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { ActivityFeed } from '@/components/Shared';
import { businessApi } from '@/services/businessApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

type RouteParams = { supplierId?: string; plantId?: string; contactId?: string };

type SupplierRow = { id: number; name?: string };

type PlantRow = { id: number; name?: string };

type ContactRow = { id: number; first_name?: string; last_name?: string };

export const PlantContactDetail: React.FC = () => {
  const navigate = useNavigate();
  const { supplierId, plantId, contactId } = useParams<RouteParams>();

  const sid = String(supplierId || '').trim();
  const pid = String(plantId || '').trim();
  const cid = String(contactId || '').trim();
  useDocumentTitle('Plant Contact Detail');

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [plant, setPlant] = useState<PlantRow | null>(null);
  const [contact, setContact] = useState<ContactRow | null>(null);

  useEffect(() => {
    if (!sid || !pid || !cid) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [supplierResp, plantResp, contactResp] = await Promise.all([
          businessApi.get(`suppliers/${sid}/`),
          businessApi.get(`plants/${pid}/`),
          businessApi.get(`contacts/${cid}/`),
        ]);

        if (!mounted) return;
        setSupplier((supplierResp.data as SupplierRow) || null);
        setPlant((plantResp.data as PlantRow) || null);
        setContact((contactResp.data as ContactRow) || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [cid, pid, sid]);

  const handleNavigateToEntity = useCallback(
    (entityType: string, entityId: string, _label: string) => {
      const type = String(entityType || '').trim().toLowerCase();
      const nextId = String(entityId || '').trim();
      if (!type || !nextId) return;

      if (type === 'supplier') {
        navigate(`/suppliers/${nextId}`);
        return;
      }

      if (type === 'plant') {
        navigate(sid ? `/suppliers/${sid}/plants/${nextId}` : `/plants/${nextId}`);
        return;
      }

      if (type === 'contact') {
        navigate(`/records/contact/${encodeURIComponent(nextId)}`);
        return;
      }

      if (type === 'customer') {
        navigate(`/customers/${nextId}`);
        return;
      }

      if (type === 'location') {
        navigate(`/locations/${nextId}`);
        return;
      }

      navigate(`/${type}/${nextId}`);
    },
    [navigate, sid]
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
                    <AIOverviewCard entityType="contact" entityId={cid} />
                    <EntityProfileHeader
                      entityType="contact"
                      entityId={cid}
                      variant="full"
                      onNavigateToEntity={handleNavigateToEntity}
                    />
                  </>
                ),
              },
              {
                key: 'activity',
                label: 'Activity',
                children: cid ? (
                  <ActivityFeed entityType="contact" entityId={cid} showCreateForm maxHeight="520px" />
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

export default PlantContactDetail;
