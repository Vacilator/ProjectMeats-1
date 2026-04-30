"""Transactional document PDF and email helpers."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Iterable

from django.apps import apps
from django.core.mail import EmailMessage
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


@dataclass(frozen=True)
class GeneratedDocument:
    """Generated PDF bytes plus suggested filename."""

    filename: str
    content: bytes
    content_type: str = "application/pdf"


DOCUMENT_MODEL_MAP: dict[str, tuple[str, str]] = {
    "purchase_order": ("purchase_orders", "PurchaseOrder"),
    "sales_order": ("sales_orders", "SalesOrder"),
    "invoice": ("invoices", "Invoice"),
    "carrier_purchase_order": ("purchase_orders", "CarrierPurchaseOrder"),
    "carrier-po": ("purchase_orders", "CarrierPurchaseOrder"),
    "carrier_pos": ("purchase_orders", "CarrierPurchaseOrder"),
}


def _resolve_document_model(entity_type: str):
    key = str(entity_type or "").strip().replace("-", "_").lower()
    if key not in DOCUMENT_MODEL_MAP:
        raise LookupError(f"Unsupported document type: {entity_type}")
    app_label, model_name = DOCUMENT_MODEL_MAP[key]
    return apps.get_model(app_label, model_name)


def generate_document_pdf(entity_type: str, entity_id, tenant=None) -> GeneratedDocument:
    """Generate a PDF for a supported transactional document."""

    model = _resolve_document_model(entity_type)
    queryset = model.objects.all()
    if tenant is not None and hasattr(model, "tenant"):
        queryset = queryset.filter(tenant=tenant)
    instance = queryset.get(pk=entity_id)
    return generate_document_pdf_for_instance(instance)


def email_document_pdf(instance, *, to: Iterable[str], subject: str, body: str) -> GeneratedDocument:
    """Email a generated PDF attachment using Django's configured email backend."""

    generated = generate_document_pdf_for_instance(instance)
    message = EmailMessage(subject=subject, body=body, to=list(to))
    message.attach(generated.filename, generated.content, generated.content_type)
    message.send(fail_silently=False)
    return generated


def generate_document_pdf_for_instance(instance) -> GeneratedDocument:
    """Render a transactional document into a PDF attachment."""

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocumentTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=10,
    )
    section_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading3"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = styles["BodyText"]

    story = [
        Paragraph(_document_title(instance), title_style),
        Paragraph(_document_subtitle(instance), body_style),
        Spacer(1, 0.15 * inch),
    ]

    for title, rows in _document_sections(instance):
        if not rows:
            continue
        story.append(Paragraph(title, section_style))
        story.append(_build_key_value_table(rows))
        story.append(Spacer(1, 0.08 * inch))

    line_items = _line_items(instance)
    if line_items:
        story.append(Paragraph("Line Items", section_style))
        story.append(_build_line_items_table(line_items))
        story.append(Spacer(1, 0.08 * inch))

    notes = _string_value(getattr(instance, "notes", ""))
    if notes:
        story.append(Paragraph("Notes", section_style))
        story.append(Paragraph(notes, body_style))

    doc.build(story)
    return GeneratedDocument(
        filename=_document_filename(instance),
        content=buffer.getvalue(),
    )


def _document_title(instance) -> str:
    titles = {
        "PurchaseOrder": "Purchase Order",
        "SalesOrder": "Sales Order",
        "Invoice": "Invoice",
        "CarrierPurchaseOrder": "Carrier / Freight Order",
    }
    return titles.get(instance.__class__.__name__, instance.__class__.__name__)


def _document_subtitle(instance) -> str:
    reference = _primary_reference(instance)
    status_label = getattr(instance, "get_status_display", lambda: _string_value(getattr(instance, "status", "")))()
    created_at = getattr(instance, "date_time_stamp", None) or getattr(instance, "date_time_stamp_created", None)
    timestamp = created_at or getattr(instance, "created_on", None)
    rendered_timestamp = timestamp.strftime("%Y-%m-%d %H:%M") if timestamp else timezone.now().strftime("%Y-%m-%d %H:%M")
    return f"{reference} · {status_label} · Generated {rendered_timestamp}"


def _primary_reference(instance) -> str:
    for attr in (
        "order_number",
        "our_purchase_order_number_to_supplier",
        "our_purchase_order_num",
        "our_sales_order_number_for_customer",
        "our_sales_order_num",
        "invoice_number",
        "our_carrier_po_num",
    ):
        value = _string_value(getattr(instance, attr, ""))
        if value:
            return value
    return f"{instance.__class__.__name__} #{instance.pk}"


def _document_filename(instance) -> str:
    prefix = {
        "PurchaseOrder": "purchase-order",
        "SalesOrder": "sales-order",
        "Invoice": "invoice",
        "CarrierPurchaseOrder": "carrier-po",
    }.get(instance.__class__.__name__, "document")
    safe_reference = _primary_reference(instance).replace("/", "-").replace(" ", "-")
    return f"{prefix}-{safe_reference}.pdf"


def _document_sections(instance) -> list[tuple[str, list[tuple[str, str]]]]:
    sections: list[tuple[str, list[tuple[str, str]]]] = []

    general_rows = [
        ("Reference", _primary_reference(instance)),
        ("Status", _string_value(getattr(instance, "get_status_display", lambda: getattr(instance, "status", ""))())),
        ("Supplier", _related_label(getattr(instance, "supplier", None))),
        ("Customer", _related_label(getattr(instance, "customer", None))),
        ("Carrier", _related_label(getattr(instance, "carrier", None)) or _string_value(getattr(instance, "carrier_name", ""))),
        ("Purchase Order", _related_label(getattr(instance, "linked_order", None))),
        ("Sales Order", _related_label(getattr(instance, "sales_order", None))),
        ("Total Amount", _string_value(getattr(instance, "total_amount", ""))),
        ("Payment Terms", _string_value(getattr(instance, "payment_terms", ""))),
        ("Credit Limit", _string_value(getattr(instance, "credit_limit", "")) or _string_value(getattr(instance, "credit_limits", ""))),
    ]
    sections.append(("General Information", general_rows))

    logistics_rows = [
        ("Order Date", _string_value(getattr(instance, "order_date", ""))),
        ("Pickup Date", _string_value(getattr(instance, "pick_up_date", ""))),
        ("Delivery Date", _string_value(getattr(instance, "delivery_date", ""))),
        ("Pickup Location", _related_label(getattr(instance, "pick_up_location", None))),
        ("Delivery Location", _related_label(getattr(instance, "delivery_location", None))),
        ("Carrier Release Format", _string_value(getattr(instance, "carrier_release_format", ""))),
        ("Carrier Release Number", _string_value(getattr(instance, "carrier_release_number", "")) or _string_value(getattr(instance, "carrier_release_num", ""))),
        ("Appointment Method", _string_value(getattr(instance, "how_to_make_appointment", "")) or _string_value(getattr(instance, "how_carrier_make_appointment", ""))),
    ]
    sections.append(("Logistics", logistics_rows))

    contacts_rows = [
        ("Billing Contact", _join_parts(getattr(instance, "billing_contact_name", ""), getattr(instance, "billing_contact_title", ""))),
        ("Billing Phone", _string_value(getattr(instance, "billing_contact_phone", ""))),
        ("Billing Email", _string_value(getattr(instance, "billing_contact_email", ""))),
        ("AP Contact", _join_parts(getattr(instance, "accounting_payable_contact_name", ""), getattr(instance, "accounting_payable_contact_title", ""))),
        ("AP Phone", _string_value(getattr(instance, "accounting_payable_contact_phone", ""))),
        ("AP Email", _string_value(getattr(instance, "accounting_payable_contact_email", ""))),
        ("Shipping Contact", _join_parts(getattr(instance, "shipping_contact_name", ""), getattr(instance, "shipping_contact_title", ""))),
        ("Shipping Phone", _string_value(getattr(instance, "shipping_contact_phone", ""))),
        ("Shipping Email", _string_value(getattr(instance, "shipping_contact_email", ""))),
    ]
    sections.append(("Contacts", contacts_rows))

    address_rows = [
        ("Billing Address", _join_parts(
            getattr(instance, "billing_address_street", ""),
            getattr(instance, "billing_address_city", ""),
            getattr(instance, "billing_address_state_zip", ""),
            getattr(instance, "billing_building_name", ""),
        )),
        ("Shipping Address", _join_parts(
            getattr(instance, "shipping_address_street", ""),
            getattr(instance, "shipping_address_city", ""),
            getattr(instance, "shipping_address_state_zip", ""),
            getattr(instance, "shipping_building_name", ""),
        )),
    ]
    sections.append(("Addresses", address_rows))

    product_rows = [
        ("Product", _related_label(getattr(instance, "product", None))),
        ("Protein", _string_value(getattr(instance, "type_of_protein", ""))),
        ("Description", _string_value(getattr(instance, "item_description", "")) or _string_value(getattr(instance, "description_of_product_item", ""))),
        ("Fresh / Frozen", _string_value(getattr(instance, "fresh_or_frozen", ""))),
        ("Package Type", _string_value(getattr(instance, "package_type", ""))),
        ("Quantity", _string_value(getattr(instance, "quantity", ""))),
        ("Weight", _join_parts(getattr(instance, "total_weight", ""), getattr(instance, "weight_unit", ""))),
    ]
    sections.append(("Product Summary", product_rows))
    return sections


def _line_items(instance) -> list[dict[str, str]]:
    items = []
    related_items = getattr(instance, "items", None)
    if related_items is None:
        return items

    for item in related_items.all():
        items.append(
            {
                "line_number": _string_value(getattr(item, "line_number", "")),
                "protein": _string_value(getattr(item, "protein_type", "")),
                "product": _related_label(getattr(item, "product_description", None)),
                "condition": _string_value(getattr(item, "fresh_or_frozen", "")),
                "package": _string_value(getattr(item, "package_type", "")),
                "quantity": _string_value(getattr(item, "quantity", "")),
                "uom": _string_value(getattr(item, "uom", "")),
                "weight": _string_value(getattr(item, "total_net_weight", "")),
            }
        )
    return items


def _build_key_value_table(rows: list[tuple[str, str]]) -> Table:
    data = [["Field", "Value"]]
    for label, value in rows:
        if value:
            data.append([label, value])

    table = Table(data, colWidths=[1.8 * inch, 4.7 * inch], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    return table


def _build_line_items_table(items: list[dict[str, str]]) -> Table:
    data = [["Line", "Protein", "Product", "Condition", "Package", "Qty", "UOM", "Net Wt"]]
    for item in items:
        data.append(
            [
                item["line_number"],
                item["protein"],
                item["product"],
                item["condition"],
                item["package"],
                item["quantity"],
                item["uom"],
                item["weight"],
            ]
        )

    table = Table(
        data,
        colWidths=[0.45 * inch, 0.85 * inch, 2.05 * inch, 0.85 * inch, 0.9 * inch, 0.45 * inch, 0.5 * inch, 0.75 * inch],
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ]
        )
    )
    return table


def _related_label(value) -> str:
    if value is None:
        return ""
    for attr in ("name", "title", "product_code", "order_number", "our_sales_order_num", "invoice_number", "our_carrier_po_num"):
        attr_value = getattr(value, attr, None)
        if attr_value:
            return _string_value(attr_value)
    return _string_value(value)


def _join_parts(*parts) -> str:
    rendered = [_string_value(part) for part in parts]
    return ", ".join(part for part in rendered if part)


def _string_value(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            return str(value)
    return str(value).strip()
