import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { ActivityFeed, EntityFormSurface } from '@/components/Shared';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import { useAuthState } from '@/contexts/AuthContext';
import { businessApi } from '@/services/businessApi';
import { isAuthError } from '@/utils/isAuthError';
import StandalonePlantEditForm from '@/pages/Plants/StandalonePlantEditForm';
import { resolveEntityDisplay } from '@/utils/entityDisplay';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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
  const location = useLocation();
  const navigate = useNavigate();
  const { supplierId, plantId } = useParams<RouteParams>();
  const startEditing = Boolean(
    (location.state as { startEditing?: boolean } | null)?.startEditing
  );

  const sid = String(supplierId || '').trim();
  const pid = String(plantId || '').trim();
  const { loading: authLoading, isAuthenticated } = useAuthState();
  useDocumentTitle(pid ? `Plant ${pid}` : 'Plant Detail');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(startEditing);
  const isCreatingDepartmentContact = useMemo(
    () => new URLSearchParams(location.search).get('createDeptContact') === '1',
    [location.search]
  );

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [plant, setPlant] = useState<PlantRow | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!sid || !pid) return;
    if (!isAuthenticated) {
      setAuthError(true);
      setLoading(false);
      setSupplier(null);
      setPlant(null);
      setLoadError(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setAuthError(false);
      setLoadError(null);
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
      } catch (error: unknown) {
        if (!mounted) return;
        if (isAuthError(error)) {
          setAuthError(true);
          setSupplier(null);
          setPlant(null);
          setContacts([]);
          setContactsError(null);
          return;
        }
        setLoadError('Failed to load plant details.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated, pid, sid]);

  useEffect(() => {
    if (authLoading) return;
    if (!pid) return;
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
          params: { plant: pid, page_size: 200, limit: 200 },
        });

        const next = asRows(resp.data)
          .filter((r) => r && typeof r === 'object')
          .map((r) => r as ContactRow);

        if (mounted) setContacts(next);
      } catch (err: unknown) {
        if (mounted) {
          if (isAuthError(err)) {
            setAuthError(true);
            setContacts([]);
            setContactsError(null);
            return;
          }
          const detail =
            (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
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
  }, [authError, authLoading, isAuthenticated, pid, refreshKey]);

  useEffect(() => {
    if (startEditing) {
      setIsEditing(true);
    }
  }, [startEditing]);

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

  const departmentContactInitialValues = useMemo(
    () => ({
      ...(sid ? { supplier: sid } : {}),
      ...(pid ? { plant: pid } : {}),
    }),
    [pid, sid]
  );
  const setDepartmentContactCreateRoute = useCallback(
    (open: boolean) => {
      const next = new URLSearchParams(location.search);
      if (open) {
        next.set('createDeptContact', '1');
      } else {
        next.delete('createDeptContact');
      }

      navigate(
        {
          pathname: location.pathname,
          search: next.toString() ? `?${next.toString()}` : '',
        },
        { replace: !open }
      );
    },
    [location.pathname, location.search, navigate]
  );
  const showAuthFallback = !authLoading && (!isAuthenticated || authError);

  const handleEditOpen = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditSaved = useCallback(() => {
    setIsEditing(false);
    setRefreshKey((key) => key + 1);
  }, []);

  const handleDeptContactClose = useCallback(() => {
    setDepartmentContactCreateRoute(false);
  }, [setDepartmentContactCreateRoute]);

  const handleDeptContactSuccess = useCallback(() => {
    setDepartmentContactCreateRoute(false);
    setRefreshKey((key) => key + 1);
  }, [setDepartmentContactCreateRoute]);

  if (isEditing) {
    return (
      <StandalonePlantEditForm
        plantId={pid}
        onCancel={handleEditCancel}
        onSaved={handleEditSaved}
      />
    );
  }

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
        <Button type="primary" onClick={handleEditOpen} disabled={!pid || loading || showAuthFallback}>
          Edit Plant
        </Button>
      </div>
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
            description="Your session expired while loading this plant. Please sign in again."
          />
        ) : loadError ? (
          <Alert type="error" showIcon title={loadError} />
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
            <AIEntityInsights entityType="plant" entityId={pid} />
          </>
        )}
      </div>

      {!showAuthFallback && <Tabs
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
                     onClick={() => setDepartmentContactCreateRoute(true)}
                     disabled={!pid || loading || showAuthFallback}
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
                    aria-label="Supplier plant contacts"
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
      />}
      <FormErrorBoundary entityType="contact" onClose={handleDeptContactClose}>
        <EntityFormSurface
          entityType="contact"
          mode="create"
          isOpen={isCreatingDepartmentContact}
          onClose={handleDeptContactClose}
          initialValues={departmentContactInitialValues}
          onSuccess={handleDeptContactSuccess}
        />
      </FormErrorBoundary>
    </div>
  );
};

export default PlantDetail;
