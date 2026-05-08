"""Reusable DRF actions for transactional document workflows."""

from __future__ import annotations

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
from apps.core.utils.audit_context import AuditRequestContext, clear_audit_context, get_audit_context, set_audit_context
from apps.tenants.email_utils import classify_email_send_exception


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
                transition_response = self.perform_document_status_transition(
                    request,
                    document,
                    serializer.validated_data["status"],
                )
                if transition_response is not None:
                    return transition_response
        return Response(self.get_serializer(document).data)

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
