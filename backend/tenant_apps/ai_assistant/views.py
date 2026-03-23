"""
Views for AI Assistant functionality.

Provides REST API endpoints for chat interactions, document uploads,
and AI-powered business intelligence for meat market operations.
"""
import logging
import time

from django.conf import settings
from django.utils import timezone
from openai import OpenAI
from pgvector.django import CosineDistance
from rest_framework import filters, permissions, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIDocument, AIFeedbackLog, AIConfiguration, ChatMessage, ChatSession, MessageTypeChoices, VectorMemory
from .serializers import (
    AIDocumentSerializer,
    AIFeedbackLogSerializer,
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
    VectorMemorySearchRequestSerializer,
    VectorMemoryUpsertRequestSerializer,
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

            # Generate AI response (live OpenAI - direct completion call)
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
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

            client = OpenAI(api_key=openai_api_key)

            try:
                from apps.system.services.ai_model_resolver import get_active_openai_model_id

                model_name = get_active_openai_model_id(fallback='gpt-4o-mini')

                completion = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {'role': 'system', 'content': SWARM_SYSTEM_PROMPT},
                        {'role': 'user', 'content': user_message},
                    ],
                )
                response_text = ((completion.choices[0].message.content or '') if completion.choices else '').strip()
                tokens_used = getattr(getattr(completion, 'usage', None), 'total_tokens', None)

            except Exception as e:
                logger.warning('OpenAI completion failed: %s', str(e), exc_info=True)
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            metadata = {
                'model': model_name,
                'provider': 'openai',
                'tokens_used': tokens_used,
                'response_type': 'openai',
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

        payload = {
            'tools': DEFAULT_OPENAI_TOOLS if outlook['connected'] else [],
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


class VectorMemorySearchAPIView(APIView):
    """Staff-only vector similarity search over tenant VectorMemory.

    Read-only: this endpoint performs a nearest-neighbor query and returns
    matching records with their distance score.
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = VectorMemorySearchRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        embedding = serializer.validated_data['embedding']
        top_k = serializer.validated_data['top_k']

        qs = (
            VectorMemory.objects.filter(tenant_id=tenant_id)
            .annotate(distance=CosineDistance('embedding', embedding))
            .order_by('distance')
        )
        results = []
        for row in qs[:top_k]:
            content = row.content or ''
            results.append(
                {
                    'id': row.id,
                    'source_type': row.source_type,
                    'document_id': row.document_id,
                    'distance': float(getattr(row, 'distance', 0.0) or 0.0),
                    'content_preview': content[:500],
                    'metadata': row.metadata or {},
                }
            )

        return Response({'results': results}, status=status.HTTP_200_OK)


class VectorMemoryUpsertAPIView(APIView):
    """Staff-only ingestion endpoint for VectorMemory.

    Caller must supply a 1536-dim embedding (no OpenAI dependency here).
    If document_id is provided, best-effort upsert keyed by (tenant, source_type, document_id).
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = VectorMemoryUpsertRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        embedding = serializer.validated_data['embedding']
        source_type = serializer.validated_data['source_type']
        document_id = serializer.validated_data.get('document_id')
        content = serializer.validated_data.get('content', '')
        metadata = serializer.validated_data.get('metadata', {})

        if document_id:
            obj, created = VectorMemory.objects.update_or_create(
                tenant_id=tenant_id,
                source_type=source_type,
                document_id=document_id,
                defaults={
                    'content': content,
                    'metadata': metadata,
                    'embedding': embedding,
                },
            )
        else:
            obj = VectorMemory.objects.create(
                tenant_id=tenant_id,
                source_type=source_type,
                document_id=None,
                content=content,
                metadata=metadata,
                embedding=embedding,
            )
            created = True

        return Response(
            {
                'id': str(obj.id),
                'created': created,
                'source_type': obj.source_type,
                'document_id': str(obj.document_id) if obj.document_id else None,
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


class AIFeedbackViewSet(viewsets.ReadOnlyModelViewSet):
    """Staff-only read access to AIFeedbackLog (for debugging/auditing)."""

    serializer_class = AIFeedbackLogSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_on']
    ordering = ['-created_on']

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = AIFeedbackLog.objects.all().select_related('tenant', 'resolved_by')

        if self.request.user.is_superuser:
            return qs

        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            return AIFeedbackLog.objects.none()

        return qs.filter(tenant_id=tenant_id)


class ToolsOpenAPIView(APIView):
    """Compatibility endpoint for the frontend widget.

    Returns a stable, minimal payload so polling never hard-fails if tool schemas
    or external integrations are unavailable.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'tools': []}, status=status.HTTP_200_OK)


class PendingReviewView(APIView):
    """Compatibility endpoint for the frontend widget.

    This must be safe for non-staff users; it returns an empty queue for now.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'pending_reviews': []}, status=status.HTTP_200_OK)


class AIAgentChatView(APIView):
    """Clean chat endpoint wrapper.

    This wraps the ViewSet action so routing is stable and server boot can't fail
    due to DRF router/action wiring.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        return ChatBotAPIViewSet().chat(request)


class PendingReviewResolveAPIView(APIView):
    """Staff-only endpoint to resolve a HITL item.

    Marks AIFeedbackLog.resolved_by and optionally stores user_corrected_data.
    """

    permission_classes = [IsAdminUser]

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
