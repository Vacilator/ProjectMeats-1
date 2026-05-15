"""Miscellaneous views for AI Assistant.

Contains views that don't fit neatly into other domain modules:
cockpit draft forms, contextual suggestions, user preferences, and
admin diagnostics.
"""
import logging

from rest_framework import status, viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema

from ..serializers import (
    ContextualSuggestionsRequestSerializer,
    ContextualSuggestionsResponseSerializer,
    RecentErrorsResponseSerializer,
    UserAIPreferencesSerializer,
)
from ..models import UserAIPreferences
from ._base import build_contextual_suggestions

logger = logging.getLogger(__name__)


class CockpitDraftFormViewSet(viewsets.ModelViewSet):
    """CRUD for cockpit draft forms routed from AI Inbox.

    Endpoints:
    - ``POST /api/v1/ai-assistant/cockpit-drafts/`` (create from feedback)
    - ``GET /api/v1/ai-assistant/cockpit-drafts/`` (list for tenant)
    - ``GET /api/v1/ai-assistant/cockpit-drafts/{id}/`` (retrieve)
    - ``PATCH /api/v1/ai-assistant/cockpit-drafts/{id}/`` (update form_data/status)
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


class ContextualSuggestionsAPIView(APIView):
    """Generate AI-powered contextual action suggestions for a given entity.

    Accepts entity type, ID, and current state; returns up to 3 ranked
    suggestions with confidence scores and prompts.
    """

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


class UserAIPreferencesAPIView(APIView):
    """Get or update the current user's AI preferences.

    Creates preferences with defaults on first access (GET).
    Supports partial updates via PATCH.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        prefs, _ = UserAIPreferences.objects.get_or_create(
            tenant=tenant,
            user=request.user,
        )
        return Response(UserAIPreferencesSerializer(prefs).data)

    def patch(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        prefs, _ = UserAIPreferences.objects.get_or_create(
            tenant=tenant,
            user=request.user,
        )
        serializer = UserAIPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RecentErrorsAPIView(APIView):
    """Admin-only diagnostics endpoint for tenant-scoped Sentry issues.

    Mirrors the Swarm tool behavior (get_recent_errors) and is useful for
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
