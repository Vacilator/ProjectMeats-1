import { apiClient } from './apiService';
import type { Inquiry, InquiryListItem, InquiryProduct, InquiryProductSupplierBid, InquiryStatus, InquiryTemplateListItem } from '../types';

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

  // ── Supplier Bid Management ──

  async listProductBids(inquiryProductId: string): Promise<InquiryProductSupplierBid[]> {
    const response = await apiClient.get('inquiry-product-bids/', {
      params: { inquiry_product: inquiryProductId },
    });
    return (response.data.results || response.data) as InquiryProductSupplierBid[];
  },

  async createBid(data: Partial<InquiryProductSupplierBid>): Promise<InquiryProductSupplierBid> {
    const response = await apiClient.post('inquiry-product-bids/', data);
    return response.data as InquiryProductSupplierBid;
  },

  async updateBid(bidId: string, data: Partial<InquiryProductSupplierBid>): Promise<InquiryProductSupplierBid> {
    const response = await apiClient.patch(`inquiry-product-bids/${bidId}/`, data);
    return response.data as InquiryProductSupplierBid;
  },

  async deleteBid(bidId: string): Promise<void> {
    await apiClient.delete(`inquiry-product-bids/${bidId}/`);
  },

  async requestBid(bidId: string): Promise<InquiryProductSupplierBid> {
    const response = await apiClient.post(`inquiry-product-bids/${bidId}/request-bid/`);
    return response.data as InquiryProductSupplierBid;
  },

  async requestAllBids(inquiryProductId: string): Promise<{ updated: number; message: string }> {
    const response = await apiClient.post('inquiry-product-bids/request-all-bids/', {
      inquiry_product_id: inquiryProductId,
    });
    return response.data as { updated: number; message: string };
  },

  async acceptBid(bidId: string): Promise<InquiryProductSupplierBid> {
    const response = await apiClient.post(`inquiry-product-bids/${bidId}/accept/`);
    return response.data as InquiryProductSupplierBid;
  },

  async updateInquiryProduct(productId: string, data: Partial<InquiryProduct>): Promise<InquiryProduct> {
    const response = await apiClient.patch(`inquiry-products/${productId}/`, data);
    return response.data as InquiryProduct;
  },
};
