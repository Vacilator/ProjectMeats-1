"""Invoice email dispatch service.

Sends invoice PDF emails to the customer's billing/accounting contact
when an invoice is finalized or manually dispatched.

Uses Microsoft Graph via ExternalAuthProvider — same pattern as supplier RFQ
and carrier freight inquiry email services.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from apps.core.services.pdf_generator import generate_document_pdf_for_instance
from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers.microsoft import MicrosoftGraphProvider
from apps.tenants.rls import set_current_tenant

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InvoiceEmailResult:
    """Result of an invoice email dispatch."""

    success: bool
    invoice_id: int | None = None
    recipient_email: str = ""
    provider_message_id: str = ""
    error_message: str = ""


def _get_sender_provider(*, tenant) -> ExternalAuthProvider:
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


def _build_subject(invoice) -> str:
    """Subject line for invoice email."""
    customer_name = getattr(invoice.customer, "name", "") if invoice.customer else ""
    return f"Invoice {invoice.invoice_number}" + (f" — {customer_name}" if customer_name else "")


def _build_body(invoice, *, recipient_name: str) -> str:
    """Build the invoice email body."""
    lines: list[str] = [
        f"Hello {recipient_name},",
        "",
        f"Please find attached invoice {invoice.invoice_number}.",
        "",
    ]

    if hasattr(invoice, "total_amount") and invoice.total_amount:
        lines.append(f"Amount Due: ${invoice.total_amount:,.2f}")
    if hasattr(invoice, "due_date") and invoice.due_date:
        lines.append(f"Due Date: {invoice.due_date}")
    if invoice.sales_order:
        lines.append(f"Sales Order: {invoice.sales_order}")

    lines += [
        "",
        "Please remit payment by the due date noted above.",
        "If you have any questions regarding this invoice, please contact us.",
        "",
        "Best regards,",
        "ProjectMeats Accounting",
    ]
    return "\n".join(lines)


def _resolve_customer_billing_email(invoice) -> tuple[str, str]:
    """Return (email, name) for the customer's billing/accounting contact."""
    customer = invoice.customer
    if not customer:
        return "", ""

    # Prefer accounting/billing department contact
    for dept in ("accounting", "billing", "finance"):
        contact = customer.contacts.filter(
            department__icontains=dept, email__isnull=False,
        ).exclude(email="").first()
        if contact and contact.email:
            return contact.email, contact.name or customer.name

    # Fall back to primary contact
    contact = customer.contacts.filter(is_primary=True, email__isnull=False).exclude(email="").first()
    if contact and contact.email:
        return contact.email, contact.name or customer.name

    # Any contact with email
    contact = customer.contacts.filter(email__isnull=False).exclude(email="").first()
    if contact and contact.email:
        return contact.email, contact.name or customer.name

    return "", customer.name or ""


def send_invoice_email(
    *,
    tenant: Any,
    invoice,
    attach_pdf: bool = True,
) -> InvoiceEmailResult:
    """Send an invoice email to the customer with optional PDF attachment.

    Args:
        tenant: The active tenant.
        invoice: The Invoice instance.
        attach_pdf: Whether to generate and attach the invoice PDF.

    Returns:
        InvoiceEmailResult with dispatch outcome.
    """
    if tenant is None:
        return InvoiceEmailResult(success=False, error_message="No tenant context.")

    rls = set_current_tenant(str(tenant.id))
    if not rls.ok:
        return InvoiceEmailResult(
            success=False,
            error_message=f"RLS context error: {rls.error}",
        )

    recipient_email, recipient_name = _resolve_customer_billing_email(invoice)
    if not recipient_email:
        logger.info(
            "invoice_email.no_recipient invoice=%s",
            invoice.invoice_number,
        )
        return InvoiceEmailResult(
            success=False,
            invoice_id=invoice.id,
            error_message="No customer billing email found.",
        )

    try:
        sender_provider = _get_sender_provider(tenant=tenant)
        access_token = _get_access_token(sender_provider)
    except ValueError as exc:
        return InvoiceEmailResult(
            success=False,
            invoice_id=invoice.id,
            error_message=str(exc),
        )

    subject = _build_subject(invoice)
    body = _build_body(invoice, recipient_name=recipient_name)

    # Generate PDF attachment
    attachments = []
    if attach_pdf:
        try:
            generated = generate_document_pdf_for_instance(invoice)
            attachments.append({
                "name": generated.filename,
                "content_type": generated.content_type,
                "content_bytes": generated.content,
            })
        except Exception:
            logger.warning(
                "invoice_email.pdf_generation_failed invoice=%s — sending without attachment",
                invoice.invoice_number,
                exc_info=True,
            )

    graph = MicrosoftGraphProvider(tenant.id)
    try:
        email_params: dict = {
            "to": [recipient_email],
            "subject": subject,
            "body": body,
        }
        if attachments:
            email_params["attachments"] = attachments

        result = graph.send_email(access_token, email_params)
        logger.info(
            "invoice_email.sent invoice=%s to=%s pdf=%s",
            invoice.invoice_number,
            recipient_email,
            bool(attachments),
        )
        return InvoiceEmailResult(
            success=True,
            invoice_id=invoice.id,
            recipient_email=recipient_email,
            provider_message_id=result.get("provider_message_id", "") or "",
        )
    except Exception as exc:
        logger.exception(
            "invoice_email.failed invoice=%s",
            invoice.invoice_number,
        )
        return InvoiceEmailResult(
            success=False,
            invoice_id=invoice.id,
            recipient_email=recipient_email,
            error_message=str(exc),
        )
