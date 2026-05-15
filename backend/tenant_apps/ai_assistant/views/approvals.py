"""Approval views for AI Assistant.

Provides viewsets and APIViews for the AI approval workflow, including
human-in-the-loop (HITL) review queues, resolution, batch operations,
and external approval queue management.
"""
import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

from ..models import (
    AIApproval,
    AIApprovalStatus,
    AIFeedbackLog,
    AIRun,
    AIRunStatus,
    AITask,
    AITaskStatus,
    ExternalApprovalRequest,
    ExternalApprovalStatus,
)
from ..serializers import (
    AIApprovalActionResponseSerializer,
    AIApprovalResolutionRequestSerializer,
    AIApprovalSerializer,
    ApprovalQueueStatsSerializer,
    ExternalApprovalActionSerializer,
    ExternalApprovalCreateSerializer,
    ExternalApprovalRequestSerializer,
    PendingReviewItemSerializer,
    PendingReviewListResponseSerializer,
    PendingReviewResolveRequestSerializer,
    PendingReviewResolveResponseSerializer,
)
from ..session_utils import get_request_tenant_id
from ._base import (
    _can_review_ai_approvals,
    build_pending_review_items,
    can_access_ai_review_queue,
)
from .control_plane import _TenantScopedAIControlPlaneViewSet

logger = logging.getLogger(__name__)


class AIApprovalViewSet(_TenantScopedAIControlPlaneViewSet):
    """Tenant-scoped viewset for managing AI approval requests.

    Provides list/retrieve plus custom approve and deny actions.
    Owners/admins see all approvals; other users see only their own.
    Supports ordering by created_on, modified_on, resolved_at, and expires_at.
    """

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
        """Approve a pending AI task for execution."""
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
                # Lineage recording is non-critical; must not block approval flow
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
        """Deny a pending AI task, blocking its execution."""
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
                # Lineage recording is non-critical; must not block denial flow
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


class PendingReviewAPIView(APIView):
    """Staff-only queue of HITL items requiring human review.

    Backed by unresolved AIFeedbackLog rows awaiting operator review.
    Note: This endpoint is not currently registered in urls.py.
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
            except (ValueError, TypeError) as exc:
                errors.append({"id": str(fid), "error": str(exc)[:200]})
            except Exception as exc:
                # Broad catch per-item: individual failures must not abort the batch
                logger.warning("Batch resolve failed for feedback_id=%s: %s (type=%s)", fid, exc, type(exc).__name__)
                errors.append({"id": str(fid), "error": str(exc)[:200]})

        return Response(
            {
                "resolved": resolved,
                "errors": errors,
                "total_resolved": len(resolved),
            },
            status=status.HTTP_200_OK,
        )


class ExternalApprovalQueueViewSet(viewsets.ModelViewSet):
    """Approval queue for outbound communications.

    Provides CRUD with custom actions for approve, reject, edit-approve,
    delegate, batch operations, and queue statistics.
    Filterable by type, status, and priority.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ExternalApprovalRequestSerializer

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return ExternalApprovalRequest.objects.none()

        qs = ExternalApprovalRequest.objects.filter(tenant=tenant)

        # Filter by status
        filter_status = self.request.query_params.get("status")
        if filter_status:
            qs = qs.filter(status=filter_status)

        # Filter by type
        request_type = self.request.query_params.get("type")
        if request_type:
            qs = qs.filter(request_type=request_type)

        # Filter by priority
        priority = self.request.query_params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)

        # Only show items relevant to current user (requested_by or delegated_to)
        if not self.request.user.is_superuser:
            from django.db.models import Q
            qs = qs.filter(
                Q(requested_by=self.request.user) | Q(delegated_to=self.request.user)
            )

        return qs

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        serializer.save(tenant=tenant, requested_by=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return ExternalApprovalCreateSerializer
        return ExternalApprovalRequestSerializer

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve a pending external approval request."""
        obj = self.get_object()
        if obj.status != ExternalApprovalStatus.PENDING:
            return Response({"error": "Can only approve pending requests"}, status=400)

        serializer = ExternalApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        obj.status = ExternalApprovalStatus.APPROVED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.reviewer_notes = serializer.validated_data.get("notes", "")
        obj.save()

        return Response(ExternalApprovalRequestSerializer(obj).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject a pending external approval request."""
        obj = self.get_object()
        if obj.status != ExternalApprovalStatus.PENDING:
            return Response({"error": "Can only reject pending requests"}, status=400)

        serializer = ExternalApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        obj.status = ExternalApprovalStatus.REJECTED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.reviewer_notes = serializer.validated_data.get("notes", "")
        obj.save()

        return Response(ExternalApprovalRequestSerializer(obj).data)

    @action(detail=True, methods=["post"], url_path="edit-approve")
    def edit_approve(self, request, pk=None):
        """Edit and approve a pending external approval request."""
        obj = self.get_object()
        if obj.status != ExternalApprovalStatus.PENDING:
            return Response({"error": "Can only edit-approve pending requests"}, status=400)

        serializer = ExternalApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        obj.status = ExternalApprovalStatus.EDITED_AND_APPROVED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.reviewer_notes = serializer.validated_data.get("notes", "")
        obj.edited_content = serializer.validated_data.get("edited_content")
        obj.save()

        return Response(ExternalApprovalRequestSerializer(obj).data)

    @action(detail=True, methods=["post"], url_path="delegate")
    def delegate(self, request, pk=None):
        """Delegate a pending approval request to another user."""
        obj = self.get_object()
        if obj.status != ExternalApprovalStatus.PENDING:
            return Response({"error": "Can only delegate pending requests"}, status=400)

        serializer = ExternalApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        delegate_to_id = serializer.validated_data.get("delegate_to")
        if not delegate_to_id:
            return Response({"error": "delegate_to is required"}, status=400)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            delegate_user = User.objects.get(pk=delegate_to_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        obj.status = ExternalApprovalStatus.DELEGATED
        obj.delegated_to = delegate_user
        obj.reviewer_notes = serializer.validated_data.get("notes", "")
        obj.save()

        # Reset to pending for the delegated user's queue
        obj.status = ExternalApprovalStatus.PENDING
        obj.save()

        return Response(ExternalApprovalRequestSerializer(obj).data)

    @action(detail=False, methods=["post"], url_path="batch")
    def batch_action(self, request):
        """Batch approve or reject multiple requests."""
        action_type = request.data.get("action")  # "approve" or "reject"
        ids = request.data.get("ids", [])
        notes = request.data.get("notes", "")

        if action_type not in ("approve", "reject"):
            return Response({"error": "action must be 'approve' or 'reject'"}, status=400)
        if not ids:
            return Response({"error": "ids required"}, status=400)

        tenant = getattr(request, "tenant", None)
        qs = ExternalApprovalRequest.objects.filter(
            tenant=tenant,
            id__in=ids,
            status=ExternalApprovalStatus.PENDING,
        )

        new_status = (
            ExternalApprovalStatus.APPROVED if action_type == "approve"
            else ExternalApprovalStatus.REJECTED
        )

        count = qs.update(
            status=new_status,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
            reviewer_notes=notes,
        )

        return Response({"updated": count})

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Approval queue statistics."""
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        from django.db.models import Count, Q
        from django.utils import timezone as tz

        today = tz.now().date()

        qs = ExternalApprovalRequest.objects.filter(tenant=tenant)

        stats_data = {
            "pending": qs.filter(status=ExternalApprovalStatus.PENDING).count(),
            "approved_today": qs.filter(
                status__in=[ExternalApprovalStatus.APPROVED, ExternalApprovalStatus.EDITED_AND_APPROVED],
                reviewed_at__date=today,
            ).count(),
            "rejected_today": qs.filter(
                status=ExternalApprovalStatus.REJECTED,
                reviewed_at__date=today,
            ).count(),
            "expired_today": qs.filter(
                status=ExternalApprovalStatus.EXPIRED,
                modified_on__date=today,
            ).count(),
            "by_type": dict(
                qs.filter(status=ExternalApprovalStatus.PENDING)
                .values_list("request_type")
                .annotate(count=Count("id"))
                .values_list("request_type", "count")
            ),
        }

        return Response(ApprovalQueueStatsSerializer(stats_data).data)
