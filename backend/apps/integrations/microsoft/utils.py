"""
Microsoft OAuth utility functions.

Provides helper functions for constructing OAuth redirect URIs
and handling Microsoft Graph API integration.
"""

from typing import Optional

from django.conf import settings
from django.http import HttpRequest


def get_microsoft_redirect_uri(
    request: HttpRequest, callback_path: str = "/api/v1/integrations/oauth/callback/"
) -> str:
    """
    Construct Microsoft OAuth redirect URI using current request's domain.

    IMPORTANT: Uses /api/v1 sub-path routing (NO api. subdomain prefix).

    Args:
        request: Django HttpRequest object
        callback_path: OAuth callback path (default: /api/v1/integrations/oauth/callback/)

    Returns:
        Full OAuth redirect URI (e.g., https://dev.meatscentral.com/api/v1/integrations/oauth/callback/)

    Examples:
        >>> # Development
        >>> get_microsoft_redirect_uri(request)
        'https://dev.meatscentral.com/api/v1/integrations/oauth/callback/'

        >>> # Production
        >>> get_microsoft_redirect_uri(request)
        'https://meatscentral.com/api/v1/integrations/oauth/callback/'
    """
    # Get scheme (http/https). Behind nginx, prefer X-Forwarded-Proto.
    scheme = request.META.get("HTTP_X_FORWARDED_PROTO", request.scheme)
    if scheme and "," in scheme:
        scheme = scheme.split(",")[0].strip()

    # Get host (WITHOUT api. prefix)
    host = request.get_host()

    # Remove port if present (for local development)
    if ":" in host:
        host = host.split(":")[0]

    # Construct full redirect URI
    redirect_uri = f"{scheme}://{host}{callback_path}"

    return redirect_uri


def get_microsoft_auth_url(
    request: HttpRequest, client_id: str, scopes: Optional[list] = None, state: Optional[str] = None
) -> str:
    """
    Generate Microsoft OAuth2 authorization URL.

    Args:
        request: Django HttpRequest object
        client_id: Microsoft application client ID
        scopes: List of OAuth scopes (defaults to Mail.Send, Mail.ReadWrite, User.Read)
        state: Optional state parameter for CSRF protection

    Returns:
        Microsoft authorization URL
    """
    from urllib.parse import urlencode

    # Default scopes for email integration
    if scopes is None:
        scopes = [
            "https://graph.microsoft.com/Mail.Send",
            "https://graph.microsoft.com/Mail.ReadWrite",
            "https://graph.microsoft.com/User.Read",
            "offline_access",
        ]

    # Get redirect URI
    redirect_uri = get_microsoft_redirect_uri(request)

    # Build authorization URL
    tenant_id = getattr(settings, "MICROSOFT_TENANT_ID", None)
    if not tenant_id:
        tenant_id = "common"

    authority = f"https://login.microsoftonline.com/{tenant_id}"
    authorize_endpoint = f"{authority}/oauth2/v2.0/authorize"

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": " ".join(scopes),
        "prompt": "select_account",
    }

    if state:
        params["state"] = state

    return f"{authorize_endpoint}?{urlencode(params)}"


def validate_microsoft_callback(request: HttpRequest) -> dict:
    """
    Validate and extract data from Microsoft OAuth callback.

    Args:
        request: Django HttpRequest object from callback

    Returns:
        Dict with 'code', 'state', 'error', 'error_description'

    Raises:
        ValueError: If callback is invalid
    """
    code = request.GET.get("code")
    state = request.GET.get("state")
    error = request.GET.get("error")
    error_description = request.GET.get("error_description")

    if error:
        raise ValueError(f"Microsoft OAuth error: {error} - {error_description}")

    if not code:
        raise ValueError("Authorization code not provided in callback")

    return {"code": code, "state": state, "error": error, "error_description": error_description}
