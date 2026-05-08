"""Approved supplier purchase-order PDF generation + outbound email orchestration."""

from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from tenant_apps.inquiries.models import InquirySupplierRFQ
from tenant_apps.purchase_orders.models import (
    PurchaseOrder,
    PurchaseOrderApprovalDispatch,
    PurchaseOrderApprovalDispatchStatus,
    PurchaseOrderStatus,
)

from apps.core.services.pdf_generator import generate_document_pdf_for_instance
from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers.base import EmailProviderError, TokenExpiredError
from apps.integrations.providers.microsoft import MicrosoftGraphProvider
from apps.tenants.rls import set_current_tenant


@dataclass(frozen=True)
class PurchaseOrderApprovalDispatchResult:
    success: bool
    error_message: str = ""
    error_code: str = ""
    http_status: int = status.HTTP_200_OK


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
    except Exception as exc:  # pragma: no cover - exercised through service failure tests
        raise ValueError("Unable to decrypt the Outlook access token.") from exc
    if not token:
        raise ValueError("Outlook access token is missing for this tenant.")
    return token


def _primary_reference(purchase_order: PurchaseOrder) -> str:
    return (
        purchase_order.our_purchase_order_number_to_supplier
        or purchase_order.our_purchase_order_num
        or purchase_order.order_number
        or f"PO-{purchase_order.pk}"
    )


def _build_subject(purchase_order: PurchaseOrder) -> str:
    return f"Approved Purchase Order {_primary_reference(purchase_order)}"


def _build_body(*, purchase_order: PurchaseOrder, recipient_name: str) -> str:
    greeting = recipient_name or purchase_order.supplier.name or "supplier"
    return "\n".join(
        [
            f"Hello {greeting},",
            "",
            f"Please find attached the approved purchase order {_primary_reference(purchase_order)}.",
            "Reply to this message if you need any clarification before fulfillment.",
            "",
            "Thank you,",
            "ProjectMeats",
        ]
    )


def _resolve_rfq(purchase_order: PurchaseOrder):
    lineage = (purchase_order.custom_data or {}).get("source_lineage") or {}
    rfq_id = lineage.get("rfq_id")
    queryset = InquirySupplierRFQ.objects.filter(
        tenant=purchase_order.tenant,
        supplier_id=purchase_order.supplier_id,
        inquiry__supplier_purchase_order=purchase_order,
    )
    if rfq_id:
        queryset = queryset.filter(id=rfq_id)
    return queryset.order_by("-created_on").first()


def _resolve_recipient(purchase_order: PurchaseOrder) -> tuple[str, str]:
    rfq = _resolve_rfq(purchase_order)
    if rfq and rfq.recipient_email:
        return rfq.recipient_email, rfq.recipient_name or purchase_order.supplier.name

    if purchase_order.supplier_contact_email:
        return (
            purchase_order.supplier_contact_email,
            purchase_order.supplier_contact_name or purchase_order.supplier.name,
        )

    supplier_email = str(getattr(purchase_order.supplier, "email", "") or "").strip()
    if supplier_email:
        return supplier_email, purchase_order.supplier.name

    contact = purchase_order.supplier.contacts.order_by("id").first()
    contact_email = str(getattr(contact, "email", "") or "").strip()
    if contact_email:
        contact_name = str(getattr(contact, "name", "") or "").strip() or purchase_order.supplier.name
        return contact_email, contact_name

    return "", ""


def _record_failure(
    dispatch: PurchaseOrderApprovalDispatch,
    *,
    message: str,
    code: str,
    http_status: int,
) -> PurchaseOrderApprovalDispatchResult:
    dispatch.status = PurchaseOrderApprovalDispatchStatus.FAILED
    dispatch.error_message = message
    dispatch.custom_data = {
        **(dispatch.custom_data or {}),
        "last_error": {
            "code": code,
            "message": message,
        },
    }
    dispatch.save(update_fields=["status", "error_message", "custom_data", "modified_on"])
    return PurchaseOrderApprovalDispatchResult(
        success=False,
        error_message=message,
        error_code=code,
        http_status=http_status,
    )


def _ensure_pdf(
    *,
    dispatch: PurchaseOrderApprovalDispatch,
    purchase_order: PurchaseOrder,
) -> tuple[str, bytes]:
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
    original_status = purchase_order.status
    purchase_order.status = PurchaseOrderStatus.APPROVED
    try:
        generated = generate_document_pdf_for_instance(purchase_order, generated_at=generated_at)
    finally:
        purchase_order.status = original_status

    dispatch.approved_pdf.save(generated.filename, ContentFile(generated.content), save=False)
    dispatch.approved_pdf_checksum = hashlib.sha256(generated.content).hexdigest()
    dispatch.approved_pdf_byte_size = len(generated.content)
    return generated.filename, generated.content


def _mark_purchase_order_approved(
    purchase_order: PurchaseOrder,
    *,
    dispatch: PurchaseOrderApprovalDispatch,
) -> None:
    update_fields: list[str] = []
    if purchase_order.status != PurchaseOrderStatus.APPROVED:
        purchase_order.status = PurchaseOrderStatus.APPROVED
        update_fields.append("status")

    custom_data = dict(purchase_order.custom_data or {})
    if custom_data.get("review_state") != "approved":
        custom_data["review_state"] = "approved"
        custom_data["approval_dispatch_id"] = dispatch.id
        purchase_order.custom_data = custom_data
        update_fields.append("custom_data")

    if hasattr(purchase_order, "modified_on"):
        purchase_order.modified_on = timezone.now()
        update_fields.append("modified_on")

    if update_fields:
        purchase_order.save(update_fields=update_fields)


def approve_purchase_order_and_send_to_supplier(
    *,
    tenant,
    purchase_order: PurchaseOrder,
    user=None,
) -> PurchaseOrderApprovalDispatchResult:
    """Generate the immutable approved PDF once and send it via Outlook exactly once."""

    if tenant is None:
        return PurchaseOrderApprovalDispatchResult(
            success=False,
            error_message="Tenant context is required for supplier PO approval.",
            error_code="missing_tenant",
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    if purchase_order is None or purchase_order.tenant_id != tenant.id:
        return PurchaseOrderApprovalDispatchResult(
            success=False,
            error_message="Purchase order is not available for the active tenant.",
            error_code="invalid_purchase_order",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    rls = set_current_tenant(str(tenant.id))
    if not rls.ok:
        return PurchaseOrderApprovalDispatchResult(
            success=False,
            error_message=f"Unable to set tenant RLS context: {rls.error}",
            error_code="tenant_rls_error",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    with transaction.atomic():
        locked_purchase_order = (
            PurchaseOrder.objects.select_for_update()
            .select_related("supplier")
            .get(pk=purchase_order.pk, tenant=tenant)
        )
        dispatch = (
            PurchaseOrderApprovalDispatch.objects.select_for_update()
            .filter(tenant=tenant, purchase_order=locked_purchase_order)
            .first()
        )
        if dispatch is None:
            dispatch = PurchaseOrderApprovalDispatch.objects.create(
                tenant=tenant,
                purchase_order=locked_purchase_order,
                approved_by=user,
                status=PurchaseOrderApprovalDispatchStatus.PENDING,
            )

        if dispatch.status == PurchaseOrderApprovalDispatchStatus.SENT and dispatch.approved_pdf:
            _mark_purchase_order_approved(locked_purchase_order, dispatch=dispatch)
            return PurchaseOrderApprovalDispatchResult(success=True)

        if dispatch.status == PurchaseOrderApprovalDispatchStatus.SENDING:
            return PurchaseOrderApprovalDispatchResult(
                success=False,
                error_message="Approval dispatch is already in progress or awaiting reconciliation.",
                error_code="dispatch_in_progress",
                http_status=status.HTTP_409_CONFLICT,
            )

        recipient_email, recipient_name = _resolve_recipient(locked_purchase_order)
        if not recipient_email:
            return _record_failure(
                dispatch,
                message="Supplier email is required before approving this purchase order.",
                code="missing_supplier_email",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sender_provider = _get_sender_provider(tenant=tenant)
            access_token = _get_access_token(sender_provider)
        except ValueError as exc:
            return _record_failure(
                dispatch,
                message=str(exc),
                code="outlook_not_ready",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        dispatch.approved_by = user or dispatch.approved_by
        dispatch.sender_provider = sender_provider
        dispatch.sender_email = sender_provider.connected_email or dispatch.sender_email
        dispatch.recipient_email = recipient_email
        dispatch.recipient_name = recipient_name
        dispatch.subject = _build_subject(locked_purchase_order)
        dispatch.body = _build_body(purchase_order=locked_purchase_order, recipient_name=recipient_name)
        dispatch.provider = sender_provider.provider_type
        dispatch.approved_at = dispatch.approved_at or timezone.now()
        dispatch.attempt_count += 1
        dispatch.last_attempted_at = timezone.now()
        dispatch.status = PurchaseOrderApprovalDispatchStatus.SENDING
        dispatch.error_message = ""

        filename, pdf_bytes = _ensure_pdf(dispatch=dispatch, purchase_order=locked_purchase_order)
        dispatch.save(
            update_fields=[
                "approved_by",
                "sender_provider",
                "sender_email",
                "recipient_email",
                "recipient_name",
                "subject",
                "body",
                "provider",
                "approved_at",
                "attempt_count",
                "last_attempted_at",
                "status",
                "error_message",
                "pdf_generated_at",
                "approved_pdf",
                "approved_pdf_checksum",
                "approved_pdf_byte_size",
                "modified_on",
            ]
        )

    graph = MicrosoftGraphProvider(tenant.id)
    try:
        provider_result = graph.send_email(
            access_token,
            {
                "to": [dispatch.recipient_email],
                "subject": dispatch.subject,
                "body": dispatch.body,
                "reply_to": dispatch.sender_email,
                "headers": {
                    "X-ProjectMeats-Purchase-Order": str(purchase_order.id),
                    "X-ProjectMeats-Purchase-Order-Dispatch": str(dispatch.id),
                },
                "attachments": [
                    {
                        "name": filename,
                        "content_base64": base64.b64encode(pdf_bytes).decode("ascii"),
                        "content_type": "application/pdf",
                    }
                ],
            },
        )
    except (EmailProviderError, TokenExpiredError, ValueError) as exc:
        with transaction.atomic():
            dispatch = PurchaseOrderApprovalDispatch.objects.select_for_update().get(pk=dispatch.pk, tenant=tenant)
            return _record_failure(
                dispatch,
                message=str(exc),
                code="dispatch_failed",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

    with transaction.atomic():
        locked_purchase_order = PurchaseOrder.objects.select_for_update().get(pk=purchase_order.pk, tenant=tenant)
        dispatch = PurchaseOrderApprovalDispatch.objects.select_for_update().get(pk=dispatch.pk, tenant=tenant)
        if dispatch.status == PurchaseOrderApprovalDispatchStatus.SENT and dispatch.provider_message_id:
            _mark_purchase_order_approved(locked_purchase_order, dispatch=dispatch)
            return PurchaseOrderApprovalDispatchResult(success=True)

        dispatch.status = PurchaseOrderApprovalDispatchStatus.SENT
        dispatch.sent_at = timezone.now()
        dispatch.provider_message_id = provider_result.get("provider_message_id", "")
        dispatch.provider_thread_id = provider_result.get("provider_thread_id", "")
        dispatch.provider_internet_message_id = provider_result.get("provider_internet_message_id", "")
        dispatch.error_message = ""
        dispatch.custom_data = {
            **(dispatch.custom_data or {}),
            "provider_result": provider_result,
        }
        dispatch.save(
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
        _mark_purchase_order_approved(locked_purchase_order, dispatch=dispatch)
    return PurchaseOrderApprovalDispatchResult(success=True)
