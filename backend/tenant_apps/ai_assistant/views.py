"""
Views for AI Assistant functionality.

Provides REST API endpoints for chat interactions, document uploads,
and AI-powered business intelligence for meat market operations.
"""
import logging
import time

from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatMessage, ChatSession, MessageTypeChoices, AIConfiguration
from .serializers import (
    ChatBotRequestSerializer,
    ChatBotResponseSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    AIConfigurationSerializer,
)

logger = logging.getLogger(__name__)


class ChatSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing chat sessions."""

    queryset = ChatSession.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title"]
    ordering_fields = ["created_on", "last_activity", "title"]
    ordering = ["-last_activity"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return ChatSessionListSerializer
        return ChatSessionDetailSerializer

    def get_queryset(self):
        """Filter sessions to current user only."""
        return self.queryset.filter(owner=self.request.user)

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

            # Generate AI response (simplified mock for now)
            response_text = self._generate_mock_response(user_message)
            metadata = {
                "model": "gpt-4o-mini",
                "provider": "openai",
                "tokens_used": len(user_message) // 4,
                "response_type": "mock",
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

    def _generate_mock_response(self, user_message: str) -> str:
        """Generate a mock AI response for demonstration purposes."""
        message_lower = user_message.lower()

        # Meat industry specific responses
        if any(word in message_lower for word in ["supplier", "suppliers"]):
            return "I can help you manage your meat suppliers. Our system tracks supplier performance, pricing, and delivery schedules. Would you like me to show you current supplier metrics or help you find new suppliers for specific meat products?"

        elif any(word in message_lower for word in ["purchase order", "po", "order"]):
            return "I can assist with purchase order management. I can help you create new POs, track existing orders, analyze spending patterns, and ensure compliance with quality standards. What specific aspect of purchase order management would you like help with?"

        elif any(word in message_lower for word in ["customer", "customers", "client"]):
            return "I can help you manage customer relationships and analyze customer data. Our system tracks customer preferences, order history, and payment patterns. Would you like to review customer performance or get insights about customer trends?"

        elif any(word in message_lower for word in ["inventory", "stock"]):
            return "I can help you monitor inventory levels, track product movements, and optimize stock management. Our system provides real-time inventory data and can suggest reorder points. What inventory information do you need?"

        elif any(word in message_lower for word in ["price", "pricing", "cost"]):
            return "I can analyze pricing trends, compare supplier costs, and help optimize your procurement strategy. Our system tracks historical pricing data and market trends. Would you like to see current price analysis or historical trends?"

        elif any(
            word in message_lower for word in ["quality", "compliance", "inspection"]
        ):
            return "I can help you manage quality standards and compliance requirements. Our system tracks USDA regulations, HACCP compliance, and quality inspection results. What quality management information do you need?"

        elif any(
            word in message_lower for word in ["delivery", "shipping", "logistics"]
        ):
            return "I can help you track deliveries, optimize logistics, and manage carrier relationships. Our system monitors delivery performance and can suggest improvements. What delivery or logistics information would you like?"

        elif any(word in message_lower for word in ["report", "analytics", "analysis"]):
            return "I can generate various reports and analytics for your meat business operations. Available reports include supplier performance, customer analysis, inventory trends, and financial summaries. What type of analysis would you like me to prepare?"

        elif (
            "hello" in message_lower or "hi" in message_lower or "help" in message_lower
        ):
            return "Hello! I'm your AI assistant for meat market operations. I can help you with supplier management, purchase orders, customer relationships, inventory tracking, pricing analysis, and compliance. What would you like assistance with today?"

        else:
            return f"Thank you for your message. I'm designed to help with meat market operations including supplier management, purchase orders, customer relationships, and business analytics. I understand you mentioned: '{user_message[:100]}...' - could you provide more specific details about what you'd like help with?"


class SwarmToolsOpenAPIView(APIView):
    """Expose an OpenAPI-ish tool schema document for PM-AS.

    This is intentionally read-only and staff-only to reduce the risk of
    accidentally exposing tool invocation.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        from .swarm.tools.registry import registry

        return Response(registry.to_openapi(), status=status.HTTP_200_OK)


class SwarmInvokeAPIView(APIView):
    """Staff-only entrypoint for PM-AS routing.

    This is a safe endpoint: it only runs the semantic router and returns the
    chosen agent chain + rationale. It does NOT execute tools or mutate data.
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        event_type = (request.data or {}).get('event_type')
        payload = (request.data or {}).get('payload')
        correlation_id = (request.data or {}).get('correlation_id')

        if event_type not in {'email', 'user_chat', 'webhook'}:
            return Response({'error': 'Unsupported event_type'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(payload, dict):
            return Response({'error': 'payload must be an object'}, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request, 'tenant', None)
        tenant_id = str(getattr(tenant, 'id', '') or '')
        if not tenant_id:
            return Response({'error': 'Tenant context missing'}, status=status.HTTP_400_BAD_REQUEST)

        from .swarm.router import SwarmOrchestrator

        orch = SwarmOrchestrator(tenant_id=tenant_id)
        decision = orch.route(event_type=event_type, payload=payload, correlation_id=correlation_id)

        return Response(
            {
                'tenant_id': tenant_id,
                'event_type': decision.event_type,
                'intent': decision.intent,
                'urgency': decision.urgency,
                'agent_chain': decision.agent_chain,
                'notes': decision.notes,
            },
            status=status.HTTP_200_OK,
        )
