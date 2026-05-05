import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DocumentAuditBadges,
  getDocumentSourceLabel,
  getDocumentStatusDescriptor,
  isRetryableDocumentFailure,
} from './DocumentAuditBadges';

describe('DocumentAuditBadges', () => {
  it('renders Outlook provenance and retryable parser status', () => {
    render(
      <DocumentAuditBadges
        processingStatus="failed"
        sourceMetadata={{ source: 'microsoft_graph_attachment', message_id: 'msg-1' }}
        processingMetadata={{
          parse_error_code: 'UNSTRUCTURED_UNREACHABLE',
          parse_error_message: 'Parsing service unavailable',
        }}
      />
    );

    expect(screen.getByLabelText('Document source: Outlook attachment')).toBeInTheDocument();
    expect(screen.getByLabelText('Document status: Retry later (UNSTRUCTURED_UNREACHABLE)')).toBeInTheDocument();
    expect(screen.getByText('UNSTRUCTURED_UNREACHABLE')).toBeInTheDocument();
  });

  it('maps helper values consistently', () => {
    expect(getDocumentSourceLabel({ source: 'manual_upload' })).toBe('Manual upload');
    expect(isRetryableDocumentFailure({ parse_error_code: 'UNSTRUCTURED_AUTH_FAILED' })).toBe(true);
    expect(
      getDocumentStatusDescriptor('completed', { parse_error_code: 'IGNORED' }).label
    ).toBe('Ready');
  });

  it('renders semantic indexing and lineage summary details', () => {
    render(
      <DocumentAuditBadges
        processingStatus="completed"
        sourceMetadata={{ source: 'manual_upload' }}
        processingMetadata={{
          parser: 'tabular_markdown',
          semantic_indexing: {
            status: 'degraded',
            mode: 'lexical_fallback',
            chunk_count: 4,
            detail: 'Embeddings unavailable; lexical fallback retained.',
          },
        }}
        lineageSummary={{
          event_count: 3,
          latest_event_type: 'document_parsed',
          latest_summary: 'Document parsed successfully.',
          recent_events: [],
        }}
      />
    );

    expect(
      screen.getByLabelText(
        'Semantic index: Lexical fallback (Embeddings unavailable; lexical fallback retained.)'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Lineage: Document parsed successfully. (3 events)')).toBeInTheDocument();
  });
});
