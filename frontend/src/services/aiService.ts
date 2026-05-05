/**
 * AI Assistant API (thin wrapper around businessApi)
 *
 * IMPORTANT:
 * - Do NOT create a separate axios/fetch client here.
 * - Use the shared apiService/businessApi so auth refresh + tenant headers are consistent.
 */

import { businessApi } from './businessApi';
import type { ChatMessage, ChatSession, UploadedDocument } from '../types';
import type {
  ContractAiChatRequest,
  ContractAiChatResponse,
  ContractPendingReviewItem,
  ContractPendingReviewListResponse,
  ContractPendingReviewResolveRequest,
  ContractPendingReviewResolveResponse,
  ContractSwarmInvokeRequest,
  ContractSwarmInvokeResponse,
} from '../../../shared/types/openapi';

export type ChatRequest = ContractAiChatRequest;
export type ChatResponse = ContractAiChatResponse;
export type PendingReviewItem = ContractPendingReviewItem & {
  sender?: string;
  source_subject?: string;
  source_summary?: string;
  source_document_name?: string;
  intent_label?: string;
  review_entity_type?: string;
  review_target_url?: string;
};
export type PendingReviewListResponse = ContractPendingReviewListResponse;
export type PendingReviewResolveRequest = ContractPendingReviewResolveRequest;
export type PendingReviewResolveResponse = ContractPendingReviewResolveResponse;
export type SwarmInvokeRequest = ContractSwarmInvokeRequest;
export type SwarmInvokeResponse = ContractSwarmInvokeResponse;

export interface DocumentProcessingRequest {
  document_id: string;
  session_id?: string;
  processing_options?: Record<string, unknown>;
}

export interface DocumentProcessingResponse {
  task_id: string;
  document_id: string;
  status: string;
  message: string;
}

export interface ContextualSuggestionRequest {
  entity_type: string;
  entity_id: string;
  current_state?: Record<string, unknown>;
}

export interface ContextualSuggestion {
  action: string;
  label: string;
  confidence: number;
  reason?: string;
  prompt?: string;
  target_url?: string;
}

export interface ContextualSuggestionsResponse {
  suggestions: ContextualSuggestion[];
}

export type DocumentUploadResponse = UploadedDocument;

export interface ExtractToSchemaRequest {
  document_id: string;
  entity_type: string;
}

export interface ExtractToSchemaResponse {
  document_id: string;
  entity_type: string;
  serializer_name: string;
  parser: string;
  model_name: string;
  warnings: string[];
  extracted_data: Record<string, unknown>;
}

const unwrap = <T,>(res: { data: T }): T => res.data;
const getDocumentIdFromMetadata = (metadata?: Record<string, unknown>): string | null => {
  const id = metadata?.document_id ?? metadata?.documentId;
  return typeof id === 'string' && id.trim() ? id : null;
};

export const extractPendingReviewItems = (
  response: PendingReviewListResponse,
): PendingReviewItem[] => {
  if (Array.isArray(response.pending_reviews) && response.pending_reviews.length) {
    return response.pending_reviews;
  }

  return Array.isArray(response.results) ? response.results : [];
};

// Chat API
export const chatApi = {
  /**
   * Send a message and get AI response.
   *
   * Use the clean endpoint wrapper so server-side routing remains stable.
   */
  sendMessage: async (data: ChatRequest): Promise<ChatResponse> => {
    const res = await businessApi.post<ChatResponse>('/ai-assistant/chat/', data);
    return unwrap(res);
  },

  /**
   * Process a document with AI (compat endpoint).
   */
  processDocument: async (data: DocumentProcessingRequest): Promise<DocumentProcessingResponse> => {
    const res = await businessApi.post<DocumentProcessingResponse>('/ai-assistant/ai-chat/process_document/', data);
    return unwrap(res);
  },
};

export const aiStaffApi = {
  previewRoute: async (data: SwarmInvokeRequest): Promise<SwarmInvokeResponse> => {
    const res = await businessApi.post<SwarmInvokeResponse>('/ai-assistant/swarm/invoke/', data);
    return unwrap(res);
  },

  listPendingReviews: async (): Promise<PendingReviewItem[]> => {
    const res = await businessApi.get<PendingReviewListResponse>('/ai-assistant/review/pending/');
    return extractPendingReviewItems(unwrap(res));
  },

  resolvePendingReview: async (
    feedbackId: string,
    data: PendingReviewResolveRequest,
  ): Promise<PendingReviewResolveResponse> => {
    const res = await businessApi.post<PendingReviewResolveResponse>(
      `/ai-assistant/review/${feedbackId}/resolve/`,
      data,
    );
    return unwrap(res);
  },
};

export const ambientAiApi = {
  getContextualSuggestions: async (
    data: ContextualSuggestionRequest,
  ): Promise<ContextualSuggestion[]> => {
    const res = await businessApi.post<ContextualSuggestionsResponse>(
      '/ai-assistant/suggestions/contextual/',
      data,
    );
    return unwrap(res).suggestions || [];
  },
};

// Chat Sessions API
export const chatSessionsApi = {
  list: async (): Promise<ChatSession[]> => {
    const res = await businessApi.get<ChatSession[]>('/ai-assistant/ai-sessions/');
    return unwrap(res);
  },

  get: async (sessionId: string): Promise<ChatSession> => {
    const res = await businessApi.get<ChatSession>(`/ai-assistant/ai-sessions/${sessionId}/`);
    return unwrap(res);
  },

  create: async (data: Partial<ChatSession>): Promise<ChatSession> => {
    const res = await businessApi.post<ChatSession>('/ai-assistant/ai-sessions/', data);
    return unwrap(res);
  },

  update: async (sessionId: string, data: Partial<ChatSession>): Promise<ChatSession> => {
    const res = await businessApi.patch<ChatSession>(`/ai-assistant/ai-sessions/${sessionId}/`, data);
    return unwrap(res);
  },

  delete: async (sessionId: string): Promise<void> => {
    await businessApi.delete(`/ai-assistant/ai-sessions/${sessionId}/`);
  },

  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const res = await businessApi.get<ChatMessage[]>(`/ai-assistant/ai-sessions/${sessionId}/messages/`);
    return unwrap(res);
  },
};

// Documents API
export const documentsApi = {
  upload: async (file: File, sessionId?: string): Promise<DocumentUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('session', sessionId);
    }

    const res = await businessApi.post<DocumentUploadResponse>('/ai-assistant/ai-documents/', formData);
    return unwrap(res);
  },

  list: async (): Promise<DocumentUploadResponse[]> => {
    const res = await businessApi.get<DocumentUploadResponse[]>('/ai-assistant/ai-documents/');
    return unwrap(res);
  },

  get: async (documentId: string): Promise<DocumentUploadResponse> => {
    const res = await businessApi.get<DocumentUploadResponse>(`/ai-assistant/ai-documents/${documentId}/`);
    return unwrap(res);
  },
};

export const schemaExtractionApi = {
  extractToSchema: async (data: ExtractToSchemaRequest): Promise<ExtractToSchemaResponse> => {
    const res = await businessApi.post<ExtractToSchemaResponse>('/ai-assistant/extract-to-schema/', data);
    return unwrap(res);
  },
};

export const hydrateDocumentMessageMetadata = async <
  T extends { metadata?: Record<string, unknown> }
>(
  messages: T[]
): Promise<T[]> => {
  const documentIds = [...new Set(messages.map((message) => getDocumentIdFromMetadata(message.metadata)).filter(Boolean))] as string[];
  if (!documentIds.length) {
    return messages;
  }

  const documents = await Promise.all(
    documentIds.map(async (documentId) => {
      try {
        const document = await documentsApi.get(documentId);
        return [documentId, document] as const;
      } catch {
        return null;
      }
    })
  );

  const documentsById = new Map(
    documents.filter((entry): entry is readonly [string, DocumentUploadResponse] => Boolean(entry))
  );

  return messages.map((message) => {
    const documentId = getDocumentIdFromMetadata(message.metadata);
    if (!documentId) {
      return message;
    }

    const document = documentsById.get(documentId);
    if (!document) {
      return message;
    }

    const currentMetadata = message.metadata || {};

    return {
      ...message,
      metadata: {
        ...currentMetadata,
        document_id: documentId,
        original_filename:
          typeof currentMetadata.original_filename === 'string' && currentMetadata.original_filename
            ? currentMetadata.original_filename
            : document.original_filename,
        content_type:
          typeof currentMetadata.content_type === 'string' && currentMetadata.content_type
            ? currentMetadata.content_type
            : document.content_type || document.file_type,
        file_url:
          typeof currentMetadata.file_url === 'string' && currentMetadata.file_url
            ? currentMetadata.file_url
            : document.file_url || document.file || '',
        // Intentionally show the latest parser state so operators can see async progress resolve
        // without waiting for the original chat message payload to be regenerated.
        processing_status: document.processing_status,
        // Preserve existing provenance details only when the hydrated document payload omits them.
        source_metadata: document.source_metadata ?? currentMetadata.source_metadata,
        processing_metadata: document.processing_metadata ?? currentMetadata.processing_metadata,
      },
    };
  });
};
