"""Swarm/tool views for AI Assistant.

Provides endpoints for OpenAI-compatible tool schema discovery and the
staff-only Swarm semantic routing invocation endpoint.
"""
import logging

from django.db import DatabaseError, ProgrammingError
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

from ..serializers import (
    SwarmInvokeRequestSerializer,
    SwarmInvokeResponseSerializer,
    ToolsOpenResponseSerializer,
)
from ..session_utils import get_request_tenant_id
from ..swarm.executor import DEFAULT_OPENAI_TOOLS

logger = logging.getLogger(__name__)


class SwarmToolsOpenAPIView(APIView):
    """Expose tool schemas for PM-AS.

    This endpoint is used by the AIAgentWidget to discover tools.

    Reliability mandate:
    - Always return a safe ``tools`` list shaped for OpenAI ChatCompletions
    - Avoid fragile runtime introspection that could 500

    UX mandate:
    - Do not advertise email tools unless the tenant is actually connected.

    Note: This endpoint is not currently registered in urls.py.
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
        except (DatabaseError, ProgrammingError):
            logger.warning("tools/openapi: failed to load outlook connection status (DB error)", exc_info=True)
        except Exception:
            # Broad catch: Outlook status is non-critical; default to disconnected
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
            from ..swarm.tools.registry import registry

            openapi_doc = registry.to_openapi()
            if not outlook["connected"]:
                openapi_doc["paths"] = {
                    path: spec
                    for path, spec in (openapi_doc.get("paths") or {}).items()
                    if path.rsplit("/", 1)[-1] not in email_tools
                }
            payload["openapi"] = openapi_doc
        except Exception as e:
            # Legacy OpenAPI doc generation is best-effort; failure returns tools without it
            logger.warning("tools/openapi fallback engaged: %s", str(e), exc_info=True)

        return Response(payload, status=status.HTTP_200_OK)


class SwarmInvokeAPIView(APIView):
    """Staff-only entrypoint for PM-AS semantic routing.

    Runs the semantic router and returns the chosen agent chain + rationale.
    Does NOT execute tools or mutate data — safe for diagnostics.
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

        from ..swarm.router import SwarmOrchestrator

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
        except (DatabaseError, ProgrammingError):
            outlook_connected = False
        except Exception:
            # Broad catch: Outlook status check is non-critical; default to disconnected
            outlook_connected = False

        email_tools = {"fetch_emails", "check_unread_emails", "draft_outlook_email"}

        if outlook_connected:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            tools = [t for t in DEFAULT_OPENAI_TOOLS if t.get("function", {}).get("name") not in email_tools]

        return Response({"tools": tools}, status=status.HTTP_200_OK)
