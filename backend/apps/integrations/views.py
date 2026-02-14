"""
OAuth integration views for external email providers.
"""
import secrets
from datetime import timedelta
from django.utils import timezone
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ExternalAuthProvider
from .providers import MicrosoftGraphProvider


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
    request.session[f'oauth_tenant_{provider_type}'] = request.tenant.id
    
    # Build redirect URI
    redirect_uri = request.build_absolute_uri(f'/api/integrations/oauth/callback/{provider_type}/')
    
    # Get provider instance
    if provider_type == 'microsoft':
        provider = MicrosoftGraphProvider(request.tenant.id)
    else:
        return Response(
            {"error": "Provider not implemented yet"},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )
    
    # Generate auth URL
    auth_response = provider.get_auth_url(redirect_uri, state)
    
    return Response({
        "auth_url": auth_response.auth_url,
        "provider": provider_type,
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
        return redirect(f'/settings/integrations?error={error}&description={error_description}')
    
    # Get authorization code
    code = request.GET.get('code')
    if not code:
        return redirect('/settings/integrations?error=no_code')
    
    # Validate state for CSRF protection
    state = request.GET.get('state')
    expected_state = request.session.get(f'oauth_state_{provider_type}')
    
    if not state or state != expected_state:
        return redirect('/settings/integrations?error=invalid_state')
    
    # Get tenant from session
    tenant_id = request.session.get(f'oauth_tenant_{provider_type}')
    if not tenant_id:
        return redirect('/settings/integrations?error=no_tenant')
    
    try:
        from apps.tenants.models import Tenant
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return redirect('/settings/integrations?error=tenant_not_found')
    
    # Build redirect URI (must match the one used in get_auth_url)
    redirect_uri = request.build_absolute_uri(f'/api/integrations/oauth/callback/{provider_type}/')
    
    # Get provider instance
    if provider_type == 'microsoft':
        provider = MicrosoftGraphProvider(tenant.id)
    else:
        return redirect('/settings/integrations?error=provider_not_supported')
    
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
        return redirect('/settings/integrations?success=connected')
        
    except Exception as e:
        return redirect(f'/settings/integrations?error=exchange_failed&message={str(e)}')


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
