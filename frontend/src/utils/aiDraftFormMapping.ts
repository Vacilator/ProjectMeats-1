import type { PendingReviewItem } from '@/services/aiService';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const firstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString().slice(0, 10);
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const mapPurchaseOrderItems = (items: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce<Array<Record<string, unknown>>>((accumulator, item, index) => {
    const record = asRecord(item);
    const description = firstString(
      record.product_description,
      record.description,
      record.item_description,
    );
    const quantity = firstNumber(record.quantity);
    const totalNetWeight = firstNumber(
      record.total_net_weight,
      record.total_weight,
      record.weight,
    );
    const proteinType = firstString(record.protein_type, record.type_of_protein);
    const weightUnit = firstString(record.uom, record.weight_unit);

    if (!description && quantity == null && totalNetWeight == null) {
      return accumulator;
    }

    accumulator.push({
      line_number: index + 1,
      product_description: description,
      quantity,
      total_net_weight: totalNetWeight,
      protein_type: proteinType,
      uom: weightUnit,
      notes: firstString(record.notes),
    });
    return accumulator;
  }, []);
};

export const resolveDraftEntityType = (item: PendingReviewItem | null): string => {
  const explicit = firstString(item?.review_entity_type);
  if (explicit) {
    return explicit;
  }

  const documentType = String(item?.document_type || '').toLowerCase();
  if (['purchase_order', 'po'].includes(documentType)) {
    return 'purchase_order';
  }
  if (
    ['bill_of_lading', 'bol', 'shipment', 'carrier_purchase_order', 'carrier_po'].includes(
      documentType,
    )
  ) {
    return 'carrier-pos';
  }
  if (['inquiry', 'quote'].includes(documentType)) {
    return 'inquiry';
  }
  if (['sales_order', 'so', 'sales order'].includes(documentType)) {
    return 'sales_order';
  }
  if (['invoice'].includes(documentType)) {
    return 'invoice';
  }
  if (['new_customer', 'customer'].includes(documentType)) {
    return 'customer';
  }
  if (['contact', 'new_contact'].includes(documentType)) {
    return 'contact';
  }
  if (['supplier', 'new_supplier', 'vendor'].includes(documentType)) {
    return 'supplier';
  }
  if (['trade', 'deal', 'trade_intent', 'trade_session'].includes(documentType)) {
    return 'inquiry';
  }

  // Fallback: infer from payload keys
  const payload = asRecord(item?.original_extracted_data);
  if (payload.order_number || payload.po_number || payload.purchase_order_number) {
    return 'purchase_order';
  }
  if (payload.our_sales_order_num || payload.sales_order_number) {
    return 'sales_order';
  }
  if (payload.bol_number || payload.carrier_name || payload.pickup_date || payload.pick_up_date) {
    return 'carrier-pos';
  }
  if (payload.first_name && payload.last_name) {
    return 'contact';
  }
  if (payload.entity_type === 'customer' || payload.entity_type === 'supplier') {
    return 'inquiry';
  }

  return '';
};

export const mapDraftToInitialValues = (
  item: PendingReviewItem | null,
): Record<string, unknown> => {
  const payload = asRecord(item?.original_extracted_data);
  const entityType = resolveDraftEntityType(item);
  const items = mapPurchaseOrderItems(payload.items);
  const firstItem = items[0] ? asRecord(items[0]) : {};
  const summary = firstString(
    payload.notes,
    payload.summary,
    payload.email_body,
    payload.body,
    payload.text,
  );

  if (entityType === 'carrier-pos') {
    return {
      our_carrier_po_num: firstString(
        payload.our_carrier_po_num,
        payload.carrier_po_number,
        payload.bol_number,
      ),
      carrier_name: firstString(payload.carrier_name),
      pick_up_date: normalizeDate(payload.pick_up_date ?? payload.pickup_date),
      delivery_date: normalizeDate(payload.delivery_date),
      quantity: firstNumber(payload.quantity, firstItem.quantity),
      total_weight: firstNumber(payload.total_weight, firstItem.total_net_weight),
      weight_unit: firstString(payload.weight_unit, firstItem.uom, 'LBS'),
      type_of_protein: firstString(payload.type_of_protein, firstItem.protein_type),
      items,
      notes: summary,
    };
  }

  if (entityType === 'purchase_order') {
    return {
      order_number: firstString(
        payload.order_number,
        payload.po_number,
        payload.purchase_order_number,
      ),
      order_date: normalizeDate(payload.order_date) ?? todayIso(),
      delivery_date: normalizeDate(payload.delivery_date),
      quantity: firstNumber(payload.quantity, firstItem.quantity),
      total_weight: firstNumber(payload.total_weight, firstItem.total_net_weight),
      weight_unit: firstString(payload.weight_unit, firstItem.uom, 'LBS'),
      item_description: firstString(payload.item_description, firstItem.product_description),
      type_of_protein: firstString(payload.type_of_protein, firstItem.protein_type),
      supplier_contact_name: firstString(payload.vendor_name, payload.supplier_name),
      supplier_contact_email: firstString(payload.from_email, payload.sender_email),
      items,
      notes: summary,
    };
  }

  if (entityType === 'inquiry') {
    return {
      entity_type: firstString(
        payload.entity_type,
        payload.inquiry_entity_type,
        payload.customer_name || payload.customer_company ? 'customer' : undefined,
        payload.supplier_name || payload.vendor_name ? 'supplier' : undefined,
      ),
      contact_name: firstString(payload.contact_name, payload.sender_name, payload.sender),
      contact_email: firstString(payload.contact_email, payload.sender_email, payload.from_email),
      contact_company: firstString(
        payload.contact_company,
        payload.customer_name,
        payload.customer_company,
        payload.supplier_name,
        payload.vendor_name,
      ),
      requested_protein: firstString(
        payload.requested_protein,
        payload.protein_type,
        payload.type_of_protein,
      ),
      valid_until: normalizeDate(
        payload.valid_until ?? payload.due_date ?? payload.requested_by_date,
      ),
      notes: firstString(summary, payload.rationale),
    };
  }

  if (entityType === 'sales_order') {
    return {
      our_sales_order_num: firstString(
        payload.our_sales_order_num,
        payload.sales_order_number,
        payload.so_number,
      ),
      order_date: normalizeDate(payload.order_date) ?? todayIso(),
      delivery_date: normalizeDate(payload.delivery_date),
      customer_name: firstString(payload.customer_name, payload.customer_company),
      supplier_name: firstString(payload.supplier_name, payload.vendor_name),
      notes: summary,
    };
  }

  if (entityType === 'contact') {
    return {
      first_name: firstString(payload.first_name, payload.contact_first_name),
      last_name: firstString(payload.last_name, payload.contact_last_name),
      email: firstString(payload.email, payload.contact_email, payload.from_email),
      mobile_phone: firstString(payload.mobile_phone, payload.phone),
      company: firstString(payload.company, payload.company_name),
      notes: summary,
    };
  }

  if (entityType === 'customer') {
    return {
      name: firstString(payload.name, payload.customer_name, payload.company_name),
      notes: summary,
    };
  }

  if (entityType === 'supplier') {
    return {
      name: firstString(payload.name, payload.supplier_name, payload.vendor_name, payload.company_name),
      notes: summary,
    };
  }

  return payload;
};
