import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Tabs, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { EntityFormSurface } from '@/components/Shared';
import { useAuthState } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiService';
import { isAuthError } from '@/utils/isAuthError';
import HardcodedPlantForm from './HardcodedPlantForm';

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
  const { loading: authLoading, isAuthenticated } = useAuthState();

  const plantId = String(id || '').trim();

  const [isEditing, setIsEditing] = useState(false);
  const [plantData, setPlantData] = useState<Record<string, unknown> | null>(null);
  const [loadingPlant, setLoadingPlant] = useState(false);
  const [plantError, setPlantError] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!plantId) return;
    if (!isAuthenticated) {
      setAuthError(true);
      setPlantData(null);
      setPlantError(null);
      setLoadingPlant(false);
      return;
    }

    let mounted = true;
    const loadPlant = async () => {
      setLoadingPlant(true);
      setPlantError(null);
      try {
        const response = await apiClient.get(`/plants/${plantId}/`);
        if (mounted) {
          setPlantData(
            response.data && typeof response.data === 'object'
              ? (response.data as Record<string, unknown>)
              : null,
          );
        }
      } catch (error: unknown) {
        if (!mounted) return;
        if (isAuthError(error)) {
          setAuthError(true);
          setPlantData(null);
          setPlantError(null);
          return;
        }
        setPlantError('Failed to load plant details.');
      } finally {
        if (mounted) {
          setLoadingPlant(false);
        }
      }
    };

    void loadPlant();
    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated, plantId]);

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
      setAuthError(false);
      setContactsError(null);
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

  if (isEditing && plantData) {
    return (
      <HardcodedPlantForm
        plantId={plantId}
        initialValues={plantData}
        onCancel={() => setIsEditing(false)}
        onSaved={(nextPlant) => {
          setPlantData(nextPlant as unknown as Record<string, unknown>);
          setIsEditing(false);
        }}
      />
    );
  }

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
        <Button
          type="primary"
          onClick={() => setIsEditing(true)}
          disabled={!plantId || showAuthFallback || loadingPlant || !plantData}
        >
          Edit Plant
        </Button>
      </div>

      {plantError ? (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          message={plantError}
        />
      ) : null}

      <div style={{ marginTop: 12 }}>
        {!showAuthFallback && (
          <EntityFormSurface
            entityType="plant"
            mode="view"
            variant="inline"
            isOpen={true}
            entityId={plantId}
            onClose={() => navigate('/suppliers')}
          />
        )}
      </div>

      <Card style={{ marginTop: 16 }} title="Contacts">
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
    </div>
  );
};

export default PlantDetailView;
