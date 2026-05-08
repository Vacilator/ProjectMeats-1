"""Carrier freight inquiry (outbound RFQ) service for CTE-04.3.

Matches eligible carriers for an approved sales order lane, generates
freight inquiry emails, and records durable audit rows.
"""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from tenant_apps.carriers.models import Carrier, CarrierFreightInquiry, CarrierFreightInquiryStatus
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers.base import EmailProviderError, TokenExpiredError
from apps.integrations.providers.microsoft import MicrosoftGraphProvider
from apps.tenants.rls import set_current_tenant

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CarrierFreightInquiryResult:
    success: bool
    inquiries_sent: int = 0
    inquiries_failed: int = 0
    error_message: str = ""
    error_code: str = ""
    http_status: int = status.HTTP_200_OK
    details: list = field(default_factory=list)


def send_carrier_freight_inquiries(
    *,
    tenant,
    sales_order: SalesOrder,
    user=None,
    carrier_ids: list | None = None,
) -> CarrierFreightInquiryResult:
    """Fan-out freight inquiry emails to matched carriers for an approved SO.

    Args:
        tenant: The active tenant.
        sales_order: The approved sales order needing logistics.
        user: The user initiating the inquiry (for audit).
        carrier_ids: Optional explicit carrier IDs. If None, auto-matches active carriers.

    Returns:
        CarrierFreightInquiryResult with per-carrier status details.
    """

    if tenant is None:
        return CarrierFreightInquiryResult(
            success=False,
            error_message="Tenant context is required.",
            error_code="missing_tenant",
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    if sales_order is None or sales_order.tenant_id != tenant.id:
        return CarrierFreightInquiryResult(
            success=False,
            error_message="Sales order not found for this tenant.",
            error_code="invalid_sales_order",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    if sales_order.status not in (
        SalesOrderStatus.APPROVED,
        SalesOrderStatus.CONFIRMED,
        SalesOrderStatus.SENT,
    ):
        return CarrierFreightInquiryResult(
            success=False,
            error_message=f"Sales order must be approved before sending freight inquiries. Current status: {sales_order.status}.",
            error_code="invalid_status",
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    rls = set_current_tenant(str(tenant.id))
    if not rls.ok:
        return CarrierFreightInquiryResult(
            success=False,
            error_message=f"Unable to set tenant RLS context: {rls.error}",
            error_code="tenant_rls_error",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Resolve email provider
    try:
        provider = _get_sender_provider(tenant=tenant)
        access_token = _get_access_token(provider)
    except ValueError as exc:
        return CarrierFreightInquiryResult(
            success=False,
            error_message=str(exc),
            error_code="provider_error",
            http_status=status.HTTP_502_BAD_GATEWAY,
        )

    # Match carriers
    carriers = _match_carriers(tenant=tenant, sales_order=sales_order, carrier_ids=carrier_ids)
    if not carriers:
        return CarrierFreightInquiryResult(
            success=False,
            error_message="No eligible carriers found for this lane.",
            error_code="no_carriers",
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # Fan out inquiries
    sent_count = 0
    failed_count = 0
    details = []

    for carrier in carriers:
        result_detail = _send_single_inquiry(
            tenant=tenant,
            sales_order=sales_order,
            carrier=carrier,
            user=user,
            provider=provider,
            access_token=access_token,
        )
        details.append(result_detail)
        if result_detail.get("status") in ("sent", "already_sent"):
            sent_count += 1
        else:
            failed_count += 1

    logger.info(
        "Telemetry: carrier_freight_inquiries.sent",
        extra={
            "event_type": "carrier_freight_inquiries.sent",
            "tenant_id": str(tenant.id),
            "sales_order_id": str(sales_order.id),
            "carriers_contacted": sent_count,
            "carriers_failed": failed_count,
            "timestamp": timezone.now().isoformat(),
        },
    )

    return CarrierFreightInquiryResult(
        success=sent_count > 0,
        inquiries_sent=sent_count,
        inquiries_failed=failed_count,
        details=details,
        error_message="" if sent_count > 0 else "All carrier inquiries failed.",
        error_code="" if sent_count > 0 else "all_failed",
        http_status=status.HTTP_200_OK if sent_count > 0 else status.HTTP_502_BAD_GATEWAY,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _match_carriers(
    *,
    tenant,
    sales_order: SalesOrder,
    carrier_ids: list | None = None,
) -> list[Carrier]:
    """Match eligible carriers for the given lane.

    If carrier_ids provided, use those (filtered by tenant + active).
    Otherwise auto-match all active carriers for the tenant.
    Future: add lane-matching logic (origin/destination, carrier_type, etc.)
    """
    qs = Carrier.objects.filter(tenant=tenant, is_active=True)

    if carrier_ids:
        qs = qs.filter(id__in=carrier_ids)

    # Filter carriers that have a usable email
    carriers = []
    for carrier in qs.iterator():
        email = _resolve_carrier_email(carrier)
        if email:
            carriers.append(carrier)

    return carriers


def _resolve_carrier_email(carrier: Carrier) -> str:
    """Resolve the best email to use for freight inquiries.

    Priority: sales_contact_email → main email → first contact with email.
    """
    if carrier.sales_contact_email and carrier.sales_contact_email.strip():
        return carrier.sales_contact_email.strip()
    if carrier.email and carrier.email.strip():
        return carrier.email.strip()
    # Try M2M contacts
    contact = carrier.contacts.exclude(email="").exclude(email__isnull=True).first()
    if contact:
        return contact.email.strip()
    return ""


def _resolve_carrier_recipient_name(carrier: Carrier) -> str:
    if carrier.sales_contact_name and carrier.sales_contact_name.strip():
        return carrier.sales_contact_name.strip()
    if carrier.contact_person and carrier.contact_person.strip():
        return carrier.contact_person.strip()
    return carrier.name


def _send_single_inquiry(
    *,
    tenant,
    sales_order: SalesOrder,
    carrier: Carrier,
    user,
    provider: ExternalAuthProvider,
    access_token: str,
) -> dict:
    """Send a single freight inquiry to one carrier and record the audit row."""

    recipient_email = _resolve_carrier_email(carrier)
    recipient_name = _resolve_carrier_recipient_name(carrier)

    if not recipient_email:
        return {
            "carrier_id": carrier.id,
            "carrier_name": carrier.name,
            "status": "failed",
            "error": "No email address found for carrier.",
        }

    subject = _build_subject(sales_order)
    body = _build_body(sales_order=sales_order, carrier=carrier, recipient_name=recipient_name)

    with transaction.atomic():
        # Check for existing pending/sent inquiry to avoid duplicates
        existing = CarrierFreightInquiry.objects.filter(
            tenant=tenant,
            sales_order=sales_order,
            carrier=carrier,
            status__in=[
                CarrierFreightInquiryStatus.PENDING,
                CarrierFreightInquiryStatus.SENDING,
                CarrierFreightInquiryStatus.SENT,
            ],
        ).first()

        if existing and existing.status == CarrierFreightInquiryStatus.SENT:
            return {
                "carrier_id": carrier.id,
                "carrier_name": carrier.name,
                "status": "already_sent",
                "inquiry_id": existing.id,
            }

        inquiry = existing or CarrierFreightInquiry(
            tenant=tenant,
            carrier=carrier,
            sales_order=sales_order,
            initiated_by=user,
        )

        # Populate freight details from SO
        inquiry.origin_city = getattr(sales_order, "pick_up_city", "") or ""
        inquiry.origin_state = getattr(sales_order, "pick_up_state", "") or ""
        inquiry.destination_city = getattr(sales_order, "delivery_city", "") or ""
        inquiry.destination_state = getattr(sales_order, "delivery_state", "") or ""
        inquiry.commodity = sales_order.product.product_code if getattr(sales_order, "product_id", None) else ""
        inquiry.weight = getattr(sales_order, "total_weight", None)
        inquiry.weight_unit = getattr(sales_order, "weight_unit", "lbs") or "lbs"
        inquiry.pickup_date = getattr(sales_order, "pick_up_date", None)
        inquiry.delivery_date = getattr(sales_order, "delivery_date", None)

        # Email fields
        inquiry.sender_email = getattr(provider, "connected_email", "") or ""
        inquiry.sender_provider_id = getattr(provider, "pk", None)
        inquiry.recipient_email = recipient_email
        inquiry.recipient_name = recipient_name
        inquiry.subject = subject
        inquiry.body = body
        inquiry.status = CarrierFreightInquiryStatus.SENDING
        inquiry.attempt_count += 1
        inquiry.last_attempted_at = timezone.now()
        inquiry.save()

        # Send email
        try:
            graph = MicrosoftGraphProvider(access_token=access_token)
            send_result = graph.send_email(
                to_email=recipient_email,
                subject=subject,
                body=body,
            )
        except (EmailProviderError, TokenExpiredError) as exc:
            inquiry.status = CarrierFreightInquiryStatus.FAILED
            inquiry.error_message = f"Email send failed: {str(exc)}"
            inquiry.save(update_fields=["status", "error_message", "modified_on"])
            return {
                "carrier_id": carrier.id,
                "carrier_name": carrier.name,
                "status": "failed",
                "error": str(exc),
            }
        except Exception as exc:
            inquiry.status = CarrierFreightInquiryStatus.FAILED
            inquiry.error_message = f"Unexpected error: {str(exc)}"
            inquiry.save(update_fields=["status", "error_message", "modified_on"])
            return {
                "carrier_id": carrier.id,
                "carrier_name": carrier.name,
                "status": "failed",
                "error": str(exc),
            }

        # Mark sent
        inquiry.status = CarrierFreightInquiryStatus.SENT
        inquiry.sent_at = timezone.now()
        inquiry.provider_message_id = getattr(send_result, "message_id", "") or ""
        inquiry.provider_thread_id = getattr(send_result, "thread_id", "") or ""
        inquiry.provider_internet_message_id = getattr(send_result, "internet_message_id", "") or ""
        inquiry.save()

        return {
            "carrier_id": carrier.id,
            "carrier_name": carrier.name,
            "status": "sent",
            "inquiry_id": inquiry.id,
            "recipient_email": recipient_email,
        }


def _build_subject(sales_order: SalesOrder) -> str:
    ref = sales_order.our_sales_order_num or f"SO-{sales_order.pk}"
    origin = getattr(sales_order, "pick_up_city", "") or ""
    dest = getattr(sales_order, "delivery_city", "") or ""
    lane = f" ({origin} → {dest})" if origin and dest else ""
    return f"Freight Quote Request - {ref}{lane}"


def _build_body(*, sales_order: SalesOrder, carrier: Carrier, recipient_name: str) -> str:
    greeting = recipient_name or carrier.name
    ref = sales_order.our_sales_order_num or f"SO-{sales_order.pk}"
    origin = getattr(sales_order, "pick_up_city", "") or "TBD"
    origin_state = getattr(sales_order, "pick_up_state", "") or ""
    dest = getattr(sales_order, "delivery_city", "") or "TBD"
    dest_state = getattr(sales_order, "delivery_state", "") or ""
    pickup_date = getattr(sales_order, "pick_up_date", None)
    delivery_date = getattr(sales_order, "delivery_date", None)
    weight = getattr(sales_order, "total_weight", None)
    weight_unit = getattr(sales_order, "weight_unit", "lbs") or "lbs"

    lines = [
        f"Hello {greeting},",
        "",
        f"We are requesting a freight quote for the following shipment (ref: {ref}):",
        "",
        f"  Origin: {origin}, {origin_state}".rstrip(", "),
        f"  Destination: {dest}, {dest_state}".rstrip(", "),
    ]
    if pickup_date:
        lines.append(f"  Pickup Date: {pickup_date}")
    if delivery_date:
        lines.append(f"  Delivery Date: {delivery_date}")
    if weight:
        lines.append(f"  Weight: {weight} {weight_unit}")

    commodity = sales_order.product.product_code if getattr(sales_order, "product_id", None) else ""
    if commodity:
        lines.append(f"  Commodity: {commodity}")

    lines.extend(
        [
            "",
            "Please reply with your rate and availability.",
            "",
            "Thank you,",
            "ProjectMeats Logistics",
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
        raise ValueError("Outlook is not connected for this tenant.")
    provider.refresh_if_needed()
    if provider.is_token_expired():
        raise ValueError("Outlook connection expired for this tenant.")
    return provider


def _get_access_token(provider: ExternalAuthProvider) -> str:
    try:
        token = provider.get_decrypted_token("access")
    except Exception as exc:
        raise ValueError("Unable to decrypt the Outlook access token.") from exc
    if not token:
        raise ValueError("Outlook access token is missing for this tenant.")
    return token
