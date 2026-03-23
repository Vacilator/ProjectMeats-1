import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Receipt,
  PhoneCall,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  Building2,
  StickyNote,
  Sparkles,
  X,
} from 'lucide-react';

import { BreadcrumbBar } from '@/components/Cockpit';
import { businessApi } from '@/services/businessApi';

// ============================================================================
// Types
// ============================================================================

type CanonicalEntityType = 'customer' | 'supplier';

type DetailTab = 'products' | 'orders' | 'callLogs' | 'enquiries';

type ContextAction = 'newProduct' | 'newOrder' | 'newCallLog' | 'newEnquiry';

type EntityRecord = {
  id: string | number;
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
  [key: string]: unknown;
};

type RelationshipCounts = {
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

export interface CockpitDetailViewTemplateProps {
  entityType: string;
  entityId: string;
  /** Optional hint to render immediately while the API loads */
  initialLabel?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeEntityType(raw: string): CanonicalEntityType | null {
  const t = String(raw || '').toLowerCase();
  if (t === 'customer' || t === 'customers') return 'customer';
  if (t === 'supplier' || t === 'suppliers') return 'supplier';
  return null;
}

function getEntityApiPath(entityType: CanonicalEntityType): string {
  return entityType === 'customer' ? 'customers' : 'suppliers';
}

function getPrimaryTitle(entity: EntityRecord | null | undefined, initialLabel?: string): string {
  const safe = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return safe(entity?.contact_person) || safe(entity?.name) || safe(initialLabel) || 'Customer';
}

function getRelationshipCount(counts: RelationshipCounts | undefined, relName: string): number {
  const rel = counts?.relationships?.find((r) => String(r.name).toLowerCase() === relName.toLowerCase());
  return rel?.count ?? 0;
}

// ============================================================================
// Styled Components (Workform Editor visual language)
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

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SubTitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const Layout = styled.div`
  display: flex;
  gap: 14px;
  padding: 16px 18px;
`;

const LeftPanel = styled.aside`
  width: 360px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (max-width: 1200px) {
    width: 320px;
    min-width: 280px;
  }

  @media (max-width: 980px) {
    display: none;
  }
`;

const Center = styled.main`
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RightPanel = styled.aside`
  width: 380px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (max-width: 1200px) {
    width: 340px;
    min-width: 300px;
  }

  @media (max-width: 980px) {
    width: 100%;
    min-width: 0;
  }
`;

const BlueGroupCard = styled.div`
  background:
    radial-gradient(900px 420px at 50% 0%, rgb(var(--color-primary) / 0.10), transparent 55%),
    rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  font-weight: 700;
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

const InfoRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: rgb(var(--color-text-primary));
  font-size: 13px;
`;

const InfoKey = styled.div`
  width: 92px;
  flex-shrink: 0;
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const InfoValue = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgb(var(--color-text-primary));

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgb(var(--color-primary) / 0.10);
  color: rgb(var(--color-primary));
  font-size: 12px;
  font-weight: 600;
`;

const TabBar = styled.div`
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: ${(p) => (p.$active ? 'rgb(var(--color-surface))' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-tertiary))')};
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s ease;

  &:hover {
    color: rgb(var(--color-text-primary));
    background: rgb(var(--color-surface));
  }
`;

const CenterCard = styled(BlueGroupCard)`
  min-height: 520px;
`;

const CenterCardBody = styled(CardBody)`
  min-height: 420px;
`;

const EmptyHint = styled.div`
  color: rgb(var(--color-text-tertiary));
  font-size: 13px;
  line-height: 1.4;
`;

const FloatingNewButton = styled.button`
  position: sticky;
  top: 84px;
  align-self: flex-end;

  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 999px;
  border: none;
  cursor: pointer;

  background: rgb(var(--color-primary));
  color: white;
  font-weight: 800;
  font-size: 13px;

  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);

  &:hover {
    opacity: 0.95;
  }

  &:active {
    transform: translateY(1px);
  }
`;

const ContextMenuOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
`;

const ContextMenu = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${(p) => p.$x}px;
  top: ${(p) => p.$y}px;
  z-index: 60;

  min-width: 240px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
  padding: 8px;
`;

const MenuHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 6px 10px 6px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const MenuItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  font-weight: 600;

  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const RightButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  cursor: pointer;
  color: rgb(var(--color-text-primary));
  font-weight: 700;
  font-size: 12px;

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const NoteItem = styled.div`
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

const NoteMeta = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
`;

const MiniSectionTitle = styled.div`
  margin-top: 6px;
  font-size: 11px;
  font-weight: 800;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.35px;
`;

const MiniList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const MiniListItem = styled.div`
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
`;

const MiniListItemMeta = styled.div`
  margin-top: 4px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
`;

// ============================================================================
// Component
// ============================================================================

export const CockpitDetailViewTemplate: React.FC<CockpitDetailViewTemplateProps> = ({
  entityType,
  entityId,
  initialLabel,
}) => {
  const navigate = useNavigate();

  const canonicalType = useMemo(() => normalizeEntityType(entityType), [entityType]);

  const [activeTab, setActiveTab] = useState<DetailTab>('products');
  const [menuState, setMenuState] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });

  const entityQuery = useQuery({
    queryKey: ['cockpit-detail-entity', canonicalType, entityId],
    enabled: !!canonicalType && !!entityId,
    queryFn: async (): Promise<EntityRecord> => {
      const apiPath = getEntityApiPath(canonicalType as CanonicalEntityType);
      const res = await businessApi.get(`/${apiPath}/${entityId}/`);
      return res.data as EntityRecord;
    },
  });

  const relationshipsQuery = useQuery({
    queryKey: ['cockpit-detail-relationships', canonicalType, entityId],
    enabled: !!canonicalType && !!entityId,
    queryFn: async (): Promise<RelationshipCounts> => {
      // This API is already used by EntityDetailModal and is tenant-safe.
      const res = await businessApi.get(`/entities/${canonicalType}/${entityId}/relationships/?counts=true`);
      return res.data as RelationshipCounts;
    },
    retry: 1,
  });

  const title = useMemo(
    () => getPrimaryTitle(entityQuery.data, initialLabel),
    [entityQuery.data, initialLabel]
  );

  const companyName = useMemo(() => {
    if (canonicalType === 'customer') return entityQuery.data?.name || '';
    if (canonicalType === 'supplier') return entityQuery.data?.name || '';
    return '';
  }, [canonicalType, entityQuery.data]);

  const productsCount = useMemo(
    () => getRelationshipCount(relationshipsQuery.data, 'products'),
    [relationshipsQuery.data]
  );

  const locationsCount = useMemo(
    () => getRelationshipCount(relationshipsQuery.data, 'locations'),
    [relationshipsQuery.data]
  );

  const productsPreviewQuery = useQuery({
    queryKey: ['cockpit-detail-products-preview', canonicalType, entityId],
    enabled: !!canonicalType && !!entityId && productsCount > 0,
    queryFn: async (): Promise<RelationshipItemsResponse> => {
      const res = await businessApi.get(`/entities/${canonicalType}/${entityId}/relationships/products/?limit=5`);
      return res.data as RelationshipItemsResponse;
    },
    retry: 0,
  });

  const locationsPreviewQuery = useQuery({
    queryKey: ['cockpit-detail-locations-preview', canonicalType, entityId],
    enabled: !!canonicalType && !!entityId && locationsCount > 0,
    queryFn: async (): Promise<RelationshipItemsResponse> => {
      const res = await businessApi.get(`/entities/${canonicalType}/${entityId}/relationships/locations/?limit=5`);
      return res.data as RelationshipItemsResponse;
    },
    retry: 0,
  });

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuState({
      open: true,
      x: Math.round(rect.right - 240),
      y: Math.round(rect.bottom + 10),
    });
  }, []);

  const closeMenu = useCallback(() => setMenuState((s) => ({ ...s, open: false })), []);

  const handleContextAction = useCallback(
    (action: ContextAction) => {
      closeMenu();

      // Additive-only: actions are placeholders until the dedicated create flows are wired.
      // We still route to existing pages where possible.
      if (action === 'newOrder') {
        if (canonicalType === 'customer') {
          navigate(`/sales-orders?customer_id=${encodeURIComponent(entityId)}&action=create`, {
            state: { prefill: { source: 'cockpit', contextEntity: { id: entityId, type: canonicalType, label: title } } },
          });
          return;
        }
        if (canonicalType === 'supplier') {
          navigate(`/purchase-orders?supplier_id=${encodeURIComponent(entityId)}&action=create`, {
            state: { prefill: { source: 'cockpit', contextEntity: { id: entityId, type: canonicalType, label: title } } },
          });
          return;
        }
      }

      // Default fallback: stay on page (template scaffold)
      // In future: open WorkForms modal / dedicated create panels.
    },
    [canonicalType, closeMenu, entityId, navigate, title]
  );

  if (!canonicalType) {
    return (
      <Page>
        <StickyHeader>
          <HeaderInner>
            <HeaderLeft>
              <TitleRow>
                <Title>Detail View</Title>
              </TitleRow>
              <SubTitle>Unsupported entity type: {String(entityType)}</SubTitle>
            </HeaderLeft>
          </HeaderInner>
        </StickyHeader>
      </Page>
    );
  }

  return (
    <Page>
      <StickyHeader>
        <HeaderInner>
          <HeaderLeft>
            <BreadcrumbBar />
            <TitleRow>
              <Title>{title}</Title>
              <Pill>{canonicalType === 'customer' ? 'Customer' : 'Supplier'}</Pill>
            </TitleRow>
            <SubTitle>{companyName ? `Company: ${companyName}` : 'Customer detail view template (additive scaffold)'}</SubTitle>
          </HeaderLeft>
        </HeaderInner>
      </StickyHeader>

      <Layout>
        <LeftPanel>
          <BlueGroupCard>
            <CardHeader>
              <CardTitle>
                <Building2 size={14} />
                {canonicalType === 'customer' ? 'Customer' : 'Supplier'} Info
              </CardTitle>
              {(entityQuery.isFetching || relationshipsQuery.isFetching) && (
                <span style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: 12 }}>Loading…</span>
              )}
            </CardHeader>
            <CardBody>
              <InfoRow>
                <InfoKey>Company</InfoKey>
                <InfoValue>
                  <Building2 size={16} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                  <span>{companyName || '—'}</span>
                </InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoKey>Phone</InfoKey>
                <InfoValue>
                  <Phone size={16} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                  <span>{(entityQuery.data?.phone as string | undefined) || '—'}</span>
                </InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoKey>Email</InfoKey>
                <InfoValue>
                  <Mail size={16} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                  <span>{(entityQuery.data?.email as string | undefined) || '—'}</span>
                </InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoKey>Locations</InfoKey>
                <InfoValue>
                  <MapPin size={16} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                  <span>
                    {locationsCount > 0
                      ? `${locationsCount} linked location${locationsCount === 1 ? '' : 's'}`
                      : (entityQuery.data?.address as string | undefined) || '—'}
                  </span>
                </InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoKey>Products</InfoKey>
                <InfoValue>
                  <Package size={16} style={{ color: 'rgb(var(--color-text-tertiary))' }} />
                  <span>{productsCount > 0 ? `${productsCount} product${productsCount === 1 ? '' : 's'}` : '—'}</span>
                </InfoValue>
              </InfoRow>

              <MiniSectionTitle>Locations</MiniSectionTitle>
              {locationsCount > 0 && (locationsPreviewQuery.data?.items?.length ?? 0) > 0 ? (
                <MiniList>
                  {locationsPreviewQuery.data?.items?.slice(0, 5).map((loc) => (
                    <MiniListItem key={String(loc.id)}>
                      {String(loc.name ?? loc.title ?? loc.label ?? 'Location')}
                      {loc.subtitle && <MiniListItemMeta>{String(loc.subtitle)}</MiniListItemMeta>}
                    </MiniListItem>
                  ))}
                </MiniList>
              ) : (
                <EmptyHint>
                  {locationsCount > 0
                    ? 'Locations detected, but preview could not be loaded yet.'
                    : 'No linked locations yet.'}
                </EmptyHint>
              )}

              <MiniSectionTitle>Products list</MiniSectionTitle>
              {productsCount > 0 && (productsPreviewQuery.data?.items?.length ?? 0) > 0 ? (
                <MiniList>
                  {productsPreviewQuery.data?.items?.slice(0, 5).map((p) => (
                    <MiniListItem key={String(p.id)}>
                      {String(p.name ?? p.title ?? p.label ?? 'Product')}
                      {p.subtitle && <MiniListItemMeta>{String(p.subtitle)}</MiniListItemMeta>}
                    </MiniListItem>
                  ))}
                </MiniList>
              ) : (
                <EmptyHint>
                  {productsCount > 0
                    ? 'Products detected, but preview could not be loaded yet.'
                    : 'No linked products yet.'}
                </EmptyHint>
              )}
            </CardBody>
          </BlueGroupCard>

          <TabBar role="tablist" aria-label="Detail tabs">
            <Tab
              $active={activeTab === 'products'}
              onClick={() => setActiveTab('products')}
              role="tab"
              aria-selected={activeTab === 'products'}
            >
              <Package size={14} /> Products
            </Tab>
            <Tab $active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} role="tab" aria-selected={activeTab === 'orders'}>
              <Receipt size={14} /> Orders
            </Tab>
            <Tab
              $active={activeTab === 'callLogs'}
              onClick={() => setActiveTab('callLogs')}
              role="tab"
              aria-selected={activeTab === 'callLogs'}
            >
              <PhoneCall size={14} /> Call Logs
            </Tab>
            <Tab
              $active={activeTab === 'enquiries'}
              onClick={() => setActiveTab('enquiries')}
              role="tab"
              aria-selected={activeTab === 'enquiries'}
            >
              <MessageSquare size={14} /> Enquiries
            </Tab>
          </TabBar>
        </LeftPanel>

        <Center>
          <FloatingNewButton onClick={openMenu} aria-label="New">
            <Plus size={18} />
            +New
          </FloatingNewButton>

          <CenterCard>
            <CardHeader>
              <CardTitle>
                {activeTab === 'products' && (
                  <>
                    <Package size={14} /> Products
                  </>
                )}
                {activeTab === 'orders' && (
                  <>
                    <Receipt size={14} /> Orders
                  </>
                )}
                {activeTab === 'callLogs' && (
                  <>
                    <PhoneCall size={14} /> Call Logs
                  </>
                )}
                {activeTab === 'enquiries' && (
                  <>
                    <MessageSquare size={14} /> Enquiries
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CenterCardBody>
              <EmptyHint>
                This center canvas is intentionally template-first. Next iterations can render the selected tab’s records
                (products/orders/calls/enquiries) and reuse WorkForm “node” cards for quick actions.
              </EmptyHint>
            </CenterCardBody>
          </CenterCard>
        </Center>

        <RightPanel>
          <BlueGroupCard>
            <CardHeader>
              <CardTitle>
                <StickyNote size={14} /> Notes
              </CardTitle>
              <RightButton onClick={() => {}} aria-label="New Note">
                <Plus size={16} />
                New Note
              </RightButton>
            </CardHeader>
            <CardBody>
              <div style={{ fontSize: 13, color: 'rgb(var(--color-text-primary))', fontWeight: 700 }}>
                All notes related to currently selected Contact
              </div>
              <NoteItem>
                Capture call outcomes, follow-ups, and key preferences here.
                <NoteMeta>Template scaffold (no notes loaded yet)</NoteMeta>
              </NoteItem>
              {entityQuery.data?.notes && (
                <NoteItem>
                  {String(entityQuery.data.notes)}
                  <NoteMeta>From record notes</NoteMeta>
                </NoteItem>
              )}
            </CardBody>
          </BlueGroupCard>

          <BlueGroupCard>
            <CardHeader>
              <CardTitle>
                <Sparkles size={14} /> AI Overview
              </CardTitle>
            </CardHeader>
            <CardBody>
              <EmptyHint>
                Grok-style conversational summary goes here. It should synthesize: recent orders, open enquiries, last calls,
                and risk flags—always tenant-safe and grounded in the currently selected entity.
              </EmptyHint>
            </CardBody>
          </BlueGroupCard>
        </RightPanel>
      </Layout>

      {menuState.open && (
        <>
          <ContextMenuOverlay onClick={closeMenu} />
          <ContextMenu $x={menuState.x} $y={menuState.y} role="menu" aria-label="New context menu">
            <MenuHeader>
              Create New
              <button
                onClick={closeMenu}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'rgb(var(--color-text-tertiary))',
                  display: 'flex',
                }}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </MenuHeader>
            <MenuItem onClick={() => handleContextAction('newProduct')} role="menuitem">
              <Package size={16} /> New Product
            </MenuItem>
            <MenuItem onClick={() => handleContextAction('newOrder')} role="menuitem">
              <Receipt size={16} /> New Order
            </MenuItem>
            <MenuItem onClick={() => handleContextAction('newCallLog')} role="menuitem">
              <PhoneCall size={16} /> New Call Log
            </MenuItem>
            <MenuItem onClick={() => handleContextAction('newEnquiry')} role="menuitem">
              <MessageSquare size={16} /> New Enquiry
            </MenuItem>
          </ContextMenu>
        </>
      )}
    </Page>
  );
};

export default CockpitDetailViewTemplate;
