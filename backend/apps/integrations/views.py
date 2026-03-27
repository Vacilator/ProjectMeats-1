"""apps.integrations.views

OAuth integration views for external email providers.
"""

import logging
import secrets
from datetime import timedelta
from urllib.parse import quote

from django.core import signing
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .microsoft.utils import get_microsoft_redirect_uri
from .models import ExternalAuthProvider
from .providers import MicrosoftGraphProvider
from .providers.base import EmailProviderError, AuthenticationError

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_auth_url(request):
    """
    Generate OAuth authorization URL for connecting email provider.
    
    Query params:
        provider: 'microsoft' or 'google'
    """
    provider_type = request.GET.get('provider', 'microsoft')
    
    if provider_type not in ['microsoft', 'google']:
        return Response(
            {"error": "Invalid provider type"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Resolve tenant context.
    # IMPORTANT: This endpoint is often reached via full-page navigation (not XHR),
    # so X-Tenant-ID header may be missing. Allow explicit tenant_id query param.
    tenant_id = request.GET.get('tenant_id')
    tenant = getattr(request, 'tenant', None)

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
        {"tenant_id": str(tenant.id), "provider": provider_type, "nonce": nonce},
        salt='integrations.oauth.state',
    )

    # Store state + tenant in session for strict validation where possible.
    request.session[f'oauth_state_{provider_type}'] = state
    request.session[f'oauth_tenant_{provider_type}'] = str(tenant.id)
    
    # Build redirect URI (must match callback path and include /api/v1 sub-path routing)
    callback_path = f'/api/v1/integrations/oauth/callback/{provider_type}/'
    redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

    # Get provider instance
    if provider_type == 'microsoft':
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
        return Response(
            {"error": "Provider not implemented yet"},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

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
    if request.GET.get('redirect') in {'1', 'true', 'yes'}:
        return redirect(auth_response.auth_url)

    return Response({
        'auth_url': auth_response.auth_url,
        'provider': provider_type,
    })


@api_view(['GET'])
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
    error = request.GET.get('error')
    if error:
        error_description = request.GET.get('error_description', 'Unknown error')
        return redirect(f'/settings?error={error}&description={error_description}')
    
    # Get authorization code
    code = request.GET.get('code')
    if not code:
        return redirect('/settings?error=no_code')
    
    # Validate state for CSRF protection
    state = request.GET.get('state')
    expected_state = request.session.get(f'oauth_state_{provider_type}')

    state_payload = None
    if state and expected_state and state == expected_state:
        # Session-based validation succeeded
        state_payload = None
    else:
        # Fallback: allow signed state when session cookies are not preserved
        try:
            state_payload = signing.loads(state or '', salt='integrations.oauth.state', max_age=15 * 60)
        except Exception:
            state_payload = None

        if not state_payload or state_payload.get('provider') != provider_type:
            return redirect('/settings?error=invalid_state')

    # Get tenant from session or signed payload
    tenant_id = request.session.get(f'oauth_tenant_{provider_type}') or (state_payload or {}).get('tenant_id')
    if not tenant_id:
        return redirect('/settings?error=no_tenant')
    
    try:
        from apps.tenants.models import Tenant
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return redirect('/settings?error=tenant_not_found')

    # Build redirect URI (must match the one used in get_auth_url)
    callback_path = f'/api/v1/integrations/oauth/callback/{provider_type}/'
    redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

    # Get provider instance
    if provider_type == 'microsoft':
        try:
            provider = MicrosoftGraphProvider(tenant.id)
        except EmailProviderError as e:
            return redirect(f"/settings?error=provider_not_configured&message={quote(str(e))}")
    else:
        return redirect('/settings?error=provider_not_supported')
    
    try:
        # Exchange code for tokens
        token_response = provider.exchange_code(code, redirect_uri)
        
        # Get user info
        user_info = provider.get_user_info(token_response.access_token)
        
        # Store tokens in database
        auth_provider, created = ExternalAuthProvider.objects.update_or_create(
            tenant=tenant,
            provider_type=provider_type,
            defaults={
                'is_active': True,
                'token_expiry': timezone.now() + timedelta(seconds=token_response.expires_in),
                'connected_email': user_info.get('email'),
                'connected_name': user_info.get('name'),
            }
        )
        
        # Encrypt and store tokens
        auth_provider.set_encrypted_token('access', token_response.access_token)
        if token_response.refresh_token:
            auth_provider.set_encrypted_token('refresh', token_response.refresh_token)
        auth_provider.save()
        
        # Clean up session
        request.session.pop(f'oauth_state_{provider_type}', None)
        request.session.pop(f'oauth_tenant_{provider_type}', None)
        
        # Redirect to success page
        return redirect('/settings?success=connected')

    except (AuthenticationError, EmailProviderError) as e:
        return redirect(f"/settings?error=exchange_failed&message={quote(str(e))}")
    except Exception:
        return redirect('/settings?error=exchange_failed')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_connection_status(request):
    """
    Get OAuth connection status for all providers.
    """
    if not request.tenant:
        return Response(
            {"error": "Tenant not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    providers = ExternalAuthProvider.objects.filter(
        tenant=request.tenant,
        is_active=True
    )
    
    connections = []
    for provider in providers:
        connections.append({
            "provider": provider.provider_type,
            "provider_name": provider.get_provider_type_display(),
            "connected_email": provider.connected_email,
            "connected_name": provider.connected_name,
            "is_expired": provider.is_token_expired(),
            "connected_at": provider.created_at.isoformat(),
        })
    
    return Response({
        "connections": connections,
        "count": len(connections),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_provider(request):
    """
    Disconnect an OAuth provider.
    
    Body:
        provider: 'microsoft' or 'google'
    """
    provider_type = request.data.get('provider')
    
    if not provider_type:
        return Response(
            {"error": "Provider type required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not request.tenant:
        return Response(
            {"error": "Tenant not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        provider = ExternalAuthProvider.objects.get(
            tenant=request.tenant,
            provider_type=provider_type
        )
        provider.is_active = False
        provider.save()
        
        return Response({
            "message": "Provider disconnected successfully",
            "provider": provider_type,
        })
    except ExternalAuthProvider.DoesNotExist:
        return Response(
            {"error": "Provider not found"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_emails(request):
    """Manually trigger email sync for current tenant (synchronous).

    This endpoint backs a user-initiated "Sync Now" action, so we execute inline
    and return stats immediately. It should avoid hard-500s for common operational
    issues and instead return clear error payloads.
    """
    tenant = getattr(request, 'tenant', None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    tenant_id = str(tenant.id)

    # Preflight: ensure Outlook is actually connected for this tenant.
    provider = ExternalAuthProvider.objects.filter(
        tenant=tenant,
        provider_type='microsoft',
        is_active=True,
    ).first()
    if not provider:
        return Response(
            {
                "error": "No active Microsoft account connected.",
                "code": "not_connected",
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

        if isinstance(stats, dict) and stats.get('error'):
            return Response(
                {
                    "error": stats.get('error'),
                    "code": "sync_failed",
                    "tenant_id": tenant_id,
                    "provider_email": provider.connected_email,
                    "stats": stats,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If Graph/token/decrypt failed, do NOT report "no new emails".
        # IMPORTANT: This is still an application-level failure, but not a server availability failure.
        # Returning 503 here makes the UI look "broken" even though we have actionable diagnostics.
        if isinstance(stats, dict) and stats.get('errors', 0) and stats.get('emails_scanned', 0) == 0:
            detail = None
            try:
                detail = (stats.get('errors_detail') or [None])[0]
            except Exception:
                detail = None

            # Normalize error codes so the frontend can provide a deterministic CTA.
            error_code = str((stats or {}).get('error_code') or '').strip().lower()
            if not error_code and isinstance(detail, str):
                if detail.startswith('DECRYPTION_FAILED') or 'Failed to decrypt Microsoft access token' in detail:
                    error_code = 'decryption_failed'

            if error_code == 'decryption_failed':
                return Response(
                    {
                        "ok": False,
                        "message": "Email sync requires reconnect",
                        "error": "Your Outlook connection needs to be refreshed for security reasons.",
                        "code": "decryption_failed",
                        "hint": "Reconnect Outlook in Settings → Email Integrations, then retry Sync Now.",
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
                    "hint": "Try reconnecting Outlook in Settings → Integrations, then retry Sync Now.",
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
        logger.error('Failed to sync emails for tenant %s: %s', tenant_id, str(e), exc_info=True)

        # If this is an auth token decryption failure, always return a stable reconnect CTA.
        # This protects the UX even if downstream code paths change.
        try:
            from cryptography.fernet import InvalidToken

            is_decrypt = isinstance(e, InvalidToken) or any(
                token in str(e).lower()
                for token in [
                    'decrypt',
                    'invalidtoken',
                    'oauth_encryption_key',
                ]
            )
        except Exception:
            is_decrypt = 'decrypt' in str(e).lower()

        if is_decrypt:
            return Response(
                {
                    "ok": False,
                    "message": "Email sync requires reconnect",
                    "error": "Your Outlook connection needs to be refreshed for security reasons.",
                    "code": "decryption_failed",
                    "hint": "Reconnect Outlook in Settings → Email Integrations, then retry Sync Now.",
                    "tenant_id": tenant_id,
                    "provider_email": provider.connected_email,
                },
                status=status.HTTP_200_OK,
            )

        # This is a user-triggered action. Prefer a 200 + structured failure payload so the UI
        # can display actionable guidance instead of treating it as a hard outage.
        return Response(
            {
                "ok": False,
                "message": "Email sync failed",
                "error": "Email sync failed. Outlook connection may be expired or misconfigured.",
                "code": "sync_exception",
                "hint": "If this persists, reconnect Outlook in Settings → Integrations and retry.",
                "tenant_id": tenant_id,
                "provider_email": provider.connected_email,
            },
            status=status.HTTP_200_OK,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_email_logs(request):
    """Get recent email ingestion logs for current tenant."""
    tenant = getattr(request, 'tenant', None)
    if not tenant:
        return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

    # Get query params
    limit = min(int(request.GET.get('limit', 10)), 50)
    status_filter = request.GET.get('status')

    # Build queryset
    from .models import EmailLog
    queryset = EmailLog.objects.filter(tenant=tenant)

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    # Get recent emails
    emails = queryset.order_by('-created_at')[:limit]

    # Serialize (contract expected by frontend IngestionMonitor.tsx)
    email_data = []
    for email in emails:
        sender = email.sender_email
        if email.sender_name:
            sender = f"{email.sender_name} <{email.sender_email}>"

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
                "error_message": email.processing_error,
                "created_at": email.created_at.isoformat(),
                "processed_at": email.processed_at.isoformat() if email.processed_at else None,
            }
        )

    return Response({"emails": email_data, "count": len(email_data)})

