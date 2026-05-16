"""Chat views for AI Assistant.

Provides ViewSets and APIViews for chat session management, message handling,
and the main AI chatbot interaction endpoint powered by the Swarm orchestrator.
"""
import logging
import time

from django.conf import settings
from django.db import DatabaseError, ProgrammingError, connection
from django.db.models import Count
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

from ..models import (
    ChatMessage,
    ChatSession,
    MessageTypeChoices,
)
from ..serializers import (
    ChatBotRequestSerializer,
    ChatBotResponseSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
)
from ..services import semantic_cache as ai_semantic_cache
from ..services import tenant_memory_service as ai_tenant_memory_service
from ..session_utils import (
    bind_context_to_tenant,
    get_request_tenant_id,
    get_session_compaction_state,
    get_session_compaction_watermark,
    session_matches_tenant,
)
from ..swarm.executor import DEFAULT_OPENAI_TOOLS
from ._base import ai_not_configured_response

logger = logging.getLogger(__name__)


class ChatSessionViewSet(viewsets.ModelViewSet):
    """Tenant-scoped viewset for managing AI chat sessions.

    Provides CRUD operations for chat sessions and a nested messages endpoint.
    Sessions are scoped to the authenticated user within their active tenant.
    """

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
        tenant_id = get_request_tenant_id(self.request)
        if not tenant_id:
            return self.queryset.none()
        return (
            self.queryset.filter(
                owner=self.request.user,
            )
            .filter(tenant_id=tenant_id)
            .select_related("owner", "tenant")
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
    """Tenant-scoped viewset for managing individual chat messages.

    Messages are scoped to the authenticated user's sessions within the active tenant.
    Supports creating new messages and listing/retrieving existing ones.
    """

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
        ).filter(tenant_id=tenant_id).select_related("session", "owner", "tenant")

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
    """Simplified chat API for frontend integration.

    Handles the complete AI chat flow: session management, message creation,
    Swarm orchestrator invocation, semantic caching, and response delivery.
    Rate-limited via the 'ai_chat' throttle scope.
    """

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
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET app.current_tenant = %s", [tenant_id])
            except (DatabaseError, ProgrammingError) as e:
                logger.warning("Failed to SET app.current_tenant=%s: %s", tenant_id, str(e), exc_info=True)
                return Response(
                    {"error": "Failed to assert tenant context for RLS-safe tool execution"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                from apps.tenants.rls import set_current_tenant

                set_current_tenant(tenant_id)
            except (DatabaseError, ProgrammingError) as rls_err:
                logger.warning("set_current_tenant fallback failed for tenant %s: %s", tenant_id, rls_err)

            openai_api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
            if not openai_api_key:
                return ai_not_configured_response()

            try:
                from apps.integrations.models import EmailLog
                from apps.system.services.ai_model_resolver import get_active_openai_model_id

                from ..swarm.router import SwarmOrchestrator

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
                except (DatabaseError, ProgrammingError):
                    logger.warning("Failed to inject email context for AI assistant (DB error)", exc_info=True)
                except Exception:
                    # Broad catch: email context is non-critical; failure must not block chat
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
                except (DatabaseError, ProgrammingError) as hist_err:
                    logger.warning("Failed to load chat history for session %s: %s", session.id, hist_err, exc_info=True)
                except Exception as hist_err:
                    # Broad catch: history loading is non-critical for generating a response
                    logger.warning("Failed to load chat history for session %s: %s", session.id, hist_err, exc_info=True)

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
                        from ..services.lineage import create_lineage_event

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
                        # Lineage recording is non-critical; must not block the response
                        logger.warning(
                            "Failed to record semantic cache hit lineage message=%s",
                            ai_msg.id,
                            exc_info=True,
                        )
                    try:
                        ai_tenant_memory_service.compact_session_messages(tenant=tenant, session=session)
                    except Exception:
                        # Session compaction is non-critical; must not block the response
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
                except (TypeError, KeyError, ValueError) as tools_err:
                    logger.debug("Failed to extract tools_used from Swarm response: %s", tools_err)

            except Exception as e:
                # Broad catch: Swarm/OpenAI errors are varied and unpredictable;
                # we must return a user-friendly error rather than a 500.
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
                    from ..services.lineage import create_lineage_event

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
                    # Lineage recording is non-critical; must not block the response
                    logger.warning(
                        "Failed to record semantic cache store lineage message=%s",
                        ai_msg.id,
                        exc_info=True,
                    )
            try:
                ai_tenant_memory_service.compact_session_messages(tenant=tenant, session=session)
            except Exception:
                # Session compaction is non-critical; must not block the response
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
            # Broad catch: top-level safety net to prevent unhandled 500s from
            # reaching the client. All specific error paths are handled above.
            logger.error("Error in chat API: %s (type=%s)", str(e), type(e).__name__, exc_info=True)
            processing_time = time.time() - start_time

            return Response(
                {
                    "error": "Failed to generate response",
                    "message": "I apologize, but I am experiencing technical difficulties. Please try again.",
                    "processing_time": processing_time,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIAgentChatView(APIView):
    """Clean chat endpoint wrapper for the AI agent widget.

    Delegates to ChatBotAPIViewSet.chat so routing is stable and server boot
    can't fail due to DRF router/action wiring.
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
