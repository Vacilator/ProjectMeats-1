"""OAuth authorization entrypoints for external integrations."""

import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode, quote

from django.conf import settings
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.integrations.microsoft.utils import get_microsoft_redirect_uri
from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers import MicrosoftGraphProvider
from apps.integrations.providers.base import EmailProviderError, AuthenticationError
from apps.tenants.models import Tenant
from apps.tenants.rls import set_current_tenant

logger = logging.getLogger(__name__)

_OAUTH_COOKIE_PREFIX = 'pm_oauth'
_OAUTH_COOKIE_MAX_AGE_SECONDS = 15 * 60
_OAUTH_COOKIE_PATH = '/api/v1/integrations/oauth/'
_SIGNER = TimestampSigner(salt='pm.integrations.oauth')
_STATE_SALT = 'pm.integrations.oauth.state'


def _oauth_cookie_name(key: str, provider: str) -> str:
    return f'{_OAUTH_COOKIE_PREFIX}_{key}_{provider}'


def _set_signed_oauth_cookie(response: HttpResponse, *, name: str, value: str, request) -> None:
    secure = bool(getattr(settings, 'SESSION_COOKIE_SECURE', False))
    if not secure:
        secure = request.is_secure()

    response.set_cookie(
        name,
        _SIGNER.sign(value),
        max_age=_OAUTH_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=secure,
        samesite='Lax',
        path=_OAUTH_COOKIE_PATH,
    )


def _get_signed_oauth_cookie(request, *, name: str) -> str | None:
    signed = request.COOKIES.get(name)
    if not signed:
        return None

    try:
        return _SIGNER.unsign(signed, max_age=_OAUTH_COOKIE_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def _clear_oauth_cookies(response, provider: str) -> None:
    response.delete_cookie(_oauth_cookie_name('state', provider), path=_OAUTH_COOKIE_PATH)
    response.delete_cookie(_oauth_cookie_name('tenant', provider), path=_OAUTH_COOKIE_PATH)
    response.delete_cookie(_oauth_cookie_name('nonce', provider), path=_OAUTH_COOKIE_PATH)


def _consume_oauth_nonce(request, provider: str, nonce: str) -> bool:
    """Nonce replay protection without requiring a shared cache.

    We bind nonce to the initiating browser via session and a signed httpOnly cookie.
    Callback must present the same nonce exactly once.
    """

    if not nonce:
        return False

    expected = request.session.get(f'oauth_nonce_{provider}') or _get_signed_oauth_cookie(
        request,
        name=_oauth_cookie_name('nonce', provider),
    )
    if not expected or expected != nonce:
        return False

    request.session.pop(f'oauth_nonce_{provider}', None)
    return True


class OAuthAuthorizeView(APIView):
    """Return (or redirect to) the provider's OAuth2 authorization URL.

    Security requirements:
    - Initiation must be tied to an authenticated user.
    - Callback must validate a signed state containing tenant_id + user_id and enforce membership.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider = request.query_params.get('provider', 'microsoft')

        # DRF auth is disabled for this endpoint (browser navigation), but the underlying Django
        # request may still have an authenticated user via session cookie.
        django_user = getattr(getattr(request, '_request', None), 'user', None) or getattr(request, 'user', None)
        user_id = getattr(django_user, 'id', None)
        logger.info('[OAuthAuthorizeView] authorize requested provider=%s user_id=%s', provider, user_id)

        if provider != 'microsoft':
            logger.warning('[OAuthAuthorizeView] unsupported provider=%s', provider)
            return HttpResponse(
                f'Unsupported provider: {provider}',
                status=400,
                content_type='text/plain',
            )

        tenant = getattr(request, 'tenant', None)
        tenant_id_param = request.query_params.get('tenant_id')

        # If tenant isn't resolved from host/subdomain, allow explicit tenant_id selection.
        # This is required for shared dev domains (e.g., dev.meatscentral.com) with many tenants.
        if tenant_id_param:
            if not (django_user and getattr(django_user, 'is_authenticated', False)):
                return HttpResponse('Authentication required to select tenant.', status=401, content_type='text/plain')

            from apps.tenants.models import TenantUser

            if not (
                getattr(django_user, 'is_superuser', False)
                or TenantUser.objects.filter(tenant_id=tenant_id_param, user=django_user, is_active=True).exists()
            ):
                return HttpResponse('Permission denied for tenant.', status=403, content_type='text/plain')

            try:
                tenant = Tenant.objects.get(id=tenant_id_param)
            except Tenant.DoesNotExist:
                return HttpResponse('Tenant not found.', status=400, content_type='text/plain')

        # Fallback: resolve tenant from user's first active membership.
        if not tenant and django_user and getattr(django_user, 'is_authenticated', False):
            from apps.tenants.models import TenantUser

            membership = (
                TenantUser.objects.filter(user=django_user, is_active=True)
                .select_related('tenant')
                .order_by('created_at')
                .first()
            )
            tenant = membership.tenant if membership else None

        if not tenant:
            return HttpResponse('Tenant not resolved for this request.', status=400, content_type='text/plain')

        # Generate signed state tied to the authenticated user + tenant.
        #
        # Why signed?
        # - Callback arrives without Authorization header.
        # - Session cookie may be blocked on cross-site redirects.
        # - Signed state provides integrity and lets us enforce tenant membership.
        nonce = secrets.token_urlsafe(16)
        request.session[f'oauth_nonce_{provider}'] = nonce

        state = signing.dumps(
            {
                'tenant_id': str(tenant.id),
                'user_id': str(request.user.id),
                'provider': provider,
                'nonce': nonce,
            },
            salt=_STATE_SALT,
        )

        # Persist state/tenant for callback verification.
        request.session[f'oauth_state_{provider}'] = state
        request.session[f'oauth_tenant_{provider}'] = str(tenant.id)

        callback_path = f'/api/v1/integrations/oauth/callback/{provider}/'
        redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

        # NOTE: client_secret is not required for the authorize redirect.
        # Use OS environment variables (container env). Avoid request.environ: not guaranteed.
        import os

        client_id = os.environ.get('MICROSOFT_CLIENT_ID')

        if not client_id:
            logger.warning('[OAuthAuthorizeView] missing MICROSOFT_CLIENT_ID')
            return HttpResponse(
                'Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID in the backend environment.',
                status=503,
                content_type='text/plain',
            )

        scopes = [
            # OpenID scopes (helpful for account selection + profile)
            'openid',
            'profile',
            'email',
            # Graph scopes
            'https://graph.microsoft.com/Mail.Send',
            'https://graph.microsoft.com/Mail.ReadWrite',
            'https://graph.microsoft.com/Calendars.ReadWrite',
            'https://graph.microsoft.com/Contacts.ReadWrite',
            'https://graph.microsoft.com/User.Read',
            'offline_access',
        ]

        params = {
            'client_id': client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'response_mode': 'query',
            'scope': ' '.join(scopes),
            'state': state,
            'prompt': 'select_account',
        }

        auth_url = f'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urlencode(params)}'

        wants_redirect = str(request.query_params.get('redirect', '')).lower() in {'1', 'true', 'yes'}
        accept_header = (request.META.get('HTTP_ACCEPT') or '').lower()
        is_xhr = (request.META.get('HTTP_X_REQUESTED_WITH') or '').lower() == 'xmlhttprequest'

        # IMPORTANT: If this is called from the SPA via Axios/fetch, we must NOT 302 to Microsoft.
        # Browsers will follow as XHR and trigger CORS failures. Instead, return JSON with auth_url,
        # and let the frontend perform a top-level navigation (window.location.href).
        wants_json = (not wants_redirect) or ('application/json' in accept_header) or is_xhr

        response: HttpResponse
        if wants_json:
            response = JsonResponse({'auth_url': auth_url, 'provider': provider})
        else:
            response = HttpResponseRedirect(auth_url)

        _set_signed_oauth_cookie(
            response,
            name=_oauth_cookie_name('state', provider),
            value=state,
            request=request,
        )
        _set_signed_oauth_cookie(
            response,
            name=_oauth_cookie_name('tenant', provider),
            value=str(tenant.id),
            request=request,
        )
        _set_signed_oauth_cookie(
            response,
            name=_oauth_cookie_name('nonce', provider),
            value=nonce,
            request=request,
        )
        return response


class OAuthCallbackView(APIView):
    """Handle OAuth callback from Microsoft and persist tokens.

    This endpoint is invoked by the provider redirect (browser navigation).
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request, provider: str | None = None, provider_type: str | None = None):
        provider = provider or provider_type
        # Provider errors come in as query params.
        error = request.query_params.get('error')
        if error:
            error_description = request.query_params.get('error_description', 'Unknown error')
            response = redirect(
                f"/settings/email-integrations?error={quote(error)}&message={quote(error_description)}&provider={quote(provider)}"
            )
            _clear_oauth_cookies(response, provider)
            return response

        code = request.query_params.get('code')
        if not code:
            response = redirect(f'/settings/email-integrations?error=no_code&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        state = request.query_params.get('state')
        expected_state = request.session.get(f'oauth_state_{provider}') or _get_signed_oauth_cookie(
            request,
            name=_oauth_cookie_name('state', provider),
        )
        if not state or state != expected_state:
            request.session.pop(f'oauth_state_{provider}', None)
            request.session.pop(f'oauth_tenant_{provider}', None)
            response = redirect(f'/settings/email-integrations?error=invalid_state&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        # Decode signed state payload (must include tenant_id + user_id).
        try:
            state_payload = signing.loads(state, salt=_STATE_SALT, max_age=_OAUTH_COOKIE_MAX_AGE_SECONDS)
        except Exception:
            response = redirect(f'/settings/email-integrations?error=invalid_state&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        tenant_id = str(state_payload.get('tenant_id') or '')
        user_id = str(state_payload.get('user_id') or '')
        state_provider = str(state_payload.get('provider') or '')
        nonce = str(state_payload.get('nonce') or '')

        if not tenant_id or not user_id or not nonce:
            request.session.pop(f'oauth_state_{provider}', None)
            request.session.pop(f'oauth_tenant_{provider}', None)
            response = redirect(f'/settings/email-integrations?error=invalid_state&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        if state_provider and state_provider != provider:
            request.session.pop(f'oauth_state_{provider}', None)
            request.session.pop(f'oauth_tenant_{provider}', None)
            response = redirect(f'/settings/email-integrations?error=invalid_state&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        header_tenant = request.headers.get('X-Tenant-ID')
        if header_tenant and header_tenant != tenant_id:
            request.session.pop(f'oauth_state_{provider}', None)
            request.session.pop(f'oauth_tenant_{provider}', None)
            response = redirect(f'/settings/email-integrations?error=tenant_mismatch&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        if not _consume_oauth_nonce(request, provider, nonce):
            request.session.pop(f'oauth_state_{provider}', None)
            request.session.pop(f'oauth_tenant_{provider}', None)
            response = redirect(f'/settings/email-integrations?error=replayed_state&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            response = redirect(f'/settings/email-integrations?error=tenant_not_found&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        # Enforce tenant membership for the initiating user.
        from django.contrib.auth import get_user_model
        from apps.tenants.models import TenantUser

        User = get_user_model()
        try:
            initiating_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            response = redirect(f'/settings/email-integrations?error=user_not_found&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        if not (
            getattr(initiating_user, 'is_superuser', False)
            or TenantUser.objects.filter(tenant=tenant, user=initiating_user, is_active=True).exists()
        ):
            response = redirect(f'/settings/email-integrations?error=permission_denied&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        # Ensure tenant + RLS context is set before any tenant-scoped writes.
        request.tenant = tenant
        if hasattr(request, '_request') and getattr(request, '_request', None) is not None:
            setattr(request._request, 'tenant', tenant)

        rls_result = set_current_tenant(str(tenant.id))
        if not getattr(rls_result, 'ok', False):
            logger.error(
                '[OAuthCallbackView] RLS setup failed before provider write: tenant_id=%s provider=%s error=%s',
                tenant.id,
                provider,
                getattr(rls_result, 'error', 'unknown'),
            )
            response = redirect(
                f'/settings/email-integrations?error=rls_enforcement_failed&provider={quote(provider)}'
            )
            _clear_oauth_cookies(response, provider)
            return response

        setattr(request, '_rls_set', True)
        if hasattr(request, '_request') and getattr(request, '_request', None) is not None:
            setattr(request._request, '_rls_set', True)

        # Must exactly match what was used in the authorize redirect.
        callback_path = f'/api/v1/integrations/oauth/callback/{provider}/'
        redirect_uri = get_microsoft_redirect_uri(request, callback_path=callback_path)

        if provider != 'microsoft':
            response = redirect(f'/settings/email-integrations?error=provider_not_supported&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        try:
            provider_client = MicrosoftGraphProvider(tenant.id)
        except EmailProviderError as e:
            response = redirect(
                f"/settings/email-integrations?error=provider_not_configured&message={quote(str(e))}"
            )
            _clear_oauth_cookies(response, provider)
            return response

        try:
            token_response = provider_client.exchange_code(code, redirect_uri)
            user_info = provider_client.get_user_info(token_response.access_token)

            auth_provider, _created = ExternalAuthProvider.objects.update_or_create(
                tenant=tenant,
                provider_type=provider,
                defaults={
                    'is_active': True,
                    'token_expiry': timezone.now() + timedelta(seconds=token_response.expires_in),
                    'connected_email': user_info.get('email'),
                    'connected_name': user_info.get('name'),
                },
            )

            auth_provider.set_encrypted_token('access', token_response.access_token)
            if token_response.refresh_token:
                auth_provider.set_encrypted_token('refresh', token_response.refresh_token)
            auth_provider.save()

            request.session.pop(f'oauth_state_{provider}', None)
            request.session.pop(f'oauth_tenant_{provider}', None)

            response = redirect(f'/settings/email-integrations?success=connected&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response

        except (AuthenticationError, EmailProviderError, ValueError) as e:
            logger.exception('[OAuthCallbackView] token exchange failed provider=%s tenant_id=%s', provider, tenant_id)
            response = redirect(
                f"/settings/email-integrations?error=exchange_failed&message={quote(str(e))}&provider={quote(provider)}"
            )
            _clear_oauth_cookies(response, provider)
            return response
        except Exception:
            logger.exception('[OAuthCallbackView] unexpected failure provider=%s tenant_id=%s', provider, tenant_id)
            response = redirect(f'/settings/email-integrations?error=exchange_failed&provider={quote(provider)}')
            _clear_oauth_cookies(response, provider)
            return response
