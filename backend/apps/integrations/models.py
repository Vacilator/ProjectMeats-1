"""apps.integrations.models

ExternalAuthProvider model for storing encrypted OAuth tokens.

This project historically supported multiple token encryption mechanisms:
- OAUTH_ENCRYPTION_KEY (preferred when set)
- SECRET_KEY-derived Fernet key (fallback; used by older code paths)

To prevent false "reconnect required" failures when deployments/config drift, we
attempt decryption with both keys.
"""

import logging
import os
from base64 import urlsafe_b64encode
from datetime import timedelta

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

_DERIVED_SALT = b'projectmeats_oauth_encryption_v1'
_DERIVED_ITERATIONS = 100000


class ExternalAuthProvider(models.Model):
    """
    Store encrypted OAuth tokens for external providers (Microsoft, Gmail, etc.)
    at the tenant level.
    """
    
    PROVIDER_CHOICES = [
        ('microsoft', 'Microsoft Outlook'),
        ('google', 'Gmail'),
        ('aws_ses', 'AWS SES'),
        ('sendgrid', 'SendGrid'),
    ]
    
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='auth_providers'
    )
    provider_type = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        help_text="Email provider type"
    )
    
    # Encrypted token fields
    access_token = models.TextField(
        help_text="Encrypted OAuth access token"
    )
    refresh_token = models.TextField(
        blank=True,
        null=True,
        help_text="Encrypted OAuth refresh token"
    )
    
    token_expiry = models.DateTimeField(
        help_text="When the access token expires"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this provider is currently active"
    )
    
    # User info from provider
    connected_email = models.EmailField(
        blank=True,
        null=True,
        help_text="Email address of the connected account"
    )
    connected_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Display name of the connected account"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['tenant', 'provider_type']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'provider_type']),
            models.Index(fields=['tenant', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.tenant.name} - {self.get_provider_type_display()}"
    
    @staticmethod
    def _derive_key_from_secret(secret_key: str) -> bytes:
        """Derive a Fernet key from Django SECRET_KEY.

        This matches `apps.integrations.microsoft.encryption.TokenEncryptionService`.
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=_DERIVED_SALT,
            iterations=_DERIVED_ITERATIONS,
        )
        raw = kdf.derive(secret_key.encode('utf-8'))
        return urlsafe_b64encode(raw)

    @classmethod
    def _get_derived_encryption_key(cls) -> bytes:
        return cls._derive_key_from_secret(settings.SECRET_KEY)

    @staticmethod
    def _get_env_encryption_key() -> bytes | None:
        key = os.environ.get('OAUTH_ENCRYPTION_KEY')
        if not key:
            return None
        return key.encode('utf-8')

    @classmethod
    def _get_primary_encryption_key(cls) -> bytes:
        """Return the encryption key used for NEW token writes."""
        return cls._get_env_encryption_key() or cls._get_derived_encryption_key()

    @classmethod
    def _get_decryption_keys(cls) -> list[bytes]:
        """Return keys to try during decryption (most-preferred first)."""
        keys: list[bytes] = []
        env_key = cls._get_env_encryption_key()
        if env_key:
            keys.append(env_key)
        derived = cls._get_derived_encryption_key()
        # Avoid duplicates if someone set OAUTH_ENCRYPTION_KEY equal to derived key.
        if derived not in keys:
            keys.append(derived)
        return keys
    
    def set_encrypted_token(self, token_type: str, token: str):
        """
        Encrypt and store a token.
        
        Args:
            token_type: 'access' or 'refresh'
            token: Plain text token to encrypt
        """
        if not token:
            return
        
        fernet = Fernet(self._get_primary_encryption_key())
        encrypted = fernet.encrypt(token.encode('utf-8'))
        
        if token_type == 'access':
            self.access_token = encrypted.decode()
        elif token_type == 'refresh':
            self.refresh_token = encrypted.decode()
        else:
            raise ValueError(f"Invalid token type: {token_type}")
    
    def get_decrypted_token(self, token_type: str) -> str:
        """
        Decrypt and return a token.
        
        Args:
            token_type: 'access' or 'refresh'
            
        Returns:
            Decrypted token string
        """
        if token_type == 'access':
            encrypted = self.access_token
        elif token_type == 'refresh':
            encrypted = self.refresh_token
        else:
            raise ValueError(f"Invalid token type: {token_type}")

        if not encrypted:
            return None

        last_err: Exception | None = None
        for key in self._get_decryption_keys():
            try:
                fernet = Fernet(key)
                return fernet.decrypt(str(encrypted).encode('utf-8')).decode('utf-8')
            except InvalidToken as e:
                last_err = e
                continue
            except Exception as e:
                last_err = e
                continue

        if last_err is not None:
            raise InvalidToken() from last_err
        raise InvalidToken()
    
    def is_token_expired(self) -> bool:
        """
        Check if the access token has expired.
        
        Returns:
            True if expired, False otherwise
        """
        if not self.token_expiry:
            return True
        
        # Add 5 minute buffer for safety
        return timezone.now() >= (self.token_expiry - timedelta(minutes=5))
    
    def refresh_if_needed(self):
        """
        Refresh the access token if it's expired.
        
        Returns:
            True if token was refreshed, False if still valid
        """
        if not self.is_token_expired():
            return False
        
        # Import here to avoid circular dependency
        from .providers import MicrosoftGraphProvider
        
        if self.provider_type == 'microsoft':
            provider = MicrosoftGraphProvider(self.tenant.id)
        else:
            raise NotImplementedError(f"Provider {self.provider_type} not implemented")
        
        refresh_token = self.get_decrypted_token('refresh')
        if not refresh_token:
            # Microsoft may not return a refresh token depending on scopes/policies.
            # Avoid crashing ingestion; caller can proceed (Graph calls will simply return no data if token is expired).
            return False
        
        # Refresh the token
        token_response = provider.refresh_token(refresh_token)
        
        # Update stored tokens
        self.set_encrypted_token('access', token_response.access_token)
        if token_response.refresh_token:
            self.set_encrypted_token('refresh', token_response.refresh_token)
        
        self.token_expiry = timezone.now() + timedelta(seconds=token_response.expires_in)
        self.save()
        
        return True


class EmailLog(models.Model):
    """
    Log of emails ingested from external providers for order processing.
    
    Tracks emails fetched from Microsoft/Gmail for AI analysis and order creation.
    """
    
    STATUS_CHOICES = [
        ('logged', 'Logged'),
        ('ai_parsing', 'AI Parsing'),
        ('order_created', 'Order Created'),
        ('action_required', 'Action Required'),
        # Backward-compatible for older rows; new ingestion should use action_required instead.
        ('failed', 'Failed'),
        ('ignored', 'Ignored'),
    ]
    
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='email_logs'
    )
    provider = models.ForeignKey(
        ExternalAuthProvider,
        on_delete=models.CASCADE,
        related_name='email_logs',
        help_text="Auth provider this email was fetched from"
    )
    
    # Email identification
    message_id = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Unique message ID from provider (prevents duplicates)"
    )
    thread_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Thread/conversation ID"
    )
    
    # Email metadata
    subject = models.CharField(max_length=500)
    sender_email = models.EmailField()
    sender_name = models.CharField(max_length=255, blank=True)
    received_at = models.DateTimeField(help_text="When email was sent/received")
    
    # Email content
    body_text = models.TextField(blank=True, help_text="Plain text body")
    body_html = models.TextField(blank=True, help_text="HTML body")
    has_attachments = models.BooleanField(default=False)
    attachment_count = models.IntegerField(default=0)
    
    # Processing status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='logged',
        db_index=True
    )
    processing_error = models.TextField(
        blank=True,
        null=True,
        help_text="Error message if processing failed"
    )
    
    # AI extraction results
    extracted_data = models.JSONField(
        blank=True,
        null=True,
        help_text="AI-extracted order data (products, quantities, etc.)"
    )
    
    # Related order (if created)
    related_order_id = models.IntegerField(
        blank=True,
        null=True,
        help_text="ID of order created from this email"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When AI processing completed"
    )
    
    class Meta:
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'received_at']),
            models.Index(fields=['provider', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.tenant.name} - {self.subject} ({self.status})"
    
    def mark_as_processing(self):
        """Update status to AI parsing."""
        self.status = 'ai_parsing'
        self.updated_at = timezone.now()
        type(self).objects.filter(pk=self.pk).update(status=self.status, updated_at=self.updated_at)
    
    def mark_as_completed(self, extracted_data: dict = None, order_id: int = None):
        """Mark email processing as complete.

        Until automatic PO creation is wired, parsed emails without an order_id
        stay operator-visible instead of silently falling into the legacy
        ignored state.
        """
        self.status = 'order_created' if order_id else 'action_required'
        self.extracted_data = extracted_data
        self.related_order_id = order_id
        self.processed_at = timezone.now()
        self.updated_at = self.processed_at
        type(self).objects.filter(pk=self.pk).update(
            status=self.status,
            extracted_data=self.extracted_data,
            related_order_id=self.related_order_id,
            processed_at=self.processed_at,
            updated_at=self.updated_at,
        )
    
    def mark_as_failed(self, error_message: str):
        """Mark email processing as failed."""
        self.status = 'failed'
        self.processing_error = error_message
        self.processed_at = timezone.now()
        self.updated_at = self.processed_at
        type(self).objects.filter(pk=self.pk).update(
            status=self.status,
            processing_error=self.processing_error,
            processed_at=self.processed_at,
            updated_at=self.updated_at,
        )
