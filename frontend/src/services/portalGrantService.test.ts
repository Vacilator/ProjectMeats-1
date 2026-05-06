import { afterEach, describe, expect, it, vi } from 'vitest';

import { businessApi } from './businessApi';
import {
  getPortalGrantHistory,
  getPortalGrantTarget,
  issuePortalGrant,
  resendPortalGrant,
  revokePortalGrant,
} from './portalGrantService';

vi.mock('./businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedBusinessApi = businessApi as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  mockedBusinessApi.get.mockReset();
  mockedBusinessApi.post.mockReset();
});

describe('portalGrantService', () => {
  it('normalizes the portal target response', async () => {
    mockedBusinessApi.get.mockResolvedValue({
      data: {
        target: {
          entity_type: 'invoice',
          entity_id: '42',
          label: 'INV-42',
          resource_scope: { invoice: ['42'] },
          default_document_sources: ['invoice_summary', 'invoice_pdf'],
          issue_blocker: null,
          available_documents: [
            {
              source_kind: 'invoice_pdf',
              source_record_type: 'invoice',
              source_record_id: '42',
              display_name: 'Invoice PDF',
              original_filename: 'invoice.pdf',
              mime_type: 'application/pdf',
              byte_size: 2048,
              metadata: { invoice_number: 'INV-42' },
              published_at: '2026-05-06T00:00:00Z',
            },
          ],
        },
        grants: [],
      },
    });

    const response = await getPortalGrantTarget('invoice', 42);

    expect(mockedBusinessApi.get).toHaveBeenCalledWith('/portal/targets/invoice/42/grants/');
    expect(response.target.label).toBe('INV-42');
    expect(response.target.defaultDocumentSources).toEqual(['invoice_summary', 'invoice_pdf']);
    expect(response.target.availableDocuments[0].displayName).toBe('Invoice PDF');
  });

  it('uses the authenticated service layer for issue, resend, revoke, and history calls', async () => {
    mockedBusinessApi.post
      .mockResolvedValueOnce({
        data: {
          grant: {
            id: 'grant-1',
            tenant_id: 'tenant-1',
            subject_email: 'buyer@example.com',
            status: 'active',
            resource_scope: { invoice: ['42'] },
            document_sources: ['invoice_summary'],
            expires_at: '2026-05-13T12:00:00Z',
            revoked_at: null,
            revoked_reason: '',
            last_accessed_at: null,
            max_uses: 2,
            use_count: 0,
            created_on: '2026-05-06T12:00:00Z',
            modified_on: '2026-05-06T12:00:00Z',
            is_expired: false,
            is_active: true,
            can_resend: true,
            documents: [],
          },
          raw_token: 'raw-token',
          share_path: '/portal/tenants/tenant-1/grants/grant-1?token=raw-token',
        },
      })
      .mockResolvedValueOnce({
        data: {
          grant: {
            id: 'grant-1',
            tenant_id: 'tenant-1',
            subject_email: 'buyer@example.com',
            status: 'active',
            resource_scope: { invoice: ['42'] },
            document_sources: ['invoice_summary'],
            expires_at: '2026-05-13T12:00:00Z',
            revoked_at: null,
            revoked_reason: '',
            last_accessed_at: null,
            max_uses: 2,
            use_count: 0,
            created_on: '2026-05-06T12:00:00Z',
            modified_on: '2026-05-06T12:00:00Z',
            is_expired: false,
            is_active: true,
            can_resend: true,
            documents: [],
          },
          raw_token: 'fresh-token',
          share_path: '/portal/tenants/tenant-1/grants/grant-1?token=fresh-token',
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'grant-1',
          tenant_id: 'tenant-1',
          subject_email: 'buyer@example.com',
          status: 'revoked',
          resource_scope: { invoice: ['42'] },
          document_sources: ['invoice_summary'],
          expires_at: '2026-05-13T12:00:00Z',
          revoked_at: '2026-05-06T14:00:00Z',
          revoked_reason: 'done',
          last_accessed_at: null,
          max_uses: 2,
          use_count: 0,
          created_on: '2026-05-06T12:00:00Z',
          modified_on: '2026-05-06T14:00:00Z',
          is_expired: false,
          is_active: false,
          can_resend: false,
          documents: [],
        },
      });
    mockedBusinessApi.get.mockResolvedValueOnce({
      data: {
        events: [
          {
            id: 'event-1',
            entity_type: 'PortalGrant',
            entity_name: 'Portal grant for buyer@example.com',
            action: 'UPDATE',
            changed_fields: ['status'],
            snapshot_before: null,
            snapshot_after: { portal_event: 'revoked' },
            actor_email: 'ops@example.com',
            created_at: '2026-05-06T14:00:00Z',
          },
        ],
      },
    });

    const issueResponse = await issuePortalGrant('invoice', '42', {
      subjectEmail: 'buyer@example.com',
      expiresAt: '2026-05-13T12:00:00Z',
      maxUses: 2,
    });
    const resendResponse = await resendPortalGrant('grant-1');
    const revokeResponse = await revokePortalGrant('grant-1', 'done');
    const historyResponse = await getPortalGrantHistory('grant-1');

    expect(mockedBusinessApi.post).toHaveBeenNthCalledWith(1, '/portal/targets/invoice/42/grants/', {
      subject_email: 'buyer@example.com',
      expires_at: '2026-05-13T12:00:00Z',
      max_uses: 2,
    });
    expect(mockedBusinessApi.post).toHaveBeenNthCalledWith(2, '/portal/grants/grant-1/resend/');
    expect(mockedBusinessApi.post).toHaveBeenNthCalledWith(3, '/portal/grants/grant-1/revoke/', {
      reason: 'done',
    });
    expect(mockedBusinessApi.get).toHaveBeenCalledWith('/portal/grants/grant-1/history/');
    expect(issueResponse.rawToken).toBe('raw-token');
    expect(resendResponse.rawToken).toBe('fresh-token');
    expect(revokeResponse.status).toBe('revoked');
    expect(historyResponse[0].snapshotAfter?.portal_event).toBe('revoked');
  });
});
