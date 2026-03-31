import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Spin, Tabs, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { EntityFormSurface } from '@/components/Shared';
import { apiClient } from '@/services/apiService';

type RouteParams = { id?: string };

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
        {c.email ? (
          <a href={`mailto:${c.email}`} style={{ color: 'rgb(var(--color-primary))' }}>
            {c.email}
          </a>
        ) : null}
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

export const LocationDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<RouteParams>();

  const locationId = String(id || '').trim();

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!locationId) return;

    let mounted = true;
    const load = async () => {
      setLoadingContacts(true);
      try {
        const resp = await apiClient.get('contacts/', {
          params: { location: locationId, page_size: 200, limit: 200 },
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
  }, [locationId]);

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

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>Location</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <EntityFormSurface
          entityType="location"
          mode="view"
          variant="inline"
          isOpen={true}
          entityId={locationId}
          onClose={() => navigate('/customers')}
        />
      </div>

      <Card style={{ marginTop: 16 }} title="Contacts">
        {loadingContacts ? (
          <div style={{ padding: 12 }}>
            <Spin />
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  );
};

export default LocationDetailView;
