import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Empty, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EntityProfileHeader } from '@/components/Cockpit';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { apiClient } from '@/services/apiService';

type RouteParams = { supplierId?: string; plantId?: string };

type SupplierRow = { id: number; name?: string };

type PlantRow = { id: number; name?: string; plant_est_num?: string | null };

type ContactRow = {
  id: string | number;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  mobile_phone?: string | null;
  office_phone?: string | null;
  office_phone_ext?: string | null;
  department?: string | null;
};

const asRows = (payload: unknown): any[] => {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  const results = Array.isArray(obj?.results) ? (obj?.results as unknown[]) : null;
  return Array.isArray(results) ? (results as any[]) : Array.isArray(payload) ? (payload as any[]) : [];
};

export const PlantDetail: React.FC = () => {
  const navigate = useNavigate();
  const { supplierId, plantId } = useParams<RouteParams>();

  const sid = String(supplierId || '').trim();
  const pid = String(plantId || '').trim();

  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [plant, setPlant] = useState<PlantRow | null>(null);

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!sid || !pid) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [supplierResp, plantResp] = await Promise.all([
          apiClient.get(`suppliers/${sid}/`),
          apiClient.get(`plants/${pid}/`),
        ]);

        const s = supplierResp.data as unknown;
        const p = plantResp.data as unknown;

        if (!mounted) return;
        setSupplier((s && typeof s === 'object' ? (s as SupplierRow) : null) || null);
        setPlant((p && typeof p === 'object' ? (p as PlantRow) : null) || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [pid, refreshKey, sid]);

  useEffect(() => {
    if (!pid) return;
    let mounted = true;

    const load = async () => {
      setLoadingContacts(true);
      try {
        const resp = await apiClient.get('contacts/', {
          params: { plant: pid, page_size: 200, limit: 200 },
        });

        const next = asRows(resp.data)
          .filter((r) => r && typeof r === 'object')
          .map((r) => r as ContactRow);

        if (mounted) setContacts(next);
      } finally {
        if (mounted) setLoadingContacts(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [pid]);

  const title = useMemo(() => {
    const name = String(plant?.name || '').trim();
    return name || (pid ? `Plant #${pid}` : 'Plant');
  }, [pid, plant?.name]);

  const handleNavigateToEntity = useCallback(
    (entityType: string, entityId: string, _label: string) => {
      const t = String(entityType || '').trim().toLowerCase();
      const id = String(entityId || '').trim();
      if (!t || !id) return;

      if (t === 'supplier') {
        navigate(`/suppliers/${id}`);
        return;
      }

      if (t === 'plant') {
        navigate(sid ? `/suppliers/${sid}/plants/${id}` : `/plants/${id}`);
        return;
      }

      if (t === 'contact') {
        if (sid && pid) {
          navigate(`/suppliers/${sid}/plants/${pid}/contacts/${encodeURIComponent(String(id))}`);
          return;
        }

        navigate(`/records/contact/${encodeURIComponent(String(id))}`);
        return;
      }

      if (t === 'customer') {
        navigate(`/customers/${id}`);
        return;
      }

      if (t === 'location') {
        navigate(`/locations/${id}`);
        return;
      }

      navigate(`/${t}/${id}`);
    },
    [navigate, pid, sid]
  );

  const columns: ColumnsType<ContactRow> = useMemo(
    () => [
      {
        title: 'Name',
        key: 'name',
        render: (_, c) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed',
      },
      {
        title: 'Department',
        dataIndex: 'department',
        key: 'department',
        render: (v) => (v ? String(v) : '-'),
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
        render: (v) => (v ? String(v) : '-'),
      },
      {
        title: 'Mobile',
        dataIndex: 'mobile_phone',
        key: 'mobile_phone',
        render: (v) => (v ? String(v) : '-'),
      },
      {
        title: 'Office',
        key: 'office_phone',
        render: (_, c) => {
          const phone = c.office_phone ? String(c.office_phone) : '';
          const ext = c.office_phone_ext ? String(c.office_phone_ext) : '';
          if (!phone) return '-';
          return ext ? `${phone} x${ext}` : phone;
        },
      },
    ],
    []
  );

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Breadcrumb
            items={[
              {
                title: (
                  <span>
                    Supplier:{' '}
                    <Link to={sid ? `/suppliers/${sid}` : '/suppliers'}>
                      {String(supplier?.name || '').trim() || (sid ? `Supplier #${sid}` : 'Suppliers')}
                    </Link>
                  </span>
                ),
              },
              {
                title: (
                  <span>
                    Plants: <span style={{ fontWeight: 700 }}>{title}</span>
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => setShowEditModal(true)} disabled={!pid || loading}>
            Edit Plant
          </Button>
        </div>
      </div>

      {showEditModal && pid && (
        <EntityFormSurface
          entityType="plant"
          mode="edit"
          entityId={pid}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Card>
            <Spin />
          </Card>
        ) : (
          <EntityProfileHeader
            key={`${pid}-${refreshKey}`}
            entityType="plant"
            entityId={pid}
            variant="full"
            onNavigateToEntity={handleNavigateToEntity}
          />
        )}
      </div>

      <Tabs
        style={{ marginTop: 12 }}
        items={[
          {
            key: 'contacts',
            label: `Contacts (${contacts.length})`,
            children: (
              <Card size="small" title="Contacts">
                {loadingContacts ? (
                  <div style={{ padding: 12 }}>
                    <Spin />
                  </div>
                ) : contacts.length === 0 ? (
                  <Empty description="No contacts for this plant" />
                ) : (
                  <Table
                    size="small"
                    columns={columns}
                    dataSource={contacts}
                    rowKey={(r) => String(r.id)}
                    pagination={false}
                    onRow={(record) => ({
                      onClick: () =>
                        navigate(`/suppliers/${sid}/plants/${pid}/contacts/${encodeURIComponent(String(record.id))}`),
                      style: { cursor: 'pointer' },
                    })}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'workflows',
            label: 'Automation',
            children: pid ? <EntityWorkflowStatusPanel entityType="plant" entityId={pid} /> : <Empty description="Automation unavailable" />,
          },
          {
            key: 'activity',
            label: 'Activity',
            children:
              Number.isFinite(Number(pid)) && Number(pid) > 0 ? (
                <ActivityFeed entityType="plant" entityId={Number(pid)} showCreateForm maxHeight="520px" />
              ) : (
                <Empty description="Activity unavailable" />
              ),
          },

        ]}
      />
    </div>
  );
};

export default PlantDetail;
