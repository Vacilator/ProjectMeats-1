"""
Microsoft Graph API provider for email integration.
Supports OAuth2 flow and email sending via Microsoft 365/Outlook.
"""
import os
import requests
from typing import Dict, Any
from urllib.parse import urlencode
from .base import (
    EmailProvider,
    EmailParams,
    EmailProviderError,
    AuthenticationError,
    TokenExpiredError,
    AuthUrlResponse,
    TokenResponse,
)


class MicrosoftGraphProvider(EmailProvider):
    """
    Microsoft Graph API email provider.
    
    Required OAuth scopes:
    - Mail.Send: Send emails
    - Mail.ReadWrite: Access mailbox
    - User.Read: Get user profile
    """
    
    PROVIDER_NAME = "microsoft"
    
    # Microsoft OAuth endpoints
    AUTHORITY = "https://login.microsoftonline.com/common"
    AUTHORIZE_ENDPOINT = f"{AUTHORITY}/oauth2/v2.0/authorize"
    TOKEN_ENDPOINT = f"{AUTHORITY}/oauth2/v2.0/token"
    
    # Microsoft Graph API
    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    
    # Required scopes
    SCOPES = [
        "https://graph.microsoft.com/Mail.Send",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/User.Read",
        "offline_access",  # Required for refresh tokens
    ]
    
    def __init__(self, tenant_id: int):
        super().__init__(tenant_id)
        self.client_id = os.environ.get("MICROSOFT_CLIENT_ID")
        self.client_secret = os.environ.get("MICROSOFT_CLIENT_SECRET")
        
        if not self.client_id or not self.client_secret:
            raise EmailProviderError(
                "Microsoft OAuth credentials not configured. "
                "Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables."
            )
    
    def get_auth_url(self, redirect_uri: str, state: str) -> AuthUrlResponse:
        """Generate Microsoft OAuth2 authorization URL"""
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": " ".join(self.SCOPES),
            "state": state,
        }
        
        auth_url = f"{self.AUTHORIZE_ENDPOINT}?{urlencode(params)}"
        return AuthUrlResponse(auth_url=auth_url, state=state)
    
    def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """Exchange authorization code for access tokens"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        
        try:
            response = requests.post(self.TOKEN_ENDPOINT, data=data, timeout=10)
            response.raise_for_status()
            token_data = response.json()
            
            return TokenResponse(
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token"),
                expires_in=token_data["expires_in"],
                token_type=token_data["token_type"],
                scope=token_data.get("scope"),
            )
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to exchange authorization code: {str(e)}")
    
    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Refresh an expired access token"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        
        try:
            response = requests.post(self.TOKEN_ENDPOINT, data=data, timeout=10)
            response.raise_for_status()
            token_data = response.json()
            
            return TokenResponse(
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token", refresh_token),
                expires_in=token_data["expires_in"],
                token_type=token_data["token_type"],
                scope=token_data.get("scope"),
            )
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to refresh token: {str(e)}")
    
    def validate_token(self, access_token: str) -> bool:
        """Validate access token by attempting to get user info"""
        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            response = requests.get(
                f"{self.GRAPH_API_BASE}/me",
                headers=headers,
                timeout=10
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Microsoft Graph"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        try:
            response = requests.get(
                f"{self.GRAPH_API_BASE}/me",
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            user_data = response.json()
            
            return {
                "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                "name": user_data.get("displayName"),
                "id": user_data.get("id"),
            }
        except requests.exceptions.RequestException as e:
            raise EmailProviderError(f"Failed to get user info: {str(e)}")
    
    def send_email(self, access_token: str, params: EmailParams) -> Dict[str, Any]:
        """
        Send email via Microsoft Graph API.
        
        Args:
            access_token: Valid OAuth access token
            params: Email parameters
            
        Returns:
            Dict with message_id and status
        """
        # Build email message in Microsoft Graph format
        message = {
            "subject": params["subject"],
            "body": {
                "contentType": "HTML" if params.get("body_html") else "Text",
                "content": params.get("body_html") or params["body"],
            },
            "toRecipients": [
                {"emailAddress": {"address": addr}} for addr in params["to"]
            ],
        }
        
        # Add optional fields
        if params.get("cc"):
            message["ccRecipients"] = [
                {"emailAddress": {"address": addr}} for addr in params["cc"]
            ]
        
        if params.get("bcc"):
            message["bccRecipients"] = [
                {"emailAddress": {"address": addr}} for addr in params["bcc"]
            ]
        
        if params.get("reply_to"):
            message["replyTo"] = [
                {"emailAddress": {"address": params["reply_to"]}}
            ]
        
        if params.get("importance"):
            message["importance"] = params["importance"]
        
        # Handle attachments
        if params.get("attachments"):
            message["attachments"] = []
            for attachment in params["attachments"]:
                message["attachments"].append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": attachment["name"],
                    "contentBytes": attachment["content_base64"],
                    "contentType": attachment.get("content_type", "application/octet-stream"),
                })
        
        # Send email
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        try:
            response = requests.post(
                f"{self.GRAPH_API_BASE}/me/sendMail",
                headers=headers,
                json={"message": message, "saveToSentItems": "true"},
                timeout=30
            )
            
            if response.status_code == 401:
                raise TokenExpiredError("Access token expired")
            
            response.raise_for_status()
            
            return {
                "status": "sent",
                "provider": "microsoft",
                "message": "Email sent successfully",
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                raise TokenExpiredError("Access token expired")
            raise EmailProviderError(f"Failed to send email: {e.response.text}")
        except requests.exceptions.RequestException as e:
            raise EmailProviderError(f"Network error while sending email: {str(e)}")
