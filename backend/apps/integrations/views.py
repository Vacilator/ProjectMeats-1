"""
OAuth integration views for external email providers.
"""
import secrets
from datetime import timedelta
from urllib.parse import quote

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
    
    if not request.tenant:
        return Response(
            {"error": "Tenant not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate CSRF state token
    state = secrets.token_urlsafe(32)
    
    # Store state in session for validation
    request.session[f'oauth_state_{provider_type}'] = state
    request.session[f'oauth_tenant_{provider_type}'] = str(request.tenant.id)
    
    # Build redirect URI (must match callback path and include /api/v1 sub-path routing)
    callback_path = f'/api/v1/integrations/oauth/callback/{provider_type}/'
    redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

    # Get provider instance
    if provider_type == 'microsoft':
        try:
            provider = MicrosoftGraphProvider(request.tenant.id)
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
    
    if not state or state != expected_state:
        return redirect('/settings?error=invalid_state')
    
    # Get tenant from session
    tenant_id = request.session.get(f'oauth_tenant_{provider_type}')
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
    """
    Manually trigger email sync for current tenant.
    
    This endpoint allows users to manually sync their inbox instead of
    waiting for the scheduled 5-minute Celery task.
    
    Returns:
        - emails_fetched: Number of emails retrieved from API
        - emails_saved: Number of new emails saved to database
        - errors: List of any errors encountered
    """
    if not request.tenant:
        return Response(
            {"error": "Tenant not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        from apps.integrations.tasks import sync_single_tenant
        
        # Trigger async task
        task = sync_single_tenant.delay(str(request.tenant.id))
        
        return Response({
            "message": "Email sync started",
            "task_id": task.id,
            "tenant_id": str(request.tenant.id),
        }, status=status.HTTP_202_ACCEPTED)
        
    except Exception as e:
        return Response(
            {"error": f"Failed to start sync: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_email_logs(request):
    """
    Get recent email ingestion logs for current tenant.
    
    Query params:
        limit: Number of emails to return (default: 10, max: 50)
        status: Filter by status (logged, ai_parsing, order_created, failed, ignored)
    """
    if not request.tenant:
        return Response(
            {"error": "Tenant not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get query params
    limit = min(int(request.GET.get('limit', 10)), 50)
    status_filter = request.GET.get('status')
    
    # Build queryset
    from .models import EmailLog
    queryset = EmailLog.objects.filter(tenant=request.tenant)
    
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    
    # Get recent emails
    emails = queryset.order_by('-created_at')[:limit]
    
    # Serialize
    email_data = []
    for email in emails:
        email_data.append({
            "id": str(email.id),
            "message_id": email.message_id,
            "subject": email.subject,
            "sender": email.sender,
            "status": email.status,
            "provider_type": email.provider.provider_type if email.provider else None,
            "has_attachments": email.has_attachments,
            "extracted_data": email.extracted_data,
            "related_order_id": email.related_order_id,
            "error_message": email.error_message,
            "created_at": email.created_at.isoformat(),
            "processed_at": email.processed_at.isoformat() if email.processed_at else None,
        })
    
    return Response({
        "emails": email_data,
        "count": len(email_data),
    })

