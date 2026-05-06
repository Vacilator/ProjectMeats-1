import { apiClient } from './apiService';
import type { Inquiry, InquiryListItem, InquiryStatus, InquiryTemplateListItem } from '../types';

interface InquiryListResponse {
  items: InquiryListItem[];
  count: number;
}

export const inquiryService = {
  async listInquiries(params: Record<string, unknown>): Promise<InquiryListResponse> {
    const response = await apiClient.get('inquiries/', { params });
    const data = response.data;
    const items: InquiryListItem[] = data.results || data;
    const count: number = data.count || (Array.isArray(items) ? items.length : 0);
    return { items, count };
  },

  async listInquiryTemplates(): Promise<InquiryTemplateListItem[]> {
    const response = await apiClient.get('inquiry-templates/', { params: { is_active: true } });
    return response.data.results || response.data;
  },

  async getInquiryDetail(inquiryId: string): Promise<Inquiry> {
    const response = await apiClient.get(`inquiries/${inquiryId}/`);
    return response.data as Inquiry;
  },

  async createInquiryFromTemplate(templateId: string): Promise<Inquiry> {
    const response = await apiClient.post(`inquiries/from-template/${templateId}/`, {});
    return response.data as Inquiry;
  },

  async updateInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<Inquiry> {
    const response = await apiClient.post(`inquiries/${inquiryId}/update-status/`, { status });
    return response.data as Inquiry;
  },
};
