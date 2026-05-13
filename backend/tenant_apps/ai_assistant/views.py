"""
Views for AI Assistant functionality.

Provides REST API endpoints for chat interactions, document uploads,
and AI-powered business intelligence for meat market operations.
"""
import logging
import time
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import DatabaseError, ProgrammingError, connection, transaction
from django.db.models import Avg
from django.db.models.functions import TruncDate
from django.http import Http404
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema

from apps.core.services.idempotency import (
    get_idempotency_key,
    release_idempotency_key,
    reserve_idempotency_key,
    store_idempotency_response,
)

from .models import (
    AIApproval,
    AIApprovalStatus,
    AIDocument,
    AIFeedbackLog,
    AIRun,
    AIRunStatus,
    AITask,
    AITaskStatus,
    ChatMessage,
    ChatSession,
    MessageTypeChoices,
)
from .serializers import (
    AIApprovalActionResponseSerializer,
    AIApprovalResolutionRequestSerializer,
    AIApprovalSerializer,
    AIDocumentSerializer,
    AIFeedbackLogSerializer,
    AIFeedbackSubmitSerializer,
    AILearningMetricsSerializer,
    AIRunSerializer,
    AITaskSerializer,
    ChatBotRequestSerializer,
    ChatBotResponseSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    ContextualSuggestionsRequestSerializer,
    ContextualSuggestionsResponseSerializer,
    ExtractToSchemaRequestSerializer,
    ExtractToSchemaResponseSerializer,
    PendingReviewItemSerializer,
    PendingReviewListResponseSerializer,
    PendingReviewResolveRequestSerializer,
    PendingReviewResolveResponseSerializer,
    RecentErrorsResponseSerializer,
    SwarmInvokeRequestSerializer,
    SwarmInvokeResponseSerializer,
    ToolsOpenResponseSerializer,
)
from .services import semantic_cache as ai_semantic_cache
from .services import tenant_memory_service as ai_tenant_memory_service
from .services.extract_to_schema import ExtractToSchemaError, extract_document_to_schema, get_extract_document
from .session_utils import (
    bind_context_to_tenant,
    get_request_tenant_id,
    get_session_compaction_state,
    get_session_compaction_watermark,
    session_matches_tenant,
)
from .swarm.executor import DEFAULT_OPENAI_TOOLS

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# OpenAI Swarm/Widget contract
# -----------------------------------------------------------------------------

SWARM_SYSTEM_PROMPT = (
    "You are the ProjectMeats Intelligent Architect. "
    "You have access to tenant data via RLS-safe tools and can learn from user feedback provided via the feedback tool. "
    "You are an expert in wholesale meat logistics, purchase orders, cold storage, and supplier management. "
    "Use tools only when they are available for the tenant (e.g., Outlook connection). "
    "Be highly analytical, concise, and proactive."
)


def _first_non_empty_string(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_review_sender(payload: dict[str, object]) -> str:
    return _first_non_empty_string(
        payload.get("sender"),
        payload.get("sender_email"),
        payload.get("from_email"),
        payload.get("email"),
        payload.get("vendor_name"),
        payload.get("supplier_name"),
        payload.get("customer_name"),
    )


def _extract_review_subject(payload: dict[str, object], document_type: str) -> str:
    return _first_non_empty_string(
        payload.get("subject"),
        payload.get("email_subject"),
        payload.get("title"),
        payload.get("document_name"),
        document_type.replace("_", " ").replace("-", " ").title(),
    )


def _extract_review_summary(payload: dict[str, object]) -> str:
    summary = _first_non_empty_string(
        payload.get("notes"),
        payload.get("summary"),
        payload.get("email_body"),
        payload.get("body"),
        payload.get("text"),
    )
    return summary[:1000]


def _normalize_review_document_type(document_type: str) -> str:
    normalized = str(document_type or "").strip().lower().replace(" ", "_").replace("-", "_")
    return normalized


def _infer_review_entity_type(document_type: str, payload: dict[str, object]) -> str:
    """Map an AI-classified document type (and payload keys) to a canonical entity type string."""
    normalized = _normalize_review_document_type(document_type)

    if normalized in {"purchase_order", "po"}:
        return "purchase_order"
    if normalized in {"bill_of_lading", "bol", "shipment", "carrier_purchase_order", "carrier_po"}:
        return "carrier-pos"
    if normalized in {"invoice"}:
        return "invoice"
    if normalized in {"sales_order", "so"}:
        return "sales_order"
    if normalized in {"inquiry", "quote"}:
        return "inquiry"
    if normalized in {"contact", "new_contact", "contact_update"}:
        return "contact"
    if normalized in {"new_customer", "customer"}:
        return "customer"
    if normalized in {"supplier", "new_supplier", "vendor", "supplier_note"}:
        return "supplier"
    if normalized in {"payment", "payment_notice", "remittance"}:
        return "payment"
    if normalized in {"pricing_sheet"}:
        return "pricing_sheet"

    # Fallback: infer from payload keys
    if any(key in payload for key in ("order_number", "vendor_name", "supplier_name")):
        return "purchase_order"
    if any(key in payload for key in ("bol_number", "carrier_name", "pickup_date", "pick_up_date")):
        return "carrier-pos"
    if any(key in payload for key in ("first_name", "last_name", "contact_name")):
        return "contact"
    if any(key in payload for key in ("total_amount", "payment_amount", "remittance_amount")):
        return "payment"

    return ""


def _build_feedback_document_placeholder(
    *,
    tenant_id: str,
    user_id: int | None,
    document_id: str,
) -> dict[str, object] | None:
    try:
        feedback_document_id = uuid.UUID(str(document_id))
    except (TypeError, ValueError):
        return None

    row = (
        AIFeedbackLog.objects.filter(tenant_id=tenant_id, document_id=feedback_document_id)
        .order_by("-created_on")
        .first()
    )
    if row is None:
        return None

    payload = row.original_extracted_data if isinstance(row.original_extracted_data, dict) else {}
    attachment_filenames = payload.get("attachment_filenames")
    first_attachment_name = (
        attachment_filenames[0]
        if isinstance(attachment_filenames, list)
        and attachment_filenames
        and isinstance(attachment_filenames[0], str)
        else ""
    )
    original_filename = _first_non_empty_string(
        payload.get("document_name"),
        payload.get("file_name"),
        first_attachment_name,
        _extract_review_subject(payload, row.document_type),
    )
    processing_status = _first_non_empty_string(payload.get("processing_status"))
    if processing_status not in {"pending", "processing", "completed", "failed"}:
        processing_status = "completed" if row.resolved_by_id else "processing"

    latest_event_type = "feedback_resolved" if row.resolved_by_id else "feedback_pending"
    latest_summary = _extract_review_summary(payload) or (
        "Document processing is still in progress."
        if not row.resolved_by_id
        else "Document review feedback has been captured."
    )

    source_metadata = {
        key: value
        for key, value in {
            "source": payload.get("source"),
            "message_id": payload.get("message_id"),
            "attachment_id": payload.get("attachment_id"),
            "graph_name": payload.get("graph_name"),
            "graph_content_type": payload.get("graph_content_type"),
        }.items()
        if value not in (None, "")
    }

    return {
        "id": str(feedback_document_id),
        "tenant": tenant_id,
        "owner": user_id,
        "session": None,
        "file": "",
        "original_filename": original_filename or f"{row.document_type or 'document'}-{feedback_document_id}",
        "content_type": str(payload.get("content_type") or ""),
        "file_type": str(payload.get("content_type") or ""),
        "file_size": int(payload.get("file_size") or 0),
        "processing_status": processing_status,
        "document_type": row.document_type or "unknown",
        "source_metadata": source_metadata,
        "processing_metadata": {
            "feedback_log_id": str(row.id),
            "feedback_source": row.feedback_source,
            "confidence_score": float(row.confidence_score or 0.0),
            "review_entity_type": _infer_review_entity_type(row.document_type, payload),
        },
        "lineage_summary": {
            "event_count": 1,
            "latest_event_type": latest_event_type,
            "latest_summary": latest_summary,
            "latest_created_on": row.created_on.isoformat() if row.created_on else "",
            "recent_events": [
                {
                    "event_type": latest_event_type,
                    "summary": latest_summary,
                    "created_on": row.created_on.isoformat() if row.created_on else "",
                    "source_type": "feedback_log",
                    "target_type": row.document_type or "document",
                }
            ],
        },
        "created_on": row.created_on.isoformat() if row.created_on else timezone.now().isoformat(),
    }


def build_contextual_suggestions(
    *,
    tenant,
    entity_type: str,
    entity_id: str,
    current_state: dict[str, object],
) -> list[dict[str, object]]:
    """Generate AI-powered action suggestions for an entity based on its current state."""
    suggestions: list[dict[str, object]] = []
    normalized_type = str(entity_type or "").strip().lower()
    current_state = current_state if isinstance(current_state, dict) else {}

    def add_suggestion(
        *,
        action: str,
        label: str,
        confidence: float,
        reason: str,
        prompt: str = "",
        target_url: str = "",
    ) -> None:
        suggestions.append(
            {
                "action": action,
                "label": label,
                "confidence": confidence,
                "reason": reason,
                "prompt": prompt,
                "target_url": target_url,
            }
        )

    status_value = _first_non_empty_string(
        current_state.get("status"),
        current_state.get("order_status"),
    ).upper()

    if normalized_type in {"supplier", "customer"}:
        add_suggestion(
            action="draft_check_in_email",
            label="Draft Check-in Email",
            confidence=0.93,
            reason="Relationship records support contextual follow-up drafting.",
            prompt=f"Draft a concise check-in email for this {normalized_type} using recent orders, balances, and delays.",
        )

    if normalized_type == "plant":
        from tenant_apps.plants.models import Plant

        plant = Plant.objects.filter(tenant=tenant, id=entity_id).only("id", "name", "booking_contact_email").first()
        if plant and not plant.booking_contact_email:
            add_suggestion(
                action="update_booking_contact",
                label="Add booking contact details",
                confidence=0.89,
                reason="This plant is missing a booking contact email.",
                prompt="Open the plant edit form and add booking contact details so logistics teams can route scheduling updates.",
            )
        else:
            add_suggestion(
                action="review_plant_profile",
                label="Review plant continuity profile",
                confidence=0.76,
                reason="Static plant editing is available for business continuity.",
                prompt="Review the plant profile and booking details for this facility.",
            )

    if normalized_type in {"purchase_order", "sales_order"} and status_value == "APPROVED":
        add_suggestion(
            action="generate_pdf",
            label="Generate & Email PDF",
            confidence=0.98,
            reason="Approved orders are good candidates for document generation and customer communication.",
            prompt="Generate the approved order PDF and prepare the outbound email for review.",
        )

    return suggestions[:3]


def _humanize_review_intent(document_type: str, payload: dict[str, object]) -> str:
    """Return a user-friendly label for a review item's entity intent (e.g. 'Purchase Order')."""
    entity_type = _infer_review_entity_type(document_type, payload)
    if entity_type == "carrier-pos":
        return "Bill Of Lading"
    if entity_type == "purchase_order":
        return "Purchase Order"
    if entity_type:
        return entity_type.replace("-", " ").replace("_", " ").title()
    normalized = _normalize_review_document_type(document_type)
    return normalized.replace("_", " ").title() or "AI Draft"


def build_pending_review_items(
    tenant_id: str,
    *,
    highlighted_id: str | None = None,
    limit: int = 25,
) -> list[dict[str, object]]:
    """Build serialized list of unresolved AI feedback items for the review queue."""
    qs = AIFeedbackLog.objects.filter(
        tenant_id=tenant_id,
        resolved_by__isnull=True,
    ).order_by("-created_on")

    rows = list(qs[:limit])
    if highlighted_id:
        try:
            highlighted_row = qs.filter(id=highlighted_id).first()
        except (TypeError, ValueError):
            highlighted_row = None
        if highlighted_row and all(str(row.id) != str(highlighted_row.id) for row in rows):
            rows = [highlighted_row, *rows[: max(limit - 1, 0)]]

    document_ids = [row.document_id for row in rows if row.document_id is not None]
    documents = {
        document.id: document
        for document in AIDocument.objects.filter(tenant_id=tenant_id, id__in=document_ids).only(
            "id",
            "original_filename",
        )
    }

    items: list[dict[str, object]] = []
    for row in rows:
        payload = row.original_extracted_data if isinstance(row.original_extracted_data, dict) else {}
        document = documents.get(row.document_id)
        review_entity_type = _infer_review_entity_type(row.document_type, payload)

        # Extract attachment metadata from the original_extracted_data payload
        att_count = int(payload.get("attachment_count") or 0)
        att_filenames = payload.get("attachment_filenames") or []
        if not isinstance(att_filenames, list):
            att_filenames = []

        items.append(
            {
                "id": row.id,
                "document_id": row.document_id,
                "document_type": row.document_type,
                "confidence_score": float(row.confidence_score or 0.0),
                "precision_delta": float(row.precision_delta or 0.0),
                "created_on": row.created_on,
                "original_extracted_data": payload,
                "sender": _extract_review_sender(payload),
                "source_subject": _extract_review_subject(payload, row.document_type),
                "source_summary": _extract_review_summary(payload),
                "source_document_name": str(getattr(document, "original_filename", "") or ""),
                "intent_label": _humanize_review_intent(row.document_type, payload),
                "review_entity_type": review_entity_type,
                "review_target_url": str(payload.get("review_target_url") or f"/my-tasks?tab=ai-review&draft={row.id}"),
                "feedback_signal": row.feedback_signal,
                "feedback_comment": row.feedback_comment,
                "retraining_status": row.retraining_status,
                "retraining_queued_at": row.retraining_queued_at,
                "attachment_count": att_count,
                "attachment_filenames": [str(n) for n in att_filenames[:20]],
            }
        )

    return items


def ai_not_configured_response() -> Response:
    """Return a 503 response when OpenAI integration is not configured."""
    return Response(
        {
            "error": "AI is not enabled for this environment.",
            "code": "AI_NOT_CONFIGURED",
            "detail": "OpenAI is not configured on the server (missing OPENAI_API_KEY).",
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _tenant_membership_role(*, user, tenant) -> str:
    """Return the active TenantUser role for a user in a tenant, or empty string."""
    if not user or not getattr(user, "is_authenticated", False) or tenant is None:
        return ""

    from apps.tenants.models import TenantUser

    return (
        TenantUser.objects.filter(tenant=tenant, user=user, is_active=True).values_list("role", flat=True).first() or ""
    )


def _can_review_ai_approvals(*, user, tenant) -> bool:
    """Check if user has owner/admin role required to resolve AI approvals."""
    return _tenant_membership_role(user=user, tenant=tenant) in {"owner", "admin"}


def can_access_ai_review_queue(*, user, tenant) -> bool:
    """Check if user can view the AI review queue (staff, superuser, or owner/admin/manager)."""
    if not user or not getattr(user, "is_authenticated", False) or tenant is None:
        return False
    if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
        return True
    return _tenant_membership_role(user=user, tenant=tenant) in {"owner", "admin", "manager"}


class ChatSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing chat sessions."""

    queryset = ChatSession.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title"]
    ordering_fields = ["created_on", "last_activity", "title"]
    ordering = ["-last_activity"]

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        """Return chat messages for a session (used by ChatWindow + widget history restore)."""
        session = self.get_object()
        qs = ChatMessage.objects.filter(session=session).order_by("created_on")
        return Response(ChatMessageSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return ChatSessionListSerializer
        return ChatSessionDetailSerializer

    def get_queryset(self):
        """Filter sessions to current user only."""
        from django.db.models import Count

        tenant_id = get_request_tenant_id(self.request)
        if not tenant_id:
            return self.queryset.none()
        return (
            self.queryset.filter(
                owner=self.request.user,
            )
            .filter(tenant_id=tenant_id)
            .annotate(message_count=Count("messages"))
        )

    def perform_create(self, serializer):
        """Set the owner when creating a new session."""
        tenant = getattr(self.request, "tenant", None)
        if not get_request_tenant_id(self.request):
            raise ValidationError("Tenant context required")
        serializer.save(
            tenant=tenant,
            context_data=bind_context_to_tenant(serializer.validated_data.get("context_data"), tenant),
            owner=self.request.user,
            created_by=self.request.user,
            modified_by=self.request.user,
        )


class ChatMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing chat messages."""

    queryset = ChatMessage.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_on"]
    ordering = ["created_on"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "create":
            return ChatMessageCreateSerializer
        return ChatMessageSerializer

    def get_queryset(self):
        """Filter messages to current user's sessions only."""
        tenant_id = get_request_tenant_id(self.request)
        if not tenant_id:
            return self.queryset.none()
        return self.queryset.filter(
            session__owner=self.request.user,
        ).filter(tenant_id=tenant_id)

    def perform_create(self, serializer):
        if not get_request_tenant_id(self.request):
            raise ValidationError("Tenant context required")
        tenant = getattr(self.request, "tenant", None)
        serializer.save(
            tenant=tenant,
            owner=self.request.user,
            created_by=self.request.user,
            modified_by=self.request.user,
        )


class ChatBotAPIViewSet(viewsets.ViewSet):
    """Simplified chat API for frontend integration."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = "ai_chat"

    @extend_schema(
        request=ChatBotRequestSerializer,
        responses={200: ChatBotResponseSerializer, 400: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT},
    )
    @action(detail=False, methods=["post"])
    def chat(self, request):
        """Send a message to the AI assistant and get a response."""
        serializer = ChatBotRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        start_time = time.time()
        user_message = serializer.validated_data["message"]
        session_id = serializer.validated_data.get("session_id")
        context = serializer.validated_data.get("context", {})

        try:
            tenant = getattr(request, "tenant", None)
            tenant_id = get_request_tenant_id(request)
            if not tenant_id:
                return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

            # Get or create session
            if session_id:
                session = (
                    ChatSession.objects.filter(
                        id=session_id,
                        owner=request.user,
                    )
                    .filter(tenant_id=tenant_id)
                    .first()
                )
                if not session:
                    return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            else:
                # Create new session
                session = ChatSession.objects.create(
                    title=f"Chat {timezone.now().strftime('%Y-%m-%d %H:%M')}",
                    tenant=tenant,
                    context_data=bind_context_to_tenant(context, tenant),
                    owner=request.user,
                    created_by=request.user,
                    modified_by=request.user,
                )

            # Create user message
            user_msg = ChatMessage.objects.create(
                session=session,
                tenant=tenant,
                message_type=MessageTypeChoices.USER,
                content=user_message,
                owner=request.user,
                created_by=request.user,
                modified_by=request.user,
            )

            # Generate AI response (OpenAI via Swarm bounded tool loop)
            import os

            if not session_matches_tenant(session, tenant):
                return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

            # Defense-in-depth: ensure RLS session vars are asserted on this DB connection
            # before any Swarm tool executes queries.
            #
            # IMPORTANT: Per ops mandate, explicitly SET app.current_tenant via cursor.execute(f"...")
            # right before tool execution to avoid "0 records found" due to missing RLS session vars.
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET app.current_tenant = %s", [tenant_id])
            except Exception as e:
                logger.warning("Failed to SET app.current_tenant=%s: %s", tenant_id, str(e), exc_info=True)
                return Response(
                    {"error": "Failed to assert tenant context for RLS-safe tool execution"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                from apps.tenants.rls import set_current_tenant

                set_current_tenant(tenant_id)
            except Exception:
                pass

            openai_api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
            if not openai_api_key:
                return ai_not_configured_response()

            try:
                from apps.integrations.models import EmailLog
                from apps.system.services.ai_model_resolver import get_active_openai_model_id

                from .swarm.router import SwarmOrchestrator

                model_name = get_active_openai_model_id(fallback="gpt-4o-mini")

                history = []
                session_compaction_memory = None
                session_compaction_state = {}

                # --- RAG-lite context injection: last 5 ingested emails for this tenant ---
                try:
                    recent_emails = EmailLog.objects.filter(tenant=tenant).order_by("-received_at")[:5]
                    if recent_emails:
                        email_context = "Here are the most recently received emails in the system:\n"
                        for email in recent_emails:
                            body_snippet = (email.body_text or "")[:300]
                            email_context += (
                                f"- Date: {email.received_at}, From: {email.sender_name} <{email.sender_email}>\n"
                                f"  Subject: {email.subject}\n"
                                f"  Has Attachments: {email.has_attachments}\n"
                                f"  Body Snippet: {body_snippet}...\n\n"
                            )
                        history.append(
                            {
                                "role": "system",
                                "content": (
                                    "You have access to recently ingested emails for this tenant. "
                                    "Use this context when answering email-related questions.\n\n"
                                    f"{email_context}"
                                ),
                            }
                        )
                except Exception:
                    logger.warning("Failed to inject email context for AI assistant", exc_info=True)

                # Include recent session message history (excluding this user message)
                try:
                    session_compaction_memory = ai_tenant_memory_service.get_session_compaction_memory(
                        tenant=tenant,
                        session_id=session.id,
                    )
                    session_compaction_state = (
                        get_session_compaction_state(session.context_data)
                        if session_compaction_memory is not None
                        else {}
                    )
                    history_qs = ChatMessage.objects.filter(session=session, tenant=tenant).exclude(id=user_msg.id)
                    compaction_watermark = (
                        get_session_compaction_watermark(session.context_data)
                        if session_compaction_memory is not None
                        else None
                    )
                    if compaction_watermark is not None:
                        history_qs = history_qs.filter(created_on__gt=compaction_watermark)

                    recent = history_qs.order_by("-created_on")[:20]
                    for row in reversed(list(recent)):
                        role = None
                        if row.message_type == MessageTypeChoices.USER:
                            role = "user"
                        elif row.message_type == MessageTypeChoices.ASSISTANT:
                            role = "assistant"
                        elif row.message_type == MessageTypeChoices.SYSTEM:
                            role = "system"
                        elif row.message_type == MessageTypeChoices.DOCUMENT:
                            role = "system"

                        if not role:
                            continue

                        content = (row.content or "").strip()
                        if not content:
                            continue

                        if row.message_type == MessageTypeChoices.DOCUMENT:
                            meta = row.metadata or {}
                            document_id = meta.get("document_id")
                            file_url = meta.get("file_url")
                            original_filename = meta.get("original_filename") or content

                            content = f"[Document] {str(original_filename)[:500]}"
                            if document_id:
                                content += f"\n- document_id: {document_id}"
                            if file_url:
                                content += f"\n- file_url: {file_url}"

                        history.append({"role": role, "content": content})
                except Exception:
                    pass

                context_signature = ai_semantic_cache.build_context_signature(
                    history=history,
                    context={
                        **(context if isinstance(context, dict) else {}),
                        "_session_memory": {
                            "key": str(getattr(session_compaction_memory, "key", "") or ""),
                            "memory_text": str(getattr(session_compaction_memory, "memory_text", "") or ""),
                            "last_compacted_created_on": str(
                                session_compaction_state.get("last_compacted_created_on") or ""
                            ),
                        },
                    },
                )
                cached_response = ai_semantic_cache.lookup_cached_response(
                    tenant_id=tenant_id,
                    user_message=user_message,
                    context_signature=context_signature,
                )
                if cached_response is not None:
                    metadata = {
                        "model": cached_response.model_name or model_name,
                        "provider": "openai",
                        "tokens_used": None,
                        "response_type": "semantic_cache_hit",
                        "tools_used": [],
                        "cache_hit": True,
                        "cache_similarity": round(float(cached_response.similarity), 4),
                        "cache_provider": "redis",
                        "cache_entry_id": cached_response.entry_id,
                    }
                    ai_msg = ChatMessage.objects.create(
                        session=session,
                        tenant=tenant,
                        message_type=MessageTypeChoices.ASSISTANT,
                        content=cached_response.response_text,
                        metadata=metadata,
                        owner=request.user,
                        created_by=request.user,
                        modified_by=request.user,
                    )
                    try:
                        from .services.lineage import create_lineage_event

                        create_lineage_event(
                            tenant=tenant,
                            event_type="semantic_cache_hit",
                            source_type="semantic_cache",
                            source_id=cached_response.entry_id,
                            target_type="chat_message",
                            target_id=str(ai_msg.id),
                            summary="Served an AI assistant response from the semantic cache.",
                            metadata={
                                "session_id": str(session.id),
                                "similarity": round(float(cached_response.similarity), 4),
                            },
                        )
                    except Exception:
                        logger.warning(
                            "Failed to record semantic cache hit lineage message=%s",
                            ai_msg.id,
                            exc_info=True,
                        )
                    try:
                        ai_tenant_memory_service.compact_session_messages(tenant=tenant, session=session)
                    except Exception:
                        logger.warning(
                            "Failed to compact chat context after semantic cache hit session=%s",
                            session.id,
                            exc_info=True,
                        )

                    processing_time = time.time() - start_time
                    response_serializer = ChatBotResponseSerializer(
                        data={
                            "response": cached_response.response_text,
                            "session_id": session.id,
                            "message_id": ai_msg.id,
                            "processing_time": processing_time,
                            "metadata": metadata,
                        }
                    )
                    response_serializer.is_valid(raise_exception=True)
                    return Response(response_serializer.data, status=status.HTTP_200_OK)

                orch = SwarmOrchestrator(tenant_id=str(getattr(tenant, "id", "") or ""))
                result = orch.run_tool_loop(
                    user_message=user_message,
                    tenant=tenant,
                    user=request.user,
                    history=history,
                    session_id=str(session.id),
                )

                response_text = str(result.get("response") or "").strip()
                tokens_used = None
                control_plane = result.get("control_plane") or {}

                tools_used = []
                try:
                    trace = result.get("messages") or []
                    for msg in trace:
                        if not isinstance(msg, dict) or msg.get("role") != "assistant":
                            continue
                        tool_calls = msg.get("tool_calls")
                        if not isinstance(tool_calls, list):
                            continue
                        for tc in tool_calls:
                            if not isinstance(tc, dict):
                                continue
                            fn = tc.get("function")
                            if not isinstance(fn, dict):
                                continue
                            name = fn.get("name")
                            if isinstance(name, str) and name:
                                tools_used.append(name)
                except Exception:
                    pass

            except Exception as e:
                logger.warning("Swarm tool loop failed: %s", str(e), exc_info=True)
                msg = str(e)
                if "OPENAI_API_KEY" in msg or "OpenAI not configured" in msg:
                    return ai_not_configured_response()
                return Response({"error": msg or "AI request failed"}, status=status.HTTP_400_BAD_REQUEST)

            metadata = {
                "model": model_name,
                "provider": "openai",
                "tokens_used": tokens_used,
                "response_type": "swarm_tool_loop",
                "tools_used": sorted(list(set(tools_used))) if tools_used else [],
            }
            if control_plane:
                metadata["control_plane"] = control_plane
            else:
                cached_entry = (
                    ai_semantic_cache.store_cached_response(
                        tenant_id=tenant_id,
                        user_message=user_message,
                        response_text=response_text,
                        context_signature=context_signature,
                        model_name=model_name,
                    )
                    if not tools_used and response_text
                    else None
                )
                if cached_entry is not None:
                    metadata["cache_store"] = {
                        "entry_id": cached_entry["entry_id"],
                        "provider": "redis",
                    }

            # Create AI response message
            ai_msg = ChatMessage.objects.create(
                session=session,
                tenant=tenant,
                message_type=MessageTypeChoices.ASSISTANT,
                content=response_text,
                metadata=metadata,
                owner=request.user,
                created_by=request.user,
                modified_by=request.user,
            )
            if metadata.get("cache_store"):
                try:
                    from .services.lineage import create_lineage_event

                    create_lineage_event(
                        tenant=tenant,
                        event_type="semantic_cache_store",
                        source_type="chat_message",
                        source_id=str(ai_msg.id),
                        target_type="semantic_cache",
                        target_id=str(metadata["cache_store"]["entry_id"]),
                        summary="Stored an AI assistant response in the semantic cache.",
                        metadata={"session_id": str(session.id)},
                    )
                except Exception:
                    logger.warning(
                        "Failed to record semantic cache store lineage message=%s",
                        ai_msg.id,
                        exc_info=True,
                    )
            try:
                ai_tenant_memory_service.compact_session_messages(tenant=tenant, session=session)
            except Exception:
                logger.warning(
                    "Failed to compact chat context after assistant response session=%s",
                    session.id,
                    exc_info=True,
                )

            processing_time = time.time() - start_time

            response_serializer = ChatBotResponseSerializer(
                data={
                    "response": response_text,
                    "session_id": session.id,
                    "message_id": ai_msg.id,
                    "processing_time": processing_time,
                    "metadata": metadata,
                }
            )
            response_serializer.is_valid(raise_exception=True)

            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in chat API: {str(e)}")
            processing_time = time.time() - start_time

            return Response(
                {
                    "error": "Failed to generate response",
                    "message": "I apologize, but I am experiencing technical difficulties. Please try again.",
                    "processing_time": processing_time,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class _TenantScopedAIControlPlaneViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ["-created_on"]

    def _tenant_queryset(self, queryset):
        tenant = getattr(self.request, "tenant", None)
        tenant_id = get_request_tenant_id(self.request)
        if not tenant_id or tenant is None:
            return queryset.none()
        return queryset.filter(tenant_id=tenant_id), tenant


class AIRunViewSet(_TenantScopedAIControlPlaneViewSet):
    queryset = AIRun.objects.select_related("tenant", "session", "requested_by")
    serializer_class = AIRunSerializer
    ordering_fields = ["created_on", "modified_on", "completed_at"]

    def get_queryset(self):
        scoped = self._tenant_queryset(self.queryset)
        if not isinstance(scoped, tuple):
            return scoped
        queryset, tenant = scoped
        if _can_review_ai_approvals(user=self.request.user, tenant=tenant):
            return queryset
        return queryset.filter(requested_by=self.request.user)


class AITaskViewSet(_TenantScopedAIControlPlaneViewSet):
    queryset = AITask.objects.select_related("tenant", "run", "requested_by")
    serializer_class = AITaskSerializer
    ordering_fields = ["created_on", "modified_on", "executed_at", "resolved_at", "sequence"]

    def get_queryset(self):
        scoped = self._tenant_queryset(self.queryset)
        if not isinstance(scoped, tuple):
            return scoped
        queryset, tenant = scoped
        if _can_review_ai_approvals(user=self.request.user, tenant=tenant):
            return queryset
        return queryset.filter(requested_by=self.request.user)


class AIApprovalViewSet(_TenantScopedAIControlPlaneViewSet):
    queryset = AIApproval.objects.select_related("tenant", "run", "task", "requested_by", "resolved_by")
    serializer_class = AIApprovalSerializer
    ordering_fields = ["created_on", "modified_on", "resolved_at", "expires_at"]

    def get_queryset(self):
        scoped = self._tenant_queryset(self.queryset)
        if not isinstance(scoped, tuple):
            return scoped
        queryset, tenant = scoped
        if _can_review_ai_approvals(user=self.request.user, tenant=tenant):
            return queryset
        return queryset.filter(requested_by=self.request.user)

    def _load_approval_bundle(self, *, approval_id: str, tenant_id: str):
        try:
            approval = AIApproval.objects.select_for_update().get(
                pk=approval_id,
                tenant_id=tenant_id,
            )
            task = AITask.objects.select_for_update().get(
                pk=approval.task_id,
                tenant_id=tenant_id,
            )
            run = AIRun.objects.select_for_update().get(
                pk=approval.run_id,
                tenant_id=tenant_id,
            )
        except (AIApproval.DoesNotExist, AITask.DoesNotExist, AIRun.DoesNotExist):
            return None

        if (
            str(approval.tenant_id) != tenant_id
            or str(task.tenant_id) != str(approval.tenant_id)
            or str(run.tenant_id) != str(approval.tenant_id)
        ):
            return None

        return approval, task, run

    @extend_schema(
        request=AIApprovalResolutionRequestSerializer,
        responses={200: AIApprovalActionResponseSerializer, 403: OpenApiTypes.OBJECT, 409: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        tenant = getattr(request, "tenant", None)
        if not _can_review_ai_approvals(user=request.user, tenant=tenant):
            return Response(
                {"error": "Only tenant owners or admins can approve AI tasks"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = AIApprovalResolutionRequestSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor

        with transaction.atomic():
            request_tenant_id = str(get_request_tenant_id(request) or "")
            approval_bundle = self._load_approval_bundle(
                approval_id=pk,
                tenant_id=request_tenant_id,
            )
            if approval_bundle is None:
                return Response({"error": "Approval not found"}, status=status.HTTP_404_NOT_FOUND)
            approval, task, run = approval_bundle
            if approval.status != AIApprovalStatus.PENDING:
                return Response({"error": "Approval already resolved"}, status=status.HTTP_409_CONFLICT)

            approval.status = AIApprovalStatus.APPROVED
            approval.resolved_by = request.user
            approval.resolution_note = serializer.validated_data.get("resolution_note", "")
            approval.resolved_at = timezone.now()
            approval.response_payload = {
                "approved_by": request.user.id,
                "resolution_note": approval.resolution_note,
                "approved_at": approval.resolved_at.isoformat(),
            }
            approval.save(
                update_fields=[
                    "status",
                    "resolved_by",
                    "resolution_note",
                    "resolved_at",
                    "response_payload",
                    "modified_on",
                ]
            )
            try:
                from tenant_apps.ai_assistant.services.lineage import create_lineage_event

                create_lineage_event(
                    tenant=approval.tenant,
                    run=run,
                    task=task,
                    approval=approval,
                    event_type="approval_granted",
                    source_type="approval",
                    source_id=str(approval.id),
                    target_type="task",
                    target_id=str(task.id),
                    summary="AI approval granted; task execution resumed.",
                    metadata={"resolution_note": approval.resolution_note},
                )
            except Exception:
                logger.warning("Failed to record approval-granted lineage approval=%s", approval.id, exc_info=True)

            task.status = AITaskStatus.RUNNING
            task.save(update_fields=["status", "modified_on"])

            run.status = AIRunStatus.RUNNING
            run.error_message = ""
            run.save(update_fields=["status", "error_message", "modified_on"])

            ToolExecutor().execute(
                approval.tool_name,
                approval.request_payload,
                approval.tenant,
                approval.requested_by or request.user,
                session_id=str(run.session_id) if run.session_id else None,
                run=run,
                existing_task=task,
                approval=approval,
                bypass_approval=True,
            )

        approval.refresh_from_db()
        task.refresh_from_db()
        run.refresh_from_db()
        return Response(
            AIApprovalActionResponseSerializer(
                {
                    "approval": approval,
                    "task": task,
                    "run": run,
                }
            ).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        request=AIApprovalResolutionRequestSerializer,
        responses={200: AIApprovalActionResponseSerializer, 403: OpenApiTypes.OBJECT, 409: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=["post"])
    def deny(self, request, pk=None):
        tenant = getattr(request, "tenant", None)
        if not _can_review_ai_approvals(user=request.user, tenant=tenant):
            return Response(
                {"error": "Only tenant owners or admins can deny AI tasks"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = AIApprovalResolutionRequestSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            request_tenant_id = str(get_request_tenant_id(request) or "")
            approval_bundle = self._load_approval_bundle(
                approval_id=pk,
                tenant_id=request_tenant_id,
            )
            if approval_bundle is None:
                return Response({"error": "Approval not found"}, status=status.HTTP_404_NOT_FOUND)
            approval, task, run = approval_bundle
            if approval.status != AIApprovalStatus.PENDING:
                return Response({"error": "Approval already resolved"}, status=status.HTTP_409_CONFLICT)

            resolved_at = timezone.now()
            resolution_note = serializer.validated_data.get("resolution_note", "")

            approval.status = AIApprovalStatus.DENIED
            approval.resolved_by = request.user
            approval.resolution_note = resolution_note
            approval.resolved_at = resolved_at
            approval.response_payload = {
                "denied_by": request.user.id,
                "resolution_note": resolution_note,
                "denied_at": resolved_at.isoformat(),
            }
            approval.save(
                update_fields=[
                    "status",
                    "resolved_by",
                    "resolution_note",
                    "resolved_at",
                    "response_payload",
                    "modified_on",
                ]
            )

            task.status = AITaskStatus.DENIED
            task.error_message = resolution_note or "Denied by approver"
            task.resolved_at = resolved_at
            task.output_payload = {
                "approval_id": str(approval.id),
                "status": AIApprovalStatus.DENIED,
                "resolution_note": resolution_note,
            }
            task.save(update_fields=["status", "error_message", "resolved_at", "output_payload", "modified_on"])

            run.status = AIRunStatus.DENIED
            run.error_message = task.error_message
            run.response_text = "This AI task was denied and was not executed."
            run.response_payload = {
                "approval_id": str(approval.id),
                "task_id": str(task.id),
                "status": AIApprovalStatus.DENIED,
                "resolution_note": resolution_note,
            }
            run.completed_at = resolved_at
            run.save(
                update_fields=[
                    "status",
                    "error_message",
                    "response_text",
                    "response_payload",
                    "completed_at",
                    "modified_on",
                ]
            )
            try:
                from tenant_apps.ai_assistant.services.lineage import create_lineage_event

                create_lineage_event(
                    tenant=approval.tenant,
                    run=run,
                    task=task,
                    approval=approval,
                    event_type="approval_denied",
                    source_type="approval",
                    source_id=str(approval.id),
                    target_type="task",
                    target_id=str(task.id),
                    summary="AI approval denied; task execution was blocked.",
                    metadata={"resolution_note": resolution_note},
                )
            except Exception:
                logger.warning("Failed to record approval-denied lineage approval=%s", approval.id, exc_info=True)

        return Response(
            AIApprovalActionResponseSerializer(
                {
                    "approval": approval,
                    "task": task,
                    "run": run,
                }
            ).data,
            status=status.HTTP_200_OK,
        )


class AILearningMetricsAPIView(APIView):
    """Tenant-scoped learning metrics for the Cockpit dashboard."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: AILearningMetricsSerializer, 400: OpenApiTypes.OBJECT})
    def get(self, request):
        tenant = getattr(request, "tenant", None)
        tenant_id = getattr(tenant, "id", None)
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        total_docs = AIDocument.objects.filter(tenant_id=tenant_id).count()

        resolved = AIFeedbackLog.objects.filter(tenant_id=tenant_id, resolved_by__isnull=False)
        corrections = resolved.exclude(user_corrected_data={}).count()

        avg_precision_delta = resolved.aggregate(avg=Avg("precision_delta")).get("avg")
        precision_score = 1.0 - float(avg_precision_delta or 0.0)
        precision_score = max(0.0, min(1.0, precision_score))

        start = timezone.now() - timedelta(days=29)
        trend_qs = (
            AIFeedbackLog.objects.filter(tenant_id=tenant_id, created_on__gte=start)
            .annotate(day=TruncDate("created_on"))
            .values("day")
            .annotate(confidence=Avg("confidence_score"))
            .order_by("day")
        )
        confidence_trend = [
            {"day": str(row["day"]), "confidence": float(row.get("confidence") or 0.0)} for row in trend_qs
        ]

        payload = {
            "totalDocumentsParsed": int(total_docs),
            "correctionsLearned": int(corrections),
            "precisionScore": float(precision_score),
            "confidenceTrend": confidence_trend,
        }
        # Defensive schema validation
        out = AILearningMetricsSerializer(data=payload)
        out.is_valid(raise_exception=True)
        return Response(out.data, status=status.HTTP_200_OK)


class AIConfidenceMetricsAPIView(APIView):
    """Tenant-scoped confidence scoring metrics for the Cockpit dashboard (AUTO-21.2)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        tenant_id = getattr(tenant, "id", None)
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.integrations.models import EmailLog

        thirty_days_ago = timezone.now() - timedelta(days=30)
        email_qs = EmailLog.objects.filter(
            tenant_id=tenant_id,
            created_at__gte=thirty_days_ago,
        )

        total_processed = email_qs.exclude(status="logged").count()
        action_required = email_qs.filter(status="action_required").count()
        auto_processed = email_qs.filter(status="order_created").count()

        # Compute confidence from AIFeedbackLog
        feedback_qs = AIFeedbackLog.objects.filter(
            tenant_id=tenant_id,
            created_on__gte=thirty_days_ago,
        )
        avg_conf = feedback_qs.aggregate(avg=Avg("confidence_score")).get("avg") or 0.0
        high_confidence = feedback_qs.filter(confidence_score__gte=0.98).count()
        low_confidence = feedback_qs.filter(confidence_score__lt=0.98).count()

        payload = {
            "average_confidence": round(float(avg_conf), 4),
            "total_processed": total_processed,
            "high_confidence_count": high_confidence,
            "low_confidence_count": low_confidence,
            "action_required_count": action_required,
            "auto_processed_count": auto_processed,
        }
        return Response(payload, status=status.HTTP_200_OK)


class AIDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for uploading and listing AI documents."""

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

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except Http404:
            tenant = getattr(request, "tenant", None)
            if tenant is None:
                raise

            # Incident fix: review queues can legitimately reference feedback-only
            # document_ids before a durable AIDocument row exists. Return a
            # serializer-compatible placeholder instead of a repeated 404.
            placeholder = _build_feedback_document_placeholder(
                tenant_id=str(tenant.id),
                user_id=getattr(request.user, "id", None),
                document_id=kwargs.get(self.lookup_field, ""),
            )
            if placeholder is None:
                raise
            return Response(placeholder, status=status.HTTP_200_OK)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

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
            logger.error("AIDocument upload: unexpected error: %s", str(e), exc_info=True)
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
    """Extract a strict serializer-backed draft payload from an uploaded AI document."""

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


class SwarmToolsOpenAPIView(APIView):
    """Expose tool schemas for PM-AS.

    This endpoint is used by the AIAgentWidget to discover tools.

    Reliability mandate:
    - Always return a safe `tools` list shaped for OpenAI ChatCompletions
    - Avoid fragile runtime introspection that could 500

    UX mandate:
    - Do not advertise email tools unless the tenant is actually connected.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.integrations.models import ExternalAuthProvider

        outlook = {
            "connected": False,
            "expired": False,
            "connected_email": None,
            "connected_name": None,
        }

        try:
            provider = (
                ExternalAuthProvider.objects.filter(
                    tenant=request.tenant,
                    provider_type="microsoft",
                    is_active=True,
                )
                .select_related("tenant")
                .first()
            )
            if provider:
                outlook["expired"] = bool(provider.is_token_expired())
                outlook["connected_email"] = provider.connected_email
                outlook["connected_name"] = provider.connected_name
                outlook["connected"] = bool(not outlook["expired"])
        except Exception:
            logger.warning("tools/openapi: failed to load outlook connection status", exc_info=True)

        email_tools = {"fetch_emails", "ingest_email_attachment", "check_unread_emails", "draft_outlook_email"}

        if outlook["connected"]:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            # Always allow safe internal tools; only hide Outlook tools when not connected.
            tools = [t for t in DEFAULT_OPENAI_TOOLS if t.get("function", {}).get("name") not in email_tools]

        payload = {
            "tools": tools,
            "capabilities": {"outlook": outlook},
        }

        try:
            # Keep legacy OpenAPI-ish document for backward compatibility.
            from .swarm.tools.registry import registry

            openapi_doc = registry.to_openapi()
            if not outlook["connected"]:
                openapi_doc["paths"] = {
                    path: spec
                    for path, spec in (openapi_doc.get("paths") or {}).items()
                    if path.rsplit("/", 1)[-1] not in email_tools
                }
            payload["openapi"] = openapi_doc
        except Exception as e:
            logger.warning("tools/openapi fallback engaged: %s", str(e), exc_info=True)

        return Response(payload, status=status.HTTP_200_OK)


class SwarmInvokeAPIView(APIView):
    """Staff-only entrypoint for PM-AS routing.

    This is a safe endpoint: it only runs the semantic router and returns the
    chosen agent chain + rationale. It does NOT execute tools or mutate data.
    """

    permission_classes = [IsAdminUser]

    @extend_schema(
        request=SwarmInvokeRequestSerializer,
        responses={200: SwarmInvokeResponseSerializer, 400: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        serializer = SwarmInvokeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, "tenant", None)
        tenant_id = str(getattr(tenant, "id", "") or "")
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        event_type = serializer.validated_data["event_type"]
        payload = serializer.validated_data["payload"]
        correlation_id = serializer.validated_data.get("correlation_id")

        from .swarm.router import SwarmOrchestrator

        orch = SwarmOrchestrator(tenant_id=tenant_id)
        decision = orch.route(event_type=event_type, payload=payload, correlation_id=correlation_id)

        return Response(
            {
                "tenant_id": tenant_id,
                "correlation_id": correlation_id,
                "event_type": decision.event_type,
                "intent": decision.intent,
                "urgency": decision.urgency,
                "agent_chain": decision.agent_chain,
                "notes": decision.notes,
            },
            status=status.HTTP_200_OK,
        )


class PendingReviewAPIView(APIView):
    """Staff-only queue of HITL items requiring human review.

    Backed by unresolved AIFeedbackLog rows awaiting operator review.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        tenant_id = str(getattr(tenant, "id", "") or "")
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        items = build_pending_review_items(tenant_id)

        payload = PendingReviewItemSerializer(items, many=True).data
        return Response({"results": payload}, status=status.HTTP_200_OK)


class ContextualSuggestionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ContextualSuggestionsRequestSerializer,
        responses={200: ContextualSuggestionsResponseSerializer, 400: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        serializer = ContextualSuggestionsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        suggestions = build_contextual_suggestions(
            tenant=tenant,
            entity_type=serializer.validated_data["entity_type"],
            entity_id=serializer.validated_data["entity_id"],
            current_state=serializer.validated_data.get("current_state") or {},
        )
        return Response({"suggestions": suggestions}, status=status.HTTP_200_OK)


class AIFeedbackViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Feedback endpoint for HITL.

    - `POST /api/v1/ai-assistant/feedback/`: tenant-scoped correction submission (used by HITLReviewCard)
    - `GET /api/v1/ai-assistant/feedback/`: staff-only auditing

    NOTE: We keep reads staff-only to avoid leaking internal training payloads.
    """

    serializer_class = AIFeedbackLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_on"]
    ordering = ["-created_on"]

    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = "ai_feedback"

    def get_permissions(self):
        if self.action in ["create"]:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        if self.action == "create":
            return AIFeedbackSubmitSerializer
        return AIFeedbackLogSerializer

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        qs = AIFeedbackLog.objects.all().select_related("tenant", "resolved_by", "submitted_by")

        if self.request.user.is_superuser:
            return qs

        tenant_id = getattr(tenant, "id", None)
        if not tenant_id:
            return AIFeedbackLog.objects.none()

        return qs.filter(tenant_id=tenant_id)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, "tenant", None)
        tenant_id = getattr(tenant, "id", None)
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        document_id = serializer.validated_data["document_id"]
        document_type = (serializer.validated_data.get("document_type") or "unknown").strip() or "unknown"
        original = serializer.validated_data.get("original_extracted_data") or {}
        corrected = serializer.validated_data.get("user_corrected_data") or {}
        confidence = float(serializer.validated_data.get("confidence_score") or 0.0)
        feedback_signal = serializer.validated_data.get("feedback_signal")
        feedback_comment = serializer.validated_data.get("feedback_comment") or ""
        feedback_source = (serializer.validated_data.get("feedback_source") or "").strip()
        should_queue_retraining = bool(corrected or feedback_signal)
        retraining_queued_at = timezone.now() if should_queue_retraining else None

        row = AIFeedbackLog.objects.filter(tenant_id=tenant_id, document_id=document_id).order_by("-created_on").first()
        created = False
        if row is None:
            row = AIFeedbackLog.objects.create(
                tenant_id=tenant_id,
                document_id=document_id,
                document_type=document_type,
                original_extracted_data=original,
                user_corrected_data=corrected,
                confidence_score=confidence,
                feedback_signal=feedback_signal,
                feedback_comment=feedback_comment,
                feedback_source=feedback_source,
                submitted_by=request.user,
                retraining_status=(
                    AIFeedbackLog.RetrainingStatus.QUEUED
                    if should_queue_retraining
                    else AIFeedbackLog.RetrainingStatus.NOT_QUEUED
                ),
                retraining_queued_at=retraining_queued_at,
                resolved_by=request.user if corrected else None,
            )
            created = True
        else:
            if document_type:
                row.document_type = row.document_type or document_type
            if original:
                row.original_extracted_data = original
            if corrected:
                row.user_corrected_data = corrected
                row.resolved_by = request.user
            if confidence:
                row.confidence_score = confidence
            if feedback_signal:
                row.feedback_signal = feedback_signal
            if feedback_signal or feedback_comment:
                row.feedback_comment = feedback_comment
            if feedback_source:
                row.feedback_source = feedback_source
            row.submitted_by = request.user
            if should_queue_retraining:
                row.retraining_status = AIFeedbackLog.RetrainingStatus.QUEUED
                row.retraining_queued_at = retraining_queued_at
            row.save()

        # --- RT-02.3: Telemetry + training queue + corrections ---
        try:
            from tenant_apps.ai_assistant.services.feedback_service import (
                EVENT_CORRECTION_APPLIED,
                EVENT_FEEDBACK_SUBMITTED,
                emit_feedback_telemetry,
                process_feedback_with_deps,
                suggest_corrections,
            )
            from tenant_apps.ai_assistant.tasks import queue_feedback_for_training

            # Emit telemetry for submission
            emit_feedback_telemetry(
                tenant=tenant,
                event_type=EVENT_FEEDBACK_SUBMITTED,
                feedback_id=str(row.pk),
                actor_user_id=str(request.user.pk),
                payload={
                    "signal": feedback_signal,
                    "has_correction": bool(corrected),
                    "confidence": confidence,
                    "source": feedback_source,
                },
            )

            # If corrections were applied, emit correction event
            if corrected:
                emit_feedback_telemetry(
                    tenant=tenant,
                    event_type=EVENT_CORRECTION_APPLIED,
                    feedback_id=str(row.pk),
                    actor_user_id=str(request.user.pk),
                    payload={"fields_corrected": list(corrected.keys())},
                )
                # Resolve missing dependencies from corrected data
                process_feedback_with_deps(tenant=tenant, feedback_row=row, user=request.user)

            # Queue for training asynchronously
            if should_queue_retraining:
                queue_feedback_for_training.delay(str(row.pk))

        except Exception:
            # Telemetry/queue failures must not break the user-facing response
            logger.exception("RT-02.3 post-feedback processing failed (non-blocking)")

        # Build response with suggestions for negative feedback
        suggestions = {}
        if feedback_signal == AIFeedbackLog.FeedbackSignal.THUMBS_DOWN:
            try:
                suggestions = suggest_corrections(
                    original_data=original,
                    confidence_score=confidence,
                )
            except Exception:
                pass

        payload = {
            "id": str(row.id),
            "created": created,
            "document_id": str(row.document_id),
            "feedback_signal": row.feedback_signal,
            "retraining_status": row.retraining_status,
            "retraining_queued_at": row.retraining_queued_at.isoformat() if row.retraining_queued_at else None,
            "suggestions": suggestions,
        }
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class RecentErrorsAPIView(APIView):
    """Admin-only diagnostics endpoint for tenant-scoped Sentry issues.

    This mirrors the Swarm tool behavior (get_recent_errors) and is useful for
    debugging the Sentry bridge without involving an LLM call.

    Safety:
    - Enforces active tenant context.
    - If a tenant_id is provided, it must match the active tenant.
    """

    permission_classes = [IsAdminUser]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="tenant_id",
                required=False,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Optional tenant guard; when provided it must match the active tenant.",
            )
        ],
        responses={200: RecentErrorsResponseSerializer, 400: RecentErrorsResponseSerializer},
    )
    def get(self, request):
        import os

        tenant = getattr(request, "tenant", None)
        active_tenant_id = str(getattr(tenant, "id", "") or "")
        if not active_tenant_id:
            return Response({"ok": False, "error": "Tenant context missing", "issues": []}, status=status.HTTP_200_OK)

        tenant_id_arg = str(request.query_params.get("tenant_id") or "").strip()
        if tenant_id_arg and tenant_id_arg != active_tenant_id:
            return Response(
                {"ok": False, "error": "tenant_id must match the active tenant", "issues": []},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from tenant_apps.ai_assistant.services.sentry_issues import fetch_recent_sentry_issues_for_tenant

        token = os.environ.get("SENTRY_AUTH_TOKEN")
        org = os.environ.get("SENTRY_ORG_SLUG") or os.environ.get("SENTRY_ORG") or "meats-central"
        base_url = os.environ.get("SENTRY_BASE_URL") or "https://sentry.io"

        payload = fetch_recent_sentry_issues_for_tenant(
            tenant_id=active_tenant_id,
            token=token,
            org_slug=org,
            base_url=base_url,
            limit=5,
            timeout_seconds=10,
        )
        return Response(payload, status=status.HTTP_200_OK)


class ToolsOpenAPIView(APIView):
    """Compatibility endpoint for the frontend widget.

    Returns OpenAI ChatCompletions-compatible tool schemas.

    Reliability mandate:
    - Always return a safe list (never 500)
    - Do not advertise email tools unless Outlook is connected for this tenant
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ToolsOpenResponseSerializer})
    def get(self, request):
        tenant = getattr(request, "tenant", None)

        try:
            from apps.integrations.models import ExternalAuthProvider

            provider = (
                ExternalAuthProvider.objects.filter(
                    tenant=tenant,
                    provider_type="microsoft",
                    is_active=True,
                )
                .select_related("tenant")
                .first()
                if tenant
                else None
            )

            outlook_connected = bool(provider and not provider.is_token_expired())
        except Exception:
            outlook_connected = False

        email_tools = {"fetch_emails", "check_unread_emails", "draft_outlook_email"}

        if outlook_connected:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            tools = [t for t in DEFAULT_OPENAI_TOOLS if t.get("function", {}).get("name") not in email_tools]

        return Response({"tools": tools}, status=status.HTTP_200_OK)


class PendingReviewView(APIView):
    """Pending-review queue for the frontend widget.

    Queue access matches the roles that receive actionable AI review notifications.
    If a highlighted draft is provided, include it even when it falls outside the
    default queue window so deep links stay deterministic.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PendingReviewListResponseSerializer, 400: OpenApiTypes.OBJECT})
    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not can_access_ai_review_queue(user=request.user, tenant=tenant):
            return Response({"pending_reviews": [], "results": []}, status=status.HTTP_200_OK)

        tenant_id = str(getattr(tenant, "id", "") or "")
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        highlighted_id = str(request.query_params.get("draft") or "").strip() or None
        items = build_pending_review_items(tenant_id, highlighted_id=highlighted_id)

        payload = PendingReviewItemSerializer(items, many=True).data
        return Response({"pending_reviews": payload, "results": payload}, status=status.HTTP_200_OK)


class AIAgentChatView(APIView):
    """Clean chat endpoint wrapper.

    This wraps the ViewSet action so routing is stable and server boot can't fail
    due to DRF router/action wiring.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = "ai_chat"

    @extend_schema(
        request=ChatBotRequestSerializer,
        responses={200: ChatBotResponseSerializer, 400: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        return ChatBotAPIViewSet().chat(request)


class PendingReviewResolveAPIView(APIView):
    """Resolve a HITL item for users who can work the AI review queue.

    Marks AIFeedbackLog.resolved_by and optionally stores user_corrected_data.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle, ScopedRateThrottle]
    throttle_scope = "ai_feedback"

    @extend_schema(
        request=PendingReviewResolveRequestSerializer,
        responses={200: PendingReviewResolveResponseSerializer, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    )
    def post(self, request, feedback_id):
        serializer = PendingReviewResolveRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, "tenant", None)
        if not can_access_ai_review_queue(user=request.user, tenant=tenant):
            return Response(
                {"error": "You do not have access to this AI review queue"}, status=status.HTTP_403_FORBIDDEN
            )

        tenant_id = str(getattr(tenant, "id", "") or "")
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            row = AIFeedbackLog.objects.get(id=feedback_id, tenant_id=tenant_id)
        except AIFeedbackLog.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if row.resolved_by_id:
            return Response(
                {
                    "id": str(row.id),
                    "resolved_by": str(row.resolved_by_id),
                    "precision_delta": float(row.precision_delta or 0.0),
                },
                status=status.HTTP_200_OK,
            )

        corrected = serializer.validated_data.get("user_corrected_data")
        update_fields = ["resolved_by", "modified_on"]
        if corrected is not None:
            row.user_corrected_data = corrected
            row.submitted_by = request.user
            row.feedback_source = row.feedback_source or "ai_inbox"
            row.retraining_status = AIFeedbackLog.RetrainingStatus.QUEUED
            row.retraining_queued_at = timezone.now()
            update_fields.extend(
                ["user_corrected_data", "submitted_by", "feedback_source", "retraining_status", "retraining_queued_at"]
            )

        row.resolved_by = request.user
        row.save(update_fields=update_fields + ["precision_delta"])

        return Response(
            {
                "id": str(row.id),
                "resolved_by": str(request.user.id),
                "precision_delta": float(row.precision_delta or 0.0),
            },
            status=status.HTTP_200_OK,
        )


class BatchResolveAPIView(APIView):
    """Resolve multiple HITL items in a single request.

    Used by the unified modal "Approve All" action to resolve the main
    review item plus all related entity drafts at once.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle, ScopedRateThrottle]
    throttle_scope = "ai_feedback"

    def post(self, request):
        tenant = getattr(request, "tenant", None)
        if not can_access_ai_review_queue(user=request.user, tenant=tenant):
            return Response(
                {"error": "You do not have access to this AI review queue"},
                status=status.HTTP_403_FORBIDDEN,
            )

        tenant_id = str(getattr(tenant, "id", "") or "")
        if not tenant_id:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        feedback_ids = request.data.get("feedback_ids") or []
        if not isinstance(feedback_ids, list) or not feedback_ids:
            return Response(
                {"error": "feedback_ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cap batch size
        feedback_ids = feedback_ids[:50]
        resolved = []
        errors = []

        for fid in feedback_ids:
            try:
                row = AIFeedbackLog.objects.get(id=fid, tenant_id=tenant_id)
                if row.resolved_by_id:
                    resolved.append({"id": str(row.id), "status": "already_resolved"})
                    continue

                row.resolved_by = request.user
                row.save(update_fields=["resolved_by", "modified_on", "precision_delta"])
                resolved.append({"id": str(row.id), "status": "resolved"})
            except AIFeedbackLog.DoesNotExist:
                errors.append({"id": str(fid), "error": "not_found"})
            except Exception as exc:
                errors.append({"id": str(fid), "error": str(exc)[:200]})

        return Response(
            {
                "resolved": resolved,
                "errors": errors,
                "total_resolved": len(resolved),
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# RT-02.4: Cockpit Draft Form ViewSet
# ---------------------------------------------------------------------------


class CockpitDraftFormViewSet(viewsets.ModelViewSet):
    """CRUD for cockpit draft forms routed from AI Inbox.

    Endpoints:
    - POST /api/v1/ai-assistant/cockpit-drafts/ (create from feedback)
    - GET /api/v1/ai-assistant/cockpit-drafts/ (list for tenant)
    - GET /api/v1/ai-assistant/cockpit-drafts/{id}/ (retrieve)
    - PATCH /api/v1/ai-assistant/cockpit-drafts/{id}/ (update form_data/status)
    """

    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_serializer_class(self):
        from tenant_apps.ai_assistant.serializers import (
            CockpitDraftCreateSerializer,
            CockpitDraftFormSerializer,
            CockpitDraftUpdateSerializer,
        )

        if self.action == "create":
            return CockpitDraftCreateSerializer
        if self.action in ("partial_update", "update"):
            return CockpitDraftUpdateSerializer
        return CockpitDraftFormSerializer

    def get_queryset(self):
        from tenant_apps.ai_assistant.models import CockpitDraftForm

        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return CockpitDraftForm.objects.none()
        qs = CockpitDraftForm.objects.filter(tenant=tenant)

        # Optional filters
        form_type = self.request.query_params.get("form_type")
        if form_type:
            qs = qs.filter(form_type=form_type)
        draft_status = self.request.query_params.get("status")
        if draft_status:
            qs = qs.filter(status=draft_status)

        return qs.select_related("assigned_to", "submitted_by")

    def create(self, request, *args, **kwargs):
        from tenant_apps.ai_assistant.models import AIFeedbackLog
        from tenant_apps.ai_assistant.serializers import CockpitDraftCreateSerializer, CockpitDraftFormSerializer
        from tenant_apps.ai_assistant.services.cockpit_routing import create_draft_from_feedback

        serializer = CockpitDraftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context missing"}, status=status.HTTP_400_BAD_REQUEST)

        feedback_id = serializer.validated_data["feedback_id"]
        try:
            feedback_row = AIFeedbackLog.objects.get(pk=feedback_id, tenant=tenant)
        except AIFeedbackLog.DoesNotExist:
            return Response({"error": f"Feedback item {feedback_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        draft = create_draft_from_feedback(
            tenant=tenant,
            feedback_row=feedback_row,
            user=request.user,
        )

        if serializer.validated_data.get("notes"):
            draft.notes = serializer.validated_data["notes"]
            draft.save(update_fields=["notes", "modified_on"])

        out = CockpitDraftFormSerializer(draft)
        return Response(out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        from tenant_apps.ai_assistant.serializers import CockpitDraftFormSerializer, CockpitDraftUpdateSerializer
        from tenant_apps.ai_assistant.services.cockpit_routing import update_draft_status

        draft = self.get_object()
        serializer = CockpitDraftUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Update form_data if provided
        if "form_data" in serializer.validated_data:
            draft.form_data = serializer.validated_data["form_data"]
            draft.save(update_fields=["form_data", "modified_on"])

        # Update notes if provided
        if serializer.validated_data.get("notes"):
            draft.notes = serializer.validated_data["notes"]
            draft.save(update_fields=["notes", "modified_on"])

        # Transition status if provided
        new_status = serializer.validated_data.get("status")
        if new_status:
            try:
                draft = update_draft_status(
                    draft=draft,
                    new_status=new_status,
                    user=request.user,
                    submitted_entity_type=serializer.validated_data.get("submitted_entity_type", ""),
                    submitted_entity_id=serializer.validated_data.get("submitted_entity_id", ""),
                )
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        out = CockpitDraftFormSerializer(draft)
        return Response(out.data, status=status.HTTP_200_OK)
