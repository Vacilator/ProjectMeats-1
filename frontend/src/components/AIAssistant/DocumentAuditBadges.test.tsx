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
});
