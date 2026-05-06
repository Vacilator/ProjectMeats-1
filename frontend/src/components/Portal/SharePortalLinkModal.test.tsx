import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SharePortalLinkModal from './SharePortalLinkModal';
import {
  getPortalGrantHistory,
  getPortalGrantTarget,
  issuePortalGrant,
} from '../../services/portalGrantService';

vi.mock('../../services/portalGrantService', async () => {
  const actual = await vi.importActual<typeof import('../../services/portalGrantService')>(
    '../../services/portalGrantService'
  );

  return {
    ...actual,
    getPortalGrantTarget: vi.fn(),
    issuePortalGrant: vi.fn(),
    getPortalGrantHistory: vi.fn(),
    resendPortalGrant: vi.fn(),
    revokePortalGrant: vi.fn(),
  };
});

const mockedGetPortalGrantTarget = vi.mocked(getPortalGrantTarget);
const mockedIssuePortalGrant = vi.mocked(issuePortalGrant);
const mockedGetPortalGrantHistory = vi.mocked(getPortalGrantHistory);

afterEach(() => {
  mockedGetPortalGrantTarget.mockReset();
  mockedIssuePortalGrant.mockReset();
  mockedGetPortalGrantHistory.mockReset();
});

describe('SharePortalLinkModal', () => {
  it('issues a portal link and renders the latest share URL', async () => {
    mockedGetPortalGrantTarget.mockResolvedValue({
      target: {
        entityType: 'invoice',
        entityId: '42',
        label: 'INV-42',
        resourceScope: { invoice: ['42'] },
        defaultDocumentSources: ['invoice_summary', 'invoice_pdf'],
        issueBlocker: null,
        availableDocuments: [],
      },
      grants: [],
    });
    mockedIssuePortalGrant.mockResolvedValue({
      grant: {
        id: 'grant-1',
        tenantId: 'tenant-1',
        subjectEmail: 'buyer@example.com',
        status: 'active',
        resourceScope: { invoice: ['42'] },
        documentSources: ['invoice_summary', 'invoice_pdf'],
        expiresAt: '2026-05-13T12:00:00Z',
        revokedAt: null,
        revokedReason: '',
        lastAccessedAt: null,
        maxUses: 1,
        useCount: 0,
        createdOn: '2026-05-06T12:00:00Z',
        modifiedOn: '2026-05-06T12:00:00Z',
        isExpired: false,
        isActive: true,
        canResend: true,
        documents: [],
      },
      rawToken: 'raw-token',
      sharePath: '/portal/tenants/tenant-1/grants/grant-1?token=raw-token',
    });

    render(
      <SharePortalLinkModal
        entityType="invoice"
        entityId="42"
        isOpen
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Manage counterpart portal access for INV-42.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Counterparty email'), {
      target: { value: 'buyer@example.com' },
    });
    fireEvent.submit(screen.getByText('Issue link').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockedIssuePortalGrant).toHaveBeenCalledWith('invoice', '42', {
        subjectEmail: 'buyer@example.com',
        expiresAt: expect.any(String),
        maxUses: 1,
      });
    });

    expect(await screen.findByDisplayValue(/\/portal\/tenants\/tenant-1\/grants\/grant-1/)).toBeInTheDocument();
  });

  it('shows blockers and loads grant history for inspection', async () => {
    mockedGetPortalGrantTarget.mockResolvedValue({
      target: {
        entityType: 'carrier_purchase_order',
        entityId: '77',
        label: 'CPO-77',
        resourceScope: { purchase_order: ['12'] },
        defaultDocumentSources: ['purchase_order_status'],
        issueBlocker: 'This freight order does not have any curated portal-safe documents available yet.',
        availableDocuments: [],
      },
      grants: [
        {
          id: 'grant-2',
          tenantId: 'tenant-1',
          subjectEmail: 'dispatcher@example.com',
          status: 'active',
          resourceScope: { purchase_order: ['12'] },
          documentSources: ['purchase_order_status'],
          expiresAt: '2026-05-13T12:00:00Z',
          revokedAt: null,
          revokedReason: '',
          lastAccessedAt: null,
          maxUses: 3,
          useCount: 1,
          createdOn: '2026-05-06T12:00:00Z',
          modifiedOn: '2026-05-06T12:00:00Z',
          isExpired: false,
          isActive: true,
          canResend: true,
          documents: [],
        },
      ],
    });
    mockedGetPortalGrantHistory.mockResolvedValue([
      {
        id: 'event-1',
        entityType: 'Invoice',
        entityName: 'INV-42',
        action: 'ACCESS',
        changedFields: null,
        snapshotBefore: null,
        snapshotAfter: { endpoint: 'portal.snapshot' },
        actorEmail: 'buyer@example.com',
        createdAt: '2026-05-06T12:30:00Z',
      },
    ]);

    render(
      <SharePortalLinkModal
        entityType="freight-orders"
        entityId="77"
        isOpen
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByText(
        'This freight order does not have any curated portal-safe documents available yet.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Issue link')).toBeDisabled();

    fireEvent.click(screen.getByText('Inspect history'));

    expect(await screen.findByText('Counterparty accessed snapshot')).toBeInTheDocument();
  });
});
