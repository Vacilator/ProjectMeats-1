"""
Base provider interface for email integrations.
Provider-agnostic design to support Microsoft, Gmail, AWS SES, SendGrid, etc.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict


class EmailProviderError(Exception):
    """Base exception for email provider errors"""

    pass


class AuthenticationError(EmailProviderError):
    """Raised when authentication fails"""

    pass


class TokenExpiredError(AuthenticationError):
    """Raised when OAuth token has expired"""

    pass


class EmailParams(TypedDict, total=False):
    """Email parameters for sending"""

    to: List[str]
    cc: Optional[List[str]]
    bcc: Optional[List[str]]
    subject: str
    body: str
    body_html: Optional[str]
    attachments: Optional[List[Dict[str, Any]]]
    reply_to: Optional[str]
    importance: Optional[str]  # low, normal, high
    headers: Optional[Dict[str, str]]


class EmailSendResult(TypedDict, total=False):
    """Provider-normalized send result for durable outbound audit."""

    status: str
    provider: str
    message: str
    provider_message_id: str
    provider_thread_id: str
    provider_internet_message_id: str
    provider_web_link: str


@dataclass
class AuthUrlResponse:
    """OAuth authorization URL response"""

    auth_url: str
    state: str


@dataclass
class TokenResponse:
    """OAuth token response"""

    access_token: str
    refresh_token: Optional[str]
    expires_in: int
    token_type: str
    scope: Optional[str]


class EmailProvider(ABC):
    """
    Abstract base class for email providers.

    All email providers (Microsoft, Gmail, AWS SES, etc.) must implement this interface.
    """

    PROVIDER_NAME: str = "base"

    def __init__(self, tenant_id: int):
        """
        Initialize provider with tenant context.

        Args:
            tenant_id: The tenant ID this provider is configured for
        """
        self.tenant_id = tenant_id

    @abstractmethod
    def get_auth_url(self, redirect_uri: str, state: str) -> AuthUrlResponse:
        """
        Generate OAuth2 authorization URL.

        Args:
            redirect_uri: URL to redirect to after authorization
            state: CSRF protection state parameter

        Returns:
            AuthUrlResponse with auth_url and state
        """
        pass

    @abstractmethod
    def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """
        Exchange authorization code for access tokens.

        Args:
            code: Authorization code from OAuth callback
            redirect_uri: Must match the redirect_uri used in get_auth_url

        Returns:
            TokenResponse with access and refresh tokens

        Raises:
            AuthenticationError: If code exchange fails
        """
        pass

    @abstractmethod
    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            TokenResponse with new access token

        Raises:
            AuthenticationError: If token refresh fails
        """
        pass

    @abstractmethod
    def send_email(self, access_token: str, params: EmailParams) -> EmailSendResult:
        """
        Send an email using the provider's API.

        Args:
            access_token: Valid OAuth access token
            params: Email parameters (to, subject, body, etc.)

        Returns:
            Provider-normalized send response with durable correlation metadata when available

        Raises:
            EmailProviderError: If email sending fails
            TokenExpiredError: If access token is expired
        """
        pass

    @abstractmethod
    def validate_token(self, access_token: str) -> bool:
        """
        Validate that an access token is still valid.

        Args:
            access_token: Access token to validate

        Returns:
            True if token is valid, False otherwise
        """
        pass

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get user information from the provider (optional).

        Args:
            access_token: Valid OAuth access token

        Returns:
            Dict with user info (email, name, etc.)
        """
        raise NotImplementedError("get_user_info not implemented for this provider")
