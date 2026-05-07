"""Approved sales-order PDF generation + outbound customer email orchestration."""

from __future__ import annotations

import base64
import hashlib
import logging
from dataclasses import dataclass

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.core.services.pdf_generator import generate_document_pdf_for_instance
from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers.base import EmailProviderError, TokenExpiredError
from apps.integrations.providers.microsoft import MicrosoftGraphProvider
from apps.tenants.rls import set_current_tenant
from tenant_apps.sales_orders.models import (
    SalesOrder,
    SalesOrderApprovalDispatch,
    SalesOrderApprovalDispatchStatus,
    SalesOrderStatus,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SalesOrderApprovalDispatchResult:
    success: bool
    error_message: str = ""
    error_code: str = ""
    http_status: int = status.HTTP_200_OK


def approve_sales_order_and_send_to_customer(
    *,
    tenant,
    sales_order: SalesOrder,
    user=None,
) -> SalesOrderApprovalDispatchResult:
    """Generate the immutable approved PDF once and send it to the customer via Outlook."""

    if tenant is None:
        return SalesOrderApprovalDispatchResult(
            success=False,
            error_message="Tenant context is required for sales order approval.",
            error_code="missing_tenant",
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    if sales_order is None or sales_order.tenant_id != tenant.id:
        return SalesOrderApprovalDispatchResult(
            success=False,
            error_message="Sales order is not available for the active tenant.",
            error_code="invalid_sales_order",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    rls = set_current_tenant(str(tenant.id))
    if not rls.ok:
        return SalesOrderApprovalDispatchResult(
            success=False,
            error_message=f"Unable to set tenant RLS context: {rls.error}",
            error_code="tenant_rls_error",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    with transaction.atomic():
        locked_sales_order = (
            SalesOrder.objects.select_for_update(of=("self",))
            .select_related("customer", "supplier", "contact")
            .get(pk=sales_order.pk, tenant=tenant)
        )
        dispatch = (
            SalesOrderApprovalDispatch.objects.select_for_update()
            .filter(tenant=tenant, sales_order=locked_sales_order)
            .first()
        )
        if dispatch is None:
            dispatch = SalesOrderApprovalDispatch.objects.create(
                tenant=tenant,
                sales_order=locked_sales_order,
                approved_by=user,
                status=SalesOrderApprovalDispatchStatus.PENDING,
            )

        # Already sent — idempotent
        if dispatch.status == SalesOrderApprovalDispatchStatus.SENT and dispatch.approved_pdf:
            _mark_sales_order_approved(locked_sales_order, dispatch=dispatch)
            return SalesOrderApprovalDispatchResult(success=True)

        # In-flight — conflict
        if dispatch.status == SalesOrderApprovalDispatchStatus.SENDING:
            return SalesOrderApprovalDispatchResult(
                success=False,
                error_message="Approval dispatch is already in progress.",
                error_code="dispatch_in_progress",
                http_status=status.HTTP_409_CONFLICT,
            )

        # Resolve email provider
        try:
            provider = _get_sender_provider(tenant=tenant)
            access_token = _get_access_token(provider)
        except ValueError as exc:
            return _record_failure(
                dispatch,
                message=str(exc),
                code="provider_error",
                http_status=status.HTTP_502_BAD_GATEWAY,
            )

        # Resolve recipient (customer)
        recipient_email, recipient_name = _resolve_recipient(locked_sales_order)
        if not recipient_email:
            return _record_failure(
                dispatch,
                message="No recipient email found for this customer.",
                code="no_recipient",
                http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Generate PDF
        try:
            pdf_filename, pdf_content = _ensure_pdf(
                dispatch=dispatch, sales_order=locked_sales_order
            )
        except Exception as exc:
            return _record_failure(
                dispatch,
                message=f"PDF generation failed: {str(exc)}",
                code="pdf_generation_error",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Build email
        subject = _build_subject(locked_sales_order)
        body = _build_body(sales_order=locked_sales_order, recipient_name=recipient_name)

        # Mark as sending
        dispatch.status = SalesOrderApprovalDispatchStatus.SENDING
        dispatch.sender_provider_id = getattr(provider, "pk", None)
        dispatch.sender_email = getattr(provider, "connected_email", "") or ""
        dispatch.recipient_email = recipient_email
        dispatch.recipient_name = recipient_name
        dispatch.subject = subject
        dispatch.body = body
        dispatch.approved_at = dispatch.approved_at or timezone.now()
        dispatch.attempt_count += 1
        dispatch.last_attempted_at = timezone.now()
        dispatch.save()

        # Send email
        try:
            graph = MicrosoftGraphProvider(access_token=access_token)
            send_result = graph.send_email(
                to_email=recipient_email,
                subject=subject,
                body=body,
                attachments=[
                    {
                        "name": pdf_filename,
                        "content_type": "application/pdf",
                        "content_bytes": base64.b64encode(pdf_content).decode("utf-8"),
                    }
                ],
            )
        except (EmailProviderError, TokenExpiredError) as exc:
            return _record_failure(
                dispatch,
                message=f"Email send failed: {str(exc)}",
                code="email_send_error",
                http_status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            return _record_failure(
                dispatch,
                message=f"Unexpected error sending email: {str(exc)}",
                code="unexpected_send_error",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Mark sent
        dispatch.status = SalesOrderApprovalDispatchStatus.SENT
        dispatch.sent_at = timezone.now()
        dispatch.provider_message_id = getattr(send_result, "message_id", "") or ""
        dispatch.provider_thread_id = getattr(send_result, "thread_id", "") or ""
        dispatch.provider_internet_message_id = (
            getattr(send_result, "internet_message_id", "") or ""
        )
        dispatch.save()

        _mark_sales_order_approved(locked_sales_order, dispatch=dispatch)

        logger.info(
            "Telemetry: sales_order.approved_and_sent",
            extra={
                "event_type": "sales_order.approved_and_sent",
                "tenant_id": str(tenant.id),
                "sales_order_id": str(locked_sales_order.id),
                "sales_order_number": locked_sales_order.our_sales_order_num,
                "recipient_email": recipient_email,
                "timestamp": timezone.now().isoformat(),
            },
        )

        return SalesOrderApprovalDispatchResult(success=True)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


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


def _resolve_recipient(sales_order: SalesOrder) -> tuple[str, str]:
    """Resolve customer email from contact or customer record."""
    # Try contact first
    if sales_order.contact:
        contact_email = getattr(sales_order.contact, "email", "") or ""
        if contact_email.strip():
            contact_name = getattr(sales_order.contact, "name", "") or sales_order.customer.name
            return contact_email.strip(), contact_name

    # Try customer record
    customer = sales_order.customer
    if customer:
        customer_email = getattr(customer, "email", "") or ""
        if customer_email.strip():
            return customer_email.strip(), customer.name or ""

        # Try customer contacts
        contact = getattr(customer, "contacts", customer.__class__.objects.none())
        if hasattr(contact, "order_by"):
            first_contact = contact.order_by("id").first()
            if first_contact:
                email = getattr(first_contact, "email", "") or ""
                if email.strip():
                    name = getattr(first_contact, "name", "") or customer.name
                    return email.strip(), name

    return "", ""


def _build_subject(sales_order: SalesOrder) -> str:
    ref = (
        sales_order.our_sales_order_number_for_customer
        or sales_order.our_sales_order_num
        or f"SO-{sales_order.pk}"
    )
    return f"Sales Order {ref}"


def _build_body(*, sales_order: SalesOrder, recipient_name: str) -> str:
    greeting = recipient_name or (sales_order.customer.name if sales_order.customer else "Customer")
    return "\n".join(
        [
            f"Hello {greeting},",
            "",
            f"Please find attached your sales order {sales_order.our_sales_order_number_for_customer or sales_order.our_sales_order_num}.",
            "If you have any questions about this order, please reply to this email.",
            "",
            "Thank you for your business,",
            "ProjectMeats",
        ]
    )


def _ensure_pdf(
    *,
    dispatch: SalesOrderApprovalDispatch,
    sales_order: SalesOrder,
) -> tuple[str, bytes]:
    """Generate or retrieve the approved SO PDF."""
    if dispatch.approved_pdf:
        try:
            existing = dispatch.approved_pdf.read()
        except (FileNotFoundError, OSError):
            existing = b""
        if existing:
            if not dispatch.approved_pdf_checksum or not dispatch.approved_pdf_byte_size:
                dispatch.approved_pdf_checksum = hashlib.sha256(existing).hexdigest()
                dispatch.approved_pdf_byte_size = len(existing)
                dispatch.save(update_fields=["approved_pdf_checksum", "approved_pdf_byte_size", "modified_on"])
            return dispatch.approved_pdf.name.rsplit("/", 1)[-1], existing

    generated_at = dispatch.pdf_generated_at or dispatch.approved_at or timezone.now()
    dispatch.pdf_generated_at = generated_at
    original_status = sales_order.status
    sales_order.status = SalesOrderStatus.APPROVED
    try:
        generated = generate_document_pdf_for_instance(sales_order, generated_at=generated_at)
    finally:
        sales_order.status = original_status

    dispatch.approved_pdf.save(generated.filename, ContentFile(generated.content), save=False)
    dispatch.approved_pdf_checksum = hashlib.sha256(generated.content).hexdigest()
    dispatch.approved_pdf_byte_size = len(generated.content)
    return generated.filename, generated.content


def _mark_sales_order_approved(
    sales_order: SalesOrder,
    *,
    dispatch: SalesOrderApprovalDispatch,
) -> None:
    """Transition SO to approved and record dispatch linkage."""
    update_fields: list[str] = []
    if sales_order.status != SalesOrderStatus.APPROVED:
        sales_order.status = SalesOrderStatus.APPROVED
        update_fields.append("status")

    custom_data = dict(sales_order.custom_data or {})
    if custom_data.get("review_state") != "approved":
        custom_data["review_state"] = "approved"
        custom_data["approval_dispatch_id"] = dispatch.id
        sales_order.custom_data = custom_data
        update_fields.append("custom_data")

    if hasattr(sales_order, "modified_on"):
        sales_order.modified_on = timezone.now()
        update_fields.append("modified_on")

    if update_fields:
        sales_order.save(update_fields=update_fields)


def _record_failure(
    dispatch: SalesOrderApprovalDispatch,
    *,
    message: str,
    code: str,
    http_status: int,
) -> SalesOrderApprovalDispatchResult:
    dispatch.status = SalesOrderApprovalDispatchStatus.FAILED
    dispatch.error_message = message
    dispatch.custom_data = {
        **(dispatch.custom_data or {}),
        "last_error": {"code": code, "message": message},
    }
    dispatch.save(update_fields=["status", "error_message", "custom_data", "modified_on"])
    return SalesOrderApprovalDispatchResult(
        success=False,
        error_message=message,
        error_code=code,
        http_status=http_status,
    )
