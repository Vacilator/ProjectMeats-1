"""Reusable DRF actions for transactional document workflows."""

from __future__ import annotations

import logging
from contextlib import contextmanager

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.serializers_documents import DocumentEmailRequestSerializer, DocumentStatusTransitionSerializer
from apps.core.services.document_workflows import get_status_workflow_payload
from apps.core.services.pdf_generator import email_document_pdf, generate_document_pdf_for_instance
from apps.core.services.workflow_cascade import CascadeResult, attempt_cascade
from apps.core.utils.audit_context import AuditRequestContext, clear_audit_context, get_audit_context, set_audit_context
from apps.tenants.email_utils import classify_email_send_exception

logger = logging.getLogger(__name__)


@contextmanager
def _request_audit_context(request):
    previous_context = get_audit_context()
    set_audit_context(
        AuditRequestContext(
            tenant=getattr(request, "tenant", None) or previous_context.tenant,
            user=getattr(request, "user", None),
            ip_address=previous_context.ip_address,
            user_agent=previous_context.user_agent or (request.META.get("HTTP_USER_AGENT") or "")[:500],
        )
    )
    try:
        yield
    finally:
        if previous_context == AuditRequestContext():
            clear_audit_context()
        else:
            set_audit_context(previous_context)


class OperationalDocumentActionsMixin:
    """Attach workflow, PDF, and email actions to a document viewset."""

    def perform_document_status_transition(self, request, document, next_status):
        document.status = next_status
        update_fields = ["status"]
        if hasattr(document, "modified_on"):
            document.modified_on = timezone.now()
            update_fields.append("modified_on")
        document.save(update_fields=update_fields)
        return None

    @action(detail=True, methods=["get"], url_path="status-workflow")
    def status_workflow(self, request, pk=None):
        document = self.get_object()
        return Response(get_status_workflow_payload(document))

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        with _request_audit_context(request):
            with transaction.atomic():
                queryset = self.filter_queryset(self.get_queryset()).select_for_update(of=("self",))
                document = get_object_or_404(queryset, pk=pk)
                self.check_object_permissions(request, document)
                serializer = DocumentStatusTransitionSerializer(
                    data=request.data,
                    context={"document": document},
                )
                serializer.is_valid(raise_exception=True)
                next_status = serializer.validated_data["status"]
                transition_response = self.perform_document_status_transition(
                    request,
                    document,
                    next_status,
                )
                if transition_response is not None:
                    return transition_response

        # Attempt downstream cascade (best-effort, outside the transition txn)
        cascade = attempt_cascade(
            tenant=getattr(request, "tenant", None),
            document=document,
            new_status=next_status,
        )
        response_data = self.get_serializer(document).data
        if cascade.triggered:
            response_data["_cascade"] = _serialize_cascade(cascade)
        return Response(response_data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        document = self.get_object()
        generated = generate_document_pdf_for_instance(document)
        response = HttpResponse(generated.content, content_type=generated.content_type)
        response["Content-Disposition"] = f'attachment; filename="{generated.filename}"'
        return response

    @action(detail=True, methods=["post"], url_path="email")
    def email_document(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentEmailRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            generated = email_document_pdf(
                document,
                to=serializer.validated_data["to"],
                subject=serializer.validated_data["subject"],
                body=serializer.validated_data["body"],
            )
        except Exception as exc:
            classified = classify_email_send_exception(exc)
            return Response(
                {
                    "error": classified["message"],
                    "code": classified["error_code"],
                    "details": {"type": exc.__class__.__name__},
                },
                status=classified["http_status"],
            )
        return Response(
            {
                "message": "Document emailed successfully.",
                "filename": generated.filename,
                "recipients": serializer.validated_data["to"],
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="audit-trail")
    def audit_trail(self, request, pk=None):
        """Synthesize an audit trail from entity timestamps, trade documents, and cascade lineage."""
        document = self.get_object()
        tenant = getattr(request, "tenant", None)
        events = _build_audit_trail(document, tenant)
        return Response(events)


def _serialize_cascade(cascade: CascadeResult) -> dict:
    """Serialize a CascadeResult for the API response."""
    result: dict = {
        "triggered": cascade.triggered,
        "created_entity_type": cascade.created_entity_type,
        "created_entity_id": cascade.created_entity_id,
        "created_entity_label": cascade.created_entity_label,
        "already_existed": cascade.already_existed,
    }
    if cascade.error:
        result["error"] = cascade.error
    if cascade.details:
        result["details"] = cascade.details
    return result


def _build_audit_trail(document, tenant) -> list[dict]:
    """Build a synthesized audit trail for any trade entity.

    Combines:
    1. Entity lifecycle events (creation, last modification)
    2. Trade documents linked to this entity
    3. Django admin log entries (if any)

    Returns a list of event dicts sorted newest-first.
    """
    events: list[dict] = []
    model_name = document.__class__.__name__
    entity_type = getattr(document, "_meta", None)
    entity_label = model_name
    if entity_type:
        entity_label = entity_type.verbose_name or model_name

    # 1. Entity creation event
    created_at = getattr(document, "created_on", None) or getattr(document, "created_at", None)
    if created_at:
        events.append({
            "id": f"created-{document.pk}",
            "action": "created",
            "description": f"{entity_label} was created",
            "status": getattr(document, "status", None),
            "from_status": None,
            "to_status": getattr(document, "status", None),
            "actor_email": None,
            "actor_name": "System",
            "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        })

    # 2. Entity last modification (if different from creation)
    modified_at = getattr(document, "modified_on", None) or getattr(document, "updated_at", None)
    if modified_at and created_at and modified_at != created_at:
        diff_seconds = abs((modified_at - created_at).total_seconds()) if hasattr(modified_at, "__sub__") else 0
        if diff_seconds > 5:
            events.append({
                "id": f"modified-{document.pk}",
                "action": "updated",
                "description": f"{entity_label} was last modified",
                "status": getattr(document, "status", None),
                "from_status": None,
                "to_status": None,
                "actor_email": None,
                "actor_name": None,
                "created_at": modified_at.isoformat() if hasattr(modified_at, "isoformat") else str(modified_at),
            })

    # 3. Trade documents linked to this entity
    if tenant:
        try:
            from tenant_apps.inquiries.models import TradeDocument

            trade_docs = TradeDocument.objects.filter(
                tenant=tenant,
                entity_type=_normalize_entity_type(model_name),
                entity_id=document.pk,
            ).order_by("-created_on")[:20]

            for td in trade_docs:
                direction_label = "sent" if td.direction == "sent" else "received"
                events.append({
                    "id": f"doc-{td.pk}",
                    "action": f"document_{direction_label}",
                    "description": f"{td.title} ({td.get_document_type_display() if hasattr(td, 'get_document_type_display') else td.document_type})",
                    "status": None,
                    "from_status": None,
                    "to_status": None,
                    "actor_email": td.email_sender,
                    "actor_name": td.email_sender.split("@")[0] if td.email_sender else (td.generated_by or "System"),
                    "created_at": td.created_on.isoformat() if td.created_on else None,
                })
        except Exception:
            logger.debug("Could not fetch trade documents for audit trail", exc_info=True)

    # 4. Django admin LogEntry (captures admin-panel edits)
    try:
        from django.contrib.admin.models import LogEntry
        from django.contrib.contenttypes.models import ContentType

        ct = ContentType.objects.get_for_model(document.__class__)
        log_entries = (
            LogEntry.objects.filter(content_type=ct, object_id=str(document.pk))
            .select_related("user")
            .order_by("-action_time")[:10]
        )
        action_labels = {1: "added", 2: "changed", 3: "deleted"}
        for entry in log_entries:
            events.append({
                "id": f"admin-{entry.pk}",
                "action": action_labels.get(entry.action_flag, "admin_action"),
                "description": entry.get_change_message() or f"Admin {action_labels.get(entry.action_flag, 'action')}",
                "status": None,
                "from_status": None,
                "to_status": None,
                "actor_email": getattr(entry.user, "email", None),
                "actor_name": entry.user.get_full_name() or entry.user.username if entry.user else None,
                "created_at": entry.action_time.isoformat(),
            })
    except Exception:
        logger.debug("Could not fetch admin log entries for audit trail", exc_info=True)

    # Sort newest first
    events.sort(key=lambda e: e.get("created_at") or "", reverse=True)
    return events


def _normalize_entity_type(model_name: str) -> str:
    """Map Django model class names to TradeDocument entity_type values."""
    mapping = {
        "Inquiry": "inquiry",
        "PurchaseOrder": "purchase_order",
        "SalesOrder": "sales_order",
        "CarrierPurchaseOrder": "carrier_po",
        "Fulfillment": "fulfillment",
        "Invoice": "invoice",
    }
    return mapping.get(model_name, model_name.lower())
