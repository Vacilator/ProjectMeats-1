"""
Microsoft OAuth2 integration views.

Handles OAuth2 callback flow for Microsoft Graph API (Outlook, Calendar, etc.)
Part of Phase 5: Third-party integrations.
"""

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
import logging

logger = logging.getLogger(__name__)


class MicrosoftOAuthCallbackView(APIView):
    """
    Handle OAuth2 callback from Microsoft authorization flow.
    
    Expected flow:
    1. Frontend redirects user to Microsoft login
    2. User authorizes application
    3. Microsoft redirects back with authorization code
    4. This endpoint exchanges code for access/refresh tokens
    5. Tokens are stored for the user's tenant
    
    Configuration Required:
    - MICROSOFT_CLIENT_ID: Application (client) ID from Azure AD
    - MICROSOFT_CLIENT_SECRET: Client secret from Azure AD
    - MICROSOFT_TENANT_ID: Azure AD tenant ID (or 'common' for multi-tenant)
    
    Returns 503 Service Unavailable if credentials not configured.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Handle OAuth2 callback with authorization code."""
        
        # Check if Microsoft OAuth is configured
        client_id = getattr(settings, 'MICROSOFT_CLIENT_ID', None)
        client_secret = getattr(settings, 'MICROSOFT_CLIENT_SECRET', None)
        tenant_id = getattr(settings, 'MICROSOFT_TENANT_ID', None)
        
        if not all([client_id, client_secret, tenant_id]):
            logger.warning(
                "Microsoft OAuth callback attempted but credentials not configured. "
                "Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID."
            )
            return Response(
                {
                    "error": "Integration not configured",
                    "detail": "Microsoft OAuth integration is not available. "
                             "Please contact your administrator.",
                    "phase": "Phase 5",
                    "status": "awaiting_credentials"
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Get authorization code from query parameters
        auth_code = request.GET.get('code')
        error = request.GET.get('error')
        error_description = request.GET.get('error_description')
        
        if error:
            logger.error(f"Microsoft OAuth error: {error} - {error_description}")
            return Response(
                {
                    "error": error,
                    "detail": error_description or "Authorization failed"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not auth_code:
            return Response(
                {
                    "error": "missing_code",
                    "detail": "Authorization code not provided in callback"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Exchange authorization code for tokens
        # This will be implemented once MSAL credentials are configured
        # For now, return success to allow frontend integration testing
        
        return Response(
            {
                "status": "scaffolded",
                "message": "Microsoft OAuth callback received successfully",
                "note": "Token exchange will be implemented once credentials are configured",
                "auth_code_received": bool(auth_code),
                "user": request.user.email
            },
            status=status.HTTP_200_OK
        )
    
    def post(self, request):
        """
        Manual token refresh endpoint.
        
        Used to refresh expired access tokens using stored refresh token.
        """
        
        # Check configuration
        if not getattr(settings, 'MICROSOFT_CLIENT_ID', None):
            return Response(
                {
                    "error": "Integration not configured",
                    "detail": "Microsoft OAuth not available"
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # TODO: Implement token refresh logic
        return Response(
            {
                "status": "scaffolded",
                "message": "Token refresh endpoint ready",
                "note": "Will be implemented with MSAL integration"
            },
            status=status.HTTP_200_OK
        )


class MicrosoftIntegrationStatusView(APIView):
    """
    Check Microsoft integration configuration status.
    
    Returns whether Microsoft OAuth is properly configured and ready to use.
    Useful for frontend to show/hide integration options.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Return Microsoft integration configuration status."""
        
        client_id = getattr(settings, 'MICROSOFT_CLIENT_ID', None)
        client_secret = getattr(settings, 'MICROSOFT_CLIENT_SECRET', None)
        tenant_id = getattr(settings, 'MICROSOFT_TENANT_ID', None)
        
        is_configured = all([client_id, client_secret, tenant_id])
        
        return Response({
            "configured": is_configured,
            "client_id_set": bool(client_id),
            "client_secret_set": bool(client_secret),
            "tenant_id_set": bool(tenant_id),
            "phase": "Phase 5",
            "status": "ready" if is_configured else "awaiting_credentials",
            "features": [
                "outlook_calendar",
                "outlook_email",
                "contact_sync",
                "event_scheduling"
            ] if is_configured else []
        })
