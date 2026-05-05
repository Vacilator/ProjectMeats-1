import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Empty, Spin, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { businessApi } from '@/services/businessApi';

type RouteParams = { id?: string };

type PlantRow = {
  id: string | number;
  name?: string;
  supplier?: string | number | null;
  supplier_name?: string | null;
  plant_est_num?: string | null;
};

type ContactRow = {
  id: string | number;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  mobile_phone?: string | null;
  office_phone?: string | null;
  office_phone_ext?: string | null;
  department?: string | null;
  protein_types_responsible?: string[] | null;
  items_responsible?: string[] | null;
};

const normalizeDept = (dept: unknown): string => {
  const d = String(dept || '').trim().toLowerCase();
  if (d === 'sales') return 'sales';
  if (d === 'qa') return 'qa';
  if (d === 'booking') return 'booking';
  if (d === 'accounting') return 'accounting';
  return 'sales';
};

const renderContact = (c: ContactRow) => {
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
  const phones = [
    c.mobile_phone ? `Mobile: ${c.mobile_phone}` : null,
    c.office_phone ? `Office: ${c.office_phone}${c.office_phone_ext ? ` x${c.office_phone_ext}` : ''}` : null,
  ].filter(Boolean);

  return (
    <Card key={String(c.id)} size="small" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {c.department ? <Tag>{c.department}</Tag> : null}
          {c.email ? (
            <a href={`mailto:${c.email}`} style={{ color: 'rgb(var(--color-primary))' }}>
              {c.email}
            </a>
          ) : null}
        </div>
      </div>

      {phones.length ? (
        <div style={{ marginTop: 6, fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
          {phones.join(' • ')}
        </div>
      ) : null}

      {(c.protein_types_responsible?.length || 0) > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--color-text-tertiary))' }}>
            Protein Types
          </div>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(c.protein_types_responsible || []).map((v) => (
              <Tag key={v}>{v}</Tag>
            ))}
          </div>
        </div>
      )}

      {(c.items_responsible?.length || 0) > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--color-text-tertiary))' }}>Items</div>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(c.items_responsible || []).map((v) => (
              <Tag key={v}>{v}</Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export const PlantDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<RouteParams>();

  const plantId = String(id || '').trim();

  const [refreshKey, setRefreshKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [loadingPlant, setLoadingPlant] = useState(true);
  const [plant, setPlant] = useState<PlantRow | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!plantId) return;

    let mounted = true;
    const load = async () => {
      setLoadingPlant(true);
      try {
        const resp = await businessApi.get(`plants/${plantId}/`);
        const payload = resp.data as unknown;

        if (!mounted) return;
        setPlant(
          (payload && typeof payload === 'object' ? (payload as PlantRow) : null) || null
        );
      } finally {
        if (mounted) setLoadingPlant(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [plantId, refreshKey]);

  useEffect(() => {
    if (!plantId) return;

    let mounted = true;
    const load = async () => {
      setLoadingContacts(true);
      try {
        const resp = await businessApi.get('contacts/', {
          params: { plant: plantId, page_size: 200, limit: 200 },
        });
        const payload = resp.data as unknown;
        const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
        const rows = Array.isArray(obj?.results) ? (obj?.results as unknown[]) : (payload as unknown[]);
        const next = (Array.isArray(rows) ? rows : [])
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
  }, [plantId, refreshKey]);

  const grouped = useMemo(() => {
    const buckets: Record<string, ContactRow[]> = {
      sales: [],
      qa: [],
      booking: [],
      accounting: [],
    };

    for (const c of contacts) {
      buckets[normalizeDept(c.department)]?.push(c);
    }

    return buckets;
  }, [contacts]);

  const supplierId = useMemo(() => {
    const raw = plant?.supplier;
    return raw == null ? '' : String(raw).trim();
  }, [plant?.supplier]);

  const title = useMemo(() => {
    const name = String(plant?.name || '').trim();
    return name || (plantId ? `Plant #${plantId}` : 'Plant');
  }, [plant?.name, plantId]);

  const columns: ColumnsType<ContactRow> = useMemo(
    () => [
      {
        title: 'Name',
        key: 'name',
        render: (_, contact) =>
          `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed',
      },
      {
        title: 'Department',
        dataIndex: 'department',
        key: 'department',
        render: (value) => (value ? String(value) : '-'),
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
        render: (value) => (value ? String(value) : '-'),
      },
      {
        title: 'Mobile',
        dataIndex: 'mobile_phone',
        key: 'mobile_phone',
        render: (value) => (value ? String(value) : '-'),
      },
      {
        title: 'Office',
        key: 'office_phone',
        render: (_, contact) => {
          const phone = contact.office_phone ? String(contact.office_phone) : '';
          const ext = contact.office_phone_ext ? String(contact.office_phone_ext) : '';
          if (!phone) return '-';
          return ext ? `${phone} x${ext}` : phone;
        },
      },
    ],
    []
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
        navigate(`/plants/${nextId}`);
        return;
      }

      if (type === 'contact') {
        if (supplierId && plantId) {
          navigate(
            `/suppliers/${supplierId}/plants/${plantId}/contacts/${encodeURIComponent(nextId)}`
          );
          return;
        }

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
    [navigate, plantId, supplierId]
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
                title: supplierId ? (
                  <span>
                    Supplier:{' '}
                    <Link to={`/suppliers/${supplierId}`}>
                      {String(plant?.supplier_name || '').trim() || `Supplier #${supplierId}`}
                    </Link>
                  </span>
                ) : (
                  <span>Plants</span>
                ),
              },
              {
                title: (
                  <span>
                    Plant: <span style={{ fontWeight: 700 }}>{title}</span>
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => setEditOpen(true)} disabled={!plantId || loadingPlant}>
            Edit Plant
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {loadingPlant ? (
          <Card>
            <Spin />
          </Card>
        ) : (
          <>
            <AIOverviewCard entityType="plant" entityId={plantId} />
            <EntityProfileHeader
              key={`${plantId}-${refreshKey}`}
              entityType="plant"
              entityId={plantId}
              variant="full"
              onNavigateToEntity={handleNavigateToEntity}
            />
          </>
        )}
      </div>

      {editOpen && plantId ? (
        <EntityFormSurface
          entityType="plant"
          mode="edit"
          variant="modal"
          isOpen={editOpen}
          entityId={plantId}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            setRefreshKey((key) => key + 1);
          }}
        />
      ) : null}

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'contacts',
            label: `Contacts (${contacts.length})`,
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
                      navigate(
                        `/contacts?plant=${encodeURIComponent(plantId)}${
                          supplierId ? `&supplier=${encodeURIComponent(supplierId)}` : ''
                        }&create=1`
                      )
                    }
                    disabled={!plantId}
                  >
                    + Add Department Contact
                  </Button>
                }
              >
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
                    rowKey={(row) => String(row.id)}
                    pagination={false}
                    onRow={(record) => ({
                      onClick: () => {
                        const contactId = encodeURIComponent(String(record.id));
                        if (supplierId && plantId) {
                          navigate(`/suppliers/${supplierId}/plants/${plantId}/contacts/${contactId}`);
                          return;
                        }

                        navigate(`/records/contact/${contactId}`);
                      },
                      style: { cursor: 'pointer' },
                    })}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'departments',
            label: 'Departments',
            children: (
              <Card size="small" title="Department Contacts">
                <Tabs
                  items={[
                    {
                      key: 'sales',
                      label: `Sales (${grouped.sales.length})`,
                      children: grouped.sales.length ? grouped.sales.map(renderContact) : <Empty description="No sales contacts" />,
                    },
                    {
                      key: 'qa',
                      label: `QA (${grouped.qa.length})`,
                      children: grouped.qa.length ? grouped.qa.map(renderContact) : <Empty description="No QA contacts" />,
                    },
                    {
                      key: 'booking',
                      label: `Booking (${grouped.booking.length})`,
                      children: grouped.booking.length ? grouped.booking.map(renderContact) : <Empty description="No booking contacts" />,
                    },
                    {
                      key: 'accounting',
                      label: `Accounting (${grouped.accounting.length})`,
                      children: grouped.accounting.length ? grouped.accounting.map(renderContact) : <Empty description="No accounting contacts" />,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'workflows',
            label: 'Automation',
            children: plantId ? (
              <EntityWorkflowStatusPanel entityType="plant" entityId={plantId} />
            ) : (
              <Empty description="Automation unavailable" />
            ),
          },
          {
            key: 'activity',
            label: 'Activity',
            children: plantId ? (
              <ActivityFeed entityType="plant" entityId={plantId} showCreateForm maxHeight="520px" />
            ) : (
              <Empty description="Activity unavailable" />
            ),
          },
        ]}
      />
    </div>
  );
};

export default PlantDetailView;
