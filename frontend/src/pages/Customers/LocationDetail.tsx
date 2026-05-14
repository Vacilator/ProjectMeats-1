import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { useAuthState } from '@/contexts/AuthContext';
import { businessApi } from '@/services/businessApi';
import { isAuthError } from '@/utils/isAuthError';
import { resolveEntityDisplay } from '@/utils/entityDisplay';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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
  const { loading: authLoading, isAuthenticated } = useAuthState();

  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!cid || !lid) return;
    if (!isAuthenticated) {
      setAuthError(true);
      setLoading(false);
      setCustomer(null);
      setLocation(null);
      setLoadError(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setAuthError(false);
      setLoadError(null);
      try {
        const [customerResp, locationResp] = await Promise.all([
          businessApi.get(`customers/${cid}/`),
          businessApi.get(`locations/${lid}/`),
        ]);

        const c = customerResp.data as unknown;
        const l = locationResp.data as unknown;

        if (!mounted) return;
        setCustomer((c && typeof c === 'object' ? (c as CustomerRow) : null) || null);
        setLocation((l && typeof l === 'object' ? (l as LocationRow) : null) || null);
      } catch (error: unknown) {
        if (!mounted) return;
        if (isAuthError(error)) {
          setAuthError(true);
          setCustomer(null);
          setLocation(null);
          setContacts([]);
          setContactsError(null);
          return;
        }
        setLoadError('Failed to load location details.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [authLoading, cid, isAuthenticated, lid, refreshKey]);

  useEffect(() => {
    if (authLoading) return;
    if (!lid) return;
    if (!isAuthenticated || authError) {
      setLoadingContacts(false);
      setContacts([]);
      setContactsError(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoadingContacts(true);
      setContactsError(null);
      try {
        const resp = await businessApi.get('contacts/', {
          params: { location: lid, page_size: 200, limit: 200 },
        });

        const next = asRows(resp.data)
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
        const detail =
          (error as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
        setContactsError(detail?.detail || detail?.error || 'Failed to load location contacts.');
      } finally {
        if (mounted) setLoadingContacts(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [authError, authLoading, isAuthenticated, lid]);

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

  const handleEditClose = useCallback(() => {
    setShowEditModal(false);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    setRefreshKey((k) => k + 1);
  }, []);

  const showAuthFallback = !authLoading && (!isAuthenticated || authError);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Button type="primary" onClick={() => setShowEditModal(true)} disabled={!lid || loading || showAuthFallback}>
          Edit Location
        </Button>
      </div>

      {showEditModal && lid && !showAuthFallback && (
        <EntityFormSurface
          entityType="location"
          mode="edit"
          entityId={lid}
          isOpen={showEditModal}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      )}

      <div style={{ marginTop: 12 }}>
        {authLoading || loading ? (
          <Card>
            <Spin />
          </Card>
        ) : showAuthFallback ? (
          <Alert
            type="warning"
            showIcon
            title="Authentication required"
            description="Your session expired while loading this location. Please sign in again."
          />
        ) : loadError ? (
          <Alert type="error" showIcon title={loadError} />
        ) : (
          <>
            <AIOverviewCard entityType="location" entityId={lid} />
            <EntityProfileHeader
              key={`${lid}-${refreshKey}`}
              entityType="location"
              entityId={lid}
              variant="full"
              onNavigateToEntity={handleNavigateToEntity}
            />
            <AIEntityInsights entityType="location" entityId={lid} />
          </>
        )}
      </div>

      {!showAuthFallback && <Tabs
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
                ) : contactsError ? (
                  <Alert type="error" showIcon title={contactsError} />
                ) : contacts.length === 0 ? (
                  <Empty description="No contacts for this location" />
                ) : (
                  <Table
                    aria-label="Customer location contacts"
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
      />}
    </div>
  );
};

export default LocationDetail;
