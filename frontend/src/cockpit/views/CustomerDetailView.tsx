import React, { useMemo, useState } from 'react';
import styled from 'styled-components';

import { InquiryCreateModal } from '@/components/Inquiry';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Mail, MapPin, Phone, Plus, Sparkles, StickyNote } from 'lucide-react';

import { businessApi } from '@/services/businessApi';
import { useToast } from '@/hooks/useToast';

type CanonicalEntityType = 'customer' | 'supplier';

type DetailTab = 'products' | 'orders' | 'callLogs' | 'inquiries';

type EntityRecord = {
  id: string | number;
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  notes?: string;
  [key: string]: unknown;
};

type RelationshipCountsResponse = {
  relationships?: Array<{ name: string; display_name?: string; count: number }>;
};

type RelatedItem = {
  id: string | number;
  name?: string;
  title?: string;
  label?: string;
  subtitle?: string;
  [key: string]: unknown;
};

type RelationshipItemsResponse = {
  items?: RelatedItem[];
};

export interface CustomerDetailViewProps {
  entityType: string;
  entityId: string;
  initialLabel?: string;
}

function normalizeEntityType(raw: string): CanonicalEntityType | null {
  const t = String(raw || '').toLowerCase();
  if (t === 'customer' || t === 'customers') return 'customer';
  if (t === 'supplier' || t === 'suppliers') return 'supplier';
  return null;
}

function getEntityApiPath(entityType: CanonicalEntityType): string {
  return entityType === 'customer' ? 'customers' : 'suppliers';
}

function safeText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getBreadcrumbTitle(entity: EntityRecord | null | undefined, initialLabel?: string): string {
  return safeText(entity?.contact_person) || safeText(initialLabel) || safeText(entity?.name) || 'Customer';
}

function getCompanyName(entity: EntityRecord | null | undefined): string {
  return safeText(entity?.name) || '—';
}

function getRelationshipCount(counts: RelationshipCountsResponse | undefined, relName: string): number {
  const rel = counts?.relationships?.find((r) => String(r.name).toLowerCase() === relName.toLowerCase());
  return rel?.count ?? 0;
}

function getTabRelationship(entityType: CanonicalEntityType, tab: DetailTab): string {
  switch (tab) {
    case 'products':
      return 'products';
    case 'orders':
      return entityType === 'customer' ? 'sales_orders' : 'purchase_orders';
    case 'callLogs':
      return 'call_logs';
    case 'inquiries':
      return 'inquiries';
  }
}

// ============================================================================
// Styled Components (Design System compliant via CSS vars)
// ============================================================================

const Page = styled.div`
  min-height: calc(100vh - 140px);
  background: rgb(var(--color-background));
`;

const StickyHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const HeaderInner = styled.div`
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const BreadcrumbTitleButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  min-width: 0;

  &:focus-visible {
    outline: 2px solid rgba(var(--color-primary), 0.35);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }
`;

const BreadcrumbTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BreadcrumbHint = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const Layout = styled.div`
  display: flex;
  gap: 14px;
  padding: 16px 18px;

  @media (max-width: 980px) {
    flex-direction: column;
  }
`;

const Column = styled.div<{ $basis: string }>`
  flex: 0 0 ${(p) => p.$basis};
  min-width: 0;

  @media (max-width: 980px) {
    flex: 1 1 auto;
  }
`;

const Card = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  letter-spacing: 0.2px;
  text-transform: uppercase;
`;

const CardBody = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.7);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const InfoRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: rgb(var(--color-text-primary));
  font-size: 13px;
`;

const InfoKey = styled.div`
  width: 88px;
  flex-shrink: 0;
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding-top: 2px;
`;

const InfoValue = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Muted = styled.span`
  color: rgb(var(--color-text-tertiary));
`;

const Expander = styled.details`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 8px 10px;
  background: rgb(var(--color-background));

  summary {
    cursor: pointer;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }
`;

const BulletList = styled.ul`
  margin: 8px 0 0 18px;
  padding: 0;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;

  li {
    margin: 4px 0;
  }
`;

const TabsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.12)' : 'rgb(var(--color-surface))')};
  color: ${(p) => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))')};
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--color-primary), 0.55);
    color: rgb(var(--color-primary));
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--color-primary), 0.35);
    outline-offset: 2px;
  }
`;

const CenterStack = styled.div`
  position: relative;
  min-height: 520px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FloatingNewWrap = styled.div`
  position: sticky;
  top: 84px;
  display: flex;
  justify-content: center;
  z-index: 10;
`;

const NewButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-primary), 0.35);
  background: rgb(var(--color-primary));
  color: white;
  font-weight: 800;
  font-size: 14px;
  box-shadow: 0 10px 22px rgba(var(--color-primary), 0.25);
  cursor: pointer;

  &:hover {
    opacity: 0.95;
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: 2px;
  }
`;

const Menu = styled.div`
  margin-top: 10px;
  width: 280px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
`;

const MenuItem = styled.button`
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  color: rgb(var(--color-text-primary));
  font-weight: 600;

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const FeedCard = styled(Card)`
  flex: 1;
`;

const FeedHeader = styled(CardHeader)`
  position: sticky;
  top: 0;
  z-index: 5;
`;

const FeedList = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const EmptyHint = styled.div`
  padding: 14px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-tertiary));
  font-size: 13px;
`;

const AIOverview = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 12px;
  background:
    radial-gradient(700px 320px at 35% 0%, rgba(var(--color-primary), 0.10), transparent 55%),
    rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
`;

const AIHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  font-size: 12px;
`;

const AIText = styled.div`
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: rgb(var(--color-text-secondary));
`;

const SmallButton = styled.button`
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--color-primary), 0.55);
  }
`;

// ============================================================================

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  entityType,
  entityId,
  initialLabel,
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const canonicalType = useMemo(() => normalizeEntityType(entityType), [entityType]);
  const [leftFilter, setLeftFilter] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('products');
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isInquiryCreateOpen, setIsInquiryCreateOpen] = useState(false);

  const entityQuery = useQuery({
    queryKey: ['cockpit-entity', canonicalType, entityId],
    enabled: Boolean(canonicalType && entityId),
    queryFn: async () => {
      if (!canonicalType) throw new Error('Unknown entity type');
      const path = getEntityApiPath(canonicalType);
      const res = await businessApi.get(`/${path}/${entityId}/`);
      return res.data as EntityRecord;
    },
  });

  const countsQuery = useQuery({
    queryKey: ['cockpit-entity-counts', canonicalType, entityId],
    enabled: Boolean(canonicalType && entityId),
    queryFn: async () => {
      if (!canonicalType) throw new Error('Unknown entity type');
      const res = await businessApi.get(`/entities/${canonicalType}/${entityId}/relationships/?counts=true`);
      return res.data as RelationshipCountsResponse;
    },
  });

  const locationsQuery = useQuery({
    queryKey: ['cockpit-entity-locations', canonicalType, entityId],
    enabled: Boolean(canonicalType && entityId),
    queryFn: async () => {
      if (!canonicalType) throw new Error('Unknown entity type');
      const res = await businessApi.get(
        `/entities/${canonicalType}/${entityId}/relationships/locations/?limit=25`
      );
      return (res.data as RelationshipItemsResponse).items ?? [];
    },
  });

  const productsQuery = useQuery({
    queryKey: ['cockpit-entity-products', canonicalType, entityId],
    enabled: Boolean(canonicalType && entityId),
    queryFn: async () => {
      if (!canonicalType) throw new Error('Unknown entity type');
      const res = await businessApi.get(`/entities/${canonicalType}/${entityId}/relationships/products/?limit=25`);
      return (res.data as RelationshipItemsResponse).items ?? [];
    },
  });

  const tabItemsQuery = useQuery({
    queryKey: ['cockpit-entity-tab', canonicalType, entityId, activeTab],
    enabled: Boolean(canonicalType && entityId),
    queryFn: async () => {
      if (!canonicalType) throw new Error('Unknown entity type');
      const rel = getTabRelationship(canonicalType, activeTab);
      const res = await businessApi.get(`/entities/${canonicalType}/${entityId}/relationships/${rel}/?limit=50`);
      return (res.data as RelationshipItemsResponse).items ?? [];
    },
    retry: 0,
  });

  const entity = entityQuery.data;
  const title = getBreadcrumbTitle(entity, initialLabel);
  const counts = countsQuery.data;

  const locations = locationsQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const filteredLocations = useMemo(() => {
    const q = leftFilter.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) => {
      const label = safeText(loc.name) || safeText(loc.title) || safeText(loc.label);
      return label.toLowerCase().includes(q);
    });
  }, [leftFilter, locations]);

  const filteredProducts = useMemo(() => {
    const q = leftFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const label = safeText(p.name) || safeText(p.title) || safeText(p.label);
      return label.toLowerCase().includes(q);
    });
  }, [leftFilter, products]);

  const tabCounts = useMemo(() => {
    if (!canonicalType) {
      return {
        products: 0,
        orders: 0,
        callLogs: 0,
        inquiries: 0,
      };
    }

    return {
      products: getRelationshipCount(counts, 'products'),
      orders: getRelationshipCount(counts, canonicalType === 'customer' ? 'sales_orders' : 'purchase_orders'),
      callLogs: getRelationshipCount(counts, 'call_logs'),
      inquiries: getRelationshipCount(counts, 'inquiries'),
    };
  }, [canonicalType, counts]);

  const handleNewAction = (action: 'product' | 'order' | 'call' | 'inquiry') => {
    setIsNewMenuOpen(false);

    if (action === 'inquiry') {
      setIsInquiryCreateOpen(true);
      return;
    }

    toast.info(`Coming soon: New ${action}`);
  };

  if (!canonicalType) {
    return (
      <Page>
        <StickyHeader>
          <HeaderInner>
            <BreadcrumbTitleButton onClick={() => navigate('/cockpit')} type="button">
              <BreadcrumbTitle>Customer</BreadcrumbTitle>
              <BreadcrumbHint>Back to Cockpit search</BreadcrumbHint>
            </BreadcrumbTitleButton>
          </HeaderInner>
        </StickyHeader>
        <Layout>
          <Card>
            <CardBody>
              <EmptyHint>Unsupported entity type: {entityType}</EmptyHint>
            </CardBody>
          </Card>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <InquiryCreateModal
        isOpen={isInquiryCreateOpen}
        onClose={() => setIsInquiryCreateOpen(false)}
        onSuccess={() => {
          void countsQuery.refetch();
          void tabItemsQuery.refetch();
          setIsInquiryCreateOpen(false);
        }}
        initialEntityType={canonicalType ?? undefined}
        initialEntityId={entityId}
      />
      <StickyHeader>
        <HeaderInner>
          <div style={{ minWidth: 0 }}>
            <BreadcrumbTitleButton onClick={() => navigate('/cockpit')} type="button" title="Back to Cockpit search">
              <BreadcrumbTitle>{title}</BreadcrumbTitle>
              <BreadcrumbHint>Click to return to global search / Entity Explorer</BreadcrumbHint>
            </BreadcrumbTitleButton>
          </div>
        </HeaderInner>
      </StickyHeader>

      <Layout>
        {/* Left Column (30%) */}
        <Column $basis="30%">
          <Card>
            <CardHeader>
              <CardTitle>
                <Building2 size={14} /> Customer Info
              </CardTitle>
            </CardHeader>
            <CardBody>
              <SearchInput
                value={leftFilter}
                onChange={(e) => setLeftFilter(e.target.value)}
                placeholder="Quick search locations/products…"
                aria-label="Filter customer info"
              />

              <InfoRow>
                <InfoKey>Company</InfoKey>
                <InfoValue>{getCompanyName(entity)}</InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoKey>Phone</InfoKey>
                <InfoValue>
                  <Phone size={14} />
                  {safeText(entity?.phone) ? safeText(entity?.phone) : <Muted>—</Muted>}
                </InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoKey>Email</InfoKey>
                <InfoValue>
                  <Mail size={14} />
                  {safeText(entity?.email) ? safeText(entity?.email) : <Muted>—</Muted>}
                </InfoValue>
              </InfoRow>

              <Expander open>
                <summary>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={14} /> Locations ({filteredLocations.length})
                  </span>
                </summary>
                {locationsQuery.isLoading ? (
                  <BulletList>
                    <li>Loading…</li>
                  </BulletList>
                ) : filteredLocations.length === 0 ? (
                  <BulletList>
                    <li>None</li>
                  </BulletList>
                ) : (
                  <BulletList>
                    {filteredLocations.slice(0, 12).map((loc) => (
                      <li key={String(loc.id)}>{safeText(loc.name) || safeText(loc.title) || safeText(loc.label) || 'Location'}</li>
                    ))}
                  </BulletList>
                )}
              </Expander>

              <Expander>
                <summary>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <StickyNote size={14} /> Products ({filteredProducts.length})
                  </span>
                </summary>
                {productsQuery.isLoading ? (
                  <BulletList>
                    <li>Loading…</li>
                  </BulletList>
                ) : filteredProducts.length === 0 ? (
                  <BulletList>
                    <li>None</li>
                  </BulletList>
                ) : (
                  <BulletList>
                    {filteredProducts.slice(0, 12).map((p) => (
                      <li key={String(p.id)}>{safeText(p.name) || safeText(p.title) || safeText(p.label) || 'Product'}</li>
                    ))}
                  </BulletList>
                )}
              </Expander>

              <TabsRow role="tablist" aria-label="Customer detail tabs">
                <TabButton
                  type="button"
                  $active={activeTab === 'products'}
                  onClick={() => setActiveTab('products')}
                  aria-selected={activeTab === 'products'}
                >
                  Products {tabCounts.products ? `(${tabCounts.products})` : ''}
                </TabButton>
                <TabButton
                  type="button"
                  $active={activeTab === 'orders'}
                  onClick={() => setActiveTab('orders')}
                  aria-selected={activeTab === 'orders'}
                >
                  Orders {tabCounts.orders ? `(${tabCounts.orders})` : ''}
                </TabButton>
                <TabButton
                  type="button"
                  $active={activeTab === 'callLogs'}
                  onClick={() => setActiveTab('callLogs')}
                  aria-selected={activeTab === 'callLogs'}
                >
                  Call Logs {tabCounts.callLogs ? `(${tabCounts.callLogs})` : ''}
                </TabButton>
                <TabButton
                  type="button"
                  $active={activeTab === 'inquiries'}
                  onClick={() => setActiveTab('inquiries')}
                  aria-selected={activeTab === 'inquiries'}
                >
                  Inquiries {tabCounts.inquiries ? `(${tabCounts.inquiries})` : ''}
                </TabButton>
              </TabsRow>
            </CardBody>
          </Card>
        </Column>

        {/* Center Column (40%) */}
        <Column $basis="40%">
          <CenterStack>
            <FloatingNewWrap>
              <div>
                <NewButton type="button" onClick={() => setIsNewMenuOpen((v) => !v)} aria-haspopup="menu">
                  <Plus size={18} /> + New
                </NewButton>
                {isNewMenuOpen && (
                  <Menu role="menu">
                    <MenuItem type="button" onClick={() => handleNewAction('product')} role="menuitem">
                      New Product <span>↵</span>
                    </MenuItem>
                    <MenuItem type="button" onClick={() => handleNewAction('order')} role="menuitem">
                      New Order <span>↵</span>
                    </MenuItem>
                    <MenuItem type="button" onClick={() => handleNewAction('call')} role="menuitem">
                      New Call Log <span>↵</span>
                    </MenuItem>
                    <MenuItem type="button" onClick={() => handleNewAction('inquiry')} role="menuitem">
                      New Inquiry <span>↵</span>
                    </MenuItem>
                  </Menu>
                )}
              </div>
            </FloatingNewWrap>

            <FeedCard>
              <FeedHeader>
                <CardTitle>
                  <StickyNote size={14} />
                  {activeTab === 'products'
                    ? 'Products'
                    : activeTab === 'orders'
                      ? 'Orders'
                      : activeTab === 'callLogs'
                        ? 'Call Logs'
                        : 'Inquiries'}
                </CardTitle>
                <Muted>
                  {tabItemsQuery.isLoading
                    ? 'Loading…'
                    : tabItemsQuery.isError
                      ? 'Unavailable'
                      : `${(tabItemsQuery.data ?? []).length} items`}
                </Muted>
              </FeedHeader>
              <FeedList>
                {tabItemsQuery.isLoading ? (
                  <EmptyHint>Loading records…</EmptyHint>
                ) : tabItemsQuery.isError ? (
                  <EmptyHint>
                    This record type isn’t available yet for this entity. (Additive-only placeholder)
                  </EmptyHint>
                ) : (tabItemsQuery.data ?? []).length === 0 ? (
                  <EmptyHint>No records found for this tab.</EmptyHint>
                ) : (
                  (tabItemsQuery.data ?? []).slice(0, 25).map((item) => (
                    <Card key={String(item.id)}>
                      <CardBody>
                        <div style={{ fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>
                          {safeText(item.title) || safeText(item.name) || safeText(item.label) || 'Record'}
                        </div>
                        {safeText(item.subtitle) ? (
                          <div style={{ fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>{safeText(item.subtitle)}</div>
                        ) : null}
                      </CardBody>
                    </Card>
                  ))
                )}
              </FeedList>
            </FeedCard>
          </CenterStack>
        </Column>

        {/* Right Column (30%) */}
        <Column $basis="30%">
          <Card>
            <CardHeader>
              <CardTitle>
                <StickyNote size={14} />
                Notes
              </CardTitle>
              <SmallButton
                type="button"
                onClick={() => toast.info('Coming soon: New Note')}
                title="Add a new note"
              >
                + New Note
              </SmallButton>
            </CardHeader>
            <CardBody>
              <div style={{ fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>
                All notes related to currently selected Contact: Customer or Supplier
              </div>

              <AIOverview>
                <AIHeader>
                  <Sparkles size={14} /> AI Overview
                </AIHeader>
                <AIText>
                  {entityQuery.isLoading
                    ? 'Loading contact context…'
                    : `Summary for ${title}: company ${getCompanyName(entity)}. Next steps: add a note, review recent orders, and capture inquiry details.`}
                </AIText>
              </AIOverview>

              {safeText(entity?.notes) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <StickyNote size={14} /> Existing Notes
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div style={{ whiteSpace: 'pre-wrap', color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                      {safeText(entity?.notes)}
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <EmptyHint>No notes yet. Use “+ New Note” to capture context.</EmptyHint>
              )}
            </CardBody>
          </Card>
        </Column>
      </Layout>
    </Page>
  );
};

export default CustomerDetailView;
