/**
 * AI Assistant API (thin wrapper around businessApi)
 *
 * IMPORTANT:
 * - Do NOT create a separate axios/fetch client here.
 * - Use the shared apiService/businessApi so auth refresh + tenant headers are consistent.
 */

import { businessApi } from './businessApi';
import type { ChatMessage, ChatSession, UploadedDocument } from '../types';

export interface ChatRequest {
  message: string;
  session_id?: string;
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  message_id: string;
  processing_time: number;
  metadata?: Record<string, unknown>;
}

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

export type DocumentUploadResponse = UploadedDocument;

const unwrap = <T,>(res: { data: T }): T => res.data;

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
      formData.append('session_id', sessionId);
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
