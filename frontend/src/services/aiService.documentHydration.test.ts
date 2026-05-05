import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./businessApi', () => ({
  businessApi: businessApiMock,
}));

import { hydrateDocumentMessageMetadata } from './aiService';

describe('hydrateDocumentMessageMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates document messages with processing and provenance metadata', async () => {
    businessApiMock.get.mockResolvedValueOnce({
      data: {
        id: 'doc-1',
        original_filename: 'invoice.pdf',
        file_size: 1024,
        file_type: 'application/pdf',
        content_type: 'application/pdf',
        file_url: '/media/doc-1',
        document_type: 'invoice',
        processing_status: 'completed',
        source_metadata: { source: 'manual_upload' },
        processing_metadata: { parser: 'unstructured' },
        lineage_summary: {
          event_count: 2,
          latest_event_type: 'document_parsed',
          latest_summary: 'Document parsed successfully.',
          recent_events: [],
        },
        created_on: '2026-01-01T00:00:00Z',
      },
    });

    const messages = await hydrateDocumentMessageMetadata([
      {
        id: 'm1',
        metadata: { document_id: 'doc-1' },
      },
    ]);

    expect(businessApiMock.get).toHaveBeenCalledWith('/ai-assistant/ai-documents/doc-1/');
    expect(messages[0].metadata).toMatchObject({
      document_id: 'doc-1',
      original_filename: 'invoice.pdf',
      file_url: '/media/doc-1',
      processing_status: 'completed',
      source_metadata: { source: 'manual_upload' },
      processing_metadata: { parser: 'unstructured' },
      lineage_summary: {
        event_count: 2,
        latest_event_type: 'document_parsed',
        latest_summary: 'Document parsed successfully.',
        recent_events: [],
      },
    });
  });

  it('dedupes repeated document ids and preserves existing metadata on fetch failure', async () => {
    businessApiMock.get
      .mockResolvedValueOnce({
        data: {
          id: 'doc-2',
          original_filename: 'quote.xlsx',
          file_size: 2048,
          file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          document_type: 'spreadsheet',
          processing_status: 'processing',
          created_on: '2026-01-01T00:00:00Z',
        },
      })
      .mockRejectedValueOnce(new Error('missing'));

    const messages = await hydrateDocumentMessageMetadata([
      {
        id: 'm1',
        metadata: { document_id: 'doc-2' },
      },
      {
        id: 'm2',
        metadata: { document_id: 'doc-2', original_filename: 'keep.xlsx' },
      },
      {
        id: 'm3',
        metadata: { document_id: 'doc-3', original_filename: 'already-there.pdf' },
      },
    ]);

    expect(businessApiMock.get).toHaveBeenCalledTimes(2);
    expect(messages[0].metadata).toMatchObject({
      document_id: 'doc-2',
      original_filename: 'quote.xlsx',
      processing_status: 'processing',
    });
    expect(messages[1].metadata).toMatchObject({
      document_id: 'doc-2',
      original_filename: 'keep.xlsx',
      processing_status: 'processing',
    });
    expect(messages[2].metadata).toMatchObject({
      document_id: 'doc-3',
      original_filename: 'already-there.pdf',
    });
  });
});
