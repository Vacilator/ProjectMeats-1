"""Fulfillment notification email service.

Sends shipment and delivery notification emails to the relevant parties
(customer / supplier) when a fulfillment transitions status.

Uses Microsoft Graph via ExternalAuthProvider — same pattern as supplier RFQ
and carrier freight inquiry email services.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.utils import timezone

from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers.microsoft import MicrosoftGraphProvider
from apps.tenants.rls import set_current_tenant

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FulfillmentEmailResult:
    """Result of a fulfillment notification email dispatch."""

    success: bool
    fulfillment_id: int | None = None
    recipient_email: str = ""
    provider_message_id: str = ""
    error_message: str = ""


def _get_sender_provider(*, tenant) -> ExternalAuthProvider:
    """Resolve the active Microsoft Graph email provider for the tenant."""
    provider = (
        ExternalAuthProvider.objects
        .filter(tenant=tenant, provider_type="microsoft", is_active=True)
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
    except Exception as exc:
        raise ValueError("Unable to decrypt Outlook access token.") from exc
    if not token:
        raise ValueError("Outlook access token is missing for this tenant.")
    return token


def _build_shipped_subject(fulfillment) -> str:
    """Subject line for a shipment notification."""
    return (
        f"Shipment Notification — {fulfillment.fulfillment_number} "
        f"(Inquiry {fulfillment.inquiry.inquiry_number})"
    )


def _build_shipped_body(fulfillment, *, recipient_name: str) -> str:
    """Build the shipment notification email body."""
    lines: list[str] = [
        f"Hello {recipient_name},",
        "",
        f"Fulfillment {fulfillment.fulfillment_number} has been shipped.",
        "",
    ]

    if fulfillment.ship_date:
        lines.append(f"Ship Date: {fulfillment.ship_date}")
    if fulfillment.expected_delivery:
        lines.append(f"Expected Delivery: {fulfillment.expected_delivery}")
    if fulfillment.tracking_numbers:
        tracking = ", ".join(fulfillment.tracking_numbers[:5])
        if len(fulfillment.tracking_numbers) > 5:
            tracking += f" (+{len(fulfillment.tracking_numbers) - 5} more)"
        lines.append(f"Tracking Number(s): {tracking}")
    if fulfillment.carrier:
        lines.append(f"Carrier: {fulfillment.carrier.name}")

    lines += [
        "",
        f"Inquiry: {fulfillment.inquiry.inquiry_number}",
        "",
        "Please contact us if you have any questions.",
        "",
        "Best regards,",
        "ProjectMeats Trade Team",
    ]
    return "\n".join(lines)


def _build_delivered_subject(fulfillment) -> str:
    return (
        f"Delivery Confirmation — {fulfillment.fulfillment_number} "
        f"(Inquiry {fulfillment.inquiry.inquiry_number})"
    )


def _build_delivered_body(fulfillment, *, recipient_name: str) -> str:
    lines: list[str] = [
        f"Hello {recipient_name},",
        "",
        f"Fulfillment {fulfillment.fulfillment_number} has been delivered.",
        "",
    ]
    if fulfillment.actual_delivery:
        lines.append(f"Delivery Date: {fulfillment.actual_delivery}")
    if fulfillment.carrier:
        lines.append(f"Carrier: {fulfillment.carrier.name}")

    lines += [
        "",
        f"Inquiry: {fulfillment.inquiry.inquiry_number}",
        "",
        "Thank you for your business.",
        "",
        "Best regards,",
        "ProjectMeats Trade Team",
    ]
    return "\n".join(lines)


def _resolve_customer_email(fulfillment) -> tuple[str, str]:
    """Return (recipient_email, recipient_name) for the customer on the fulfillment."""
    customer = fulfillment.customer or getattr(fulfillment.inquiry, "customer", None)
    if not customer:
        return "", ""

    # Try primary contact
    contact = customer.contacts.filter(is_primary=True).first()
    if contact and contact.email:
        return contact.email, contact.name or customer.name

    # Fallback to any contact with email
    contact = customer.contacts.filter(email__isnull=False).exclude(email="").first()
    if contact and contact.email:
        return contact.email, contact.name or customer.name

    return "", customer.name or ""


def send_fulfillment_notification(
    *,
    tenant: Any,
    fulfillment,
    notification_type: str = "shipped",
) -> FulfillmentEmailResult:
    """Send a fulfillment notification email (shipped or delivered).

    Args:
        tenant: The active tenant.
        fulfillment: The Fulfillment instance.
        notification_type: 'shipped' or 'delivered'.

    Returns:
        FulfillmentEmailResult with dispatch outcome.
    """
    if tenant is None:
        return FulfillmentEmailResult(success=False, error_message="No tenant context.")

    rls = set_current_tenant(str(tenant.id))
    if not rls.ok:
        return FulfillmentEmailResult(
            success=False,
            error_message=f"RLS context error: {rls.error}",
        )

    recipient_email, recipient_name = _resolve_customer_email(fulfillment)
    if not recipient_email:
        logger.info(
            "fulfillment_email.no_recipient fulfillment=%s type=%s",
            fulfillment.fulfillment_number,
            notification_type,
        )
        return FulfillmentEmailResult(
            success=False,
            fulfillment_id=fulfillment.id,
            error_message="No customer email found for notification.",
        )

    try:
        sender_provider = _get_sender_provider(tenant=tenant)
        access_token = _get_access_token(sender_provider)
    except ValueError as exc:
        return FulfillmentEmailResult(
            success=False,
            fulfillment_id=fulfillment.id,
            error_message=str(exc),
        )

    if notification_type == "delivered":
        subject = _build_delivered_subject(fulfillment)
        body = _build_delivered_body(fulfillment, recipient_name=recipient_name)
    else:
        subject = _build_shipped_subject(fulfillment)
        body = _build_shipped_body(fulfillment, recipient_name=recipient_name)

    graph = MicrosoftGraphProvider(tenant.id)
    try:
        email_params: dict = {
            "to": [recipient_email],
            "subject": subject,
            "body": body,
        }

        result = graph.send_email(access_token, email_params)
        logger.info(
            "fulfillment_email.sent fulfillment=%s type=%s to=%s",
            fulfillment.fulfillment_number,
            notification_type,
            recipient_email,
        )
        return FulfillmentEmailResult(
            success=True,
            fulfillment_id=fulfillment.id,
            recipient_email=recipient_email,
            provider_message_id=result.get("provider_message_id", "") or "",
        )
    except Exception as exc:
        logger.exception(
            "fulfillment_email.failed fulfillment=%s type=%s",
            fulfillment.fulfillment_number,
            notification_type,
        )
        return FulfillmentEmailResult(
            success=False,
            fulfillment_id=fulfillment.id,
            recipient_email=recipient_email,
            error_message=str(exc),
        )
