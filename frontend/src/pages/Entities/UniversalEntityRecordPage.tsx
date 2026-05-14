import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Spin, Tabs } from 'antd';
import { Building2, ClipboardList, MessageSquarePlus, UsersRound } from 'lucide-react';
import styled from 'styled-components';

import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';
import { EntityWorkflowStatusPanel } from '@/components/Entities/EntityWorkflowStatusPanel';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { AmbientSuggestions } from '@/components/AIAssistant/AmbientSuggestions';
import {
  TransactionalEmptyState,
  TransactionalEmptyStateGuidance,
  TransactionalEmptyStateGuidanceItem,
} from '@/components/Onboarding';
import { AuditHistoryTimeline } from '@/components/Operations/AuditHistoryTimeline';
import { OperationalDocumentActions } from '@/components/Operations/OperationalDocumentActions';
import {
  supportsAuditHistory,
  supportsOperationalActions,
} from '@/components/Operations/documentOperations';
import {
  ActivityFeed,
  CommentsPanel,
  EntityFormSurface,
  UnifiedEntityTable,
} from '@/components/Shared';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import type { EntityFormMode } from '@/components/Shared/EntityFormSurface';
import { TradeJourneyTimeline } from '@/components/Trader/TradeJourneyTimeline';
import { TradeLineageActions } from '@/components/Trader/TradeLineageActions';
import { PartyRoleBadges, WorkflowStatusBar } from '@/components/Workflow';
import { getWorkflowConfig } from '@/components/Workflow/workflowConfig';
import { businessApi } from '@/services/businessApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { type ResolvedEntityDisplay } from '@/utils/entityDisplay';

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
  const row =
    (result && typeof result === 'object' ? (result as Record<string, unknown>) : {}) || {};
  const id = row.id ?? row.uuid ?? row.pk;
  const s = String(id ?? '').trim();
  return s ? s : null;
};

const getRecordPath = (entityType: string, id: string) => {
  const t = String(entityType || '')
    .trim()
    .toLowerCase();
  return `/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`;
};

const getRecordEditPath = (entityType: string, id: string) => {
  return `${getRecordPath(entityType, id)}/edit`;
};

export const UniversalEntityRecordPage: React.FC<UniversalEntityRecordPageProps> = ({
  entityType,
  basePath,
  mode,
}) => {
  useDocumentTitle('Entity Record');
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<RouteParams>();
  const requestedTabKey = useMemo(
    () => new URLSearchParams(location.search).get('tab') || undefined,
    [location.search]
  );

  const entityId = id ? String(id) : undefined;

  const normalizedEntityType = String(entityType || '')
    .trim()
    .toLowerCase();
  const isSupplier = normalizedEntityType === 'supplier';
  const isCustomer = normalizedEntityType === 'customer';

  const showTabs = mode === 'view' && Boolean(entityId);
  const canShowOperationalActions = supportsOperationalActions(normalizedEntityType);
  const canShowAuditHistory = supportsAuditHistory(normalizedEntityType);
  const hasWorkflow = Boolean(getWorkflowConfig(normalizedEntityType));
  const isTradeEntity = useMemo(
    () =>
      [
        'inquiry',
        'purchase_order',
        'sales_order',
        'carrier_purchase_order',
        'fulfillment',
        'invoice',
      ].includes(normalizedEntityType),
    [normalizedEntityType],
  );

  const childEntityType = isSupplier ? 'plant' : 'location';
  const childEntityDisplayName = isSupplier ? 'Plant' : 'Location';
  const childLabel = isSupplier ? 'Plants' : 'Locations';
  const childEndpoint = isSupplier ? 'plants/' : 'locations/';
  const childFilterKey = isSupplier ? 'supplier' : 'customer';
  const childCreateInitialValues = useMemo<Record<string, unknown>>(
    () => ({
      ...(entityId ? { [childFilterKey]: entityId } : {}),
      ...(isSupplier ? { plant_type: 'processing' } : { location_type: 'warehouse' }),
      country: 'USA',
    }),
    [childFilterKey, entityId, isSupplier]
  );

  const [childRows, setChildRows] = useState<Record<string, unknown>[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [childCreateOpen, setChildCreateOpen] = useState(false);

  const [deptContactsRows, setDeptContactsRows] = useState<Record<string, unknown>[]>([]);
  const [deptContactsLoading, setDeptContactsLoading] = useState(false);

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [relationshipCounts, setRelationshipCounts] = useState<Record<string, number>>({});
  const [relationships, setRelationships] = useState<Record<string, unknown[]>>({});
  const editPath = useMemo(
    () => (entityId ? getRecordEditPath(normalizedEntityType, entityId) : null),
    [entityId, normalizedEntityType]
  );
  const viewPath = useMemo(() => {
    if (!entityId) return basePath;
    if (location.pathname.startsWith('/records/')) {
      return getRecordPath(normalizedEntityType, entityId);
    }
    return `${basePath}/${encodeURIComponent(entityId)}`;
  }, [basePath, entityId, location.pathname, normalizedEntityType]);
  const [recordDisplay, setRecordDisplay] = useState<ResolvedEntityDisplay | null>(null);

  const loadChildRows = useCallback(async () => {
    if (!entityId || !(isSupplier || isCustomer) || mode !== 'view') return;
    setChildLoading(true);
    try {
      const resp = await businessApi.get(childEndpoint, {
        params: {
          [childFilterKey]: entityId,
          page_size: 50,
          limit: 50,
        },
      });

      const payload = resp.data as unknown;
      const payloadObj =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const rows = Array.isArray(payloadObj?.results)
        ? (payloadObj?.results as unknown[])
        : (payload as unknown[]);

      setChildRows(
        (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object') as Record<
          string,
          unknown
        >[]
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

      const resp = await businessApi.get('contacts/', { params });
      const payload = resp.data as unknown;
      const payloadObj =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const rows = Array.isArray(payloadObj?.results)
        ? (payloadObj?.results as unknown[])
        : (payload as unknown[]);

      setDeptContactsRows(
        (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object') as Record<
          string,
          unknown
        >[]
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

  const handleChildCreateClose = useCallback(() => {
    setChildCreateOpen(false);
  }, []);

  const handleChildCreateOpen = useCallback(() => {
    setChildCreateOpen(true);
  }, []);

  const handleChildCreateSuccess = useCallback(() => {
    setChildCreateOpen(false);
    void loadChildRows();
  }, [loadChildRows]);
  const handleNavigateToBasePath = useCallback(() => {
    navigate(basePath);
  }, [basePath, navigate]);

  const handleFormClose = useCallback(() => {
    navigate(basePath);
  }, [basePath, navigate]);

  const handleFormSuccess = useCallback(
    (result: unknown) => {
      const nextId = extractId(result);

      if (mode === 'create' && nextId) {
        navigate(`${basePath}/${encodeURIComponent(nextId)}`);
        return;
      }

      if (mode === 'edit' && entityId) {
        navigate(viewPath);
        return;
      }
    },
    [basePath, entityId, mode, navigate, viewPath]
  );

  const handleOperationalChanged = useCallback(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleEditCurrentRecord = useCallback(() => {
    if (editPath) {
      navigate(editPath);
    }
  }, [editPath, navigate]);

  const handleNavigateToEntity = useCallback(
    (t: string, pk: string) => {
      navigate(getRecordPath(t, pk));
    },
    [navigate]
  );

  useEffect(() => {
    void loadChildRows();
  }, [loadChildRows]);

  useEffect(() => {
    void loadDeptContacts();
  }, [loadDeptContacts]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setRecordDisplay(null);
  }, [entityId, normalizedEntityType]);

  const formMode: EntityFormMode = useMemo(() => {
    if (mode === 'create') return 'create';
    if (mode === 'edit') return 'edit';
    return 'view';
  }, [mode]);

  const entityLabel = useMemo(() => {
    const t = String(normalizedEntityType || '')
      .trim()
      .toLowerCase();
    if (t === 'supplier') return 'Supplier';
    if (t === 'customer') return 'Customer';
    if (t === 'plant') return 'Plant';
    if (t === 'location') return 'Location';
    if (t === 'contact') return 'Contact';
    if (t === 'purchase_order' || t === 'purchase-orders' || t === 'purchase_orders')
      return 'Purchase Order';
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
    if (mode === 'view' && entityId) return recordDisplay?.text || entityLabel;
    return entityLabel;
  }, [entityId, entityLabel, mode, recordDisplay?.text]);

  const numericEntityId = useMemo(() => {
    const n = Number(entityId);
    return Number.isFinite(n) ? n : null;
  }, [entityId]);

  const openRelatedContactCreate = useCallback(() => {
    if (!(isSupplier || isCustomer) || !entityId) {
      return;
    }

    const params = new URLSearchParams({ create: '1' });
    params.set(childFilterKey, entityId);
    navigate(`/contacts?${params.toString()}`);
  }, [childFilterKey, entityId, isCustomer, isSupplier, navigate]);

  const openRelatedInquiryCreate = useCallback(() => {
    if (!entityId) {
      return;
    }

    navigate('/inquiries', {
      state: {
        openCreateModal: true,
        entityType: normalizedEntityType,
        entityId,
      },
    });
  }, [entityId, navigate, normalizedEntityType]);

  const openContextualOrderCreate = useCallback(() => {
    if (!entityId) {
      return;
    }

    if (isSupplier) {
      navigate(`/purchase-orders?action=create&supplier_id=${encodeURIComponent(entityId)}`);
      return;
    }

    if (isCustomer) {
      navigate(`/sales-orders?action=create&customer_id=${encodeURIComponent(entityId)}`);
    }
  }, [entityId, isCustomer, isSupplier, navigate]);

  const childRecordPathForRow = useCallback(
    (_tableEntityType: string, row: Record<string, unknown>) => {
      const childId = String((row as { id?: unknown }).id ?? '').trim();
      if (!childId || !entityId) return null;
      return isSupplier
        ? `/suppliers/${encodeURIComponent(entityId)}/plants/${encodeURIComponent(childId)}`
        : `/customers/${encodeURIComponent(entityId)}/locations/${encodeURIComponent(childId)}`;
    },
    [entityId, isSupplier]
  );

  const childEmptyStateActions = useMemo(
    () => [
      {
        label: `Create ${childEntityDisplayName}`,
        onClick: handleChildCreateOpen,
        variant: 'primary' as const,
      },
      {
        label: 'Create Contact',
        onClick: openRelatedContactCreate,
        variant: 'secondary' as const,
      },
    ],
    [childEntityDisplayName, handleChildCreateOpen, openRelatedContactCreate]
  );

  const deptContactsEmptyActions = useMemo(
    () => [
      {
        label: 'Create Contact',
        onClick: openRelatedContactCreate,
        variant: 'primary' as const,
      },
      {
        label: `Create ${childEntityDisplayName}`,
        onClick: handleChildCreateOpen,
        variant: 'secondary' as const,
      },
    ],
    [childEntityDisplayName, handleChildCreateOpen, openRelatedContactCreate]
  );
  const childCreateButtonLabel = useMemo(
    () => `New ${childEntityDisplayName}`,
    [childEntityDisplayName]
  );

  const renderRelationshipTable = useCallback(
    (relKey: string, label: string) => {
      const rows = relationships[relKey] || [];
      if (!Array.isArray(rows) || rows.length === 0) return null;

      const types = new Set(
        rows.map((r: any) => String(r?.type ?? '').toLowerCase()).filter(Boolean)
      );
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
        <RelationCard
          key={relKey}
          size="small"
          title={
            <span>
              {label}{' '}
              {relationshipCounts[relKey] != null ? (
                <CountSpan>({relationshipCounts[relKey]})</CountSpan>
              ) : null}
            </span>
          }
        >
          <UnifiedEntityTable
            entityType={tableEntityType}
            data={rows as any}
            enableQuickEdit={!isMixed}
            enableBulkActions
            recordPathForRow={(_t, row: any) => {
              const rowId = String(row?.id ?? '').trim();
              const rowType = String(row?.type ?? tableEntityType).trim();
              if (!rowId) return null;
              return getRecordPath(rowType, rowId);
            }}
          />
        </RelationCard>
      );
    },
    [relationshipCounts, relationships]
  );

  const supplierCustomerRelatedSections = useMemo(
    () =>
      [
        renderRelationshipTable('inquiries', 'Inquiries'),
        renderRelationshipTable('recent_orders', 'Recent Orders'),
        renderRelationshipTable('invoices', 'Invoices'),
        renderRelationshipTable('related_products', 'Related Products'),
      ].filter(Boolean),
    [renderRelationshipTable]
  );

  const genericRelatedSections = useMemo(
    () =>
      [
        renderRelationshipTable('contacts', 'Contacts'),
        renderRelationshipTable('inquiries', 'Inquiries'),
        renderRelationshipTable('recent_orders', 'Recent Orders'),
        renderRelationshipTable('invoices', 'Invoices'),
        renderRelationshipTable('related_products', 'Related Products'),
      ].filter(Boolean),
    [renderRelationshipTable]
  );

  return (
    <PageWrapper>
      <PageToolbar>
        {mode === 'view' && entityId && (
          <SpaceWrap>
            {canShowOperationalActions ? (
              <OperationalDocumentActions
                entityType={normalizedEntityType}
                entityId={entityId}
                recordLabel={title}
                compact
                onChanged={handleOperationalChanged}
              />
            ) : null}
            {isTradeEntity && (
              <TradeLineageActions
                entityType={normalizedEntityType}
                entityId={entityId}
                onRecordCreated={handleOperationalChanged}
              />
            )}
            <Button type="primary" onClick={handleEditCurrentRecord}>
              Edit
            </Button>
          </SpaceWrap>
        )}

        {mode === 'edit' && entityId && <Button onClick={() => navigate(viewPath)}>Cancel</Button>}
      </PageToolbar>
      {mode !== 'view' && (
        <EntityFormSurface
          entityType={entityType}
          mode={formMode}
          variant="inline"
          isOpen={true}
          entityId={formMode === 'create' ? undefined : entityId}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* View mode becomes the unified record pivot + standard tabs. */}
      {showTabs && entityId && (
        <>
          <AIOverviewCard entityType={normalizedEntityType} entityId={entityId} />

          <EntityProfileHeader
            entityType={normalizedEntityType}
            entityId={entityId}
            onNavigateToEntity={handleNavigateToEntity}
            onTitleResolved={setRecordDisplay}
            layout="grid"
            variant="compact"
          />

          {hasWorkflow && (
            <WorkflowStatusBar
              entityType={normalizedEntityType}
              entityId={entityId}
              onTransitioned={handleOperationalChanged}
            />
          )}

          {isTradeEntity && (
            <PartyRoleBadges
              entityType={normalizedEntityType}
              entityId={entityId}
            />
          )}

          {isTradeEntity && (
            <TradeJourneyTimeline
              entityType={normalizedEntityType}
              entityId={entityId}
            />
          )}

          <AIEntityInsights entityType={normalizedEntityType} entityId={entityId} />

          <AmbientSuggestions entityType={normalizedEntityType} entityId={entityId} />

          <TabsSection
            defaultActiveKey={requestedTabKey}
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
                            <Button type="primary" onClick={handleChildCreateOpen}>
                              {childCreateButtonLabel}
                            </Button>
                          }
                        >
                          {childLoading ? (
                            <SpinnerPad>
                              <Spin />
                            </SpinnerPad>
                          ) : childRows.length ? (
                            <UnifiedEntityTable
                              entityType={childEntityType}
                              data={childRows as any}
                              loading={childLoading}
                              onReload={loadChildRows}
                              recordPathForRow={childRecordPathForRow}
                            />
                          ) : (
                            <TransactionalEmptyState
                              icon={<Building2 size={36} />}
                              title={`No ${childLabel.toLowerCase()} yet`}
                              message={`Create the first ${childEntityDisplayName.toLowerCase()} to anchor departments, logistics, and related transactional activity for this record.`}
                              actions={childEmptyStateActions}
                            >
                              <TransactionalEmptyStateGuidance>
                                <TransactionalEmptyStateGuidanceItem>
                                  {childEntityDisplayName}s help organize downstream contacts,
                                  receiving, shipping, and operational notes.
                                </TransactionalEmptyStateGuidanceItem>
                              </TransactionalEmptyStateGuidance>
                            </TransactionalEmptyState>
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
                            <SpinnerPad>
                              <Spin />
                            </SpinnerPad>
                          ) : deptContactsRows.length ? (
                            <UnifiedEntityTable
                              entityType="contact"
                              data={deptContactsRows as any}
                            />
                          ) : (
                            <TransactionalEmptyState
                              icon={<UsersRound size={36} />}
                              title="No contacts yet"
                              message="Add the first department contact so purchasing, sales, and logistics teams have a real person to work with."
                              actions={deptContactsEmptyActions}
                            />
                          )}
                        </Card>
                      ),
                    },
                    {
                      key: 'documents',
                      label: 'Documents',
                      children: (
                        <Card size="small" title="Documents">
                          <TertiaryHint>Document management is coming soon.</TertiaryHint>
                        </Card>
                      ),
                    },
                    {
                      key: 'related',
                      label: 'Related',
                      children: supplierCustomerRelatedSections.length ? (
                        <>{supplierCustomerRelatedSections}</>
                      ) : (
                        <TransactionalEmptyState
                          icon={<ClipboardList size={36} />}
                          title={`No related ${isSupplier ? 'supplier' : 'customer'} activity yet`}
                          message={`Create the first ${isSupplier ? 'purchase order' : 'sales order'} or inquiry tied to this record so the related tab has real commercial context.`}
                          actions={[
                            {
                              label: isSupplier ? 'Create Purchase Order' : 'Create Sales Order',
                              onClick: openContextualOrderCreate,
                              variant: 'primary',
                            },
                            {
                              label: 'Create Inquiry',
                              onClick: openRelatedInquiryCreate,
                              variant: 'secondary',
                            },
                          ]}
                        >
                          <TransactionalEmptyStateGuidance>
                            <TransactionalEmptyStateGuidanceItem>
                              Related activity fills in automatically once this account starts
                              participating in inquiries and orders.
                            </TransactionalEmptyStateGuidanceItem>
                          </TransactionalEmptyStateGuidance>
                        </TransactionalEmptyState>
                      ),
                    },
                    {
                      key: 'comments',
                      label: 'Comments',
                      children: (
                        <CommentsPanel entityType={normalizedEntityType} entityId={entityId} />
                      ),
                    },
                    {
                      key: 'recent_activity',
                      label: 'Recent Activity',
                      children: numericEntityId ? (
                        <ActivityFeed
                          entityType={normalizedEntityType as any}
                          entityId={numericEntityId}
                          showCreateForm
                        />
                      ) : (
                        <TertiaryHint>Recent activity unavailable.</TertiaryHint>
                      ),
                    },
                  ]
                : [
                    {
                      key: 'overview',
                      label: 'Overview',
                      children: overviewLoading ? (
                        <SpinnerPad>
                          <Spin />
                        </SpinnerPad>
                      ) : (
                        <Card size="small" title="Counts">
                          {Object.keys(relationshipCounts).length ? (
                            <CountsGrid>
                              {Object.entries(relationshipCounts).map(([k, v]) => (
                                <CountCard key={k}>
                                  <CountLabel>{k}</CountLabel>
                                  <CountValue>{v}</CountValue>
                                </CountCard>
                              ))}
                            </CountsGrid>
                          ) : (
                            <TransactionalEmptyState
                              icon={<MessageSquarePlus size={36} />}
                              title="No related counts yet"
                              message={
                                isSupplier || isCustomer
                                  ? 'This record does not have downstream activity yet. Start with an inquiry or order to populate counts and related tabs.'
                                  : 'This record does not have downstream activity yet. Update it with operational details so related activity has a complete source record.'
                              }
                              actions={
                                isSupplier || isCustomer
                                  ? [
                                      {
                                        label: 'Create Inquiry',
                                        onClick: openRelatedInquiryCreate,
                                        variant: 'primary' as const,
                                      },
                                      {
                                        label: isSupplier
                                          ? 'Create Purchase Order'
                                          : 'Create Sales Order',
                                        onClick: openContextualOrderCreate,
                                        variant: 'secondary' as const,
                                      },
                                    ]
                                  : [
                                      {
                                        label: 'Edit Record',
                                        onClick: handleEditCurrentRecord,
                                        variant: 'primary' as const,
                                      },
                                    ]
                              }
                            />
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
                          onClose={handleFormClose}
                        />
                      ),
                    },
                    {
                      key: 'related',
                      label: 'Related',
                      children: genericRelatedSections.length ? (
                        <>{genericRelatedSections}</>
                      ) : (
                        <TransactionalEmptyState
                          icon={<ClipboardList size={36} />}
                          title="No related records yet"
                          message="This record has not been tied to contacts, inquiries, orders, or invoices yet."
                          actions={
                            isSupplier || isCustomer
                              ? [
                                  {
                                    label: 'Create Inquiry',
                                    onClick: openRelatedInquiryCreate,
                                    variant: 'primary' as const,
                                  },
                                ]
                              : [
                                  {
                                    label: 'Edit Record',
                                    onClick: handleEditCurrentRecord,
                                    variant: 'primary' as const,
                                  },
                                ]
                          }
                        />
                      ),
                    },
                    {
                      key: 'workflows',
                      label: 'Workflows',
                      children: (
                        <EntityWorkflowStatusPanel
                          entityType={normalizedEntityType}
                          entityId={String(entityId)}
                        />
                      ),
                    },
                    {
                      key: 'audit_history',
                      label: 'Audit History',
                      children: canShowAuditHistory ? (
                        <Card size="small" title="Audit History">
                          <AuditHistoryTimeline
                            entityType={normalizedEntityType}
                            entityId={entityId}
                          />
                        </Card>
                      ) : (
                        <TertiaryHint>Audit history unavailable.</TertiaryHint>
                      ),
                    },
                    {
                      key: 'comments',
                      label: 'Comments',
                      children: (
                        <CommentsPanel entityType={normalizedEntityType} entityId={entityId} />
                      ),
                    },
                    {
                      key: 'timeline',
                      label: 'Timeline',
                      children: numericEntityId ? (
                        <ActivityFeed
                          entityType={normalizedEntityType as any}
                          entityId={numericEntityId}
                          showCreateForm
                        />
                      ) : (
                        <TertiaryHint>Timeline unavailable.</TertiaryHint>
                      ),
                    },
                  ]
            }
          />

          {(isSupplier || isCustomer) && (
            <FormErrorBoundary entityType={childEntityType} onClose={handleChildCreateClose}>
              <EntityFormSurface
                entityType={childEntityType}
                mode="create"
                variant="modal"
                isOpen={childCreateOpen}
                onClose={handleChildCreateClose}
                onSuccess={handleChildCreateSuccess}
                initialValues={childCreateInitialValues}
              />
            </FormErrorBoundary>
          )}
        </>
      )}
    </PageWrapper>
  );
};

export default UniversalEntityRecordPage;

/* ─── Styled Components ─── */

const PageWrapper = styled.div`
  padding: 16px;
`;

const PageToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const RelationCard = styled(Card)`
  margin-bottom: 12px;
`;

const CountSpan = styled.span`
  color: rgb(var(--color-text-tertiary));
`;

const TertiaryHint = styled.span`
  color: rgb(var(--color-text-tertiary));
`;

const SpinnerPad = styled.div`
  padding: 12px;
`;

const TabsSection = styled(Tabs)`
  margin-top: 12px;
`;

const CountsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const CountCard = styled.div`
  min-width: 160px;
`;

const CountLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const CountValue = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const SpaceWrap: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SpaceWrapRow>{children}</SpaceWrapRow>
);

const SpaceWrapRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
`;
