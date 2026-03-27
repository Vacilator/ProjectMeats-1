"""
Views for AI Assistant functionality.

Provides REST API endpoints for chat interactions, document uploads,
and AI-powered business intelligence for meat market operations.
"""
import logging
import time
from datetime import timedelta

from django.conf import settings
from django.db.models import Avg
from django.db.models.functions import TruncDate
from django.utils import timezone
from openai import OpenAI
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIDocument, AIFeedbackLog, AIConfiguration, ChatMessage, ChatSession, MessageTypeChoices
from .serializers import (
    AIDocumentSerializer,
    AIFeedbackLogSerializer,
    AIFeedbackSubmitSerializer,
    AILearningMetricsSerializer,
    AIConfigurationSerializer,
    ChatBotRequestSerializer,
    ChatBotResponseSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    PendingReviewItemSerializer,
    PendingReviewResolveRequestSerializer,
    SwarmInvokeRequestSerializer,
)

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# OpenAI Swarm/Widget contract
# -----------------------------------------------------------------------------

SWARM_SYSTEM_PROMPT = (
    "You are the ProjectMeats Autonomous Swarm Orchestrator. "
    "You are an expert in wholesale meat logistics, purchase orders, cold storage, and supplier management. "
    "Use tools only when they are available for the tenant (e.g., Outlook connection). "
    "Be highly analytical, concise, and proactive."
)

from tenant_apps.ai_assistant.swarm.executor import DEFAULT_OPENAI_TOOLS


class ChatSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing chat sessions."""

    queryset = ChatSession.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title"]
    ordering_fields = ["created_on", "last_activity", "title"]
    ordering = ["-last_activity"]

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Return chat messages for a session (used by ChatWindow + widget history restore)."""
        session = self.get_object()
        qs = ChatMessage.objects.filter(session=session).order_by('created_on')
        return Response(ChatMessageSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return ChatSessionListSerializer
        return ChatSessionDetailSerializer

    def get_queryset(self):
        """Filter sessions to current user only."""
        from django.db.models import Count

        return self.queryset.filter(owner=self.request.user).annotate(message_count=Count('messages'))

    def perform_create(self, serializer):
        """Set the owner when creating a new session."""
        serializer.save(
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
        return self.queryset.filter(session__owner=self.request.user)


class ChatBotAPIViewSet(viewsets.ViewSet):
    """Simplified chat API for frontend integration."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = 'ai_chat'

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
            # Get or create session
            if session_id:
                try:
                    session = ChatSession.objects.get(id=session_id, owner=request.user)
                except ChatSession.DoesNotExist:
                    return Response(
                        {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # Create new session
                session = ChatSession.objects.create(
                    title=f"Chat {timezone.now().strftime('%Y-%m-%d %H:%M')}",
                    context_data=context,
                    owner=request.user,
                    created_by=request.user,
                    modified_by=request.user,
                )

            # Create user message
            user_msg = ChatMessage.objects.create(
                session=session,
                message_type=MessageTypeChoices.USER,
                content=user_message,
                owner=request.user,
                created_by=request.user,
                modified_by=request.user,
            )

            # Generate AI response (OpenAI via Swarm bounded tool loop)
            import os

            tenant = getattr(request, 'tenant', None)
            if not tenant:
                return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

            # Defense-in-depth: ensure RLS session vars are asserted on this DB connection
            # before any Swarm tool executes queries.
            try:
                from apps.tenants.rls import set_current_tenant

                set_current_tenant(str(getattr(tenant, 'id', '') or ''))
            except Exception:
                pass

            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
            if not openai_api_key:
                return Response(
                    {
                        'error': 'OpenAI not configured (missing OPENAI_API_KEY)',
                        'detail': (
                            'Backend container is missing OPENAI_API_KEY. '
                            'Verify the GitHub Environment secret OPENAI_API_KEY is set for the active backend environment '
                            'and that the deploy-backend job writes it into backend.env / passes it to docker run.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                from apps.system.services.ai_model_resolver import get_active_openai_model_id
                from apps.integrations.models import EmailLog
                from .swarm.router import SwarmOrchestrator

                model_name = get_active_openai_model_id(fallback='gpt-4o-mini')

                history = []

                # --- RAG-lite context injection: last 5 ingested emails for this tenant ---
                try:
                    recent_emails = EmailLog.objects.filter(tenant=tenant).order_by('-received_at')[:5]
                    if recent_emails:
                        email_context = 'Here are the most recently received emails in the system:\n'
                        for email in recent_emails:
                            body_snippet = (email.body_text or '')[:300]
                            email_context += (
                                f"- Date: {email.received_at}, From: {email.sender_name} <{email.sender_email}>\n"
                                f"  Subject: {email.subject}\n"
                                f"  Has Attachments: {email.has_attachments}\n"
                                f"  Body Snippet: {body_snippet}...\n\n"
                            )
                        history.append(
                            {
                                'role': 'system',
                                'content': (
                                    'You have access to recently ingested emails for this tenant. '
                                    'Use this context when answering email-related questions.\n\n'
                                    f'{email_context}'
                                ),
                            }
                        )
                except Exception:
                    pass

                # Include recent session message history (excluding this user message)
                try:
                    recent = (
                        ChatMessage.objects.filter(session=session)
                        .exclude(id=user_msg.id)
                        .order_by('-created_on')[:20]
                    )
                    for row in reversed(list(recent)):
                        role = None
                        if row.message_type == MessageTypeChoices.USER:
                            role = 'user'
                        elif row.message_type == MessageTypeChoices.ASSISTANT:
                            role = 'assistant'
                        elif row.message_type == MessageTypeChoices.SYSTEM:
                            role = 'system'
                        elif row.message_type == MessageTypeChoices.DOCUMENT:
                            role = 'system'

                        if not role:
                            continue

                        content = (row.content or '').strip()
                        if not content:
                            continue

                        if row.message_type == MessageTypeChoices.DOCUMENT:
                            content = f"[Document] {content[:500]}"

                        history.append({'role': role, 'content': content})
                except Exception:
                    pass

                orch = SwarmOrchestrator(tenant_id=str(getattr(tenant, 'id', '') or ''))
                result = orch.run_tool_loop(
                    user_message=user_message,
                    tenant=tenant,
                    user=request.user,
                    history=history,
                )

                response_text = str(result.get('response') or '').strip()
                tokens_used = None

                tools_used = []
                try:
                    trace = result.get('messages') or []
                    for msg in trace:
                        if not isinstance(msg, dict) or msg.get('role') != 'assistant':
                            continue
                        tool_calls = msg.get('tool_calls')
                        if not isinstance(tool_calls, list):
                            continue
                        for tc in tool_calls:
                            if not isinstance(tc, dict):
                                continue
                            fn = tc.get('function')
                            if not isinstance(fn, dict):
                                continue
                            name = fn.get('name')
                            if isinstance(name, str) and name:
                                tools_used.append(name)
                except Exception:
                    pass

            except Exception as e:
                logger.warning('Swarm tool loop failed: %s', str(e), exc_info=True)
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            metadata = {
                'model': model_name,
                'provider': 'openai',
                'tokens_used': tokens_used,
                'response_type': 'swarm_tool_loop',
                'tools_used': sorted(list(set(tools_used))) if tools_used else [],
            }

            # Create AI response message
            ai_msg = ChatMessage.objects.create(
                session=session,
                message_type=MessageTypeChoices.ASSISTANT,
                content=response_text,
                metadata=metadata,
                owner=request.user,
                created_by=request.user,
                modified_by=request.user,
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


class AILearningMetricsAPIView(APIView):
    """Tenant-scoped learning metrics for the Cockpit dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        total_docs = AIDocument.objects.filter(tenant_id=tenant_id).count()

        resolved = AIFeedbackLog.objects.filter(tenant_id=tenant_id, resolved_by__isnull=False)
        corrections = resolved.exclude(user_corrected_data={}).count()

        avg_precision_delta = resolved.aggregate(avg=Avg('precision_delta')).get('avg')
        precision_score = 1.0 - float(avg_precision_delta or 0.0)
        precision_score = max(0.0, min(1.0, precision_score))

        start = timezone.now() - timedelta(days=29)
        trend_qs = (
            AIFeedbackLog.objects.filter(tenant_id=tenant_id, created_on__gte=start)
            .annotate(day=TruncDate('created_on'))
            .values('day')
            .annotate(confidence=Avg('confidence_score'))
            .order_by('day')
        )
        confidence_trend = [
            {'day': str(row['day']), 'confidence': float(row.get('confidence') or 0.0)}
            for row in trend_qs
        ]

        payload = {
            'totalDocumentsParsed': int(total_docs),
            'correctionsLearned': int(corrections),
            'precisionScore': float(precision_score),
            'confidenceTrend': confidence_trend,
        }
        # Defensive schema validation
        out = AILearningMetricsSerializer(data=payload)
        out.is_valid(raise_exception=True)
        return Response(out.data, status=status.HTTP_200_OK)


class AIDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for uploading and listing AI documents."""

    serializer_class = AIDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_on']
    ordering = ['-created_on']

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = AIDocument.objects.all().select_related('tenant', 'owner', 'session')
        qs = qs.filter(owner=self.request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        return qs

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            from rest_framework.exceptions import ValidationError

            raise ValidationError('Tenant context required.')

        instance = serializer.save(
            tenant=tenant,
            owner=self.request.user,
            original_filename=getattr(self.request.FILES.get('file'), 'name', ''),
            content_type=getattr(self.request.FILES.get('file'), 'content_type', '') or '',
            file_size=getattr(self.request.FILES.get('file'), 'size', 0) or 0,
        )

        # If the upload was tied to a session, also create a DOCUMENT message so UIs can show it inline.
        if instance.session_id:
            try:
                ChatMessage.objects.create(
                    session=instance.session,
                    message_type=MessageTypeChoices.DOCUMENT,
                    content=instance.original_filename or 'Document uploaded',
                    metadata={
                        'document_id': str(instance.id),
                        'original_filename': instance.original_filename,
                        'file_url': getattr(instance.file, 'url', ''),
                        'content_type': instance.content_type,
                        'file_size': instance.file_size,
                    },
                    owner=self.request.user,
                    created_by=self.request.user,
                    modified_by=self.request.user,
                )
            except Exception:
                pass


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
            'connected': False,
            'expired': False,
            'connected_email': None,
            'connected_name': None,
        }

        try:
            provider = (
                ExternalAuthProvider.objects.filter(
                    tenant=request.tenant,
                    provider_type='microsoft',
                    is_active=True,
                )
                .select_related('tenant')
                .first()
            )
            if provider:
                outlook['expired'] = bool(provider.is_token_expired())
                outlook['connected_email'] = provider.connected_email
                outlook['connected_name'] = provider.connected_name
                outlook['connected'] = bool(not outlook['expired'])
        except Exception:
            logger.warning('tools/openapi: failed to load outlook connection status', exc_info=True)

        email_tools = {'check_unread_emails', 'draft_outlook_email'}

        if outlook['connected']:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            # Always allow safe internal tools; only hide Outlook tools when not connected.
            tools = [
                t
                for t in DEFAULT_OPENAI_TOOLS
                if t.get('function', {}).get('name') not in email_tools
            ]

        payload = {
            'tools': tools,
            'capabilities': {'outlook': outlook},
        }

        try:
            # Keep legacy OpenAPI-ish document for backward compatibility.
            from .swarm.tools.registry import registry

            payload['openapi'] = registry.to_openapi()
        except Exception as e:
            logger.warning('tools/openapi fallback engaged: %s', str(e), exc_info=True)

        return Response(payload, status=status.HTTP_200_OK)


class SwarmInvokeAPIView(APIView):
    """Staff-only entrypoint for PM-AS routing.

    This is a safe endpoint: it only runs the semantic router and returns the
    chosen agent chain + rationale. It does NOT execute tools or mutate data.
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = SwarmInvokeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        event_type = serializer.validated_data['event_type']
        payload = serializer.validated_data['payload']
        correlation_id = serializer.validated_data.get('correlation_id')

        from .swarm.router import SwarmOrchestrator

        orch = SwarmOrchestrator(tenant_id=tenant_id)
        decision = orch.route(event_type=event_type, payload=payload, correlation_id=correlation_id)

        return Response(
            {
                'tenant_id': tenant_id,
                'correlation_id': correlation_id,
                'event_type': decision.event_type,
                'intent': decision.intent,
                'urgency': decision.urgency,
                'agent_chain': decision.agent_chain,
                'notes': decision.notes,
            },
            status=status.HTTP_200_OK,
        )




class PendingReviewAPIView(APIView):
    """Staff-only queue of HITL items requiring human review.

    Backed by AIFeedbackLog (unresolved rows with low confidence).
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        qs = (
            AIFeedbackLog.objects.filter(
                tenant_id=tenant_id,
                resolved_by__isnull=True,
                confidence_score__lt=0.85,
            )
            .order_by('-created_on')
        )

        items = [
            {
                'id': row.id,
                'document_id': row.document_id,
                'document_type': row.document_type,
                'confidence_score': float(row.confidence_score or 0.0),
                'precision_delta': float(row.precision_delta or 0.0),
                'created_on': row.created_on,
                'original_extracted_data': row.original_extracted_data or {},
            }
            for row in qs[:25]
        ]

        payload = PendingReviewItemSerializer(items, many=True).data
        return Response({'results': payload}, status=status.HTTP_200_OK)


class AIFeedbackViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Feedback endpoint for HITL.

    - `POST /api/v1/ai-assistant/feedback/`: tenant-scoped correction submission (used by HITLReviewCard)
    - `GET /api/v1/ai-assistant/feedback/`: staff-only auditing

    NOTE: We keep reads staff-only to avoid leaking internal training payloads.
    """

    serializer_class = AIFeedbackLogSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_on']
    ordering = ['-created_on']

    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = 'ai_feedback'

    def get_permissions(self):
        if self.action in ['create']:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        if self.action == 'create':
            return AIFeedbackSubmitSerializer
        return AIFeedbackLogSerializer

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = AIFeedbackLog.objects.all().select_related('tenant', 'resolved_by')

        if self.request.user.is_superuser:
            return qs

        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            return AIFeedbackLog.objects.none()

        return qs.filter(tenant_id=tenant_id)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, 'tenant', None)
        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        document_id = serializer.validated_data['document_id']
        document_type = (serializer.validated_data.get('document_type') or 'unknown').strip() or 'unknown'
        original = serializer.validated_data.get('original_extracted_data') or {}
        corrected = serializer.validated_data.get('user_corrected_data') or {}
        confidence = float(serializer.validated_data.get('confidence_score') or 0.0)

        row = (
            AIFeedbackLog.objects.filter(tenant_id=tenant_id, document_id=document_id)
            .order_by('-created_on')
            .first()
        )
        created = False
        if row is None:
            row = AIFeedbackLog.objects.create(
                tenant_id=tenant_id,
                document_id=document_id,
                document_type=document_type,
                original_extracted_data=original,
                user_corrected_data=corrected,
                confidence_score=confidence,
                resolved_by=request.user,
            )
            created = True
        else:
            row.document_type = row.document_type or document_type
            row.original_extracted_data = original or (row.original_extracted_data or {})
            row.user_corrected_data = corrected
            row.confidence_score = confidence or row.confidence_score
            row.resolved_by = request.user
            row.save()

        payload = {
            'id': str(row.id),
            'created': created,
            'document_id': str(row.document_id),
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

    def get(self, request):
        import os

        tenant = getattr(request, 'tenant', None)
        active_tenant_id = str(getattr(tenant, 'id', '') or '')
        if not active_tenant_id:
            return Response({'ok': False, 'error': 'Tenant context missing', 'issues': []}, status=status.HTTP_200_OK)

        tenant_id_arg = str(request.query_params.get('tenant_id') or '').strip()
        if tenant_id_arg and tenant_id_arg != active_tenant_id:
            return Response(
                {'ok': False, 'error': 'tenant_id must match the active tenant', 'issues': []},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from tenant_apps.ai_assistant.services.sentry_issues import fetch_recent_sentry_issues_for_tenant

        token = os.environ.get('SENTRY_AUTH_TOKEN')
        org = os.environ.get('SENTRY_ORG_SLUG') or os.environ.get('SENTRY_ORG') or 'meats-central'
        base_url = os.environ.get('SENTRY_BASE_URL') or 'https://sentry.io'

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

    def get(self, request):
        tenant = getattr(request, 'tenant', None)

        try:
            from apps.integrations.models import ExternalAuthProvider

            provider = (
                ExternalAuthProvider.objects.filter(
                    tenant=tenant,
                    provider_type='microsoft',
                    is_active=True,
                )
                .select_related('tenant')
                .first()
                if tenant
                else None
            )

            outlook_connected = bool(provider and not provider.is_token_expired())
        except Exception:
            outlook_connected = False

        email_tools = {'check_unread_emails', 'draft_outlook_email'}

        if outlook_connected:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            tools = [
                t
                for t in DEFAULT_OPENAI_TOOLS
                if t.get('function', {}).get('name') not in email_tools
            ]

        return Response({'tools': tools}, status=status.HTTP_200_OK)


class PendingReviewView(APIView):
    """Pending-review queue for the frontend widget.

    Safety rule:
    - Non-staff users must not be able to access the HITL queue, so they always
      receive an empty list.
    - Staff users receive the same underlying queue as PendingReviewAPIView.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'pending_reviews': []}, status=status.HTTP_200_OK)

        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        qs = (
            AIFeedbackLog.objects.filter(
                tenant_id=tenant_id,
                resolved_by__isnull=True,
                confidence_score__lt=0.85,
            )
            .order_by('-created_on')
        )

        items = [
            {
                'id': row.id,
                'document_id': row.document_id,
                'document_type': row.document_type,
                'confidence_score': float(row.confidence_score or 0.0),
                'precision_delta': float(row.precision_delta or 0.0),
                'created_on': row.created_on,
                'original_extracted_data': row.original_extracted_data or {},
            }
            for row in qs[:25]
        ]

        payload = PendingReviewItemSerializer(items, many=True).data
        return Response({'pending_reviews': payload, 'results': payload}, status=status.HTTP_200_OK)


class AIAgentChatView(APIView):
    """Clean chat endpoint wrapper.

    This wraps the ViewSet action so routing is stable and server boot can't fail
    due to DRF router/action wiring.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]
    throttle_scope = 'ai_chat'

    def post(self, request):
        return ChatBotAPIViewSet().chat(request)


class PendingReviewResolveAPIView(APIView):
    """Staff-only endpoint to resolve a HITL item.

    Marks AIFeedbackLog.resolved_by and optionally stores user_corrected_data.
    """

    permission_classes = [IsAdminUser]
    throttle_classes = [UserRateThrottle, ScopedRateThrottle]
    throttle_scope = 'ai_feedback'

    def post(self, request, feedback_id):
        serializer = PendingReviewResolveRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            row = AIFeedbackLog.objects.get(id=feedback_id, tenant_id=tenant_id)
        except AIFeedbackLog.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if row.resolved_by_id:
            return Response(
                {
                    'id': str(row.id),
                    'resolved_by': str(row.resolved_by_id),
                    'precision_delta': float(row.precision_delta or 0.0),
                },
                status=status.HTTP_200_OK,
            )

        corrected = serializer.validated_data.get('user_corrected_data')
        if corrected is not None:
            row.user_corrected_data = corrected

        row.resolved_by = request.user
        row.save(update_fields=['user_corrected_data', 'resolved_by', 'precision_delta', 'modified_on'])

        return Response(
            {
                'id': str(row.id),
                'resolved_by': str(request.user.id),
                'precision_delta': float(row.precision_delta or 0.0),
            },
            status=status.HTTP_200_OK,
        )
