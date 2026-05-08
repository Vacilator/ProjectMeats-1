"""
Auto-invoice generation service for ProjectMeats.

Generates draft invoices automatically when:
- A final customer PO is confirmed against a Sales Order
- A process run completes the full E2E flow

Uses Sales Order data (customer, amounts, products, contacts) to
pre-populate Invoice fields. Routes to Accounting department contacts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class InvoiceLineItem:
    """Represents a single line on the generated invoice."""

    description: str
    quantity: int = 1
    unit_price: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    weight: Decimal | None = None
    weight_unit: str = "LBS"

    def calculate_total(self) -> Decimal:
        self.total = self.unit_price * self.quantity
        return self.total


@dataclass
class InvoiceGenerationResult:
    """Result of invoice generation attempt."""

    success: bool
    invoice_number: str = ""
    invoice_data: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    routing_contact: dict[str, Any] = field(default_factory=dict)


@dataclass
class InvoiceRoutingInfo:
    """Contact routing for generated invoice delivery."""

    recipient_email: str = ""
    recipient_name: str = ""
    department: str = "Accounting"
    contact_type: str = "billing_contact"
    fallback_email: str = ""


def generate_invoice_number(tenant_id: str, sequence: int = 0) -> str:
    """Generate a unique invoice number for the tenant."""
    today = date.today()
    prefix = f"INV-{today.strftime('%Y%m')}"
    seq = str(sequence).zfill(4) if sequence else "0001"
    return f"{prefix}-{seq}"


def calculate_due_date(
    invoice_date: date | None = None,
    payment_terms: str = "net_30",
) -> date:
    """Calculate invoice due date from payment terms."""
    base_date = invoice_date or date.today()
    terms_days = {
        "net_7": 7,
        "net_15": 15,
        "net_30": 30,
        "net_45": 45,
        "net_60": 60,
        "net_90": 90,
        "due_on_receipt": 0,
        "cod": 0,
    }
    days = terms_days.get(payment_terms.lower().replace(" ", "_"), 30)
    return base_date + timedelta(days=days)


def build_invoice_from_sales_order(
    sales_order_data: dict[str, Any],
    tenant_id: str = "",
    sequence: int = 0,
) -> InvoiceGenerationResult:
    """
    Build a draft invoice from a confirmed Sales Order.

    Args:
        sales_order_data: Dict with sales order fields:
            - our_sales_order_num: str
            - customer_id: int/str
            - customer_name: str
            - total_amount: Decimal or float
            - unit_price: Decimal or float (optional)
            - quantity: int (optional)
            - product_description: str (optional)
            - payment_terms: str (optional)
            - billing_contact_email: str (optional)
            - billing_contact_name: str (optional)
            - shipping_contact_email: str (optional)
        tenant_id: Tenant identifier
        sequence: Invoice sequence number

    Returns:
        InvoiceGenerationResult with populated invoice_data
    """
    errors: list[str] = []

    # Validate required fields
    so_number = sales_order_data.get("our_sales_order_num", "")
    if not so_number:
        errors.append("Missing sales order number")

    customer_id = sales_order_data.get("customer_id")
    if not customer_id:
        errors.append("Missing customer_id")

    total_amount = sales_order_data.get("total_amount")
    if total_amount is None:
        errors.append("Missing total_amount")

    if errors:
        return InvoiceGenerationResult(success=False, errors=errors)

    # Generate invoice
    invoice_number = generate_invoice_number(tenant_id, sequence)
    payment_terms = sales_order_data.get("payment_terms", "net_30")
    due_date = calculate_due_date(payment_terms=payment_terms)

    # Build line items
    line_items: list[dict[str, Any]] = []
    description = sales_order_data.get(
        "product_description",
        f"Per Sales Order {so_number}",
    )
    quantity = sales_order_data.get("quantity", 1)
    unit_price = Decimal(str(sales_order_data.get("unit_price", total_amount)))

    line_item = InvoiceLineItem(
        description=description,
        quantity=quantity,
        unit_price=unit_price,
    )
    line_item.calculate_total()
    line_items.append(
        {
            "description": line_item.description,
            "quantity": line_item.quantity,
            "unit_price": str(line_item.unit_price.quantize(Decimal("0.01"))),
            "total": str(line_item.total.quantize(Decimal("0.01"))),
        }
    )

    # Resolve routing contact (prefer billing, fall back to shipping)
    routing = InvoiceRoutingInfo(
        recipient_email=sales_order_data.get("billing_contact_email", ""),
        recipient_name=sales_order_data.get("billing_contact_name", ""),
        department="Accounting",
        contact_type="billing_contact",
    )
    if not routing.recipient_email:
        routing.recipient_email = sales_order_data.get("shipping_contact_email", "")
        routing.fallback_email = sales_order_data.get("shipping_contact_email", "")

    invoice_data = {
        "invoice_number": invoice_number,
        "status": "draft",
        "payment_status": "unpaid",
        "customer_id": customer_id,
        "customer_name": sales_order_data.get("customer_name", ""),
        "sales_order_number": so_number,
        "total_amount": str(Decimal(str(total_amount)).quantize(Decimal("0.01"))),
        "tax_amount": str(Decimal(str(sales_order_data.get("tax_amount", "0.00"))).quantize(Decimal("0.01"))),
        "outstanding_amount": str(Decimal(str(total_amount)).quantize(Decimal("0.01"))),
        "due_date": due_date.isoformat(),
        "payment_terms": payment_terms,
        "line_items": line_items,
        "product_description": description,
        "quantity": quantity,
        "unit_price": str(unit_price.quantize(Decimal("0.01"))),
        "billing_contact_email": routing.recipient_email,
        "billing_contact_name": routing.recipient_name,
        "routing_department": routing.department,
        "lineage": {
            "source_type": "sales_order",
            "source_ref": so_number,
            "customer_id": str(customer_id),
            "generated_at": date.today().isoformat(),
        },
    }

    logger.info(
        "Generated draft invoice %s from SO %s for customer %s",
        invoice_number,
        so_number,
        customer_id,
    )

    return InvoiceGenerationResult(
        success=True,
        invoice_number=invoice_number,
        invoice_data=invoice_data,
        routing_contact={
            "email": routing.recipient_email,
            "name": routing.recipient_name,
            "department": routing.department,
            "contact_type": routing.contact_type,
        },
    )


def build_invoice_from_po_confirmation(
    po_data: dict[str, Any],
    sales_order_data: dict[str, Any],
    tenant_id: str = "",
    sequence: int = 0,
) -> InvoiceGenerationResult:
    """
    Build a draft invoice when customer PO is confirmed.

    Merges PO confirmation data with the originating Sales Order.
    """
    # PO confirmation enriches the SO data
    merged = {**sales_order_data}
    merged["delivery_po_number"] = po_data.get("po_number", "")

    # Override amount if PO specifies different (customer PO is authoritative)
    if po_data.get("total_amount"):
        merged["total_amount"] = po_data["total_amount"]

    # Use PO contact if available
    if po_data.get("billing_contact_email"):
        merged["billing_contact_email"] = po_data["billing_contact_email"]
        merged["billing_contact_name"] = po_data.get("billing_contact_name", "")

    result = build_invoice_from_sales_order(merged, tenant_id, sequence)
    if result.success:
        result.invoice_data["delivery_po_number"] = po_data.get("po_number", "")
        result.invoice_data["lineage"]["po_ref"] = po_data.get("po_number", "")
        result.invoice_data["lineage"]["source_type"] = "po_confirmation"

    return result
