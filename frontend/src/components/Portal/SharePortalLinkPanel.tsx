import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import {
  buildAbsolutePortalShareUrl,
  getPortalGrantHistory,
  getPortalGrantTarget,
  issuePortalGrant,
  resendPortalGrant,
  revokePortalGrant,
  type PortalGrantHistoryEvent,
  type PortalGrantManagementEntityType,
  type PortalGrantSummary,
  type PortalGrantTarget,
} from '../../services/portalGrantService';

interface SharePortalLinkPanelProps {
  entityType: PortalGrantManagementEntityType;
  entityId: string | number;
  onBack: () => void;
}

const Container = styled.div`
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 0;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const CloseButton = styled.button`
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: transparent;
  color: rgb(var(--color-text-primary));
  padding: 0.55rem 0.85rem;
  font-size: 0.875rem;
  cursor: pointer;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const InlineTextButton = styled.button`
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  padding: 0;
  font-size: 0.875rem;
  cursor: pointer;
`;

const Section = styled.section`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgb(var(--color-surface, 255 255 255));
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
`;

const SectionCopy = styled.p`
  margin: 0;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const AlertBox = styled.div<{ tone?: 'error' | 'warning' | 'success' }>`
  border-radius: var(--radius-md);
  padding: 0.875rem 1rem;
  border: 1px solid
    ${({ tone }) =>
      tone === 'error'
        ? 'rgb(var(--color-error))'
        : tone === 'warning'
          ? 'rgb(var(--color-warning))'
          : 'rgb(var(--color-success))'};
  background:
    ${({ tone }) =>
      tone === 'error'
        ? 'rgba(var(--color-error), 0.08)'
        : tone === 'warning'
          ? 'rgba(var(--color-warning), 0.08)'
          : 'rgba(var(--color-success), 0.08)'};
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const InputRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
`;

const Input = styled.input`
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  padding: 0.75rem 0.875rem;
  font-size: 0.875rem;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  padding: 0.7rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: transparent;
  color: rgb(var(--color-text-primary));
  padding: 0.7rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const GrantCard = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const GrantHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const GrantMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const GrantTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 600;
`;

const GrantSubtle = styled.div`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
`;

const StatusPill = styled.span<{ state: string }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  background:
    ${({ state }) =>
      state === 'active'
        ? 'rgba(var(--color-success), 0.12)'
        : state === 'revoked'
          ? 'rgba(var(--color-error), 0.12)'
          : 'rgba(var(--color-warning), 0.12)'};
  color:
    ${({ state }) =>
      state === 'active'
        ? 'rgb(var(--color-success))'
        : state === 'revoked'
          ? 'rgb(var(--color-error))'
          : 'rgb(var(--color-warning))'};
`;

const DocumentList = styled.ul`
  margin: 0;
  padding-left: 1rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.84rem;
`;

const HistoryList = styled.ol`
  margin: 0;
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const HistoryItem = styled.li`
  color: rgb(var(--color-text-primary));
`;

const HistoryMeta = styled.div`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const defaultExpiryInput = (): string => {
  const next = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const year = next.getFullYear();
  const month = `${next.getMonth() + 1}`.padStart(2, '0');
  const day = `${next.getDate()}`.padStart(2, '0');
  const hours = `${next.getHours()}`.padStart(2, '0');
  const minutes = `${next.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateTime = (raw: string | null | undefined): string => {
  if (!raw) {
    return '—';
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString();
};

const describeHistoryEvent = (event: PortalGrantHistoryEvent): string => {
  const snapshot = event.snapshotAfter || {};
  const portalEvent = String(snapshot.portal_event || '');
  if (portalEvent === 'issued') {
    return 'Portal link issued';
  }
  if (portalEvent === 'resent') {
    return 'Portal link reissued';
  }
  if (portalEvent === 'revoked') {
    return 'Portal link revoked';
  }

  const endpoint = String(snapshot.endpoint || '');
  if (endpoint.startsWith('portal.')) {
    return `Counterparty accessed ${endpoint.replace('portal.', '').replace(/-/g, ' ')}`;
  }

  if (event.action === 'ACCESS') {
    return 'Counterparty accessed shared portal content';
  }

  return 'Portal grant activity recorded';
};

export const SharePortalLinkPanel: React.FC<SharePortalLinkPanelProps> = ({
  entityType,
  entityId,
  onBack,
}) => {
  const [target, setTarget] = useState<PortalGrantTarget | null>(null);
  const [grants, setGrants] = useState<PortalGrantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subjectEmail, setSubjectEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpiryInput);
  const [maxUses, setMaxUses] = useState('1');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [historyByGrant, setHistoryByGrant] = useState<Record<string, PortalGrantHistoryEvent[]>>({});
  const [historyLoadingGrantId, setHistoryLoadingGrantId] = useState<string | null>(null);
  const [expandedGrantId, setExpandedGrantId] = useState<string | null>(null);

  const loadTarget = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPortalGrantTarget(entityType, entityId);
      setTarget(response.target);
      setGrants(response.grants);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Failed to load portal grant controls.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void loadTarget();
  }, [loadTarget]);

  const headerSubtitle = useMemo(() => {
    if (target?.label) {
      return `Manage counterpart portal access for ${target.label}.`;
    }
    return 'Manage counterpart portal access.';
  }, [target?.label]);

  const handleIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionMessage(null);

    try {
      const response = await issuePortalGrant(entityType, entityId, {
        subjectEmail: subjectEmail.trim(),
        expiresAt: new Date(expiresAt).toISOString(),
        maxUses: Number(maxUses || 1),
      });
      setShareUrl(buildAbsolutePortalShareUrl(response.sharePath));
      setActionMessage('Portal link issued successfully.');
      await loadTarget();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Failed to issue portal link.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setActionMessage('Portal link copied to clipboard.');
  };

  const handleResend = async (grantId: string) => {
    setSubmitting(true);
    setError(null);
    setActionMessage(null);
    try {
      const response = await resendPortalGrant(grantId);
      setShareUrl(buildAbsolutePortalShareUrl(response.sharePath));
      setActionMessage('Portal link reissued successfully.');
      await loadTarget();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Failed to resend portal link.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    setSubmitting(true);
    setError(null);
    setActionMessage(null);
    try {
      await revokePortalGrant(grantId);
      setActionMessage('Portal link revoked.');
      await loadTarget();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Failed to revoke portal link.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectHistory = async (grantId: string) => {
    if (expandedGrantId === grantId) {
      setExpandedGrantId(null);
      return;
    }

    setExpandedGrantId(grantId);
    if (historyByGrant[grantId]) {
      return;
    }

    setHistoryLoadingGrantId(grantId);
    try {
      const events = await getPortalGrantHistory(grantId);
      setHistoryByGrant((current) => ({ ...current, [grantId]: events }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Failed to load portal history.';
      setError(detail);
    } finally {
      setHistoryLoadingGrantId(null);
    }
  };

  return (
    <Container data-testid="share-portal-link-panel">
      <Header>
        <TitleBlock>
          <InlineTextButton type="button" onClick={onBack}>
            ← Back to record details
          </InlineTextButton>
          <Title>Portal access</Title>
          <Subtitle>{headerSubtitle}</Subtitle>
        </TitleBlock>
        <CloseButton type="button" aria-label="Back to record details" onClick={onBack}>
          Back
        </CloseButton>
      </Header>

      <Body>
        {error ? <AlertBox tone="error">{error}</AlertBox> : null}
        {actionMessage ? <AlertBox tone="success">{actionMessage}</AlertBox> : null}

        <Section>
          <SectionTitle>Issue a new link</SectionTitle>
          <SectionCopy>
            Create a bounded, tenant-scoped portal link for the selected record.
          </SectionCopy>
          {target?.issueBlocker ? <AlertBox tone="warning">{target.issueBlocker}</AlertBox> : null}
          <form onSubmit={handleIssue}>
            <InputRow>
              <Label>
                Counterparty email
                <Input
                  aria-label="Counterparty email"
                  type="email"
                  value={subjectEmail}
                  onChange={(event) => setSubjectEmail(event.target.value)}
                  placeholder="counterparty@example.com"
                  required
                />
              </Label>
              <Label>
                Expiration
                <Input
                  aria-label="Expiration"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  required
                />
              </Label>
              <Label>
                Allowed opens
                <Input
                  aria-label="Allowed opens"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.value)}
                  required
                />
              </Label>
            </InputRow>
            <ActionRow style={{ marginTop: '0.75rem' }}>
              <PrimaryButton
                type="submit"
                disabled={submitting || loading || Boolean(target?.issueBlocker)}
              >
                {submitting ? 'Issuing…' : 'Issue link'}
              </PrimaryButton>
              {shareUrl ? (
                <SecondaryButton type="button" onClick={() => void handleCopyShareUrl()}>
                  Copy latest link
                </SecondaryButton>
              ) : null}
            </ActionRow>
          </form>
          {shareUrl ? (
            <Label>
              Latest portal link
              <Input
                aria-label="Latest portal link"
                type="text"
                readOnly
                value={shareUrl}
              />
            </Label>
          ) : null}
        </Section>

        <Section>
          <SectionTitle>Available portal-safe documents</SectionTitle>
          {loading ? (
            <SectionCopy>Loading portal grant details…</SectionCopy>
          ) : target?.availableDocuments?.length ? (
            <DocumentList>
              {target.availableDocuments.map((document) => (
                <li key={`${document.sourceKind}-${document.sourceRecordId}-${document.displayName}`}>
                  {document.displayName}
                </li>
              ))}
            </DocumentList>
          ) : (
            <EmptyState>No curated portal-safe documents are currently attached.</EmptyState>
          )}
        </Section>

        <Section>
          <SectionTitle>Existing grants</SectionTitle>
          {loading ? (
            <SectionCopy>Loading grant history…</SectionCopy>
          ) : grants.length ? (
            grants.map((grant) => (
              <GrantCard key={grant.id}>
                <GrantHeader>
                  <GrantMeta>
                    <GrantTitle>{grant.subjectEmail}</GrantTitle>
                    <GrantSubtle>
                      Expires {formatDateTime(grant.expiresAt)} · {grant.useCount}/{grant.maxUses}{' '}
                      opens used
                    </GrantSubtle>
                  </GrantMeta>
                  <StatusPill state={grant.status}>{grant.status}</StatusPill>
                </GrantHeader>

                {grant.documents.length ? (
                  <DocumentList>
                    {grant.documents.map((document) => (
                      <li key={`${document.sourceKind}-${document.sourceRecordId}-${document.displayName}`}>
                        {document.displayName}
                      </li>
                    ))}
                  </DocumentList>
                ) : null}

                <ActionRow>
                  <SecondaryButton
                    type="button"
                    disabled={!grant.canResend || submitting}
                    onClick={() => void handleResend(grant.id)}
                  >
                    Resend
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    disabled={submitting || grant.status === 'revoked'}
                    onClick={() => void handleRevoke(grant.id)}
                  >
                    Revoke
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => void handleInspectHistory(grant.id)}
                  >
                    {expandedGrantId === grant.id ? 'Hide history' : 'Inspect history'}
                  </SecondaryButton>
                </ActionRow>

                {expandedGrantId === grant.id ? (
                  historyLoadingGrantId === grant.id ? (
                    <SectionCopy>Loading grant history…</SectionCopy>
                  ) : historyByGrant[grant.id]?.length ? (
                    <HistoryList>
                      {historyByGrant[grant.id].map((event) => (
                        <HistoryItem key={event.id}>
                          <div>{describeHistoryEvent(event)}</div>
                          <HistoryMeta>
                            {(event.actorEmail || 'System')} · {formatDateTime(event.createdAt)}
                          </HistoryMeta>
                        </HistoryItem>
                      ))}
                    </HistoryList>
                  ) : (
                    <EmptyState>No grant history recorded yet.</EmptyState>
                  )
                ) : null}
              </GrantCard>
            ))
          ) : (
            <EmptyState>No portal grants have been issued for this record yet.</EmptyState>
          )}
        </Section>
      </Body>
    </Container>
  );
};

export default SharePortalLinkPanel;
