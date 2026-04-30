"""Reusable DRF actions for transactional document workflows."""

from __future__ import annotations

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.serializers_documents import (
    DocumentEmailRequestSerializer,
    DocumentStatusTransitionSerializer,
)
from apps.core.services.document_workflows import get_status_workflow_payload
from apps.core.services.pdf_generator import (
    email_document_pdf,
    generate_document_pdf_for_instance,
)
from apps.tenants.email_utils import classify_email_send_exception


class OperationalDocumentActionsMixin:
    """Attach workflow, PDF, and email actions to a document viewset."""

    @action(detail=True, methods=["get"], url_path="status-workflow")
    def status_workflow(self, request, pk=None):
        document = self.get_object()
        return Response(get_status_workflow_payload(document))

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentStatusTransitionSerializer(
            data=request.data,
            context={"document": document},
        )
        serializer.is_valid(raise_exception=True)
        document.status = serializer.validated_data["status"]
        document.save(update_fields=["status"])
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
