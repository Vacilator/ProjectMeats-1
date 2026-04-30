import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MessageList from './MessageList';

describe('MessageList document badges', () => {
  it('renders provenance and parsing status for document messages', () => {
    render(
      <MessageList
        messages={[
          {
            id: 'doc-message-1',
            role: 'assistant',
            content: 'Uploaded invoice.pdf',
            message_type: 'document',
            created_on: '2026-01-01T00:00:00Z',
            metadata: {
              original_filename: 'invoice.pdf',
              content_type: 'application/pdf',
              processing_status: 'failed',
              source_metadata: {
                source: 'microsoft_graph_attachment',
                message_id: 'msg-1',
              },
              processing_metadata: {
                parse_error_code: 'UNSTRUCTURED_UNREACHABLE',
              },
            },
          },
        ]}
      />
    );

    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Document source: Outlook attachment')).toBeInTheDocument();
    expect(screen.getByLabelText('Document status: Retry later (UNSTRUCTURED_UNREACHABLE)')).toBeInTheDocument();
  });
});
