import React, { useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Empty, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EntityFormSurface } from '@/components/Shared';
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
  }, [cid, lid]);

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
                    Locations: <span style={{ fontWeight: 700 }}>{title}</span>
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
          <EntityFormSurface
            entityType="location"
            mode="view"
            variant="inline"
            isOpen={true}
            entityId={lid}
            onClose={() => navigate('/customers')}
          />
        )}
      </div>

      <Card style={{ marginTop: 16 }} title="Contacts">
        {loadingContacts ? (
          <div style={{ padding: 12 }}>
            <Spin />
          </div>
        ) : contacts.length === 0 ? (
          <Empty description="No contacts for this location" />
        ) : (
          <Table
            columns={columns}
            dataSource={contacts}
            rowKey={(r) => String(r.id)}
            pagination={false}
            onRow={(record) => ({
              onClick: () => navigate(`/customers/${cid}/locations/${lid}/contacts/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </Card>
    </div>
  );
};

export default LocationDetail;
