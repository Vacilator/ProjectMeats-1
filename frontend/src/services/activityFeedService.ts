import { businessApi } from './businessApi';

export type ActivitySource = 'audit' | 'ai' | 'workflow' | 'note';

export interface ActivityFeedItem {
  id: string;
  source: ActivitySource;
  source_label: string;
  action: string;
  title: string;
  description: string;
  actor_name: string;
  actor_email: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  source_record_id: string;
  occurred_at: string;
  editable: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedListParams {
  entityType?: string;
  entityId?: string | number;
  sources?: ActivitySource[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface ActivityFeedListResponse {
  results: ActivityFeedItem[];
  count: number;
}

export interface ActivityNotePayload {
  entityType: string;
  entityId: string | number;
  title?: string;
  content: string;
}

export interface ActivityNoteResponse {
  id: number;
  entity_type: string;
  entity_id: string | number;
  title: string;
  content: string;
  created_by: number | null;
  created_by_name?: string;
  is_pinned?: boolean;
  tags?: string | string[];
  created_on: string;
  modified_on: string;
}

const buildParams = (params: ActivityFeedListParams) => {
  const nextParams: Record<string, string | number> = {};

  if (params.entityType) {
    nextParams.entity_type = params.entityType;
  }
  if (params.entityId !== undefined && params.entityId !== null && String(params.entityId).trim()) {
    nextParams.entity_id = String(params.entityId).trim();
  }
  if (params.sources && params.sources.length > 0) {
    nextParams.sources = params.sources.join(',');
  }
  if (params.startDate) {
    nextParams.start_date = params.startDate;
  }
  if (params.endDate) {
    nextParams.end_date = params.endDate;
  }
  if (params.limit) {
    nextParams.limit = params.limit;
  }

  return nextParams;
};

export const activityFeedService = {
  async list(params: ActivityFeedListParams): Promise<ActivityFeedListResponse> {
    const response = await businessApi.get<ActivityFeedListResponse>('workspace/activity/recent/', {
      params: buildParams(params),
    });
    return response.data;
  },

  async createNote(payload: ActivityNotePayload): Promise<ActivityNoteResponse> {
    const response = await businessApi.post<ActivityNoteResponse>('activity-logs/', {
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      title: payload.title?.trim() || 'Note',
      content: payload.content.trim(),
    });
    return response.data;
  },

  async updateNote(noteId: string | number, payload: Pick<ActivityNotePayload, 'title' | 'content'>): Promise<ActivityNoteResponse> {
    const response = await businessApi.patch<ActivityNoteResponse>(`activity-logs/${noteId}/`, {
      title: payload.title?.trim() || 'Note',
      content: payload.content.trim(),
    });
    return response.data;
  },
};
