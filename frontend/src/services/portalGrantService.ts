import { businessApi } from './businessApi';

export type PortalGrantManagementEntityType = 'invoice' | 'freight-orders';

export interface PortalGrantDocument {
  sourceKind: string;
  sourceRecordType: string;
  sourceRecordId: string;
  displayName: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  metadata: Record<string, unknown>;
  publishedAt: string;
}

export interface PortalGrantSummary {
  id: string;
  tenantId: string;
  subjectEmail: string;
  status: string;
  resourceScope: Record<string, string[]>;
  documentSources: string[];
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string;
  lastAccessedAt: string | null;
  maxUses: number;
  useCount: number;
  createdOn: string;
  modifiedOn: string;
  isExpired: boolean;
  isActive: boolean;
  canResend: boolean;
  documents: PortalGrantDocument[];
}

export interface PortalGrantTarget {
  entityType: string;
  entityId: string;
  label: string;
  resourceScope: Record<string, string[]>;
  defaultDocumentSources: string[];
  issueBlocker: string | null;
  availableDocuments: PortalGrantDocument[];
}

export interface PortalGrantTargetResponse {
  target: PortalGrantTarget;
  grants: PortalGrantSummary[];
}

export interface IssuePortalGrantInput {
  subjectEmail: string;
  expiresAt: string;
  maxUses: number;
}

export interface PortalGrantActionResponse {
  grant: PortalGrantSummary;
  rawToken: string;
  sharePath: string;
}

export interface PortalGrantHistoryEvent {
  id: string;
  entityType: string;
  entityName: string;
  action: string;
  changedFields: string[] | null;
  snapshotBefore: Record<string, unknown> | null;
  snapshotAfter: Record<string, unknown> | null;
  actorEmail: string | null;
  createdAt: string | null;
}

const normalizeDocument = (payload: Record<string, unknown>): PortalGrantDocument => ({
  sourceKind: String(payload.source_kind || ''),
  sourceRecordType: String(payload.source_record_type || ''),
  sourceRecordId: String(payload.source_record_id || ''),
  displayName: String(payload.display_name || ''),
  originalFilename: String(payload.original_filename || ''),
  mimeType: String(payload.mime_type || ''),
  byteSize: Number(payload.byte_size || 0),
  metadata:
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? (payload.metadata as Record<string, unknown>)
      : {},
  publishedAt: String(payload.published_at || ''),
});

const normalizeGrant = (payload: Record<string, unknown>): PortalGrantSummary => ({
  id: String(payload.id || ''),
  tenantId: String(payload.tenant_id || ''),
  subjectEmail: String(payload.subject_email || ''),
  status: String(payload.status || ''),
  resourceScope:
    payload.resource_scope && typeof payload.resource_scope === 'object' && !Array.isArray(payload.resource_scope)
      ? (payload.resource_scope as Record<string, string[]>)
      : {},
  documentSources: Array.isArray(payload.document_sources)
    ? payload.document_sources.map((item) => String(item))
    : [],
  expiresAt: String(payload.expires_at || ''),
  revokedAt: payload.revoked_at ? String(payload.revoked_at) : null,
  revokedReason: String(payload.revoked_reason || ''),
  lastAccessedAt: payload.last_accessed_at ? String(payload.last_accessed_at) : null,
  maxUses: Number(payload.max_uses || 0),
  useCount: Number(payload.use_count || 0),
  createdOn: String(payload.created_on || ''),
  modifiedOn: String(payload.modified_on || ''),
  isExpired: Boolean(payload.is_expired),
  isActive: Boolean(payload.is_active),
  canResend: Boolean(payload.can_resend),
  documents: Array.isArray(payload.documents)
    ? payload.documents.map((item) => normalizeDocument(item as Record<string, unknown>))
    : [],
});

const normalizeTarget = (payload: Record<string, unknown>): PortalGrantTarget => ({
  entityType: String(payload.entity_type || ''),
  entityId: String(payload.entity_id || ''),
  label: String(payload.label || ''),
  resourceScope:
    payload.resource_scope && typeof payload.resource_scope === 'object' && !Array.isArray(payload.resource_scope)
      ? (payload.resource_scope as Record<string, string[]>)
      : {},
  defaultDocumentSources: Array.isArray(payload.default_document_sources)
    ? payload.default_document_sources.map((item) => String(item))
    : [],
  issueBlocker: payload.issue_blocker ? String(payload.issue_blocker) : null,
  availableDocuments: Array.isArray(payload.available_documents)
    ? payload.available_documents.map((item) => normalizeDocument(item as Record<string, unknown>))
    : [],
});

const normalizeHistoryEvent = (payload: Record<string, unknown>): PortalGrantHistoryEvent => ({
  id: String(payload.id || ''),
  entityType: String(payload.entity_type || ''),
  entityName: String(payload.entity_name || ''),
  action: String(payload.action || ''),
  changedFields: Array.isArray(payload.changed_fields)
    ? payload.changed_fields.map((item) => String(item))
    : null,
  snapshotBefore:
    payload.snapshot_before && typeof payload.snapshot_before === 'object' && !Array.isArray(payload.snapshot_before)
      ? (payload.snapshot_before as Record<string, unknown>)
      : null,
  snapshotAfter:
    payload.snapshot_after && typeof payload.snapshot_after === 'object' && !Array.isArray(payload.snapshot_after)
      ? (payload.snapshot_after as Record<string, unknown>)
      : null,
  actorEmail: payload.actor_email ? String(payload.actor_email) : null,
  createdAt: payload.created_at ? String(payload.created_at) : null,
});

export const buildAbsolutePortalShareUrl = (sharePath: string): string => {
  if (typeof window === 'undefined') {
    return sharePath;
  }

  return new URL(sharePath, window.location.origin).toString();
};

export const getPortalGrantTarget = async (
  entityType: PortalGrantManagementEntityType,
  entityId: string | number
): Promise<PortalGrantTargetResponse> => {
  const response = await businessApi.get(
    `/portal/targets/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}/grants/`
  );

  const payload = response.data as {
    target?: Record<string, unknown>;
    grants?: Array<Record<string, unknown>>;
  };

  return {
    target: normalizeTarget(payload.target || {}),
    grants: Array.isArray(payload.grants) ? payload.grants.map(normalizeGrant) : [],
  };
};

export const issuePortalGrant = async (
  entityType: PortalGrantManagementEntityType,
  entityId: string | number,
  input: IssuePortalGrantInput
): Promise<PortalGrantActionResponse> => {
  const response = await businessApi.post(
    `/portal/targets/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}/grants/`,
    {
      subject_email: input.subjectEmail,
      expires_at: input.expiresAt,
      max_uses: input.maxUses,
    }
  );

  const payload = response.data as {
    grant?: Record<string, unknown>;
    raw_token?: string;
    share_path?: string;
  };

  return {
    grant: normalizeGrant(payload.grant || {}),
    rawToken: String(payload.raw_token || ''),
    sharePath: String(payload.share_path || ''),
  };
};

export const resendPortalGrant = async (grantId: string): Promise<PortalGrantActionResponse> => {
  const response = await businessApi.post(`/portal/grants/${encodeURIComponent(grantId)}/resend/`);
  const payload = response.data as {
    grant?: Record<string, unknown>;
    raw_token?: string;
    share_path?: string;
  };

  return {
    grant: normalizeGrant(payload.grant || {}),
    rawToken: String(payload.raw_token || ''),
    sharePath: String(payload.share_path || ''),
  };
};

export const revokePortalGrant = async (
  grantId: string,
  reason = ''
): Promise<PortalGrantSummary> => {
  const response = await businessApi.post(`/portal/grants/${encodeURIComponent(grantId)}/revoke/`, {
    reason,
  });
  return normalizeGrant((response.data || {}) as Record<string, unknown>);
};

export const getPortalGrantHistory = async (grantId: string): Promise<PortalGrantHistoryEvent[]> => {
  const response = await businessApi.get(`/portal/grants/${encodeURIComponent(grantId)}/history/`);
  const payload = response.data as { events?: Array<Record<string, unknown>> };
  return Array.isArray(payload.events) ? payload.events.map(normalizeHistoryEvent) : [];
};
