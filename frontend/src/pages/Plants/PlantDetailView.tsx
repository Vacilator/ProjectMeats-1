import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Tabs, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { useAuthState } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiService';
import { isAuthError } from '@/utils/isAuthError';
import StandalonePlantEditForm from './StandalonePlantEditForm';
import { resolveEntityDisplay } from '@/utils/entityDisplay';

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
  const name = resolveEntityDisplay(c, { entityType: 'contact', fallbackStyle: 'id' }).text;
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
  const { loading: authLoading, isAuthenticated } = useAuthState();

  const plantId = String(id || '').trim();

  const [isEditing, setIsEditing] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!plantId) return;
    if (!isAuthenticated) {
      setAuthError(true);
      setLoadingContacts(false);
      setContacts([]);
      setContactsError(null);
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoadingContacts(true);
      setAuthError(false);
      setContactsError(null);
      try {
        const resp = await apiClient.get('contacts/', {
          params: { plant: plantId, page_size: 200, limit: 200 },
        });
        const payload = resp.data as unknown;
        const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
        const rows = Array.isArray(obj?.results) ? (obj?.results as unknown[]) : (payload as unknown[]);
        const next = (Array.isArray(rows) ? rows : [])
          .filter((r) => r && typeof r === 'object')
          .map((r) => r as ContactRow);
        if (mounted) setContacts(next);
      } catch (error: unknown) {
        if (!mounted) return;
        if (isAuthError(error)) {
          setAuthError(true);
          setContacts([]);
          setContactsError(null);
          return;
        }
        setContactsError('Failed to load plant contacts.');
      } finally {
        if (mounted) setLoadingContacts(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated, plantId]);

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

  const showAuthFallback = !authLoading && (!isAuthenticated || authError);

  if (isEditing) {
    return (
      <StandalonePlantEditForm
        plantId={plantId}
        onCancel={() => setIsEditing(false)}
        onSaved={() => {
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>Plant</div>
        </div>
        <Button
          type="primary"
          onClick={() => setIsEditing(true)}
          disabled={!plantId || showAuthFallback}
        >
          Edit Plant
        </Button>
      </div>

      <div style={{ marginTop: 12 }}>
        {!showAuthFallback && (
          <EntityFormSurface
            entityType="plant"
            mode="view"
            variant="inline"
            isOpen={true}
            entityId={plantId}
            onClose={() => navigate('/plants')}
          />
        )}
      </div>

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'contacts',
            label: 'Contacts',
            children: (
              <Card title="Contacts">
                {authLoading || loadingContacts ? (
                  <div style={{ padding: 12 }}>
                    <Spin />
                  </div>
                ) : showAuthFallback ? (
                  <Alert
                    type="warning"
                    showIcon
                    title="Authentication required"
                    description="Your session expired while loading this plant. Please sign in again."
                  />
                ) : contactsError ? (
                  <Alert type="error" showIcon title={contactsError} />
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
