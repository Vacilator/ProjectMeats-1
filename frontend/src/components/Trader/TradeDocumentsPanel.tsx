/**
 * TradeDocumentsPanel
 *
 * Displays trade documents grouped by stage in execution order.
 * Supports file upload, download links, and collapsible stage sections.
 *
 * Theme Compliance: CSS custom properties only — no hardcoded colours.
 */
import React, { useMemo, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Collapse, Tag, Spin, Tooltip, Upload, message } from 'antd';
import {
  FileText,
  Mail,
  Paperclip,
  Upload as UploadIcon,
  ArrowUpRight,
  ArrowDownLeft,
  File,
  Shield,
  CreditCard,
  Truck,
  Package,
  Receipt,
  ShoppingCart,
  FileSearch,
} from 'lucide-react';
import styled from 'styled-components';
import { withTenantQueryKey } from '@/utils/queryKeys';
import {
  tradeDocumentsService,
  TRADE_STAGES,
  type TradeDocument,
  type TradeStageKey,
} from '@/services/tradeDocumentsService';

// ============================================================================
// Props
// ============================================================================

interface TradeDocumentsPanelProps {
  entityType: string;
  entityId: string;
  tradeSessionId?: number | string;
}

// ============================================================================
// Constants
// ============================================================================

const STAGE_ICONS: Record<string, React.ReactNode> = {
  inquiry: <FileSearch size={16} />,
  purchase_order: <ShoppingCart size={16} />,
  sales_order: <Receipt size={16} />,
  carrier_po: <Truck size={16} />,
  fulfillment: <Package size={16} />,
  invoice: <CreditCard size={16} />,
};

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText size={14} />,
  email: <Mail size={14} />,
  attachment: <Paperclip size={14} />,
  contract: <Shield size={14} />,
  quote: <FileText size={14} />,
  bid_request: <FileText size={14} />,
  bid_response: <FileText size={14} />,
  confirmation: <FileText size={14} />,
  invoice_doc: <CreditCard size={14} />,
  bol: <Truck size={14} />,
  pod: <Package size={14} />,
};

const GENERATED_LABELS: Record<string, string> = {
  system: '(auto)',
  user: '(uploaded)',
  email_ingest: '(email)',
};

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) {
      const diffMin = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `${diffMin}m ago`;
    }
    return `${diffHrs}h ago`;
  }
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function inferStageFromEntity(entityType: string): TradeStageKey {
  const map: Record<string, TradeStageKey> = {
    inquiry: 'inquiry',
    purchase_order: 'purchase_order',
    sales_order: 'sales_order',
    carrier_purchase_order: 'carrier_po',
    fulfillment: 'fulfillment',
    invoice: 'invoice',
  };
  return map[entityType] ?? 'inquiry';
}

// ============================================================================
// Styled Components — theme tokens only
// ============================================================================

const PanelWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const StageBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const DocCount = styled(Tag)`
  margin-left: 8px;
`;

const DocRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover {
    background: rgb(var(--color-primary) / 0.06);
  }
`;

const DocLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const DocTitle = styled.a`
  color: rgb(var(--color-text-primary));
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;

  &:hover {
    color: rgb(var(--color-primary));
    text-decoration: underline;
  }
`;

const DocRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
`;

const MetaText = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
`;

const SpinWrapper = styled.div`
  display: flex;
  justify-content: center;
  padding: 48px 0;
`;

const EmptyWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 16px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
`;

const EmptyIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  margin-bottom: 12px;
`;

const EmptyTitle = styled.p`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px;
`;

const EmptyMessage = styled.p`
  font-size: 13px;
  margin: 0 0 16px;
`;

// ============================================================================
// Component
// ============================================================================

export const TradeDocumentsPanel: React.FC<TradeDocumentsPanelProps> = ({
  entityType,
  entityId,
  tradeSessionId,
}) => {
  const queryClient = useQueryClient();

  const stableQueryKey = useMemo(
    () =>
      tradeSessionId
        ? withTenantQueryKey('trade-documents', 'session', String(tradeSessionId))
        : withTenantQueryKey('trade-documents', 'entity', entityType, entityId),
    [tradeSessionId, entityType, entityId],
  );

  const fetchFn = useCallback(async () => {
    if (tradeSessionId) {
      return tradeDocumentsService.listByTradeSession(tradeSessionId);
    }
    return tradeDocumentsService.listByEntity(entityType, entityId);
  }, [tradeSessionId, entityType, entityId]);

  const { data: documents, isLoading } = useQuery({
    queryKey: stableQueryKey,
    queryFn: fetchFn,
    enabled: Boolean(entityId),
  });

  const currentStage = useMemo(() => inferStageFromEntity(entityType), [entityType]);

  // Group documents by stage in execution order
  const groupedByStage = useMemo(() => {
    const docs = documents ?? [];
    const map = new Map<string, TradeDocument[]>();
    for (const stage of TRADE_STAGES) {
      map.set(stage.key, []);
    }
    for (const doc of docs) {
      const bucket = map.get(doc.stage);
      if (bucket) {
        bucket.push(doc);
      } else {
        // Unknown stage — append to a catch-all
        const existing = map.get('inquiry') ?? [];
        existing.push(doc);
        map.set('inquiry', existing);
      }
    }
    // Sort each bucket by stage_order, then created_on
    for (const [, bucket] of map) {
      bucket.sort((a, b) => {
        if (a.stage_order !== b.stage_order) return a.stage_order - b.stage_order;
        return new Date(a.created_on).getTime() - new Date(b.created_on).getTime();
      });
    }
    return map;
  }, [documents]);

  // Auto-expand panels that have documents
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const expandedKeys = useMemo(() => {
    if (activeKeys.length > 0) return activeKeys;
    const keys: string[] = [];
    for (const [stageKey, docs] of groupedByStage) {
      if (docs.length > 0) keys.push(stageKey);
    }
    return keys.length > 0 ? keys : [currentStage];
  }, [activeKeys, groupedByStage, currentStage]);

  const handleCollapseChange = useCallback((keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys]);
  }, []);

  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (info: { file: File }) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', info.file);
        if (tradeSessionId) {
          formData.append('trade_session', String(tradeSessionId));
        }
        formData.append('entity_type', entityType);
        formData.append('entity_id', entityId);
        formData.append('stage', currentStage);
        formData.append('direction', 'sent');
        formData.append('document_type', 'other');
        formData.append('title', info.file.name);

        await tradeDocumentsService.upload(formData);
        message.success('Document uploaded');
        void queryClient.invalidateQueries({ queryKey: stableQueryKey });
      } catch {
        message.error('Upload failed. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [tradeSessionId, entityType, entityId, currentStage, queryClient, stableQueryKey],
  );

  const customRequest = useCallback(
    (options: unknown) => {
      const opts = options as { file: File; onSuccess?: () => void; onError?: (e: Error) => void };
      void handleUpload({ file: opts.file })
        .then(() => opts.onSuccess?.())
        .catch((e: unknown) => opts.onError?.(e instanceof Error ? e : new Error(String(e))));
    },
    [handleUpload],
  );

  // ---- Render ----

  if (isLoading) {
    return (
      <SpinWrapper>
        <Spin />
      </SpinWrapper>
    );
  }

  const totalDocs = documents?.length ?? 0;

  if (totalDocs === 0) {
    return (
      <EmptyWrapper>
        <EmptyIcon>
          <FileText size={28} />
        </EmptyIcon>
        <EmptyTitle>No documents yet</EmptyTitle>
        <EmptyMessage>
          Upload a file to attach it to this record. Documents are organised by trade stage.
        </EmptyMessage>
        <Upload customRequest={customRequest} showUploadList={false} multiple={false}>
          <Button icon={<UploadIcon size={14} />} loading={uploading}>
            Upload Document
          </Button>
        </Upload>
      </EmptyWrapper>
    );
  }

  const collapseItems = TRADE_STAGES.map((stage) => {
    const docs = groupedByStage.get(stage.key) ?? [];
    return {
      key: stage.key,
      label: (
        <StageBadge>
          {STAGE_ICONS[stage.key] ?? <File size={16} />}
          {stage.label}
          {docs.length > 0 && <DocCount>{docs.length}</DocCount>}
        </StageBadge>
      ),
      children: docs.length === 0 ? (
        <MetaText>No documents in this stage.</MetaText>
      ) : (
        docs.map((doc) => (
          <DocRow key={doc.id}>
            <DocLeft>
              {doc.direction === 'sent' ? (
                <Tooltip title="Sent">
                  <Tag color="blue" style={{ margin: 0 }}>
                    <ArrowUpRight size={12} style={{ marginRight: 2 }} />
                    Sent
                  </Tag>
                </Tooltip>
              ) : (
                <Tooltip title="Received">
                  <Tag color="green" style={{ margin: 0 }}>
                    <ArrowDownLeft size={12} style={{ marginRight: 2 }} />
                    Received
                  </Tag>
                </Tooltip>
              )}
              {DOC_TYPE_ICONS[doc.document_type] ?? <File size={14} />}
              {doc.download_url ? (
                <DocTitle
                  href={doc.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={doc.title}
                >
                  {doc.title}
                </DocTitle>
              ) : (
                <Tooltip title={doc.email_subject ?? doc.title}>
                  <DocTitle as="span">{doc.title}</DocTitle>
                </Tooltip>
              )}
            </DocLeft>
            <DocRight>
              <MetaText>{GENERATED_LABELS[doc.generated_by] ?? ''}</MetaText>
              <MetaText>{formatFileSize(doc.file_size)}</MetaText>
              <Tooltip title={new Date(doc.created_on).toLocaleString()}>
                <MetaText>{formatRelativeDate(doc.created_on)}</MetaText>
              </Tooltip>
            </DocRight>
          </DocRow>
        ))
      ),
    };
  });

  return (
    <PanelWrapper>
      <HeaderRow>
        <span style={{ fontWeight: 600, color: 'rgb(var(--color-text-primary))' }}>
          Trade Documents ({totalDocs})
        </span>
        <Upload customRequest={customRequest} showUploadList={false} multiple={false}>
          <Button size="small" icon={<UploadIcon size={14} />} loading={uploading}>
            Upload
          </Button>
        </Upload>
      </HeaderRow>

      <Collapse
        activeKey={expandedKeys}
        onChange={handleCollapseChange}
        items={collapseItems}
      />
    </PanelWrapper>
  );
};

export default TradeDocumentsPanel;
