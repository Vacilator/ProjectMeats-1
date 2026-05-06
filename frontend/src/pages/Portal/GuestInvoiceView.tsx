import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import PortalPageShell from '../../components/Portal/PortalPageShell';
import { usePortalGrantSnapshot } from '../../hooks/usePortalGrantSnapshot';
import {
  PortalDocumentReference,
  PortalFulfillmentTracking,
  PortalGrantSnapshot,
  PortalInvoiceSummary,
} from '../../services/portalService';
import { formatCurrency } from '../../shared/utils';

const PORTAL_TOKEN_QUERY_PARAM = 'token';

export const getPortalSessionStorageKey = (tenantId: string, grantId: string) =>
  `portal-grant-token:${tenantId}:${grantId}`;

const readPortalToken = (storageKey: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem(storageKey)?.trim() ?? '';
};

const writePortalToken = (storageKey: string, token: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(storageKey, token);
};

const clearPortalToken = (storageKey: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(storageKey);
};

const formatPortalDate = (value?: string | null): string => {
  if (!value) {
    return 'Not provided';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(parsed);
};

const formatPortalDateTime = (value?: string | null): string => {
  if (!value) {
    return 'Not provided';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) {
    return 'Unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const renderInvoiceSummary = (invoice: PortalInvoiceSummary) => (
  <SectionCard key={invoice.invoice_number}>
    <CardHeader>
      <div>
        <CardTitle>{invoice.invoice_number}</CardTitle>
        <CardMeta>{invoice.customer_name}</CardMeta>
      </div>
      <StatusPill>{invoice.status.replace(/_/g, ' ')}</StatusPill>
    </CardHeader>
    <MetricGrid>
      <Metric>
        <MetricLabel>Total amount</MetricLabel>
        <MetricValue>{formatCurrency(invoice.total_amount)}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Outstanding</MetricLabel>
        <MetricValue>{formatCurrency(invoice.outstanding_amount ?? '0')}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Payment status</MetricLabel>
        <MetricValue>{invoice.payment_status || 'Unknown'}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Sales order</MetricLabel>
        <MetricValue>{invoice.sales_order_num || 'Not linked'}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Due date</MetricLabel>
        <MetricValue>{formatPortalDate(invoice.due_date)}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Created</MetricLabel>
        <MetricValue>{formatPortalDateTime(invoice.created_on)}</MetricValue>
      </Metric>
    </MetricGrid>
  </SectionCard>
);

const renderDocument = (document: PortalDocumentReference) => (
  <SectionCard key={`${document.source_kind}:${document.source_record_id}:${document.display_name}`}>
    <CardHeader>
      <div>
        <CardTitle>{document.display_name}</CardTitle>
        <CardMeta>{document.original_filename}</CardMeta>
      </div>
      <StatusPill>{document.source_kind.replace(/_/g, ' ')}</StatusPill>
    </CardHeader>
    <MetricGrid>
      <Metric>
        <MetricLabel>Type</MetricLabel>
        <MetricValue>{document.mime_type || 'Unknown'}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Size</MetricLabel>
        <MetricValue>{formatFileSize(document.byte_size)}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Created</MetricLabel>
        <MetricValue>{formatPortalDateTime(document.created_on)}</MetricValue>
      </Metric>
    </MetricGrid>
    {Object.keys(document.metadata).length > 0 && (
      <MetadataList>
        {Object.entries(document.metadata).map(([key, value]) => (
          <MetadataItem key={key}>
            <MetadataLabel>{key.replace(/_/g, ' ')}</MetadataLabel>
            <MetadataValue>{String(value)}</MetadataValue>
          </MetadataItem>
        ))}
      </MetadataList>
    )}
  </SectionCard>
);

const renderFulfillment = (fulfillment: PortalFulfillmentTracking) => (
  <SectionCard key={fulfillment.fulfillment_number}>
    <CardHeader>
      <div>
        <CardTitle>{fulfillment.fulfillment_number}</CardTitle>
        <CardMeta>
          {fulfillment.supplier_name} to {fulfillment.customer_name}
        </CardMeta>
      </div>
      <StatusPill>{fulfillment.status.replace(/_/g, ' ')}</StatusPill>
    </CardHeader>
    <MetricGrid>
      <Metric>
        <MetricLabel>Carrier</MetricLabel>
        <MetricValue>{fulfillment.carrier_name || 'Pending assignment'}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Ship date</MetricLabel>
        <MetricValue>{formatPortalDate(fulfillment.ship_date)}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Expected delivery</MetricLabel>
        <MetricValue>{formatPortalDate(fulfillment.expected_delivery)}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Delivered</MetricLabel>
        <MetricValue>{formatPortalDate(fulfillment.actual_delivery)}</MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>Tracking numbers</MetricLabel>
        <MetricValue>
          {fulfillment.tracking_numbers.length > 0
            ? fulfillment.tracking_numbers.join(', ')
            : 'Not provided'}
        </MetricValue>
      </Metric>
    </MetricGrid>
    {Object.keys(fulfillment.document_milestones).length > 0 && (
      <MetadataList>
        {Object.entries(fulfillment.document_milestones).map(([key, value]) => (
          <MetadataItem key={key}>
            <MetadataLabel>{key.replace(/_/g, ' ')}</MetadataLabel>
            <MetadataValue>{String(value)}</MetadataValue>
          </MetadataItem>
        ))}
      </MetadataList>
    )}
  </SectionCard>
);

const renderPortalContent = (snapshot: PortalGrantSnapshot) => (
  <SectionGrid>
    <Section>
      <SectionHeading>Invoice summary</SectionHeading>
      {snapshot.invoices.length > 0 ? snapshot.invoices.map(renderInvoiceSummary) : <EmptySectionNotice>No invoice summary was shared with this link.</EmptySectionNotice>}
    </Section>
    <Section>
      <SectionHeading>Document metadata</SectionHeading>
      {snapshot.documents.length > 0 ? snapshot.documents.map(renderDocument) : <EmptySectionNotice>No document metadata was shared with this link.</EmptySectionNotice>}
    </Section>
    <Section>
      <SectionHeading>Shipment tracking</SectionHeading>
      {snapshot.fulfillments.length > 0 ? snapshot.fulfillments.map(renderFulfillment) : <EmptySectionNotice>No shipment tracking was shared with this link.</EmptySectionNotice>}
    </Section>
  </SectionGrid>
);

const GuestInvoiceView: React.FC = () => {
  const { tenantId = '', grantId = '' } = useParams<{ tenantId: string; grantId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const storageKey = useMemo(() => getPortalSessionStorageKey(tenantId, grantId), [tenantId, grantId]);
  const [portalToken, setPortalToken] = useState(() => {
    const queryToken = searchParams.get(PORTAL_TOKEN_QUERY_PARAM)?.trim();
    if (queryToken) {
      return queryToken;
    }

    return readPortalToken(storageKey);
  });

  useEffect(() => {
    const queryToken = searchParams.get(PORTAL_TOKEN_QUERY_PARAM)?.trim();

    if (queryToken) {
      writePortalToken(storageKey, queryToken);
      setPortalToken(queryToken);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete(PORTAL_TOKEN_QUERY_PARAM);
      setSearchParams(nextParams, { replace: true });
      return;
    }

    const storedToken = readPortalToken(storageKey);
    if (storedToken && storedToken !== portalToken) {
      setPortalToken(storedToken);
    }
  }, [portalToken, searchParams, setSearchParams, storageKey]);

  const snapshotQuery = usePortalGrantSnapshot({
    tenantId,
    grantId,
    token: portalToken,
  });

  useEffect(() => {
    if (snapshotQuery.error?.code === 'invalid_or_expired') {
      clearPortalToken(storageKey);
    }
  }, [snapshotQuery.error, storageKey]);

  let content: React.ReactNode;

  if (!portalToken) {
    content = (
      <Alert
        type="warning"
        showIcon
        title="This portal link is missing its access token."
        description="Please reopen the latest link from your email so we can verify your access."
      />
    );
  } else if (snapshotQuery.isLoading) {
    content = <Skeleton active paragraph={{ rows: 10 }} />;
  } else if (snapshotQuery.error?.code === 'invalid_or_expired') {
    content = (
      <Alert
        type="error"
        showIcon
        title="This portal link is invalid or has expired."
        description="Ask your ProjectMeats contact to resend a fresh access link."
      />
    );
  } else if (snapshotQuery.error) {
    content = (
      <Alert
        type="error"
        showIcon
        title="We couldn't load this portal view."
        description={snapshotQuery.error.message}
      />
    );
  } else if (snapshotQuery.data) {
    content = (
      <>
        <SummaryBanner>
          <BannerLabel>Shared with</BannerLabel>
          <BannerValue>{snapshotQuery.data.subjectEmail}</BannerValue>
        </SummaryBanner>
        {renderPortalContent(snapshotQuery.data)}
      </>
    );
  } else {
    content = (
      <Alert
        type="info"
        showIcon
        title="No portal content is available yet."
        description="Please check back with your ProjectMeats contact if you expected invoice or shipment details here."
      />
    );
  }

  return (
    <PortalPageShell
      title="Shared invoice and shipment details"
      subtitle="This public portal is separate from the internal Meats Central workspace and only shows the guest-safe records attached to your signed access link."
    >
      {content}
    </PortalPageShell>
  );
};

const SummaryBanner = styled.section`
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  background: rgba(var(--color-primary), 0.08);
  border: 1px solid rgba(var(--color-primary), 0.18);
`;

const BannerLabel = styled.p`
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-text-secondary));
`;

const BannerValue = styled.p`
  margin: 0.35rem 0 0;
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const SectionGrid = styled.div`
  display: grid;
  gap: 1.5rem;
`;

const Section = styled.section`
  display: grid;
  gap: 1rem;
`;

const SectionHeading = styled.h2`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-size: 1.125rem;
`;

const EmptySectionNotice = styled.p`
  margin: 0;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  border: 1px dashed rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
`;

const SectionCard = styled.article`
  padding: 1.25rem;
  border-radius: 18px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const CardTitle = styled.h3`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-size: 1.125rem;
`;

const CardMeta = styled.p`
  margin: 0.35rem 0 0;
  color: rgb(var(--color-text-secondary));
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgba(var(--color-info), 0.12);
  color: rgb(var(--color-info));
  text-transform: capitalize;
  font-size: 0.75rem;
  font-weight: 700;
`;

const MetricGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.85rem;
  margin: 0;
`;

const Metric = styled.div`
  min-width: 0;
`;

const MetricLabel = styled.dt`
  margin: 0 0 0.25rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.8rem;
`;

const MetricValue = styled.dd`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-weight: 600;
  line-height: 1.5;
`;

const MetadataList = styled.dl`
  display: grid;
  gap: 0.5rem;
  margin: 1rem 0 0;
  padding-top: 1rem;
  border-top: 1px solid rgb(var(--color-border));
`;

const MetadataItem = styled.div`
  display: grid;
  gap: 0.15rem;
`;

const MetadataLabel = styled.dt`
  color: rgb(var(--color-text-secondary));
  font-size: 0.8rem;
  text-transform: capitalize;
`;

const MetadataValue = styled.dd`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-weight: 500;
`;

export default GuestInvoiceView;
