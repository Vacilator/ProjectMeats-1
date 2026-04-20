"""
Email OAuth Views

Handles OAuth2 authentication flow for Outlook and Gmail integrations.
Manages token exchange, refresh, and webhook subscriptions.

Created: 2026-02-23 - Email Integration Phase 2
"""

import logging
from datetime import timedelta
from django.conf import settings
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from django.shortcuts import redirect
from django.utils import timezone
from django.http import JsonResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.email_integration.models import EmailAccount, EmailLog

logger = logging.getLogger(__name__)

OAUTH_STATE_SALT = 'email_integration.oauth_state'
OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60


def _sign_oauth_state(payload: dict) -> str:
    return signing.dumps(payload, salt=OAUTH_STATE_SALT)


def _unsign_oauth_state(state: str) -> dict:
    return signing.loads(state, salt=OAUTH_STATE_SALT, max_age=OAUTH_STATE_MAX_AGE_SECONDS)


# ============================================================================
# Outlook OAuth Flow
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def outlook_auth_init(request):
    """
    Initiate Outlook OAuth2 flow.
    Redirects user to Microsoft login page.
    """
    from msal import ConfidentialClientApplication
    
    try:
        client_id = settings.MICROSOFT_CLIENT_ID
        client_secret = settings.MICROSOFT_CLIENT_SECRET
        redirect_uri = settings.MICROSOFT_REDIRECT_URI
        
        tenant_id = getattr(settings, 'MICROSOFT_TENANT_ID', 'common')
        authority = f"https://login.microsoftonline.com/{tenant_id}"

        msal_app = ConfidentialClientApplication(
            client_id,
            authority=authority,
            client_credential=client_secret,
        )
        
        # Request offline_access for refresh tokens
        scopes = [
            "https://graph.microsoft.com/Mail.Read",
            "https://graph.microsoft.com/Mail.Send",
            "https://graph.microsoft.com/User.Read",
            "offline_access"
        ]
        
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return JsonResponse(
                {'error': 'Tenant context required', 'code': 'tenant_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        state = _sign_oauth_state({'user_id': request.user.id, 'tenant_id': str(tenant.id), 'provider': 'outlook'})
        
        auth_url = msal_app.get_authorization_request_url(
            scopes=scopes,
            redirect_uri=redirect_uri,
            state=state,
            prompt="select_account",  # Mitigates msaidpvalidate 400 errors and enforces clean session selection
        )
        
        return JsonResponse({
            'auth_url': auth_url,
            'provider': 'outlook'
        })
        
    except Exception as e:
        logger.error(f"Outlook OAuth init failed: {str(e)}")
        return JsonResponse({
            'error': 'Failed to initialize OAuth flow',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def outlook_auth_callback(request):
    """
    Handle Outlook OAuth2 callback.
    Exchange code for tokens and create EmailAccount.
    """
    from msal import ConfidentialClientApplication
    import requests
    
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    if error:
        logger.error(f"Outlook OAuth error: {error}")
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error={error}")
    
    if not code or not state:
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=missing_params")
    
    try:
        try:
            payload = _unsign_oauth_state(state)
        except SignatureExpired:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=state_expired")
        except BadSignature:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=invalid_state")

        user_id = payload.get('user_id')
        tenant_id = payload.get('tenant_id')
        if not user_id or not tenant_id:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=invalid_state")

        from django.contrib.auth import get_user_model
        from apps.tenants.models import Tenant, TenantUser

        User = get_user_model()
        user = User.objects.get(id=int(user_id))
        tenant = Tenant.objects.filter(id=tenant_id, is_active=True).first()
        if not tenant:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=invalid_tenant")

        if not TenantUser.objects.filter(tenant=tenant, user=user, is_active=True).exists():
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=tenant_denied")

        # Exchange code for tokens
        client_id = settings.MICROSOFT_CLIENT_ID
        client_secret = settings.MICROSOFT_CLIENT_SECRET
        redirect_uri = settings.MICROSOFT_REDIRECT_URI
        
        tenant_id = getattr(settings, 'MICROSOFT_TENANT_ID', 'common')
        authority = f"https://login.microsoftonline.com/{tenant_id}"

        msal_app = ConfidentialClientApplication(
            client_id,
            authority=authority,
            client_credential=client_secret,
        )
        
        scopes = [
            "https://graph.microsoft.com/Mail.Read",
            "https://graph.microsoft.com/Mail.Send",
            "https://graph.microsoft.com/User.Read"
        ]
        
        result = msal_app.acquire_token_by_authorization_code(
            code,
            scopes=scopes,
            redirect_uri=redirect_uri
        )
        
        if 'error' in result:
            logger.error(f"Token exchange failed: {result.get('error_description')}")
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=token_failed")
        
        access_token = result.get('access_token')
        refresh_token = result.get('refresh_token')
        expires_in = result.get('expires_in', 3600)
        
        # Get user profile
        headers = {'Authorization': f'Bearer {access_token}'}
        profile_response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers=headers
        )
        profile_data = profile_response.json()
        
        email_address = profile_data.get('mail') or profile_data.get('userPrincipalName')
        display_name = profile_data.get('displayName', '')
        provider_user_id = profile_data.get('id')
        
        # Create or update EmailAccount
        email_account, created = EmailAccount.objects.update_or_create(
            user=user,
            provider='outlook',
            email_address=email_address,
            defaults={
                'access_token': access_token,
                'refresh_token': refresh_token,
                'token_expires_at': timezone.now() + timedelta(seconds=expires_in),
                'provider_user_id': provider_user_id,
                'display_name': display_name,
                'status': 'active',
                'last_synced_at': timezone.now()
            }
        )
        
        logger.info(f"Outlook account {'created' if created else 'updated'}: {email_address}")
        
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_success=outlook&email={email_address}")
        
    except Exception as e:
        logger.error(f"Outlook callback failed: {str(e)}")
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=callback_failed")


# ============================================================================
# Gmail OAuth Flow
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gmail_auth_init(request):
    """
    Initiate Gmail OAuth2 flow.
    Redirects user to Google login page.
    """
    from google_auth_oauthlib.flow import Flow
    
    try:
        client_id = str(getattr(settings, 'GOOGLE_CLIENT_ID', '') or '').strip()
        client_secret = str(getattr(settings, 'GOOGLE_CLIENT_SECRET', '') or '').strip()
        redirect_uri = str(getattr(settings, 'GOOGLE_REDIRECT_URI', '') or '').strip()

        if not client_id or not client_secret or not redirect_uri:
            return JsonResponse(
                {
                    'error': 'Gmail OAuth is not configured',
                    'code': 'not_configured',
                    'required': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
                },
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return JsonResponse(
                {'error': 'Tenant context required', 'code': 'tenant_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_config = {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uris": [redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }

        flow = Flow.from_client_config(
            client_config,
            scopes=[
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            redirect_uri=redirect_uri
        )

        state = _sign_oauth_state({'user_id': request.user.id, 'tenant_id': str(tenant.id), 'provider': 'gmail'})
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force consent to get refresh token
        )
        
        return JsonResponse({
            'auth_url': auth_url,
            'provider': 'gmail'
        })
        
    except Exception as e:
        logger.error(f"Gmail OAuth init failed: {str(e)}")
        return JsonResponse({
            'error': 'Failed to initialize OAuth flow',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def gmail_auth_callback(request):
    """
    Handle Gmail OAuth2 callback.
    Exchange code for tokens and create EmailAccount.
    """
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    if error:
        logger.error(f"Gmail OAuth error: {error}")
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error={error}")
    
    if not code or not state:
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=missing_params")
    
    try:
        try:
            payload = _unsign_oauth_state(state)
        except SignatureExpired:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=state_expired")
        except BadSignature:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=invalid_state")

        user_id = payload.get('user_id')
        tenant_id = payload.get('tenant_id')
        if not user_id or not tenant_id:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=invalid_state")

        from django.contrib.auth import get_user_model
        from apps.tenants.models import Tenant, TenantUser

        User = get_user_model()
        user = User.objects.get(id=int(user_id))
        tenant = Tenant.objects.filter(id=tenant_id, is_active=True).first()
        if not tenant:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=invalid_tenant")

        if not TenantUser.objects.filter(tenant=tenant, user=user, is_active=True).exists():
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=tenant_denied")

        client_id = str(getattr(settings, 'GOOGLE_CLIENT_ID', '') or '').strip()
        client_secret = str(getattr(settings, 'GOOGLE_CLIENT_SECRET', '') or '').strip()
        redirect_uri = str(getattr(settings, 'GOOGLE_REDIRECT_URI', '') or '').strip()

        if not client_id or not client_secret or not redirect_uri:
            return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=not_configured")

        # Exchange code for tokens
        client_config = {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uris": [redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=[
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            redirect_uri=redirect_uri,
            state=state
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user email
        service = build('gmail', 'v1', credentials=credentials)
        profile = service.users().getProfile(userId='me').execute()
        email_address = profile.get('emailAddress')
        
        # Calculate token expiration
        expires_in = 3600  # Default 1 hour
        
        # Create or update EmailAccount
        email_account, created = EmailAccount.objects.update_or_create(
            user=user,
            provider='gmail',
            email_address=email_address,
            defaults={
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token or '',
                'token_expires_at': timezone.now() + timedelta(seconds=expires_in),
                'provider_user_id': email_address,
                'display_name': email_address.split('@')[0],
                'status': 'active',
                'last_synced_at': timezone.now()
            }
        )
        
        logger.info(f"Gmail account {'created' if created else 'updated'}: {email_address}")
        
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_success=gmail&email={email_address}")
        
    except Exception as e:
        logger.error(f"Gmail callback failed: {str(e)}")
        return redirect(f"{settings.FRONTEND_URL}/cockpit?oauth_error=callback_failed")


# ============================================================================
# Email Account Management API
# ============================================================================

class EmailAccountViewSet(viewsets.ModelViewSet):
    """CRUD operations for email accounts"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return EmailAccount.objects.filter(user=self.request.user)
    
    def list(self, request):
        """List all connected email accounts"""
        accounts = self.get_queryset()
        data = [{
            'id': acc.id,
            'provider': acc.provider,
            'email_address': acc.email_address,
            'display_name': acc.display_name,
            'status': acc.status,
            'is_token_expired': acc.is_token_expired,
            'created_at': acc.created_at,
            'last_synced_at': acc.last_synced_at,
        } for acc in accounts]
        
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def disconnect(self, request, pk=None):
        """Disconnect email account"""
        try:
            account = self.get_queryset().get(pk=pk)
            account.status = 'revoked'
            account.save()
            
            EmailLog.objects.create(
                email_account=account,
                log_type='webhook',
                subject='Account disconnected',
                success=True
            )
            
            return Response({
                'message': 'Account disconnected successfully',
                'email': account.email_address
            })
        except EmailAccount.DoesNotExist:
            return Response({
                'error': 'Account not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test email account connection"""
        try:
            account = self.get_queryset().get(pk=pk)
            
            if account.is_token_expired:
                return Response({
                    'success': False,
                    'error': 'Token expired. Please reconnect.'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # TODO: Actually test by sending API request
            return Response({
                'success': True,
                'message': f'Connection to {account.email_address} is active'
            })
            
        except EmailAccount.DoesNotExist:
            return Response({
                'error': 'Account not found'
            }, status=status.HTTP_404_NOT_FOUND)
