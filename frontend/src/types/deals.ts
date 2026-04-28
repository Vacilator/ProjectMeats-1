export type DealStatus =
  | 'draft'
  | 'active'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface DealDeskRow {
  id: string;
  deal_number: string;
  status: DealStatus;
  purchase_order: number;
  purchase_order_number: string;
  sales_order: number;
  sales_order_number: string;
  fulfillment: number | null;
  supplier_name: string;
  customer_name: string;
  carrier_name: string;
  pickup_date: string | null;
  delivery_date: string | null;
  gross_revenue: string;
  cogs: string;
  freight_cost: string;
  net_margin: string;
  next_action: string;
  next_follow_up_date: string | null;
  is_past_due: boolean;
  created_on: string;
  modified_on: string;
}
