import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Empty, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EntityProfileHeader } from '@/components/Cockpit';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { apiClient } from '@/services/apiService';

type RouteParams = { customerId?: string; locationId?: string };

type CustomerRow = { id: number; name?: string };

type LocationRow = { id: number; name?: string };

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

export const LocationDetail: React.FC = () => {
  const navigate = useNavigate();
  const { customerId, locationId } = useParams<RouteParams>();

  const cid = String(customerId || '').trim();
  const lid = String(locationId || '').trim();

  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [location, setLocation] = useState<LocationRow | null>(null);

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!cid || !lid) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [customerResp, locationResp] = await Promise.all([
          apiClient.get(`customers/${cid}/`),
          apiClient.get(`locations/${lid}/`),
        ]);

        const c = customerResp.data as unknown;
        const l = locationResp.data as unknown;

        if (!mounted) return;
        setCustomer((c && typeof c === 'object' ? (c as CustomerRow) : null) || null);
        setLocation((l && typeof l === 'object' ? (l as LocationRow) : null) || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [cid, lid, refreshKey]);

  useEffect(() => {
    if (!lid) return;
    let mounted = true;

    const load = async () => {
      setLoadingContacts(true);
      try {
        const resp = await apiClient.get('contacts/', {
          params: { location: lid, page_size: 200, limit: 200 },
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
  }, [lid]);

  const title = useMemo(() => {
    const name = String(location?.name || '').trim();
    return name || (lid ? `Location #${lid}` : 'Location');
  }, [lid, location?.name]);

  const handleNavigateToEntity = useCallback(
    (entityType: string, entityId: string, _label: string) => {
      const t = String(entityType || '').trim().toLowerCase();
      const id = String(entityId || '').trim();
      if (!t || !id) return;

      if (t === 'customer') {
        navigate(`/customers/${id}`);
        return;
      }

      if (t === 'location') {
        navigate(cid ? `/customers/${cid}/locations/${id}` : `/locations/${id}`);
        return;
      }

      if (t === 'contact') {
        if (cid && lid) {
          navigate(`/customers/${cid}/locations/${lid}/contacts/${encodeURIComponent(String(id))}`);
          return;
        }

        navigate(`/records/contact/${encodeURIComponent(String(id))}`);
        return;
      }

      if (t === 'supplier') {
        navigate(`/suppliers/${id}`);
        return;
      }

      if (t === 'plant') {
        navigate(`/plants/${id}`);
        return;
      }

      navigate(`/${t}/${id}`);
    },
    [cid, lid, navigate]
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
                    Locations: <span style={{ fontWeight: 700 }}>{title}</span>
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => setShowEditModal(true)} disabled={!lid || loading}>
            Edit Location
          </Button>
        </div>
      </div>

      {showEditModal && lid && (
        <EntityFormSurface
          entityType="location"
          mode="edit"
          entityId={lid}
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
            key={`${lid}-${refreshKey}`}
            entityType="location"
            entityId={lid}
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
                  <Empty description="No contacts for this location" />
                ) : (
                  <Table
                    size="small"
                    columns={columns}
                    dataSource={contacts}
                    rowKey={(r) => String(r.id)}
                    pagination={false}
                    onRow={(record) => ({
                      onClick: () =>
                        navigate(`/customers/${cid}/locations/${lid}/contacts/${encodeURIComponent(String(record.id))}`),
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
            children: lid ? <EntityWorkflowStatusPanel entityType="location" entityId={lid} /> : <Empty description="Automation unavailable" />,
          },
          {
            key: 'activity',
            label: 'Activity',
            children:
              Number.isFinite(Number(lid)) && Number(lid) > 0 ? (
                <ActivityFeed entityType="location" entityId={Number(lid)} showCreateForm maxHeight="520px" />
              ) : (
                <Empty description="Activity unavailable" />
              ),
          },

        ]}
      />
    </div>
  );
};

export default LocationDetail;
