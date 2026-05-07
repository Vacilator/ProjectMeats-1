import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Breadcrumb, Button, Card, Empty, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { businessApi } from '@/services/businessApi';
import { resolveEntityDisplay } from '@/utils/entityDisplay';

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
  const [editOpen, setEditOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [plant, setPlant] = useState<PlantRow | null>(null);

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    if (!sid || !pid) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [supplierResp, plantResp] = await Promise.all([
          businessApi.get(`suppliers/${sid}/`),
          businessApi.get(`plants/${pid}/`),
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
      setContactsError(null);
      try {
        const resp = await businessApi.get('contacts/', {
          params: { plant: pid, page_size: 200, limit: 200 },
        });

        const next = asRows(resp.data)
          .filter((r) => r && typeof r === 'object')
          .map((r) => r as ContactRow);

        if (mounted) setContacts(next);
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
        if (mounted) {
          setContactsError(detail?.detail || detail?.error || 'Failed to load plant contacts.');
        }
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
    return resolveEntityDisplay(
      { name: plant?.name, id: pid },
      { entityType: 'plant', fallbackStyle: 'id' }
    );
  }, [pid, plant?.name]);

  const supplierDisplay = useMemo(
    () =>
      resolveEntityDisplay(
        { name: supplier?.name, id: sid },
        { entityType: 'supplier', fallbackStyle: 'id' }
      ),
    [sid, supplier?.name]
  );

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
        render: (_, c) =>
          resolveEntityDisplay(c, { entityType: 'contact', fallbackStyle: 'id' }).text,
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
                     <span style={{ fontWeight: 700 }} title={title.tooltip || title.text}>
                       {title.text}
                     </span>
                    </span>
                  ),
                },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => setEditOpen(true)} disabled={!pid || loading}>
            Edit Plant
          </Button>
        </div>
      </div>

      {pid ? (
        <EntityFormSurface
          entityType="plant"
          mode="edit"
          variant="modal"
          entityId={pid}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            setRefreshKey((key) => key + 1);
          }}
        />
      ) : null}

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Card>
            <Spin />
          </Card>
        ) : (
          <>
            <AIOverviewCard entityType="plant" entityId={pid} />
            <EntityProfileHeader
              key={`${pid}-${refreshKey}`}
              entityType="plant"
              entityId={pid}
              variant="full"
              onNavigateToEntity={handleNavigateToEntity}
            />
          </>
        )}
      </div>

      <Tabs
        style={{ marginTop: 12 }}
        items={[
          {
            key: 'contacts',
            label: `Plant Dept. Contacts (${contacts.length})`,
            children: (
              <Card
                size="small"
                title="Plant Dept. Contacts"
                extra={
                  <Button
                    type="primary"
                    size="large"
                    style={{ minHeight: 44 }}
                    onClick={() =>
                      navigate(`/contacts?plant=${encodeURIComponent(pid)}${sid ? `&supplier=${encodeURIComponent(sid)}` : ''}&create=1`)
                    }
                    disabled={!pid}
                  >
                    + Add Department Contact
                  </Button>
                }
              >
                {loadingContacts ? (
                  <div style={{ padding: 12 }}>
                    <Spin />
                  </div>
                ) : contactsError ? (
                  <Alert type="error" showIcon title={contactsError} />
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
            children: pid ? <ActivityFeed entityType="plant" entityId={pid} showCreateForm maxHeight="520px" /> : <Empty description="Activity unavailable" />,
          },

        ]}
      />
    </div>
  );
};

export default PlantDetail;
