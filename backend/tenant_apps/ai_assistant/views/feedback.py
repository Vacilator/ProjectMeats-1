"""Feedback views for AI Assistant.

Provides endpoints for HITL feedback submission, correction processing,
and implicit/explicit feedback event batching from the frontend.
"""
import logging

from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from ..models import (
    AIFeedbackLog,
)
from ..serializers import (
    AIFeedbackLogSerializer,
    AIFeedbackSubmitSerializer,
    FeedbackEventBatchSerializer,
)

logger = logging.getLogger(__name__)


class AIFeedbackViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Feedback endpoint for human-in-the-loop (HITL) corrections.

    - ``POST /api/v1/ai-assistant/feedback/``: tenant-scoped correction submission
      (used by HITLReviewCard)
    - ``GET /api/v1/ai-assistant/feedback/``: staff-only auditing

    Reads are staff-only to avoid leaking internal training payloads.
    Supports telemetry emission, correction processing, and async retraining queueing.
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
            # Telemetry/queue failures are non-critical and must not break the user-facing response
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
                # Suggestion generation is best-effort; failure returns empty suggestions
                logger.debug("suggest_corrections failed for feedback=%s", row.pk, exc_info=True)

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


class FeedbackEventsAPIView(APIView):
    """Batch endpoint for implicit/explicit feedback events.

    Frontend batches events in memory and flushes here every 30s.
    Fire-and-forget — always returns 202.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FeedbackEventBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        events = serializer.validated_data["events"]
        # Store as AIFeedbackLog entries with implicit signal fields
        bulk_logs = []
        for event in events:
            # Map event_type to implicit_signal
            signal_map = {
                "implicit_accept": "accepted_as_is",
                "implicit_field_correction": "field_correction",
                "implicit_dismiss": "dismissed_after_view",
                "implicit_timing": "accepted_as_is",
                "implicit_search_intent": "search_navigate",
                "implicit_undo": "undo_revert",
                "implicit_suggestion_click": "suggestion_clicked",
                "implicit_suggestion_dismiss": "suggestion_dismissed",
            }
            implicit_signal = signal_map.get(event.get("event_type", ""), "")

            log = AIFeedbackLog(
                tenant=tenant,
                document_id=event.get("entity_id") or "00000000-0000-0000-0000-000000000000",
                document_type=event.get("entity_type", "unknown"),
                implicit_signal=implicit_signal,
                source_surface=event.get("source_surface", ""),
                source_entity_type=event.get("entity_type", ""),
                source_entity_id=event.get("entity_id", ""),
                confidence_score=event.get("confidence_score") or 0.0,
                review_duration_ms=event.get("resolution_time_ms"),
                feedback_signal="thumbs_up" if event.get("event_type", "").endswith("_up") else
                                "thumbs_down" if event.get("event_type", "").endswith("_down") else None,
                submitted_by=request.user,
                original_extracted_data={"ai_value": event.get("ai_value")} if event.get("ai_value") else {},
                user_corrected_data={"user_value": event.get("user_value")} if event.get("user_value") else {},
            )
            if event.get("field_name"):
                log.fields_modified_by_user = [event["field_name"]]
            bulk_logs.append(log)

        if bulk_logs:
            AIFeedbackLog.objects.bulk_create(bulk_logs, ignore_conflicts=True)

        return Response({"accepted": len(bulk_logs)}, status=202)
