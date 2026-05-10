"""apps.integrations.views

OAuth integration views for external email providers.
"""

import logging
import secrets
from datetime import timedelta

from django.core import signing
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from celery.result import AsyncResult

from .microsoft.utils import get_microsoft_redirect_uri
from .models import ExternalAuthProvider
from .providers import MicrosoftGraphProvider
from .providers.base import AuthenticationError, EmailProviderError

logger = logging.getLogger(__name__)

AUTO_SYNC_SOURCES = {"login", "interval", "manual"}


def _normalize_auto_sync_source(raw_source):
    if isinstance(raw_source, str):
        normalized = raw_source.strip().lower()
        if normalized in AUTO_SYNC_SOURCES:
            return normalized
    return "interval"


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
    from apps.tenants.rls import set_current_tenant, reset_current_tenant

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
        return Response(
            {
                "ok": False,
                "accepted": False,
                "message": "No active Microsoft account connected.",
                "code": "not_connected",
                "tenant_id": tenant_id,
                "source": source,
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
        return Response(
            {
                "ok": False,
                "accepted": False,
                "message": "Email sync could not be queued right now.",
                "code": "sync_schedule_failed",
                "tenant_id": tenant_id,
                "source": source,
                "details": {
                    "type": sync_err.__class__.__name__,
                },
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "ok": True,
            "accepted": True,
            "message": "Email sync queued",
            "tenant_id": tenant_id,
            "source": source,
            "provider_email": provider.connected_email,
            "task_id": task.id,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_scheduled_email_sync_status(request, task_id):
    """Return task status for a previously queued tenant email sync."""
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    result = AsyncResult(task_id)
    payload = {
        "task_id": task_id,
        "state": result.state,
        "ready": result.ready(),
        "successful": result.successful(),
        "failed": result.failed(),
    }

    if result.ready() and isinstance(result.result, dict):
        task_tenant_id = str(result.result.get("tenant_id") or "").strip()
        if task_tenant_id and task_tenant_id != str(tenant.id):
            return Response({"error": "Sync task not found"}, status=status.HTTP_404_NOT_FOUND)
        payload["result"] = result.result

    return Response(payload, status=status.HTTP_200_OK)


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
        return Response(
            {
                "error": "No active Microsoft account connected.",
                "code": "not_connected",
                "error_code": "not_connected",
                "hint": "Connect Outlook in Settings → Email Integrations, then retry Sync Now.",
                "cta": {
                    "label": "Open Email Integrations",
                    "url": "/settings/email-integrations",
                },
                "tenant_id": tenant_id,
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
            return Response(
                {
                    "error": stats.get("error"),
                    "code": "sync_failed",
                    "error_code": "sync_failed",
                    "tenant_id": tenant_id,
                    "provider_email": provider.connected_email,
                    "stats": stats,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If Graph/token/decrypt failed, do NOT report "no new emails".
        # IMPORTANT: This is still an application-level failure, but not a server availability failure.
        # Returning 503 here makes the UI look "broken" even though we have actionable diagnostics.
        if isinstance(stats, dict) and stats.get("errors", 0) and stats.get("emails_scanned", 0) == 0:
            detail = None
            try:
                detail = (stats.get("errors_detail") or [None])[0]
            except Exception:
                detail = None

            # Normalize error codes so the frontend can provide a deterministic CTA.
            error_code = str((stats or {}).get("error_code") or "").strip().lower()
            if not error_code and isinstance(detail, str):
                detail_lower = detail.lower()
                if (
                    detail.startswith("DECRYPTION_FAILED")
                    or "decrypt" in detail_lower
                    or "invalidtoken" in detail_lower
                ):
                    error_code = "decryption_failed"
                elif "token refresh failed" in detail_lower:
                    error_code = "token_refresh_failed"
                elif "token is invalid" in detail_lower or "invalid/expired" in detail_lower:
                    error_code = "token_invalid"
                elif "no microsoft access token" in detail_lower or "no access token" in detail_lower:
                    error_code = "token_missing"

            if error_code == "decryption_failed":
                return Response(
                    {
                        "ok": False,
                        "message": "Email sync requires reconnect",
                        "error": "Your Outlook connection needs to be refreshed for security reasons.",
                        "code": "decryption_failed",
                        "error_code": "decryption_failed",
                        "hint": "Reconnect Outlook in Settings → Email Integrations, then retry Sync Now.",
                        "cta": {
                            "label": "Open Email Integrations",
                            "url": "/settings/email-integrations",
                        },
                        "tenant_id": tenant_id,
                        "provider_email": provider.connected_email,
                        "stats": stats,
                    },
                    status=status.HTTP_200_OK,
                )

            # Other failure modes that generally require a reconnect.
            if error_code in {"token_invalid", "token_refresh_failed", "token_missing"}:
                return Response(
                    {
                        "ok": False,
                        "message": "Email sync requires reconnect",
                        "error": detail or "Outlook connection is invalid or expired.",
                        "code": "sync_failed",
                        "error_code": error_code,
                        "hint": "Reconnect Outlook in Settings → Email Integrations, then retry Sync Now.",
                        "cta": {
                            "label": "Open Email Integrations",
                            "url": "/settings/email-integrations",
                        },
                        "tenant_id": tenant_id,
                        "provider_email": provider.connected_email,
                        "stats": stats,
                    },
                    status=status.HTTP_200_OK,
                )

            return Response(
                {
                    "ok": False,
                    "message": "Email sync completed with errors",
                    "error": detail or "Email sync failed. Outlook connection may be expired or misconfigured.",
                    "code": "sync_failed",
                    "error_code": error_code or "sync_failed",
                    "hint": "Try reconnecting Outlook in Settings → Email Integrations, then retry Sync Now.",
                    "tenant_id": tenant_id,
                    "provider_email": provider.connected_email,
                    "stats": stats,
                },
                status=status.HTTP_200_OK,
            )

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

        # If this is an auth token decryption failure, always return a stable reconnect CTA.
        # This protects the UX even if downstream code paths change.
        try:
            from cryptography.fernet import InvalidToken

            is_decrypt = isinstance(sync_err, InvalidToken) or any(
                token in str(sync_err).lower()
                for token in [
                    "decrypt",
                    "invalidtoken",
                    "oauth_encryption_key",
                ]
            )
        except Exception:
            is_decrypt = "decrypt" in str(sync_err).lower()

        if is_decrypt:
            return Response(
                {
                    "ok": False,
                    "message": "Email sync requires reconnect",
                    "error": "Your Outlook connection needs to be refreshed for security reasons.",
                    "code": "decryption_failed",
                    "error_code": "decryption_failed",
                    "hint": "Reconnect Outlook in Settings → Email Integrations, then retry Sync Now.",
                    "cta": {
                        "label": "Open Email Integrations",
                        "url": "/settings/email-integrations",
                    },
                    "tenant_id": tenant_id,
                    "provider_email": provider.connected_email,
                },
                status=status.HTTP_200_OK,
            )

        # This is a user-triggered action. Prefer a 200 + structured failure payload so the UI
        # can display actionable guidance instead of treating it as a hard outage.
        # IMPORTANT: Never leak raw decryption/token exception strings to the client.
        return Response(
            {
                "ok": False,
                "message": "Email sync failed",
                "error": "Email sync failed. Outlook connection may be expired or misconfigured.",
                "code": "sync_exception",
                "error_code": "sync_exception",
                "hint": "If this persists, reconnect Outlook in Settings → Email Integrations and retry.",
                "cta": {
                    "label": "Open Email Integrations",
                    "url": "/settings/email-integrations",
                },
                "tenant_id": tenant_id,
                "provider_email": provider.connected_email,
                "details": {
                    "type": sync_err.__class__.__name__,
                },
            },
            status=status.HTTP_200_OK,
        )


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
                "created_at": email.created_at.isoformat(),
                "processed_at": email.processed_at.isoformat() if email.processed_at else None,
            }
        )

    return Response({"emails": email_data, "count": len(email_data)})
