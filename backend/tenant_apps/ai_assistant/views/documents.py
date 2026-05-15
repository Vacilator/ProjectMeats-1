"""Document views for AI Assistant.

Provides viewsets for uploading and managing AI documents, and an endpoint
for extracting structured data from uploaded documents using AI.
"""
import logging
import uuid

from django.db import DatabaseError, ProgrammingError, connection, transaction
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

from apps.core.services.idempotency import (
    get_idempotency_key,
    release_idempotency_key,
    reserve_idempotency_key,
    store_idempotency_response,
)

from ..models import (
    AIDocument,
    ChatMessage,
    MessageTypeChoices,
)
from ..serializers import (
    AIDocumentSerializer,
    ExtractToSchemaRequestSerializer,
    ExtractToSchemaResponseSerializer,
)
from ..services.extract_to_schema import ExtractToSchemaError, extract_document_to_schema, get_extract_document
from ..session_utils import get_request_tenant_id
from ._base import ai_not_configured_response

logger = logging.getLogger(__name__)

from rest_framework.parsers import FormParser, MultiPartParser


class AIDocumentViewSet(viewsets.ModelViewSet):
    """Tenant-scoped viewset for uploading and listing AI documents.

    Supports file uploads with idempotency, RLS assertion, and automatic
    lineage tracking. Documents can be filtered by source, session, and
    processing status.
    """

    serializer_class = AIDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_on"]
    ordering = ["-created_on"]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        qs = AIDocument.objects.all().select_related("tenant", "owner", "session")
        qs = qs.filter(owner=self.request.user)
        if not tenant:
            return qs.none()
        qs = qs.filter(tenant=tenant)

        source = str(self.request.query_params.get("source") or "").strip()
        if source:
            qs = qs.filter(custom_data__source=source)

        session_id = str(self.request.query_params.get("session") or "").strip()
        if session_id:
            try:
                session_uuid = uuid.UUID(session_id)
            except ValueError:
                return qs.none()
            qs = qs.filter(session_id=session_uuid)

        processing_status = str(self.request.query_params.get("processing_status") or "").strip()
        if processing_status:
            allowed_statuses = {"pending", "processing", "completed", "failed"}
            if processing_status not in allowed_statuses:
                return qs.none()
            qs = qs.filter(processing_status=processing_status)

        return qs

    def create(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            raise ValidationError("Tenant context required.")

        tenant_id = str(getattr(tenant, "id", "") or "")
        if tenant_id and connection.vendor == "postgresql":
            from apps.tenants.rls import set_current_tenant

            rls = set_current_tenant(tenant_id)
            if not rls.ok:
                logger.warning(
                    "AIDocument upload: failed to assert RLS session vars tenant=%s err=%s",
                    tenant_id,
                    rls.error,
                    exc_info=True,
                )
                raise ValidationError("Tenant context unavailable.")

        reservation = None
        idempotency_key = get_idempotency_key(request)
        if idempotency_key:
            reservation = reserve_idempotency_key(
                tenant=tenant,
                idempotency_key=idempotency_key,
                method=request.method,
                path=request.path,
                payload=request.data,
                actor=request.user,
            )
            if reservation.response is not None:
                return reservation.response

        serializer = self.get_serializer(data=request.data)
        instance = None
        try:
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = self.perform_create(serializer)
                response_data = self.get_serializer(instance).data
                headers = self.get_success_headers(response_data)
                if reservation and reservation.record is not None:
                    store_idempotency_response(
                        record=reservation.record,
                        response=Response(response_data, status=status.HTTP_201_CREATED),
                    )
        except Exception:
            if instance is not None and getattr(instance, "file", None):
                file_name = getattr(instance.file, "name", "")
                if file_name:
                    instance.file.storage.delete(file_name)
            if reservation and reservation.record is not None:
                release_idempotency_key(record=reservation.record)
            raise

        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise ValidationError("Tenant context required.")

        tenant_id = str(getattr(tenant, "id", "") or "")

        try:
            from apps.tenants.rls import set_current_tenant

            # Defense-in-depth: assert RLS vars on the active connection inside the write transaction.
            if tenant_id:
                rls = set_current_tenant(tenant_id)
                if not rls.ok:
                    logger.warning(
                        "AIDocument upload: failed to assert RLS session vars tenant=%s err=%s",
                        tenant_id,
                        rls.error,
                        exc_info=True,
                    )

            instance = serializer.save(
                tenant=tenant,
                owner=self.request.user,
                original_filename=getattr(self.request.FILES.get("file"), "name", ""),
                content_type=getattr(self.request.FILES.get("file"), "content_type", "") or "",
                file_size=getattr(self.request.FILES.get("file"), "size", 0) or 0,
                custom_data={
                    "source": "manual_upload",
                    "uploaded_at": timezone.now().isoformat(),
                    "semantic_indexing": {
                        "status": "pending",
                        "mode": "awaiting_parse",
                        "detail": "Document uploaded; semantic indexing will run after parse.",
                    },
                },
            )
        except ValidationError:
            raise
        except OSError as e:
            logger.error("AIDocument upload: storage error: %s", str(e), exc_info=True)
            raise ValidationError("Upload failed: storage is not writable. Please contact an administrator.")
        except (DatabaseError, ProgrammingError) as e:
            msg = str(e)
            lower = msg.lower()
            logger.error("AIDocument upload: database error: %s", msg, exc_info=True)

            if "does not exist" in lower and "ai_assistant_documents" in lower:
                raise ValidationError(
                    "Upload failed: documents table is not ready (migrations not applied). Please contact an administrator."
                )

            if "row-level security" in lower or "rls" in lower:
                raise ValidationError(
                    "Upload failed: tenant context could not be asserted for RLS. Please reload and retry."
                )

            raise ValidationError("Upload failed: database error. Please retry in a moment.")
        except Exception as e:
            # Broad catch: unexpected errors during document save must be logged and
            # converted to a user-friendly ValidationError
            logger.error("AIDocument upload: unexpected error: %s (type=%s)", str(e), type(e).__name__, exc_info=True)
            raise ValidationError("Upload failed: unexpected error. Please retry.")

        # If the upload was tied to a session, also create a DOCUMENT message so UIs can show it inline.
        try:
            from tenant_apps.ai_assistant.services.lineage import create_lineage_event

            create_lineage_event(
                tenant=instance.tenant,
                document=instance,
                event_type="document_uploaded",
                source_type="manual_upload",
                source_id=str(instance.id),
                target_type="document",
                target_id=str(instance.id),
                summary="Document uploaded for AI processing.",
                metadata={"source": "manual_upload"},
            )
        except Exception:
            # Lineage recording is non-critical; must not block the upload
            logger.warning("AIDocument upload: failed to record lineage for document=%s", instance.id, exc_info=True)

        # If the upload was tied to a session, also create a DOCUMENT message so UIs can show it inline.
        if instance.session_id:
            try:
                ChatMessage.objects.create(
                    session=instance.session,
                    tenant=instance.tenant,
                    message_type=MessageTypeChoices.DOCUMENT,
                    content=instance.original_filename or "Document uploaded",
                    metadata={
                        "document_id": str(instance.id),
                        "original_filename": instance.original_filename,
                        "file_url": getattr(instance.file, "url", ""),
                        "content_type": instance.content_type,
                        "file_size": instance.file_size,
                        "source_metadata": dict(getattr(instance, "custom_data", {}) or {}),
                    },
                    owner=self.request.user,
                    created_by=self.request.user,
                    modified_by=self.request.user,
                )
            except Exception:
                file_name = getattr(instance.file, "name", "")
                if file_name:
                    instance.file.storage.delete(file_name)
                raise

        return instance


class ExtractToSchemaAPIView(APIView):
    """Extract a strict serializer-backed draft payload from an uploaded AI document.

    Uses AI to parse document content and map it to a canonical entity schema.
    Supports entity types such as purchase_order, invoice, contact, etc.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = "ai_chat"

    @extend_schema(
        request=ExtractToSchemaRequestSerializer,
        responses={
            200: ExtractToSchemaResponseSerializer,
            400: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
            503: OpenApiTypes.OBJECT,
        },
    )
    def post(self, request):
        serializer = ExtractToSchemaRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, "tenant", None)
        if not tenant:
            raise ValidationError("Tenant context required")

        document_id = serializer.validated_data["document_id"]
        entity_type = serializer.validated_data["entity_type"]

        try:
            document = get_extract_document(document_id=document_id, tenant=tenant, user=request.user)
            extracted = extract_document_to_schema(
                document=document,
                entity_type=entity_type,
                tenant=tenant,
                user=request.user,
            )
        except LookupError:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)
        except ExtractToSchemaError as exc:
            if exc.code == "AI_NOT_CONFIGURED":
                return ai_not_configured_response()
            return Response({"error": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "document_id": extracted.document.id,
            "entity_type": extracted.entity_type,
            "serializer_name": extracted.serializer_name,
            "parser": extracted.parser,
            "model_name": extracted.model_name,
            "warnings": extracted.warnings,
            "extracted_data": extracted.data,
        }
        return Response(ExtractToSchemaResponseSerializer(payload).data, status=status.HTTP_200_OK)
