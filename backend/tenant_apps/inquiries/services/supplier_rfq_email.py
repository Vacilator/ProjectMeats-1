"""Canonical outbound supplier RFQ email service for broker inquiries."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from apps.core.services.supplier_matching import match_suppliers_for_inquiry
from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers.base import EmailProviderError, TokenExpiredError
from apps.integrations.providers.microsoft import MicrosoftGraphProvider
from apps.tenants.rls import set_current_tenant
from tenant_apps.contacts.services import (
    build_supplier_contact_context_lines,
    resolve_supplier_contact_route,
)
from tenant_apps.inquiries.models import (
    InquiryRouteDecisionChoices,
    InquiryShippingTypeChoices,
    InquirySupplierRFQ,
    InquirySupplierRFQStatusChoices,
)
from tenant_apps.suppliers.models import Supplier


@dataclass(frozen=True)
class SupplierRFQDispatchEntry:
    supplier_id: int
    supplier_name: str
    rfq_id: int | None
    status: str
    recipient_email: str = ""
    provider_message_id: str = ""
    provider_thread_id: str = ""
    skipped_reason: str = ""
    error_message: str = ""


@dataclass(frozen=True)
class SupplierRFQDispatchResult:
    inquiry_id: int
    route_decision: str
    matched_supplier_count: int
    dispatched_count: int
    skipped_count: int
    entries: tuple[SupplierRFQDispatchEntry, ...]


def _build_subject(inquiry) -> str:
    anchor = ""
    if inquiry.requested_master_product_id and inquiry.requested_master_product:
        anchor = inquiry.requested_master_product.display_name
    elif inquiry.requested_protein:
        anchor = inquiry.requested_protein
    return f"RFQ {inquiry.inquiry_number}: {anchor}".strip(": ")


def _resolve_rfq_focus(inquiry) -> str:
    shipping_type = getattr(inquiry, "shipping_type", "")
    return "logistics" if shipping_type == InquiryShippingTypeChoices.SUPPLIER_DELIVERING else "pricing"


def _build_body(*, inquiry, supplier_name: str, correlation_key: str, contact_resolution) -> str:
    entity_name = getattr(getattr(inquiry, "entity", None), "name", "") or inquiry.contact_company or "our team"
    lines: list[str] = [
        f"Hello {supplier_name},",
        "",
        f"We are requesting a quote for inquiry {inquiry.inquiry_number}.",
    ]
    if entity_name:
        lines.append(f"Customer / source: {entity_name}")
    if inquiry.requested_master_product_id and inquiry.requested_master_product:
        lines.append(f"Requested item: {inquiry.requested_master_product.display_name}")
    elif inquiry.requested_protein:
        lines.append(f"Requested protein: {inquiry.requested_protein}")

    for product_line in inquiry.products.select_related("product").all()[:10]:
        label = getattr(product_line.product, "name", "") or "Line item"
        lines.append(
            f"- {label}: qty {product_line.quantity} {product_line.desired_uom or ''}".rstrip()
        )
        if product_line.desired_available_date:
            lines.append(f"  Needed by: {product_line.desired_available_date.isoformat()}")
        if product_line.desired_delivery_date:
            lines.append(f"  Delivery target: {product_line.desired_delivery_date.isoformat()}")

    if inquiry.notes:
        lines.extend(["", "Notes:", inquiry.notes.strip()])

    contact_context_lines = build_supplier_contact_context_lines(
        resolution=contact_resolution,
        include_90_day_confirm=True,
    )
    if contact_context_lines:
        lines.extend(["", *contact_context_lines])

    lines.extend(
        [
            "",
            f"Shipping type: {inquiry.get_shipping_type_display()}",
            f"RFQ reference: {correlation_key}",
            "",
            "Please reply with availability, pricing, lead time, plant details, and any shipping constraints.",
            "If an alternate plant will fulfill this inquiry, include that plant and the applicable establishment details.",
            "If you can support the attached document packet, please return those items with your reply.",
            "",
            "Thank you,",
            inquiry.created_by.get_full_name().strip() if inquiry.created_by and inquiry.created_by.get_full_name().strip() else "ProjectMeats",
        ]
    )
    return "\n".join(lines)


def _get_sender_provider(*, tenant) -> ExternalAuthProvider:
    provider = (
        ExternalAuthProvider.objects.filter(
            tenant=tenant,
            provider_type="microsoft",
            is_active=True,
        )
        .select_related("tenant")
        .first()
    )
    if not provider:
        raise ValueError("Outlook not connected for this tenant.")

    provider.refresh_if_needed()
    if provider.is_token_expired():
        raise ValueError("Outlook connection expired for this tenant.")
    return provider


def _get_access_token(provider: ExternalAuthProvider) -> str:
    try:
        token = provider.get_decrypted_token("access")
    except Exception as exc:  # pragma: no cover - exercised via service failure tests
        raise ValueError("Unable to decrypt Outlook access token.") from exc
    if not token:
        raise ValueError("Outlook access token is missing for this tenant.")
    return token


def send_supplier_rfqs_for_inquiry(*, tenant, inquiry, user=None, supplier_ids: Iterable[int] | None = None) -> SupplierRFQDispatchResult:
    """Send RFQ emails for a broker inquiry and persist one durable audit row per supplier."""

    if tenant is None:
        raise ValueError("Tenant context is required for supplier RFQ dispatch.")
    if inquiry is None:
        raise ValueError("Inquiry is required for supplier RFQ dispatch.")
    if getattr(inquiry, "tenant_id", None) != getattr(tenant, "id", None):
        raise ValueError("Inquiry does not belong to the active tenant.")
    if inquiry.route_decision != InquiryRouteDecisionChoices.BROKER:
        raise ValueError("Only broker inquiries can dispatch supplier RFQs.")

    rls = set_current_tenant(str(tenant.id))
    if not rls.ok:
        raise ValueError(f"Unable to set tenant RLS context: {rls.error}")

    match_result = match_suppliers_for_inquiry(tenant=tenant, inquiry=inquiry)
    candidate_ids = [candidate.supplier_id for candidate in match_result.candidates]
    if supplier_ids is not None:
        requested_ids = {int(supplier_id) for supplier_id in supplier_ids}
        candidate_ids = [supplier_id for supplier_id in candidate_ids if supplier_id in requested_ids]

    if not candidate_ids:
        return SupplierRFQDispatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            matched_supplier_count=len(match_result.candidates),
            dispatched_count=0,
            skipped_count=0,
            entries=(),
        )

    supplier_map = {
        supplier.id: supplier
        for supplier in Supplier.objects.for_tenant(tenant)
        .filter(id__in=candidate_ids)
        .prefetch_related("contacts")
    }

    sender_provider = _get_sender_provider(tenant=tenant)
    access_token = _get_access_token(sender_provider)
    graph = MicrosoftGraphProvider(tenant.id)

    dispatched_count = 0
    entries: list[SupplierRFQDispatchEntry] = []
    rfq_focus = _resolve_rfq_focus(inquiry)
    for supplier_id in candidate_ids:
        supplier = supplier_map.get(supplier_id)
        if supplier is None:
            continue
        contact_resolution = resolve_supplier_contact_route(
            tenant=tenant,
            supplier=supplier,
            inquiry=inquiry,
            focus=rfq_focus,
        )
        recipient_email = contact_resolution.recipient_email
        if not recipient_email:
            entries.append(
                SupplierRFQDispatchEntry(
                    supplier_id=supplier.id,
                    supplier_name=supplier.name,
                    rfq_id=None,
                    status="skipped",
                    skipped_reason="missing_supplier_email",
                )
            )
            continue

        with transaction.atomic():
            rfq, created = InquirySupplierRFQ.objects.get_or_create(
                tenant=tenant,
                inquiry=inquiry,
                supplier=supplier,
                defaults={
                    "created_by": user,
                    "sender_provider": sender_provider,
                    "sender_email": sender_provider.connected_email or "",
                    "recipient_email": recipient_email,
                    "recipient_name": contact_resolution.recipient_name or supplier.name,
                    "subject": "",
                    "body": "",
                    "provider": sender_provider.provider_type,
                },
            )
            if rfq.status == InquirySupplierRFQStatusChoices.SENT:
                entries.append(
                    SupplierRFQDispatchEntry(
                        supplier_id=supplier.id,
                        supplier_name=supplier.name,
                        rfq_id=rfq.id,
                        status=rfq.status,
                        recipient_email=rfq.recipient_email,
                        provider_message_id=rfq.provider_message_id,
                        provider_thread_id=rfq.provider_thread_id,
                        skipped_reason="already_sent",
                    )
                )
                continue

            subject = _build_subject(inquiry)
            body = _build_body(
                inquiry=inquiry,
                supplier_name=contact_resolution.recipient_name or supplier.name,
                correlation_key=str(rfq.correlation_key),
                contact_resolution=contact_resolution,
            )
            rfq.created_by = user or rfq.created_by
            rfq.sender_provider = sender_provider
            rfq.sender_email = sender_provider.connected_email or rfq.sender_email
            rfq.recipient_email = recipient_email
            rfq.recipient_name = contact_resolution.recipient_name or supplier.name
            rfq.subject = subject[:300]
            rfq.body = body
            rfq.provider = sender_provider.provider_type
            rfq.status = InquirySupplierRFQStatusChoices.PENDING
            rfq.error_message = ""
            rfq.attempt_count += 1
            rfq.last_attempted_at = timezone.now()
            rfq.custom_data = {
                **(rfq.custom_data or {}),
                "inquiry_number": inquiry.inquiry_number,
                "route_decision": inquiry.route_decision,
                "rfq_focus": rfq_focus,
                "recipient_routing": contact_resolution.as_dict(),
            }
            rfq.save()

        try:
            provider_result = graph.send_email(
                access_token,
                {
                    "to": [recipient_email],
                    "subject": rfq.subject,
                    "body": rfq.body,
                    "reply_to": sender_provider.connected_email or "",
                    "headers": {
                        "X-ProjectMeats-Inquiry-RFQ": str(rfq.correlation_key),
                        "X-ProjectMeats-Inquiry-Id": str(inquiry.id),
                    },
                    "attachments": [
                        attachment.as_email_payload()
                        for attachment in contact_resolution.attachments
                    ],
                },
            )
            rfq.status = InquirySupplierRFQStatusChoices.SENT
            rfq.sent_at = timezone.now()
            rfq.provider_message_id = provider_result.get("provider_message_id", "")
            rfq.provider_thread_id = provider_result.get("provider_thread_id", "")
            rfq.provider_internet_message_id = provider_result.get("provider_internet_message_id", "")
            rfq.error_message = ""
            rfq.custom_data = {
                **(rfq.custom_data or {}),
                "provider_result": provider_result,
            }
            rfq.save(
                update_fields=[
                    "status",
                    "sent_at",
                    "provider_message_id",
                    "provider_thread_id",
                    "provider_internet_message_id",
                    "error_message",
                    "custom_data",
                    "modified_on",
                ]
            )
            dispatched_count += 1
            entries.append(
                SupplierRFQDispatchEntry(
                    supplier_id=supplier.id,
                    supplier_name=supplier.name,
                    rfq_id=rfq.id,
                    status=rfq.status,
                    recipient_email=rfq.recipient_email,
                    provider_message_id=rfq.provider_message_id,
                    provider_thread_id=rfq.provider_thread_id,
                )
            )
        except (EmailProviderError, TokenExpiredError, ValueError) as exc:
            rfq.status = InquirySupplierRFQStatusChoices.FAILED
            rfq.error_message = str(exc)
            rfq.custom_data = {
                **(rfq.custom_data or {}),
                "last_error": str(exc),
            }
            rfq.save(update_fields=["status", "error_message", "custom_data", "modified_on"])
            entries.append(
                SupplierRFQDispatchEntry(
                    supplier_id=supplier.id,
                    supplier_name=supplier.name,
                    rfq_id=rfq.id,
                    status=rfq.status,
                    recipient_email=rfq.recipient_email,
                    error_message=rfq.error_message,
                )
            )

    skipped_count = sum(1 for entry in entries if entry.status != InquirySupplierRFQStatusChoices.SENT)
    return SupplierRFQDispatchResult(
        inquiry_id=inquiry.id,
        route_decision=inquiry.route_decision,
        matched_supplier_count=len(match_result.candidates),
        dispatched_count=dispatched_count,
        skipped_count=skipped_count,
        entries=tuple(entries),
    )
