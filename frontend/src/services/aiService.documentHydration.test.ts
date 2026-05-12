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

import {
  hydrateDocumentMessageMetadata,
  hydratePendingReviewItemsWithDocumentMetadata,
} from './aiService';

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

describe('hydratePendingReviewItemsWithDocumentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates pending review items with document audit metadata', async () => {
    businessApiMock.get.mockResolvedValueOnce({
      data: {
        id: 'doc-9',
        original_filename: 'po-1001.pdf',
        file_size: 1024,
        file_type: 'application/pdf',
        content_type: 'application/pdf',
        file_url: '/media/doc-9',
        document_type: 'purchase_order',
        processing_status: 'failed',
        source_metadata: { source: 'microsoft_graph_attachment', message_id: 'msg-9' },
        processing_metadata: {
          parse_error_code: 'UNSTRUCTURED_UNREACHABLE',
          parse_error_message: 'Parser unavailable',
        },
        lineage_summary: {
          event_count: 1,
          latest_event_type: 'document_failed',
          latest_summary: 'Awaiting parser retry.',
          recent_events: [],
        },
        created_on: '2026-01-01T00:00:00Z',
      },
    });

    const reviews = await hydratePendingReviewItemsWithDocumentMetadata([
      {
        id: 'review-1',
        document_id: 'doc-9',
        document_type: 'purchase_order',
        confidence_score: 0.88,
        precision_delta: 0,
        created_on: '2026-01-01T00:00:00Z',
        original_extracted_data: {},
      },
    ]);

    expect(businessApiMock.get).toHaveBeenCalledWith('/ai-assistant/ai-documents/doc-9/');
    expect(reviews[0]).toMatchObject({
      document_id: 'doc-9',
      source_document_name: 'po-1001.pdf',
      processing_status: 'failed',
      source_metadata: { source: 'microsoft_graph_attachment', message_id: 'msg-9' },
      processing_metadata: {
        parse_error_code: 'UNSTRUCTURED_UNREACHABLE',
        parse_error_message: 'Parser unavailable',
      },
      lineage_summary: {
        event_count: 1,
        latest_event_type: 'document_failed',
        latest_summary: 'Awaiting parser retry.',
        recent_events: [],
      },
    });
  });

  it('preserves review-provided audit metadata over fetched document defaults', async () => {
    businessApiMock.get.mockResolvedValueOnce({
      data: {
        id: 'doc-10',
        original_filename: 'server.pdf',
        file_size: 2048,
        file_type: 'application/pdf',
        document_type: 'purchase_order',
        processing_status: 'completed',
        source_metadata: { source: 'manual_upload' },
        processing_metadata: { parser: 'unstructured' },
        lineage_summary: {
          event_count: 4,
          latest_event_type: 'document_parsed',
          latest_summary: 'Server summary',
          recent_events: [],
        },
        created_on: '2026-01-01T00:00:00Z',
      },
    });

    const reviews = await hydratePendingReviewItemsWithDocumentMetadata([
      {
        id: 'review-2',
        document_id: 'doc-10',
        document_type: 'purchase_order',
        confidence_score: 0.91,
        precision_delta: 0,
        created_on: '2026-01-01T00:00:00Z',
        original_extracted_data: {},
        source_document_name: 'client.pdf',
        processing_status: 'failed',
        source_metadata: { source: 'microsoft_graph_attachment' },
        processing_metadata: { parse_error_code: 'UNSTRUCTURED_UNREACHABLE' },
        lineage_summary: {
          event_count: 2,
          latest_event_type: 'document_failed',
          latest_summary: 'Client summary',
          recent_events: [],
        },
      },
    ]);

    expect(reviews[0]).toMatchObject({
      source_document_name: 'client.pdf',
      processing_status: 'failed',
      source_metadata: { source: 'microsoft_graph_attachment' },
      processing_metadata: { parse_error_code: 'UNSTRUCTURED_UNREACHABLE' },
      lineage_summary: {
        event_count: 2,
        latest_event_type: 'document_failed',
        latest_summary: 'Client summary',
        recent_events: [],
      },
    });
  });
});
