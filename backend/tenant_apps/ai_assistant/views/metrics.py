"""Metrics views for AI Assistant.

Provides tenant-scoped dashboards for AI learning metrics, confidence scoring,
and learning snapshots used by the Cockpit dashboard.
"""
import logging
from datetime import timedelta

from django.db.models import Avg
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

from ..models import (
    AIDocument,
    AIFeedbackLog,
    AILearningSnapshot,
)
from ..serializers import (
    AILearningMetricsSerializer,
    AILearningSnapshotSerializer,
)

logger = logging.getLogger(__name__)


class AILearningMetricsAPIView(APIView):
    """Tenant-scoped learning metrics for the Cockpit dashboard.

    Returns aggregate metrics including total documents parsed, corrections
    learned, precision score, and a 30-day confidence trend.
    """

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
    """Tenant-scoped confidence scoring metrics for the Cockpit dashboard (AUTO-21.2).

    Returns average confidence, high/low confidence counts, and email processing
    statistics for the last 30 days.
    """

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


class AILearningSnapshotAPIView(APIView):
    """Latest AI learning snapshots for the dashboard.

    Returns up to 30 recent snapshots, optionally filtered by entity_type.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        entity_type = request.query_params.get("entity_type")
        qs = AILearningSnapshot.objects.filter(tenant=tenant)
        if entity_type:
            qs = qs.filter(entity_type=entity_type)

        snapshots = qs.order_by("-period_end")[:30]
        return Response(AILearningSnapshotSerializer(snapshots, many=True).data)
