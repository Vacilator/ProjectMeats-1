"""
ExternalAuthProvider model for storing encrypted OAuth tokens.
"""
import os
from datetime import timedelta

from cryptography.fernet import Fernet, InvalidToken
from django.db import models
from django.utils import timezone


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
    def _get_encryption_key():
        """
        Get encryption key from environment.
        In production, use a secure key management service.
        """
        key = os.environ.get('OAUTH_ENCRYPTION_KEY')
        if not key:
            raise ValueError(
                "OAUTH_ENCRYPTION_KEY environment variable not set. "
                "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
        return key.encode()
    
    def set_encrypted_token(self, token_type: str, token: str):
        """
        Encrypt and store a token.
        
        Args:
            token_type: 'access' or 'refresh'
            token: Plain text token to encrypt
        """
        if not token:
            return
        
        fernet = Fernet(self._get_encryption_key())
        encrypted = fernet.encrypt(token.encode())
        
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
        fernet = Fernet(self._get_encryption_key())
        
        if token_type == 'access':
            encrypted = self.access_token
        elif token_type == 'refresh':
            encrypted = self.refresh_token
        else:
            raise ValueError(f"Invalid token type: {token_type}")
        
        if not encrypted:
            return None
        
        try:
            return fernet.decrypt(encrypted.encode()).decode()
        except InvalidToken as e:
            # Preserve InvalidToken so callers can differentiate key-mismatch from other failures.
            raise
        except Exception as e:
            raise ValueError(f"Failed to decrypt token: {str(e)}")
    
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
        self.save(update_fields=['status', 'updated_at'])
    
    def mark_as_completed(self, extracted_data: dict = None, order_id: int = None):
        """Mark email processing as complete."""
        self.status = 'order_created' if order_id else 'ignored'
        self.extracted_data = extracted_data
        self.related_order_id = order_id
        self.processed_at = timezone.now()
        self.save(update_fields=['status', 'extracted_data', 'related_order_id', 'processed_at', 'updated_at'])
    
    def mark_as_failed(self, error_message: str):
        """Mark email processing as failed."""
        self.status = 'failed'
        self.processing_error = error_message
        self.processed_at = timezone.now()
        self.save(update_fields=['status', 'processing_error', 'processed_at', 'updated_at'])
