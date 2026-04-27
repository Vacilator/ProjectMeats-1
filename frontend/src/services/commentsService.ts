import { apiClient } from './apiService';

export interface CommentUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  display_name: string;
}

export interface CommentRecord {
  id: number;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  body: string;
  created_by: CommentUser | null;
  created_by_name: string;
  mentioned_users: CommentUser[];
  created_on: string;
  modified_on: string;
}

export interface MentionSuggestion {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
}

type PaginatedResponse<T> = {
  results?: T[];
};

const normalizeList = <T,>(payload: T[] | PaginatedResponse<T> | null | undefined): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
};

export class CommentsService {
  async listComments(entityType: string, entityId: string | number): Promise<CommentRecord[]> {
    const response = await apiClient.get<CommentRecord[] | PaginatedResponse<CommentRecord>>('/comments/', {
      params: {
        entity_type: entityType,
        entity_id: String(entityId),
      },
    });

    return normalizeList(response.data);
  }

  async createComment(input: {
    entityType: string;
    entityId: string | number;
    body: string;
    mentionedUserIds?: number[];
  }): Promise<CommentRecord> {
    const response = await apiClient.post<CommentRecord>('/comments/', {
      entity_type: input.entityType,
      entity_id: String(input.entityId),
      body: input.body,
      mentioned_user_ids: input.mentionedUserIds ?? [],
    });

    return response.data;
  }

  async searchMentionSuggestions(query: string): Promise<MentionSuggestion[]> {
    const response = await apiClient.get('/tenant-users/', {
      params: {
        search: query,
        is_active: true,
        page_size: 8,
      },
    });

    const rows = normalizeList<any>(response.data);
    return rows
      .map((row) => {
        const firstName = String(row?.first_name ?? '').trim();
        const lastName = String(row?.last_name ?? '').trim();
        const username = String(row?.username ?? '').trim();
        const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || username;

        return {
          id: Number(row?.user ?? row?.id),
          username,
          firstName,
          lastName,
          email: String(row?.email ?? '').trim(),
          displayName,
        } satisfies MentionSuggestion;
      })
      .filter((row) => Number.isFinite(row.id) && row.username);
  }
}

export const commentsService = new CommentsService();
