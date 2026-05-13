"""apps.integrations.views

OAuth integration views for external email providers.
"""

import logging
import secrets
from datetime import timedelta

from django.core import signing
from django.core.cache import cache
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from celery.result import AsyncResult
from drf_spectacular.utils import extend_schema

from .email_failure_contract import (
    EMAIL_INTEGRATIONS_CTA,
    build_email_failure,
    build_sync_action,
    build_sync_failure_response,
    failure_from_log_fields,
    failure_from_stats,
)
from .microsoft.utils import get_microsoft_redirect_uri
from .models import ExternalAuthProvider
from .providers import MicrosoftGraphProvider
from .providers.base import AuthenticationError, EmailProviderError
from .serializers import (
    EmailAutoSyncQueuedResponseSerializer,
    EmailAutoSyncStatusResponseSerializer,
    EmailLogListResponseSerializer,
    EmailSyncResponseSerializer,
)

logger = logging.getLogger(__name__)

AUTO_SYNC_SOURCES = {"login", "interval", "manual"}
AUTO_SYNC_TASK_CACHE_TTL_SECONDS = 60 * 60 * 4


def _normalize_auto_sync_source(raw_source):
    if isinstance(raw_source, str):
        normalized = raw_source.strip().lower()
        if normalized in AUTO_SYNC_SOURCES:
            return normalized
    return "interval"


def _auto_sync_task_cache_key(task_id: str) -> str:
    return f"integrations.email_auto_sync.tenant:{task_id}"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_auth_url(request):
    """
    Generate OAuth authorization URL for connecting email provider.

    Query params:
        provider: 'microsoft' or 'google'
    """
    provider_type = request.GET.get("provider", "microsoft")

    if provider_type not in ["microsoft", "google"]:
        return Response({"error": "Invalid provider type"}, status=status.HTTP_400_BAD_REQUEST)

    # Resolve tenant context.
    # IMPORTANT: This endpoint is often reached via full-page navigation (not XHR),
    # so X-Tenant-ID header may be missing. Allow explicit tenant_id query param.
    tenant_id = request.GET.get("tenant_id")
    tenant = getattr(request, "tenant", None)

    if tenant_id:
        from apps.tenants.models import Tenant, TenantUser

        if not (
            request.user.is_superuser
            or TenantUser.objects.filter(tenant_id=tenant_id, user=request.user, is_active=True).exists()
        ):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    # Generate signed state token (fallback when session cookies are blocked).
    nonce = secrets.token_urlsafe(16)
    state = signing.dumps(
        {
            "tenant_id": str(tenant.id),
            "user_id": str(request.user.id),
            "provider": provider_type,
            "nonce": nonce,
        },
        salt="integrations.oauth.state",
    )

    # Store state + tenant in session for strict validation where possible.
    request.session[f"oauth_state_{provider_type}"] = state
    request.session[f"oauth_tenant_{provider_type}"] = str(tenant.id)

    # Build redirect URI (must match callback path and include /api/v1 sub-path routing)
    callback_path = f"/api/v1/integrations/oauth/callback/{provider_type}/"
    redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

    # Get provider instance
    if provider_type == "microsoft":
        try:
            provider = MicrosoftGraphProvider(tenant.id)
        except EmailProviderError as e:
            return Response(
                {
                    "error": str(e),
                    "code": "provider_not_configured",
                    "provider": provider_type,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    else:
        return Response({"error": "Provider not implemented yet"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    try:
        # Generate auth URL
        auth_response = provider.get_auth_url(redirect_uri, state)
    except AuthenticationError as e:
        return Response(
            {
                "error": str(e),
                "code": "oauth_init_failed",
                "provider": provider_type,
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # By default we return JSON (existing behavior). Some UI flows prefer a direct 302.
    if request.GET.get("redirect") in {"1", "true", "yes"}:
        return redirect(auth_response.auth_url)

    return Response(
        {
            "auth_url": auth_response.auth_url,
            "provider": provider_type,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_callback(request, provider_type):
    """
    Handle OAuth callback from provider.

    Path params:
        provider_type: 'microsoft' or 'google'

    Query params:
        code: Authorization code
        state: CSRF state token
        error: Error message (if authorization failed)
    """
    # Check for errors
    error = request.GET.get("error")
    if error:
        error_description = request.GET.get("error_description", "Unknown error")
        return redirect(f"/settings?error={error}&description={error_description}")

    # Get authorization code
    code = request.GET.get("code")
    if not code:
        return redirect("/settings?error=no_code")

    # Validate signed state for CSRF protection + identity binding.
    state = request.GET.get("state")

    expected_state = request.session.get(f"oauth_state_{provider_type}")
    if not expected_state or state != expected_state:
        request.session.pop(f"oauth_state_{provider_type}", None)
        request.session.pop(f"oauth_tenant_{provider_type}", None)
        return redirect("/settings?error=invalid_state")

    try:
        state_payload = signing.loads(state or "", salt="integrations.oauth.state", max_age=15 * 60)
    except (signing.BadSignature, signing.SignatureExpired, Exception) as e:
        logger.warning("OAuth state validation failed: %s", type(e).__name__)
        state_payload = None

    if not state_payload or state_payload.get("provider") != provider_type:
        return redirect("/settings?error=invalid_state")

    # Get tenant + initiating user from session or signed payload
    tenant_id = request.session.get(f"oauth_tenant_{provider_type}") or (state_payload or {}).get("tenant_id")
    user_id = (state_payload or {}).get("user_id")
    if not tenant_id or not user_id:
        return redirect("/settings?error=invalid_state")

    try:
        from apps.tenants.models import Tenant, TenantUser

        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return redirect("/settings?error=tenant_not_found")

    # Enforce tenant membership for the initiating user.
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        initiating_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return redirect("/settings?error=user_not_found")

    if not (
        getattr(initiating_user, "is_superuser", False)
        or TenantUser.objects.filter(tenant=tenant, user=initiating_user, is_active=True).exists()
    ):
        return redirect("/settings?error=permission_denied")

    # Set RLS context BEFORE any tenant-scoped ORM writes.
    from apps.tenants.rls import reset_current_tenant, set_current_tenant

    rls_result = set_current_tenant(str(tenant.id))
    if not rls_result.ok:
        logger.error("Failed to set RLS context for OAuth callback: %s", rls_result.error)
        return redirect("/settings?error=internal_error")

    try:
        return _complete_oauth_exchange(request, tenant, provider_type, code)
    finally:
        reset_current_tenant()


def _complete_oauth_exchange(request, tenant, provider_type, code):
    """Exchange OAuth code for tokens and persist them under RLS context."""
    # Build redirect URI (must match the one used in get_auth_url)
    callback_path = f"/api/v1/integrations/oauth/callback/{provider_type}/"
    redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

    # Get provider instance
    if provider_type == "microsoft":
        try:
            provider = MicrosoftGraphProvider(tenant.id)
        except EmailProviderError as e:
            logger.warning("OAuth provider not configured: %s", e)
            return redirect("/settings?error=provider_not_configured")
    else:
        return redirect("/settings?error=provider_not_supported")

    try:
        # Exchange code for tokens
        token_response = provider.exchange_code(code, redirect_uri)

        # Get user info
        user_info = provider.get_user_info(token_response.access_token)

        # Store tokens in database (RLS context already set by caller)
        auth_provider, created = ExternalAuthProvider.objects.update_or_create(
            tenant=tenant,
            provider_type=provider_type,
            defaults={
                "is_active": True,
                "token_expiry": timezone.now() + timedelta(seconds=token_response.expires_in),
                "connected_email": user_info.get("email"),
                "connected_name": user_info.get("name"),
            },
        )

        # Encrypt and store tokens
        auth_provider.set_encrypted_token("access", token_response.access_token)
        if token_response.refresh_token:
            auth_provider.set_encrypted_token("refresh", token_response.refresh_token)
        auth_provider.save()

        # Clean up session
        request.session.pop(f"oauth_state_{provider_type}", None)
        request.session.pop(f"oauth_tenant_{provider_type}", None)

        # Redirect to success page
        return redirect("/settings?success=connected")

    except (AuthenticationError, EmailProviderError) as e:
        logger.warning("OAuth exchange failed: %s", e)
        return redirect("/settings?error=exchange_failed")
    except Exception:
        logger.exception("Unexpected OAuth callback failure for provider=%s", provider_type)
        return redirect("/settings?error=exchange_failed")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_connection_status(request):
    """
    Get OAuth connection status for all providers.
    """
    if not request.tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    providers = ExternalAuthProvider.objects.filter(tenant=request.tenant, is_active=True)

    connections = []
    for provider in providers:
        try:
            provider.refresh_if_needed()
        except Exception:
            logger.warning(
                "OAuth status refresh failed tenant=%s provider=%s",
                getattr(request.tenant, "id", None),
                provider.provider_type,
                exc_info=True,
            )

        connections.append(
            {
                "provider": provider.provider_type,
                "provider_name": provider.get_provider_type_display(),
                "connected_email": provider.connected_email,
                "connected_name": provider.connected_name,
                "is_expired": provider.is_token_expired(),
                "connected_at": provider.created_at.isoformat(),
                "reconnect_action": build_sync_action(
                    build_email_failure("OUTLOOK_CONNECTION_EXPIRED", stage="oauth_status"),
                    tenant_id=str(request.tenant.id),
                )
                if provider.is_token_expired()
                else None,
            }
        )

    return Response(
        {
            "connections": connections,
            "count": len(connections),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def disconnect_provider(request):
    """
    Disconnect an OAuth provider.

    Body:
        provider: 'microsoft' or 'google'
    """
    provider_type = request.data.get("provider")

    if not provider_type:
        return Response({"error": "Provider type required"}, status=status.HTTP_400_BAD_REQUEST)

    if not request.tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        provider = ExternalAuthProvider.objects.get(tenant=request.tenant, provider_type=provider_type)
        provider.is_active = False
        provider.save()

        return Response(
            {
                "message": "Provider disconnected successfully",
                "provider": provider_type,
            }
        )
    except ExternalAuthProvider.DoesNotExist:
        return Response({"error": "Provider not found"}, status=status.HTTP_404_NOT_FOUND)


@extend_schema(
    tags=["Integrations"],
    responses={
        200: EmailAutoSyncQueuedResponseSerializer,
        202: EmailAutoSyncQueuedResponseSerializer,
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def schedule_email_sync(request):
    """Queue a tenant-scoped email sync for login and background AI inbox refresh."""
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    tenant_id = str(tenant.id)
    source = _normalize_auto_sync_source(getattr(request, "data", {}).get("source"))
    provider = ExternalAuthProvider.objects.filter(
        tenant=tenant,
        provider_type="microsoft",
        is_active=True,
    ).first()
    if not provider:
        failure = build_email_failure("OUTLOOK_NOT_CONNECTED", stage="sync_queue")
        return Response(
            {
                "ok": False,
                "accepted": False,
                "message": failure["message"],
                "code": "not_connected",
                "tenant_id": tenant_id,
                "source": source,
                "action": build_sync_action(failure, tenant_id=tenant_id),
                "failure": failure,
            },
            status=status.HTTP_200_OK,
        )

    try:
        from apps.integrations.tasks import sync_single_tenant

        task = sync_single_tenant.apply_async(args=[tenant_id])
    except Exception as sync_err:
        logger.error(
            "Failed to queue email auto-sync for tenant %s: %s",
            tenant_id,
            str(sync_err),
            exc_info=True,
        )
        failure = build_email_failure(
            "EMAIL_SYNC_SCHEDULE_FAILED",
            stage="sync_queue",
            detail_type=sync_err.__class__.__name__,
        )
        return Response(
            {
                "ok": False,
                "accepted": False,
                "message": failure["message"],
                "code": "sync_schedule_failed",
                "tenant_id": tenant_id,
                "source": source,
                "action": build_sync_action(failure, tenant_id=tenant_id),
                "failure": failure,
                "details": {
                    "type": sync_err.__class__.__name__,
                },
            },
            status=status.HTTP_200_OK,
        )

    cache.set(_auto_sync_task_cache_key(task.id), tenant_id, timeout=AUTO_SYNC_TASK_CACHE_TTL_SECONDS)

    return Response(
        {
            "ok": True,
            "accepted": True,
            "message": "Email sync queued",
            "tenant_id": tenant_id,
            "source": source,
            "provider_email": provider.connected_email,
            "task_id": task.id,
            "progress": {
                "phase": "queued",
                "percent": 5,
                "summary": "Email sync queued. Checking Outlook shortly…",
            },
        },
        status=status.HTTP_202_ACCEPTED,
    )


@extend_schema(tags=["Integrations"], responses={200: EmailAutoSyncStatusResponseSerializer})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_scheduled_email_sync_status(request, task_id):
    """Return task status for a previously queued tenant email sync."""
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    expected_tenant_id = cache.get(_auto_sync_task_cache_key(task_id))
    if expected_tenant_id and str(expected_tenant_id) != str(tenant.id):
        return Response({"error": "Sync task not found"}, status=status.HTTP_404_NOT_FOUND)

    result = AsyncResult(task_id)
    raw_result_info = getattr(result, "info", None)
    result_info = raw_result_info if isinstance(raw_result_info, dict) else None
    info_tenant_id = str((result_info or {}).get("tenant_id") or "").strip()
    if info_tenant_id and info_tenant_id != str(tenant.id):
        return Response({"error": "Sync task not found"}, status=status.HTTP_404_NOT_FOUND)

    if not result.ready() and not expected_tenant_id and not info_tenant_id:
        return Response({"error": "Sync task not found"}, status=status.HTTP_404_NOT_FOUND)

    payload = {
        "task_id": task_id,
        "state": result.state,
        "ready": result.ready(),
        "successful": result.successful(),
        "failed": result.failed(),
    }
    if result_info and isinstance(result_info.get("progress"), dict):
        payload["progress"] = result_info["progress"]

    if result.ready() and isinstance(result.result, dict):
        task_tenant_id = str(result.result.get("tenant_id") or "").strip()
        if task_tenant_id and task_tenant_id != str(tenant.id):
            return Response({"error": "Sync task not found"}, status=status.HTTP_404_NOT_FOUND)
        payload["result"] = result.result
        if isinstance(result.result.get("progress"), dict):
            payload["progress"] = result.result["progress"]
        if result.result.get("success") is False:
            payload["successful"] = False
            payload["failed"] = True

    return Response(payload, status=status.HTTP_200_OK)


@extend_schema(
    tags=["Integrations"],
    responses={
        200: EmailSyncResponseSerializer,
        400: EmailSyncResponseSerializer,
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_emails(request):
    """Manually trigger email sync for current tenant (synchronous).

    This endpoint backs a user-initiated "Sync Now" action, so we execute inline
    and return stats immediately. It should avoid hard-500s for common operational
    issues and instead return clear error payloads.
    """
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    tenant_id = str(tenant.id)

    # Preflight: ensure Outlook is actually connected for this tenant.
    provider = ExternalAuthProvider.objects.filter(
        tenant=tenant,
        provider_type="microsoft",
        is_active=True,
    ).first()
    if not provider:
        failure = build_email_failure("OUTLOOK_NOT_CONNECTED", stage="sync_manual")
        return Response(
            {
                "error": failure["message"],
                "code": "not_connected",
                "error_code": "not_connected",
                "hint": failure["hint"],
                "action": build_sync_action(failure, tenant_id=tenant_id),
                "cta": EMAIL_INTEGRATIONS_CTA,
                "tenant_id": tenant_id,
                "failure": failure,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

        # User-triggered sync must be fast enough for an HTTP request.
        # Scan a bounded number of pages; deeper scans happen via scheduled/background jobs.
        service = EmailIngestionService(max_pages_attachments=2, max_pages_all=2, max_messages=400)
        stats = service.poll_tenant_by_id(tenant_id)

        if isinstance(stats, dict) and stats.get("error"):
            failure = failure_from_stats(stats, stage="sync_manual") or build_email_failure(
                "EMAIL_SYNC_FAILED",
                message=str(stats.get("error") or ""),
                stage="sync_manual",
            )
            payload, response_status = build_sync_failure_response(
                failure,
                tenant_id=tenant_id,
                provider_email=provider.connected_email,
                stats=stats,
            )
            if response_status == status.HTTP_200_OK:
                response_status = status.HTTP_400_BAD_REQUEST
            return Response(payload, status=response_status)

        # If Graph/token/decrypt failed, do NOT report "no new emails".
        # IMPORTANT: This is still an application-level failure, but not a server availability failure.
        # Returning 503 here makes the UI look "broken" even though we have actionable diagnostics.
        if isinstance(stats, dict) and stats.get("errors", 0) and stats.get("emails_scanned", 0) == 0:
            failure = failure_from_stats(stats, stage="sync_manual") or build_email_failure(
                "EMAIL_SYNC_FAILED",
                stage="sync_manual",
            )
            payload, response_status = build_sync_failure_response(
                failure,
                tenant_id=tenant_id,
                provider_email=provider.connected_email,
                stats=stats,
            )
            return Response(payload, status=response_status)

        return Response(
            {
                "ok": True,
                "message": "Email sync completed",
                "tenant_id": tenant_id,
                "provider_email": provider.connected_email,
                "stats": stats,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        sync_err = e
        logger.error("Failed to sync emails for tenant %s: %s", tenant_id, str(sync_err), exc_info=True)
        if "decrypt" in str(sync_err).lower():
            failure = build_email_failure(
                "DECRYPTION_FAILED",
                stage="sync_manual_exception",
                detail_type=sync_err.__class__.__name__,
            )
        else:
            failure = build_email_failure(
                "EMAIL_SYNC_FAILED",
                stage="sync_manual_exception",
                detail_type=sync_err.__class__.__name__,
            )
        payload, response_status = build_sync_failure_response(
            failure,
            tenant_id=tenant_id,
            provider_email=provider.connected_email,
        )
        payload.setdefault("details", {})["type"] = sync_err.__class__.__name__
        return Response(payload, status=response_status)


@extend_schema(tags=["Integrations"], responses={200: EmailLogListResponseSerializer})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_email_logs(request):
    """Get recent email ingestion logs for current tenant."""
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    # Get query params
    limit = min(int(request.GET.get("limit", 10)), 50)
    status_filter = request.GET.get("status")

    # Build queryset
    from .models import EmailLog

    queryset = EmailLog.objects.filter(tenant=tenant)

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    # Get recent emails
    emails = queryset.select_related("provider", "review_draft").order_by("-created_at")[:limit]

    # Serialize (contract expected by frontend IngestionMonitor.tsx)
    email_data = []
    for email in emails:
        sender = email.sender_email
        if email.sender_name:
            sender = f"{email.sender_name} <{email.sender_email}>"

        # Build attachment summary from attachment_data if present
        attachment_info = {}
        att_data = getattr(email, "attachment_data", None)
        if att_data and isinstance(att_data, dict):
            files = att_data.get("files") or []
            attachment_info = {
                "attachment_count": len(files),
                "attachment_filenames": [str(f.get("name", "")) for f in files if f.get("name")],
            }

        email_data.append(
            {
                "id": str(email.id),
                "message_id": email.message_id,
                "subject": email.subject,
                "sender": sender,
                "status": email.status,
                "provider_type": email.provider.provider_type if email.provider else None,
                "has_attachments": email.has_attachments,
                "extracted_data": email.extracted_data,
                "related_order_id": email.related_order_id,
                **attachment_info,
                "draft": (
                    {
                        "id": str(email.review_draft.id),
                        "draft_type": email.review_draft.draft_type,
                        "status": email.review_draft.status,
                        "summary": email.review_draft.summary,
                        "classification_confidence": email.review_draft.classification_confidence,
                    }
                    if getattr(email, "review_draft", None) is not None
                    else None
                ),
                "error_message": email.processing_error,
                "failure": failure_from_log_fields(
                    failure_code=getattr(email, "failure_code", None),
                    status_metadata=getattr(email, "status_metadata", None),
                    processing_error=email.processing_error,
                ),
                "created_at": email.created_at.isoformat(),
                "processed_at": email.processed_at.isoformat() if email.processed_at else None,
            }
        )

    return Response({"emails": email_data, "count": len(email_data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_email_stats(request):
    """Aggregate email classification statistics for current tenant.

    Returns confidence-score distribution (histogram buckets), auto-approve
    vs manual-review breakdown, category counts, and success/failure rates.
    Used by the Cockpit confidence-scoring dashboard widget.
    """
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    from django.db.models import Avg, Count

    from .models import EmailLog, EmailReviewDraft

    # Overall email counts by status
    email_status_counts = dict(
        EmailLog.objects.filter(tenant=tenant)
        .values_list("status")
        .annotate(cnt=Count("id"))
        .values_list("status", "cnt")
    )
    total_emails = sum(email_status_counts.values())

    # Draft stats
    drafts_qs = EmailReviewDraft.objects.filter(tenant=tenant)
    total_drafts = drafts_qs.count()

    # Category breakdown
    category_counts = dict(
        drafts_qs.values_list("draft_type").annotate(cnt=Count("id")).values_list("draft_type", "cnt")
    )

    # Status breakdown (pending_review / reviewed / dismissed)
    draft_status_counts = dict(drafts_qs.values_list("status").annotate(cnt=Count("id")).values_list("status", "cnt"))

    # Auto-approved count: reviewed drafts with confidence >= 0.98
    auto_approved = drafts_qs.filter(status="reviewed", classification_confidence__gte=0.98).count()
    manual_reviewed = draft_status_counts.get("reviewed", 0) - auto_approved

    # Average confidence
    avg_confidence = drafts_qs.aggregate(avg=Avg("classification_confidence"))["avg"] or 0.0

    # Confidence histogram (10 buckets: 0-0.1, 0.1-0.2, ..., 0.9-1.0)
    confidence_buckets = []
    bucket_ranges = [(i / 10, (i + 1) / 10) for i in range(10)]
    for low, high in bucket_ranges:
        if high < 1.0:
            cnt = drafts_qs.filter(
                classification_confidence__gte=low,
                classification_confidence__lt=high,
            ).count()
        else:
            cnt = drafts_qs.filter(
                classification_confidence__gte=low,
                classification_confidence__lte=high,
            ).count()
        confidence_buckets.append({"range": f"{low:.1f}-{high:.1f}", "count": cnt})

    # High-confidence rate (>= 0.9)
    high_confidence_count = drafts_qs.filter(classification_confidence__gte=0.9).count()

    return Response(
        {
            "total_emails": total_emails,
            "email_status_counts": email_status_counts,
            "total_drafts": total_drafts,
            "category_counts": category_counts,
            "draft_status_counts": draft_status_counts,
            "auto_approved": auto_approved,
            "manual_reviewed": manual_reviewed,
            "dismissed": draft_status_counts.get("dismissed", 0),
            "pending_review": draft_status_counts.get("pending_review", 0),
            "avg_confidence": round(avg_confidence, 3),
            "high_confidence_rate": (round(high_confidence_count / total_drafts, 3) if total_drafts else 0.0),
            "confidence_histogram": confidence_buckets,
        }
    )
