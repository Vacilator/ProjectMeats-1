import React from 'react';
import styled, { css } from 'styled-components';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCcw,
} from 'lucide-react';

import type {
  DocumentLineageSummary,
  DocumentProcessingMetadata,
  DocumentSemanticIndexingMetadata,
  DocumentSourceMetadata,
  UploadedDocument,
} from '@/types';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

type StatusDescriptor = {
  label: string;
  tone: BadgeTone;
  detail?: string;
  title?: string;
  icon: React.ReactNode;
};

const RETRYABLE_DOCUMENT_ERROR_CODES = new Set([
  'UNSTRUCTURED_NOT_CONFIGURED',
  'UNSTRUCTURED_UNREACHABLE',
  'UNSTRUCTURED_AUTH_FAILED',
]);

const toTitleCase = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');

export const getDocumentSourceLabel = (
  sourceMetadata?: DocumentSourceMetadata | null
): string => {
  const source = String(sourceMetadata?.source || '').trim().toLowerCase();

  if (!source) {
    return 'Unknown source';
  }

  if (source === 'manual_upload') {
    return 'Manual upload';
  }

  if (
    source === 'microsoft_graph_attachment' ||
    Boolean(sourceMetadata?.message_id || sourceMetadata?.attachment_id)
  ) {
    return 'Outlook attachment';
  }

  return toTitleCase(source);
};

export const isRetryableDocumentFailure = (
  processingMetadata?: DocumentProcessingMetadata | null
): boolean => {
  const code = String(processingMetadata?.parse_error_code || '').trim().toUpperCase();
  return RETRYABLE_DOCUMENT_ERROR_CODES.has(code);
};

export const getDocumentStatusDescriptor = (
  processingStatus?: UploadedDocument['processing_status'] | string | null,
  processingMetadata?: DocumentProcessingMetadata | null
): StatusDescriptor => {
  const status = String(processingStatus || '').trim().toLowerCase();
  const errorCode = String(processingMetadata?.parse_error_code || '').trim();
  const errorMessage = String(processingMetadata?.parse_error_message || '').trim();

  if (status === 'completed') {
    return {
      label: 'Ready',
      tone: 'success',
      icon: <CheckCircle2 size={12} aria-hidden="true" />,
    };
  }

  if (status === 'processing') {
    return {
      label: 'Parsing',
      tone: 'info',
      icon: <LoaderCircle size={12} className="pm-spin" aria-hidden="true" />,
    };
  }

  if (status === 'failed') {
    if (isRetryableDocumentFailure(processingMetadata)) {
      return {
        label: 'Retry later',
        tone: 'warning',
        detail: errorCode || 'Retryable failure',
        title: errorMessage || errorCode || 'The parser is temporarily unavailable.',
        icon: <RefreshCcw size={12} aria-hidden="true" />,
      };
    }

    return {
      label: 'Failed',
      tone: 'error',
      detail: errorCode || undefined,
      title: errorMessage || errorCode || 'The document could not be parsed.',
      icon: <AlertTriangle size={12} aria-hidden="true" />,
    };
  }

  return {
    label: 'Queued',
    tone: 'neutral',
    icon: <Clock3 size={12} aria-hidden="true" />,
  };
};

const getSemanticIndexDescriptor = (
  processingStatus?: UploadedDocument['processing_status'] | string | null,
  semanticMetadata?: DocumentSemanticIndexingMetadata | null
): StatusDescriptor | null => {
  if (!semanticMetadata) {
    const normalizedStatus = String(processingStatus || '').trim().toLowerCase();
    if (normalizedStatus === 'pending' || normalizedStatus === 'processing') {
      return {
        label: 'Index pending',
        tone: 'neutral',
        icon: <Clock3 size={12} aria-hidden="true" />,
      };
    }
    return null;
  }

  const semanticStatus = String(semanticMetadata.status || '').trim().toLowerCase();
  const chunkCount =
    typeof semanticMetadata.chunk_count === 'number' ? `${semanticMetadata.chunk_count} chunks` : undefined;
  const detail = String(semanticMetadata.detail || '').trim() || chunkCount;

  if (semanticStatus === 'indexed') {
    return {
      label: 'Indexed',
      tone: 'success',
      detail,
      title: detail,
      icon: <CheckCircle2 size={12} aria-hidden="true" />,
    };
  }

  if (semanticStatus === 'degraded') {
    return {
      label: 'Lexical fallback',
      tone: 'warning',
      detail,
      title: detail,
      icon: <RefreshCcw size={12} aria-hidden="true" />,
    };
  }

  if (semanticStatus === 'skipped') {
    return {
      label: 'Index skipped',
      tone: 'neutral',
      detail,
      title: detail,
      icon: <Clock3 size={12} aria-hidden="true" />,
    };
  }

  return null;
};

export interface DocumentAuditBadgesProps {
  processingStatus?: UploadedDocument['processing_status'] | string | null;
  sourceMetadata?: DocumentSourceMetadata | null;
  processingMetadata?: DocumentProcessingMetadata | null;
  lineageSummary?: DocumentLineageSummary | null;
}

export const DocumentAuditBadges: React.FC<DocumentAuditBadgesProps> = ({
  processingStatus,
  sourceMetadata,
  processingMetadata,
  lineageSummary,
}) => {
  const sourceLabel = getDocumentSourceLabel(sourceMetadata);
  const status = getDocumentStatusDescriptor(processingStatus, processingMetadata);
  const semanticStatus = getSemanticIndexDescriptor(
    processingStatus,
    processingMetadata?.semantic_indexing
  );
  const lineageText =
    typeof lineageSummary?.latest_summary === 'string' && lineageSummary.latest_summary
      ? `Lineage: ${lineageSummary.latest_summary}${
          typeof lineageSummary.event_count === 'number' ? ` (${lineageSummary.event_count} events)` : ''
        }`
      : null;

  return (
    <BadgeStack>
      <BadgeRow>
        <Badge $tone="info" aria-label={`Document source: ${sourceLabel}`}>
          {sourceLabel}
        </Badge>
        <Badge
          $tone={status.tone}
          title={status.title}
          aria-label={`Document status: ${status.label}${status.detail ? ` (${status.detail})` : ''}`}
        >
          {status.icon}
          <span>{status.label}</span>
        </Badge>
        {semanticStatus ? (
          <Badge
            $tone={semanticStatus.tone}
            title={semanticStatus.title}
            aria-label={`Semantic index: ${semanticStatus.label}${
              semanticStatus.detail ? ` (${semanticStatus.detail})` : ''
            }`}
          >
            {semanticStatus.icon}
            <span>{semanticStatus.label}</span>
          </Badge>
        ) : null}
      </BadgeRow>
      {status.detail ? <DetailText>{status.detail}</DetailText> : null}
      {semanticStatus?.detail ? <DetailText>{semanticStatus.detail}</DetailText> : null}
      {lineageText ? <DetailText>{lineageText}</DetailText> : null}
    </BadgeStack>
  );
};

const BadgeStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const toneStyles: Record<BadgeTone, ReturnType<typeof css>> = {
  neutral: css`
    color: rgb(var(--color-text-secondary));
    border-color: rgb(var(--color-border));
    background: rgb(var(--color-surface-hover));
  `,
  info: css`
    color: rgb(var(--color-info));
    border-color: rgb(var(--color-info) / 0.25);
    background: rgb(var(--color-info) / 0.10);
  `,
  success: css`
    color: rgb(var(--color-success));
    border-color: rgb(var(--color-success) / 0.25);
    background: rgb(var(--color-success) / 0.10);
  `,
  warning: css`
    color: rgb(var(--color-warning));
    border-color: rgb(var(--color-warning) / 0.25);
    background: rgb(var(--color-warning) / 0.10);
  `,
  error: css`
    color: rgb(var(--color-error));
    border-color: rgb(var(--color-error) / 0.25);
    background: rgb(var(--color-error) / 0.10);
  `,
};

const Badge = styled.span<{ $tone: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgb(var(--color-border));
  font-size: 11px;
  font-weight: 700;
  line-height: 1;

  ${(props) => toneStyles[props.$tone]}

  .pm-spin {
    animation: pm-spin 1s linear infinite;
  }

  @keyframes pm-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const DetailText = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.3;
`;

export default DocumentAuditBadges;
