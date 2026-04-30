import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Spin, Tabs } from 'antd';

import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { AuditHistoryTimeline } from '@/components/Operations/AuditHistoryTimeline';
import { OperationalDocumentActions } from '@/components/Operations/OperationalDocumentActions';
import { supportsAuditHistory, supportsOperationalActions } from '@/components/Operations/documentOperations';
import { ActivityFeed, CommentsPanel, EntityFormSurface, UnifiedEntityTable } from '@/components/Shared';
import type { EntityFormMode } from '@/components/Shared/EntityFormSurface';
import { apiClient } from '@/services/apiService';
import { businessApi } from '@/services/businessApi';

type RouteParams = {
  id?: string;
};

type RelationshipsPayload = {
  relationships?: Record<string, unknown[]>;
  counts?: Record<string, number>;
};

export interface UniversalEntityRecordPageProps {
  entityType: string;

  /** Base path for this entity section (e.g. "/customers" or "/suppliers"). */
  basePath: string;

  mode: 'create' | 'view' | 'edit';
}

const extractId = (result: unknown): string | null => {
  const row = (result && typeof result === 'object' ? (result as Record<string, unknown>) : {}) || {};
  const id = row.id ?? row.uuid ?? row.pk;
  const s = String(id ?? '').trim();
  return s ? s : null;
};

const getRecordPath = (entityType: string, id: string) => {
  const t = String(entityType || '').trim().toLowerCase();
  return `/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`;
};

export const UniversalEntityRecordPage: React.FC<UniversalEntityRecordPageProps> = ({
  entityType,
  basePath,
  mode,
}) => {
  const navigate = useNavigate();
  const { id } = useParams<RouteParams>();

  const entityId = id ? String(id) : undefined;

  const normalizedEntityType = String(entityType || '').trim().toLowerCase();
  const isSupplier = normalizedEntityType === 'supplier';
  const isCustomer = normalizedEntityType === 'customer';

  const showTabs = mode === 'view' && Boolean(entityId);
  const canShowOperationalActions = supportsOperationalActions(normalizedEntityType);
  const canShowAuditHistory = supportsAuditHistory(normalizedEntityType);

  const childEntityType = isSupplier ? 'plant' : 'location';
  const childEntityDisplayName = isSupplier ? 'Plant' : 'Location';
  const childLabel = isSupplier ? 'Plants' : 'Locations';
  const childEndpoint = isSupplier ? 'plants/' : 'locations/';
  const childFilterKey = isSupplier ? 'supplier' : 'customer';

  const [childRows, setChildRows] = useState<Record<string, unknown>[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [childCreateOpen, setChildCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [deptContactsRows, setDeptContactsRows] = useState<Record<string, unknown>[]>([]);
  const [deptContactsLoading, setDeptContactsLoading] = useState(false);

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [relationshipCounts, setRelationshipCounts] = useState<Record<string, number>>({});
  const [relationships, setRelationships] = useState<Record<string, unknown[]>>({});

  const loadChildRows = useCallback(async () => {
    if (!entityId || !(isSupplier || isCustomer) || mode !== 'view') return;
    setChildLoading(true);
    try {
      const resp = await apiClient.get(childEndpoint, {
        params: {
          [childFilterKey]: entityId,
          page_size: 50,
          limit: 50,
        },
      });

      const payload = resp.data as unknown;
      const payloadObj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const rows = Array.isArray(payloadObj?.results) ? (payloadObj?.results as unknown[]) : (payload as unknown[]);

      setChildRows(
        (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object') as Record<string, unknown>[]
      );
    } finally {
      setChildLoading(false);
    }
  }, [childEndpoint, childFilterKey, entityId, isCustomer, isSupplier, mode]);

  const loadDeptContacts = useCallback(async () => {
    if (!entityId || !(isSupplier || isCustomer) || mode !== 'view') return;
    setDeptContactsLoading(true);
    try {
      const params: Record<string, unknown> = {
        page_size: 50,
        limit: 50,
      };
      params[childFilterKey] = entityId;

      const resp = await apiClient.get('contacts/', { params });
      const payload = resp.data as unknown;
      const payloadObj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const rows = Array.isArray(payloadObj?.results) ? (payloadObj?.results as unknown[]) : (payload as unknown[]);

      setDeptContactsRows(
        (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object') as Record<string, unknown>[]
      );
    } finally {
      setDeptContactsLoading(false);
    }
  }, [childFilterKey, entityId, isCustomer, isSupplier, mode]);

  const loadOverview = useCallback(async () => {
    if (!entityId || mode !== 'view') return;

    setOverviewLoading(true);
    try {
      const relRes = await businessApi.get(
        `/system/entities/${normalizedEntityType}/${encodeURIComponent(entityId)}/relationships/`
      );

      const payload = (relRes.data || {}) as RelationshipsPayload;
      setRelationshipCounts(payload.counts || {});
      setRelationships(payload.relationships || {});
    } catch {
      // Degrade gracefully; related panels can render empty states.
      setRelationshipCounts({});
      setRelationships({});
    } finally {
      setOverviewLoading(false);
    }
  }, [entityId, mode, normalizedEntityType]);

  useEffect(() => {
    void loadChildRows();
  }, [loadChildRows]);

  useEffect(() => {
    void loadDeptContacts();
  }, [loadDeptContacts]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const formMode: EntityFormMode = useMemo(() => {
    if (mode === 'create') return 'create';
    if (mode === 'edit') return 'edit';
    return 'view';
  }, [mode]);

  const entityLabel = useMemo(() => {
    const t = String(normalizedEntityType || '').trim().toLowerCase();
    if (t === 'supplier') return 'Supplier';
    if (t === 'customer') return 'Customer';
    if (t === 'plant') return 'Plant';
    if (t === 'location') return 'Location';
    if (t === 'contact') return 'Contact';
    if (t === 'purchase_order' || t === 'purchase-orders' || t === 'purchase_orders') return 'Purchase Order';
    if (t === 'sales_order' || t === 'sales-orders' || t === 'sales_orders') return 'Sales Order';
    if (t === 'inquiry' || t === 'inquiries') return 'Inquiry';
    if (t === 'invoice' || t === 'invoices') return 'Invoice';
    if (t === 'claim' || t === 'claims') return 'Claim';

    const cleaned = t.replace(/[_-]+/g, ' ').trim();
    return cleaned ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Record';
  }, [normalizedEntityType]);

  const sectionLabel = useMemo(() => {
    const p = String(basePath || '').toLowerCase();
    if (p.startsWith('/suppliers')) return 'Suppliers';
    if (p.startsWith('/customers')) return 'Customers';
    if (p.startsWith('/contacts')) return 'Contacts';
    if (p.includes('/plants')) return 'Plants';
    if (p.includes('/locations')) return 'Locations';
    if (p.includes('/purchase-orders')) return "P.O.'s";
    if (p.includes('/sales-orders')) return "S.O.'s";
    if (p.includes('/inquiries')) return 'Inquiries';
    if (p.includes('/invoices')) return 'Invoices';

    return `${entityLabel}s`;
  }, [basePath, entityLabel]);

  const title = useMemo(() => {
    if (mode === 'create') return `New ${entityLabel}`;
    if (mode === 'edit') return `Edit ${entityLabel}`;
    if (mode === 'view' && entityId) return `${entityLabel} ${entityId}`;
    return entityLabel;
  }, [entityId, entityLabel, mode]);

  const numericEntityId = useMemo(() => {
    const n = Number(entityId);
    return Number.isFinite(n) ? n : null;
  }, [entityId]);

  const renderRelationshipTable = useCallback(
    (relKey: string, label: string) => {
      const rows = relationships[relKey] || [];
      if (!Array.isArray(rows) || rows.length === 0) return null;

      const types = new Set(rows.map((r: any) => String(r?.type ?? '').toLowerCase()).filter(Boolean));
      const isMixed = types.size > 1;
      const tableEntityType = !isMixed
        ? Array.from(types)[0]
        : relKey === 'contacts'
          ? 'contact'
          : relKey === 'inquiries'
            ? 'inquiry'
            : relKey === 'invoices'
              ? 'invoice'
              : relKey.includes('product')
                ? 'product'
                : 'sales_order';

      return (
        <Card
          key={relKey}
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <span>
              {label}{' '}
              {relationshipCounts[relKey] != null ? (
                <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>({relationshipCounts[relKey]})</span>
              ) : null}
            </span>
          }
        >
          <UnifiedEntityTable
            entityType={tableEntityType}
            data={rows as any}
            enableQuickEdit={!isMixed}
            recordPathForRow={(_t, row: any) => {
              const rowId = String(row?.id ?? '').trim();
              const rowType = String(row?.type ?? tableEntityType).trim();
              if (!rowId) return null;
              return getRecordPath(rowType, rowId);
            }}
          />
        </Card>
      );
    },
    [relationshipCounts, relationships]
  );

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Breadcrumb
          items={[
            {
              title: (
                <button
                  type="button"
                  onClick={() => navigate(basePath)}
                  style={{
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'rgb(var(--color-primary))',
                    fontWeight: 700,
                  }}
                >
                  {sectionLabel}
                </button>
              ),
            },
            {
              title: (
                <span style={{ color: 'rgb(var(--color-text-primary))', fontWeight: 700 }}>
                  {title}
                </span>
              ),
            },
          ]}
        />

        {mode === 'view' && entityId && (
          <SpaceWrap>
            {canShowOperationalActions ? (
              <OperationalDocumentActions
                entityType={normalizedEntityType}
                entityId={entityId}
                recordLabel={title}
                compact
                onChanged={() => {
                  void loadOverview();
                }}
              />
            ) : null}
            <Button type="primary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </SpaceWrap>
        )}

        {mode === 'edit' && entityId && (
          <Button onClick={() => navigate(`${basePath}/${encodeURIComponent(entityId)}`)}>Cancel</Button>
        )}
      </div>

      {/* Create/Edit keep the form-first experience. */}
      {mode !== 'view' && (
        <EntityFormSurface
          entityType={entityType}
          mode={formMode}
          variant="inline"
          isOpen={true}
          entityId={formMode === 'create' ? undefined : entityId}
          onClose={() => navigate(basePath)}
          onSuccess={(result) => {
            const nextId = extractId(result);

            if (mode === 'create' && nextId) {
              navigate(`${basePath}/${encodeURIComponent(nextId)}`);
              return;
            }

            if (mode === 'edit' && entityId) {
              navigate(`${basePath}/${encodeURIComponent(entityId)}`);
              return;
            }
          }}
        />
      )}

      {/* View mode becomes the unified record pivot + standard tabs. */}
      {showTabs && entityId && (
        <>
          <EntityFormSurface
            entityType={entityType}
            mode="edit"
            variant="modal"
            isOpen={editOpen}
            entityId={entityId}
            onClose={() => setEditOpen(false)}
            onSuccess={() => {
              setEditOpen(false);
              void loadOverview();
              void loadChildRows();
              void loadDeptContacts();
            }}
          />

          <AIOverviewCard entityType={normalizedEntityType} entityId={entityId} />

          <EntityProfileHeader
            entityType={normalizedEntityType}
            entityId={entityId}
            onNavigateToEntity={(t, pk) => {
              navigate(getRecordPath(t, pk));
            }}
            layout="grid"
            variant="full"
          />

          <Tabs
            style={{ marginTop: 12 }}
            items={
              isSupplier || isCustomer
                ? [
                    {
                      key: 'children',
                      label: childLabel,
                      children: (
                        <Card
                          size="small"
                          title={childLabel}
                          extra={
                            <Button type="primary" onClick={() => setChildCreateOpen(true)}>
                              New {childEntityDisplayName}
                            </Button>
                          }
                        >
                          {childLoading ? (
                            <div style={{ padding: 12 }}>
                              <Spin />
                            </div>
                          ) : (
                            <UnifiedEntityTable
                              entityType={childEntityType}
                              data={childRows as any}
                              loading={childLoading}
                              onReload={loadChildRows}
                              recordPathForRow={(_t, row: Record<string, unknown>) => {
                                const childId = String((row as { id?: unknown }).id ?? '').trim();
                                if (!childId) return null;
                                return isSupplier
                                  ? `/suppliers/${encodeURIComponent(entityId)}/plants/${encodeURIComponent(childId)}`
                                  : `/customers/${encodeURIComponent(entityId)}/locations/${encodeURIComponent(childId)}`;
                              }}
                            />
                          )}
                        </Card>
                      ),
                    },
                    {
                      key: 'dept_contacts',
                      label: 'Dept. Contacts',
                      children: (
                        <Card size="small" title="Dept. Contacts">
                          {deptContactsLoading ? (
                            <div style={{ padding: 12 }}>
                              <Spin />
                            </div>
                          ) : deptContactsRows.length ? (
                            <UnifiedEntityTable entityType="contact" data={deptContactsRows as any} />
                          ) : (
                            <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>No contacts found.</span>
                          )}
                        </Card>
                      ),
                    },
                    {
                      key: 'documents',
                      label: 'Documents',
                      children: (
                        <Card size="small" title="Documents">
                          <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                            Document management is coming soon.
                          </span>
                        </Card>
                      ),
                    },
                    {
                      key: 'related',
                      label: 'Related',
                      children: (
                        <>
                          {renderRelationshipTable('inquiries', 'Inquiries')}
                          {renderRelationshipTable('recent_orders', 'Recent Orders')}
                          {renderRelationshipTable('invoices', 'Invoices')}
                          {renderRelationshipTable('related_products', 'Related Products')}
                        </>
                      ),
                    },
                    {
                      key: 'comments',
                      label: 'Comments',
                      children: <CommentsPanel entityType={normalizedEntityType} entityId={entityId} />,
                    },
                    {
                      key: 'recent_activity',
                      label: 'Recent Activity',
                      children: numericEntityId ? (
                        <ActivityFeed entityType={normalizedEntityType as any} entityId={numericEntityId} showCreateForm />
                      ) : (
                        <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>Recent activity unavailable.</span>
                      ),
                    },
                  ]
                : [
                    {
                      key: 'overview',
                      label: 'Overview',
                      children: overviewLoading ? (
                        <div style={{ padding: 12 }}>
                          <Spin />
                        </div>
                      ) : (
                        <Card size="small" title="Counts">
                          {Object.keys(relationshipCounts).length ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {Object.entries(relationshipCounts).map(([k, v]) => (
                                <div key={k} style={{ minWidth: 160 }}>
                                  <div style={{ fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>{k}</div>
                                  <div style={{ fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-text-primary))' }}>
                                    {v}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>No related counts available.</span>
                          )}
                        </Card>
                      ),
                    },
                    {
                      key: 'details',
                      label: 'Details',
                      children: (
                        <EntityFormSurface
                          entityType={entityType}
                          mode="view"
                          variant="inline"
                          isOpen={true}
                          entityId={entityId}
                          onClose={() => navigate(basePath)}
                        />
                      ),
                    },
                    {
                      key: 'related',
                      label: 'Related',
                      children: (
                        <>
                          {renderRelationshipTable('contacts', 'Contacts')}
                          {renderRelationshipTable('inquiries', 'Inquiries')}
                          {renderRelationshipTable('recent_orders', 'Recent Orders')}
                          {renderRelationshipTable('invoices', 'Invoices')}
                          {renderRelationshipTable('related_products', 'Related Products')}
                        </>
                      ),
                    },
                    {
                      key: 'workflows',
                      label: 'Workflows',
                      children: (
                        <EntityWorkflowStatusPanel entityType={normalizedEntityType} entityId={String(entityId)} />
                      ),
                    },
                    {
                      key: 'audit_history',
                      label: 'Audit History',
                      children: canShowAuditHistory ? (
                        <Card size="small" title="Audit History">
                          <AuditHistoryTimeline entityType={normalizedEntityType} entityId={entityId} />
                        </Card>
                      ) : (
                        <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                          Audit history unavailable.
                        </span>
                      ),
                    },
                    {
                      key: 'comments',
                      label: 'Comments',
                      children: <CommentsPanel entityType={normalizedEntityType} entityId={entityId} />,
                    },
                    {
                      key: 'timeline',
                      label: 'Timeline',
                      children: numericEntityId ? (
                        <ActivityFeed entityType={normalizedEntityType as any} entityId={numericEntityId} showCreateForm />
                      ) : (
                        <span style={{ color: 'rgb(var(--color-text-tertiary))' }}>Timeline unavailable.</span>
                      ),
                    },
                  ]
            }
          />

          {(isSupplier || isCustomer) && (
            <EntityFormSurface
              entityType={childEntityType}
              mode="create"
              variant="modal"
              isOpen={childCreateOpen}
              onClose={() => setChildCreateOpen(false)}
              onSuccess={() => {
                setChildCreateOpen(false);
                void loadChildRows();
              }}
              initialValues={{ [childFilterKey]: entityId }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default UniversalEntityRecordPage;

const SpaceWrap: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>{children}</div>
);
