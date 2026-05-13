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

const firstBoolean = (...values: unknown[]): boolean | undefined => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['yes', 'true', 'y'].includes(normalized)) return true;
      if (['no', 'false', 'n'].includes(normalized)) return false;
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
    ['bill_of_lading', 'bol', 'shipment', 'carrier_purchase_order', 'carrier_po', 'carrier-pos'].includes(
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
  if (['contact', 'new_contact', 'contact_update'].includes(documentType)) {
    return 'contact';
  }
  if (['supplier', 'new_supplier', 'vendor', 'supplier_note'].includes(documentType)) {
    return 'supplier';
  }
  if (['company', 'new_company', 'organization'].includes(documentType)) {
    return 'customer';
  }
  if (['plant', 'new_plant', 'facility', 'warehouse', 'processing_plant'].includes(documentType)) {
    return 'plant';
  }
  if (['department', 'new_department', 'division'].includes(documentType)) {
    return 'department';
  }
  if (['carrier', 'new_carrier', 'logistics', 'freight'].includes(documentType)) {
    return 'carrier';
  }
  if (['product', 'new_product', 'item_master', 'master_product'].includes(documentType)) {
    return 'product';
  }
  if (['trade', 'deal', 'trade_intent', 'trade_session'].includes(documentType)) {
    return 'inquiry';
  }
  if (['pricing_sheet', 'price_list'].includes(documentType)) {
    return 'inquiry';
  }
  if (['payment', 'payment_notice', 'remittance'].includes(documentType)) {
    return 'invoice';
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
  if (payload.total_amount || payload.payment_amount || payload.invoice_number) {
    return 'invoice';
  }
  if (payload.entity_type === 'customer' || payload.entity_type === 'supplier') {
    return 'inquiry';
  }

  // Last resort: if contact_name or contact_company exist in the item metadata,
  // treat as a contact draft rather than showing "unsupported"
  const contactName = firstString((item as Record<string, unknown>)?.contact_name);
  const contactCompany = firstString((item as Record<string, unknown>)?.contact_company);
  if (contactName || contactCompany) {
    return 'contact';
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
      status: 'draft',
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
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight, firstItem.total_net_weight),
      weight_unit: firstString(payload.weight_unit, firstItem.uom, 'LBS'),
      type_of_protein: firstString(payload.type_of_protein, firstItem.protein_type),
      description_of_product_item: firstString(payload.description_of_product_item, firstItem.product_description),
      fresh_or_frozen: firstString(payload.fresh_or_frozen),
      package_type: firstString(payload.package_type),
      net_or_catch: firstString(payload.net_or_catch),
      edible_or_inedible: firstString(payload.edible_or_inedible),
      tested_product: firstBoolean(payload.tested_product),
      delivery_po_number: firstString(payload.delivery_po_number, payload.delivery_po_num),
      supplier_confirmation_order_number: firstString(payload.supplier_confirmation_order_number),
      our_purchase_order_number_to_supplier: firstString(payload.our_purchase_order_number_to_supplier),
      shipping_contact_name: firstString(payload.shipping_contact_name),
      shipping_contact_phone: firstString(payload.shipping_contact_phone),
      shipping_contact_email: firstString(payload.shipping_contact_email),
      receiving_contact_name: firstString(payload.receiving_contact_name),
      receiving_contact_phone: firstString(payload.receiving_contact_phone),
      receiving_contact_email: firstString(payload.receiving_contact_email),
      items,
      notes: summary,
    };
  }

  if (entityType === 'purchase_order') {
    return {
      status: 'draft',
      order_number: firstString(
        payload.order_number,
        payload.po_number,
        payload.purchase_order_number,
      ),
      order_date: normalizeDate(payload.order_date) ?? todayIso(),
      delivery_date: normalizeDate(payload.delivery_date),
      quantity: firstNumber(payload.quantity, firstItem.quantity),
      total_weight: firstNumber(payload.total_weight, firstItem.total_net_weight),
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight, firstItem.total_net_weight),
      weight_unit: firstString(payload.weight_unit, firstItem.uom, 'LBS'),
      item_description: firstString(payload.item_description, firstItem.product_description),
      type_of_protein: firstString(payload.type_of_protein, firstItem.protein_type),
      description_of_product_item: firstString(payload.description_of_product_item, firstItem.product_description),
      fresh_or_frozen: firstString(payload.fresh_or_frozen),
      package_type: firstString(payload.package_type),
      net_or_catch: firstString(payload.net_or_catch),
      edible_or_inedible: firstString(payload.edible_or_inedible),
      tested_product: firstBoolean(payload.tested_product),
      logistics_scenario: firstString(payload.logistics_scenario),
      delivery_po_number: firstString(payload.delivery_po_number, payload.delivery_po_num),
      supplier_confirmation_order_number: firstString(payload.supplier_confirmation_order_number),
      our_purchase_order_number_to_supplier: firstString(payload.our_purchase_order_number_to_supplier),
      supplier_contact_name: firstString(payload.vendor_name, payload.supplier_name),
      supplier_contact_email: firstString(payload.from_email, payload.sender_email),
      items,
      notes: summary,
    };
  }

  if (entityType === 'inquiry') {
    return {
      status: 'draft',
      entity_type: firstString(
        payload.entity_type,
        payload.inquiry_entity_type,
        payload.customer_name || payload.customer_company ? 'customer' : undefined,
        payload.supplier_name || payload.vendor_name ? 'supplier' : undefined,
        'customer',
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
      status: 'draft',
      our_sales_order_num: firstString(
        payload.our_sales_order_num,
        payload.sales_order_number,
        payload.so_number,
      ),
      order_date: normalizeDate(payload.order_date) ?? todayIso(),
      delivery_date: normalizeDate(payload.delivery_date),
      logistics_scenario: firstString(payload.logistics_scenario),
      delivery_po_number: firstString(payload.delivery_po_number, payload.delivery_po_num),
      type_of_protein: firstString(payload.type_of_protein, payload.protein_type),
      description_of_product_item: firstString(payload.description_of_product_item, payload.description),
      fresh_or_frozen: firstString(payload.fresh_or_frozen),
      package_type: firstString(payload.package_type),
      quantity: firstNumber(payload.quantity),
      uom: firstString(payload.uom, payload.weight_unit, 'LBS'),
      net_or_catch: firstString(payload.net_or_catch),
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight),
      edible_or_inedible: firstString(payload.edible_or_inedible),
      tested_product: firstBoolean(payload.tested_product),
      customer_name: firstString(payload.customer_name, payload.customer_company),
      supplier_name: firstString(payload.supplier_name, payload.vendor_name),
      notes: summary,
    };
  }

  if (entityType === 'contact') {
    return {
      status: 'draft',
      first_name: firstString(payload.first_name, payload.contact_first_name) || 'Unknown',
      last_name: firstString(payload.last_name, payload.contact_last_name) || 'Contact',
      email: firstString(payload.email, payload.contact_email, payload.from_email),
      mobile_phone: firstString(payload.mobile_phone, payload.phone),
      company: firstString(payload.company, payload.company_name, payload.contact_company),
      notes: summary,
    };
  }

  if (entityType === 'customer') {
    return {
      status: 'draft',
      name: firstString(payload.name, payload.customer_name, payload.company_name) || 'New Customer',
      accounting_payable_contact_name: firstString(payload.accounting_payable_contact_name),
      accounting_payable_contact_phone: firstString(payload.accounting_payable_contact_phone),
      accounting_payable_contact_email: firstString(payload.accounting_payable_contact_email),
      buyer_contact_name: firstString(payload.buyer_contact_name, payload.contact_name),
      buyer_contact_email: firstString(payload.buyer_contact_email, payload.email),
      buyer_contact_main_phone: firstString(payload.buyer_contact_main_phone, payload.phone),
      address: firstString(payload.address),
      city: firstString(payload.city),
      state: firstString(payload.state),
      zip_code: firstString(payload.zip_code, payload.postal_code),
      delivery_po_number: firstString(payload.delivery_po_number, payload.delivery_po_num),
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight),
      uom: firstString(payload.uom, payload.weight_unit, 'LBS'),
      notes: summary,
    };
  }

  if (entityType === 'supplier') {
    return {
      status: 'draft',
      name: firstString(payload.name, payload.supplier_name, payload.vendor_name, payload.company_name) || 'New Supplier',
      accounting_payable_contact_name: firstString(payload.accounting_payable_contact_name),
      accounting_payable_contact_phone: firstString(payload.accounting_payable_contact_phone),
      accounting_payable_contact_email: firstString(payload.accounting_payable_contact_email),
      sales_contact_name: firstString(payload.sales_contact_name, payload.contact_name),
      sales_contact_email: firstString(payload.sales_contact_email, payload.email),
      sales_contact_main_phone: firstString(payload.sales_contact_main_phone, payload.phone),
      address: firstString(payload.address),
      city: firstString(payload.city),
      state: firstString(payload.state),
      zip_code: firstString(payload.zip_code, payload.postal_code),
      our_purchase_order_number_to_supplier: firstString(payload.our_purchase_order_number_to_supplier),
      my_customer_number_from_supplier: firstString(payload.my_customer_number_from_supplier),
      supplier_confirmation_order_number: firstString(payload.supplier_confirmation_order_number),
      carrier_release_number: firstString(payload.carrier_release_number),
      shipping_contact_name: firstString(payload.shipping_contact_name),
      shipping_contact_phone: firstString(payload.shipping_contact_phone),
      shipping_contact_email: firstString(payload.shipping_contact_email),
      bill_of_lading_comments: firstString(payload.bill_of_lading_comments),
      invoicing_comments: firstString(payload.invoicing_comments),
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight),
      item_production_date: firstString(payload.item_production_date),
      notes: summary,
    };
  }

  if (entityType === 'invoice') {
    return {
      status: 'draft',
      invoice_number: firstString(payload.invoice_number, payload.po_number),
      total_amount: firstString(payload.total_amount, payload.amount),
      delivery_po_number: firstString(payload.delivery_po_number, payload.delivery_po_num),
      our_sales_order_number_for_customer: firstString(payload.our_sales_order_number_for_customer, payload.our_sales_order_num),
      type_of_protein: firstString(payload.type_of_protein, payload.protein_type),
      description_of_product_item: firstString(payload.description_of_product_item, payload.description),
      fresh_or_frozen: firstString(payload.fresh_or_frozen),
      package_type: firstString(payload.package_type),
      quantity: firstNumber(payload.quantity),
      weight_unit: firstString(payload.weight_unit, payload.uom, 'LBS'),
      net_or_catch: firstString(payload.net_or_catch),
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight),
      edible_or_inedible: firstString(payload.edible_or_inedible),
      tested_product: firstBoolean(payload.tested_product),
      vendor_name: firstString(payload.vendor_name, payload.supplier_name, payload.contact_company),
      notes: summary,
    };
  }

  if (entityType === 'plant') {
    return {
      status: 'active',
      name: firstString(payload.name, payload.plant_name, payload.facility_name) || 'New Plant',
      address: firstString(payload.address, payload.location),
      city: firstString(payload.city),
      state: firstString(payload.state),
      country: firstString(payload.country),
      notes: summary,
    };
  }

  if (entityType === 'department') {
    return {
      name: firstString(payload.name, payload.department_name, payload.division_name) || 'New Department',
      notes: summary,
    };
  }

  if (entityType === 'carrier') {
    return {
      status: 'active',
      name: firstString(payload.name, payload.carrier_name, payload.company_name) || 'New Carrier',
      my_customer_num_from_carrier: firstString(payload.my_customer_num_from_carrier),
      accounting_payable_contact_name: firstString(payload.accounting_payable_contact_name),
      accounting_payable_contact_phone: firstString(payload.accounting_payable_contact_phone),
      accounting_payable_contact_email: firstString(payload.accounting_payable_contact_email),
      sales_contact_name: firstString(payload.sales_contact_name, payload.contact_name),
      sales_contact_email: firstString(payload.sales_contact_email, payload.contact_email, payload.email),
      sales_contact_main_phone: firstString(payload.sales_contact_main_phone, payload.contact_phone, payload.phone),
      address: firstString(payload.address),
      city: firstString(payload.city),
      state: firstString(payload.state),
      zip_code: firstString(payload.zip_code, payload.postal_code),
      our_purchase_order_number_to_supplier: firstString(payload.our_purchase_order_number_to_supplier),
      supplier_confirmation_order_number: firstString(payload.supplier_confirmation_order_number),
      delivery_po_number: firstString(payload.delivery_po_number, payload.delivery_po_num),
      carrier_release_number: firstString(payload.carrier_release_number),
      type_of_protein: firstString(payload.type_of_protein, payload.protein_type),
      description_of_product_item: firstString(payload.description_of_product_item, payload.description),
      fresh_or_frozen: firstString(payload.fresh_or_frozen),
      package_type: firstString(payload.package_type),
      quantity: firstNumber(payload.quantity),
      total_weight: firstNumber(payload.total_weight),
      total_net_weight: firstNumber(payload.total_net_weight, payload.total_weight),
      net_or_catch: firstString(payload.net_or_catch),
      edible_or_inedible: firstString(payload.edible_or_inedible),
      tested_product: firstBoolean(payload.tested_product),
      notes: summary,
    };
  }

  if (entityType === 'product') {
    return {
      name: firstString(payload.name, payload.description_of_product_item, payload.product_name) || 'New Product',
      protein_type: firstString(payload.protein_type, payload.type_of_protein),
      description: firstString(payload.description, payload.description_of_product_item),
      fresh_or_frozen: firstString(payload.fresh_or_frozen),
      package_type: firstString(payload.package_type),
      edible_or_inedible: firstString(payload.edible_or_inedible),
      tested_product: firstBoolean(payload.tested_product),
      uom: firstString(payload.uom, payload.weight_unit, 'LBS'),
    };
  }

  // Fallback: inject status default even for unknown entity types
  if (payload && typeof payload === 'object') {
    return { status: 'draft', ...payload };
  }
  return payload;
};

/**
 * Fields that should be hidden from user-facing forms.
 * These are auto-populated by the backend or AI and should not
 * require manual entry.
 */
export const HIDDEN_FORM_FIELDS = new Set([
  'status',
  'tenant',
  'tenant_id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
]);
