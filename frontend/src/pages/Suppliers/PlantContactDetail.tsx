import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Empty, Spin, Tabs } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { ActivityFeed } from '@/components/Shared';
import { apiClient } from '@/services/apiService';
import { resolveEntityDisplay } from '@/utils/entityDisplay';

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
          apiClient.get(`suppliers/${sid}/`),
          apiClient.get(`plants/${pid}/`),
          apiClient.get(`contacts/${cid}/`),
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

  const contactLabel = useMemo(() => {
    return resolveEntityDisplay(
      { first_name: contact?.first_name, last_name: contact?.last_name, id: cid },
      { entityType: 'contact', fallbackStyle: 'id' }
    );
  }, [cid, contact?.first_name, contact?.last_name]);

  const supplierDisplay = useMemo(
    () =>
      resolveEntityDisplay(
        { name: supplier?.name, id: sid },
        { entityType: 'supplier', fallbackStyle: 'id' }
      ),
    [sid, supplier?.name]
  );

  const plantDisplay = useMemo(
    () =>
      resolveEntityDisplay(
        { name: plant?.name, id: pid },
        { entityType: 'plant', fallbackStyle: 'id' }
      ),
    [pid, plant?.name]
  );

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Breadcrumb
            items={[
              {
                title: (
                  <span>
                    Supplier:{' '}
                    <Link to={sid ? `/suppliers/${sid}` : '/suppliers'}>
                      <span title={supplierDisplay.tooltip || supplierDisplay.text}>
                        {supplierDisplay.text}
                      </span>
                    </Link>
                  </span>
                ),
              },
              {
                title: (
                  <span>
                    Plants:{' '}
                    <Link to={`/suppliers/${sid}/plants/${pid}`}>
                      <span title={plantDisplay.tooltip || plantDisplay.text}>
                        {plantDisplay.text}
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
