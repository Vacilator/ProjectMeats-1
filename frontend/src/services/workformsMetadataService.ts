import { apiClient } from '@/services/apiService';

export type WorkformsNodeCategory = 'trigger' | 'control' | 'action' | 'form' | 'terminal';

export interface WorkformsNodeDefinition {
  node_type: string;
  category: WorkformsNodeCategory;
  label: string;
  description?: string;
  action_type?: string | null;
  aliases?: string[];
}

export interface WorkformsMetadataResponse {
  version: string;
  nodes: Record<string, WorkformsNodeDefinition>;
  aliases: Record<string, string>;
}

export const workformsMetadataService = {
  async getMetadata(version: string = 'v1'): Promise<WorkformsMetadataResponse> {
    const resp = await apiClient.get<WorkformsMetadataResponse>('/system/workforms/metadata/', {
      params: { version },
    });
    return resp.data;
  },
};
