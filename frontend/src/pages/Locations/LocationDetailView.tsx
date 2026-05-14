import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Tabs, Tag } from 'antd';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';

import { AIOverviewCard, EntityProfileHeader } from '@/components/Cockpit';
import { EntityFormSurface } from '@/components/Shared';
import { FormErrorBoundary } from '@/components/Shared/FormErrorBoundary';
import { useAuthState } from '@/contexts/AuthContext';
import { businessApi } from '@/services/businessApi';
import { isAuthError } from '@/utils/isAuthError';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import AIEntityInsights from '@/components/AIAssistant/AIEntityInsights';

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
      <ContactHeader>
        <ContactName>{name}</ContactName>
        <ContactActions>
          {c.department ? <Tag>{c.department}</Tag> : null}
          {c.email ? (
            <EmailLink href={`mailto:${c.email}`}>
              {c.email}
            </EmailLink>
          ) : null}
        </ContactActions>
      </ContactHeader>

      {phones.length ? (
        <PhoneInfo>
          {phones.join(' • ')}
        </PhoneInfo>
      ) : null}

      {(c.protein_types_responsible?.length || 0) > 0 && (
        <TagSection>
          <TagSectionLabel>
            Protein Types
          </TagSectionLabel>
          <TagRow>
            {(c.protein_types_responsible || []).map((v) => (
              <Tag key={v}>{v}</Tag>
            ))}
          </TagRow>
        </TagSection>
      )}

      {(c.items_responsible?.length || 0) > 0 && (
        <TagSection>
          <TagSectionLabel>Items</TagSectionLabel>
          <TagRow>
            {(c.items_responsible || []).map((v) => (
              <Tag key={v}>{v}</Tag>
            ))}
          </TagRow>
        </TagSection>
      )}
    </Card>
  );
};

export const LocationDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<RouteParams>();
  const { loading: authLoading, isAuthenticated } = useAuthState();

  const locationId = String(id || '').trim();
  useDocumentTitle(locationId ? `Location ${locationId}` : 'Location Detail');

  const [refreshKey, setRefreshKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!locationId) return;
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
        const resp = await businessApi.get('contacts/', {
          params: { location: locationId, page_size: 200, limit: 200 },
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
        setContactsError('Failed to load location contacts.');
      } finally {
        if (mounted) setLoadingContacts(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated, locationId]);

  const handleNavigateToEntity = useCallback(
    (entityType: string, entityId: string, _label: string) => {
      const type = String(entityType || '').trim().toLowerCase();
      const nextId = String(entityId || '').trim();
      if (!type || !nextId) return;

      if (type === 'customer') {
        navigate(`/customers/${nextId}`);
        return;
      }

      if (type === 'location') {
        navigate(`/locations/${nextId}`);
        return;
      }

      if (type === 'contact') {
        navigate(`/records/contact/${encodeURIComponent(nextId)}`);
        return;
      }

      if (type === 'supplier') {
        navigate(`/suppliers/${nextId}`);
        return;
      }

      if (type === 'plant') {
        navigate(`/plants/${nextId}`);
        return;
      }

      navigate(`/${type}/${nextId}`);
    },
    [navigate]
  );

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

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditOpen(false);
    setRefreshKey((key) => key + 1);
  }, []);

  const showAuthFallback = !authLoading && (!isAuthenticated || authError);

  return (
    <PageWrapper>
      <TopBar>
        <TitleGroup>
          <PageTitle>Location</PageTitle>
        </TitleGroup>

        <Button type="primary" onClick={() => setEditOpen(true)} disabled={!locationId || showAuthFallback}>
          Edit Location
        </Button>
      </TopBar>

      <ContentSection>
        {!showAuthFallback && (
          <>
            {locationId && <AIEntityInsights entityType="location" entityId={locationId} />}
            <AIOverviewCard entityType="location" entityId={locationId} />
            <EntityProfileHeader
              key={`${locationId}-${refreshKey}`}
              entityType="location"
              entityId={locationId}
              variant="full"
              onNavigateToEntity={handleNavigateToEntity}
            />
          </>
        )}
      </ContentSection>

      {locationId ? (
        <FormErrorBoundary entityType="location" onClose={handleEditClose}>
          <EntityFormSurface
            entityType="location"
            mode="edit"
            variant="modal"
            isOpen={editOpen}
            entityId={locationId}
            onClose={handleEditClose}
            onSuccess={handleEditSuccess}
          />
        </FormErrorBoundary>
      ) : null}

      <Card style={{ marginTop: 16 }} title="Contacts">
        {authLoading || loadingContacts ? (
          <LoadingWrapper>
            <Spin />
          </LoadingWrapper>
        ) : showAuthFallback ? (
          <Alert
            type="warning"
            showIcon
            title="Authentication required"
            description="Your session expired while loading this location. Please sign in again."
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
    </PageWrapper>
  );
};

export default LocationDetailView;

// --- Styled Components ---

const PageWrapper = styled.div`
  padding: 16px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PageTitle = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const ContentSection = styled.div`
  margin-top: 12px;
`;

const LoadingWrapper = styled.div`
  padding: 12px;
`;

const ContactHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
`;

const ContactName = styled.div`
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const ContactActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const EmailLink = styled.a`
  color: rgb(var(--color-primary));
`;

const PhoneInfo = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const TagSection = styled.div`
  margin-top: 8px;
`;

const TagSectionLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--color-text-tertiary));
`;

const TagRow = styled.div`
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
