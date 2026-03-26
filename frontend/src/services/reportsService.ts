import { apiClient } from './apiService';

export type ReportsDateRange = {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
};

export type ReportsSummaryResponse = {
  date_range: ReportsDateRange;
  summary: {
    purchase_orders: { count: number; total_amount: number; avg_amount: number };
    sales_orders: { count: number; total_amount: number; total_weight: number; avg_amount: number };
    inquiries: { total: number; won: number; lost: number; win_rate: number };
    calls: { total: number; completed: number; upcoming: number; overdue: number; completion_rate: number };
    workforms: { submissions_total: number; completed: number; in_progress: number; completion_rate: number };
    master_data: { suppliers: number; customers: number; contacts: number };
  };
};

export type PurchaseOrderTrendPoint = {
  date: string;
  orders: number;
  value: number;
  averageValue: number;
};

export type PurchaseOrderTrendsResponse = {
  date_range: ReportsDateRange;
  data: PurchaseOrderTrendPoint[];
};

export type SupplierPerformancePoint = {
  name: string;
  orders: number;
  revenue: number;
  rating: number;
};

export type TopSuppliersResponse = {
  date_range: ReportsDateRange;
  data: SupplierPerformancePoint[];
};

export const reportsService = {
  async getSummary(range: ReportsDateRange): Promise<ReportsSummaryResponse> {
    const resp = await apiClient.get('/reports/summary/', { params: range });
    return resp.data;
  },

  async getPurchaseOrderTrends(range: ReportsDateRange): Promise<PurchaseOrderTrendsResponse> {
    const resp = await apiClient.get('/reports/trends/purchase-orders/', { params: range });
    return resp.data;
  },

  async getTopSuppliers(range: ReportsDateRange, limit = 10): Promise<TopSuppliersResponse> {
    const resp = await apiClient.get('/reports/top/suppliers/', { params: { ...range, limit } });
    return resp.data;
  },

  downloadCsv(filename: string, rows: Array<Record<string, unknown>>): void {
    const headers = Array.from(
      rows.reduce((acc, r) => {
        Object.keys(r).forEach((k) => acc.add(k));
        return acc;
      }, new Set<string>())
    );

    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[\n\r,\"]/g.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
