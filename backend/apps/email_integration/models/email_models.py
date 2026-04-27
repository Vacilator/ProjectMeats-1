"""
Email Integration Models

Manages OAuth connections and email account integrations for Outlook and Gmail.
Enables trigger/action nodes in Workforms for email automation.

Created: 2026-02-23 - Email Integrations Phase 1
"""

from django.db import models
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class EmailAccount(models.Model):
    """OAuth-connected email account for workflow automation"""
    
    PROVIDER_CHOICES = [
        ('outlook', 'Microsoft Outlook'),
        ('gmail', 'Google Gmail'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expired', 'Token Expired'),
        ('revoked', 'Access Revoked'),
        ('error', 'Error'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='email_accounts',
        help_text='User who owns this email connection',
    )

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='email_integration_accounts',
        help_text='Tenant that owns this email connection',
    )
    
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        help_text='Email service provider'
    )
    
    email_address = models.EmailField(
        help_text='Connected email address'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    
    # OAuth tokens (stored encrypted via settings.SECRET_KEY)
    access_token = models.CharField(max_length=1024)
    refresh_token = models.CharField(max_length=1024, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    
    # Provider-specific IDs
    provider_user_id = models.CharField(max_length=255, blank=True)
    
    # Metadata
    display_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    # Webhook configuration
    webhook_id = models.CharField(max_length=255, blank=True, help_text='Provider webhook/subscription ID')
    webhook_expires_at = models.DateTimeField(null=True, blank=True)
    webhook_client_state_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text='SHA256 hash of Microsoft Graph webhook clientState',
    )
    
    class Meta:
        db_table = 'email_accounts'
        ordering = ['-created_at']
        unique_together = [['user', 'provider', 'email_address']]
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['provider', 'email_address']),
            models.Index(fields=['tenant', 'provider', 'email_address']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'provider', 'email_address'],
                condition=Q(tenant__isnull=False),
                name='uniq_emailaccount_tenant_provider_email',
            ),
        ]
    
    def __str__(self):
        return f'{self.email_address} ({self.get_provider_display()})'
    
    @property
    def is_token_expired(self):
        """Check if access token has expired"""
        if not self.token_expires_at:
            return False
        return timezone.now() >= self.token_expires_at
    
    @property
    def needs_webhook_renewal(self):
        """Check if webhook subscription needs renewal"""
        if not self.webhook_expires_at:
            return False
        # Renew 1 day before expiration
        return timezone.now() >= (self.webhook_expires_at - timezone.timedelta(days=1))



class EmailTrigger(models.Model):
    """Email-based trigger configuration for workflow nodes"""
    
    TRIGGER_TYPES = [
        ('new_email', 'New Email Received'),
        ('new_thread', 'New Email Thread'),
        ('reply_received', 'Reply Received'),
        ('attachment_received', 'Email with Attachment'),
    ]
    
    email_account = models.ForeignKey(
        EmailAccount,
        on_delete=models.CASCADE,
        related_name='triggers',
    )

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='email_integration_triggers',
    )
    
    workflow_node_id = models.CharField(
        max_length=255,
        help_text='ID of the Workforms node this trigger activates'
    )
    
    trigger_type = models.CharField(
        max_length=50,
        choices=TRIGGER_TYPES
    )
    
    # Filter configuration (JSON)
    filter_from = models.CharField(max_length=255, blank=True, help_text='Filter by sender email/domain')
    filter_subject = models.CharField(max_length=255, blank=True, help_text='Filter by subject keywords')
    filter_has_attachment = models.BooleanField(default=False)
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    trigger_count = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'email_triggers'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['email_account', 'is_active']),
            models.Index(fields=['workflow_node_id']),
        ]
    
    def __str__(self):
        return f'{self.get_trigger_type_display()} for {self.email_account.email_address}'


class EmailAction(models.Model):
    """Email action configuration for workflow nodes"""
    
    ACTION_TYPES = [
        ('send_email', 'Send Email'),
        ('reply', 'Reply to Email'),
        ('forward', 'Forward Email'),
    ]
    
    email_account = models.ForeignKey(
        EmailAccount,
        on_delete=models.CASCADE,
        related_name='actions',
    )

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='email_integration_actions',
    )
    
    workflow_node_id = models.CharField(
        max_length=255,
        help_text='ID of the Workforms node this action belongs to'
    )
    
    action_type = models.CharField(
        max_length=50,
        choices=ACTION_TYPES
    )
    
    # Template configuration
    template_subject = models.CharField(max_length=255, blank=True)
    template_body = models.TextField(blank=True)
    use_html = models.BooleanField(default=True)
    
    # Recipients (supports variables: {{customer.email}}, etc.)
    recipient_to = models.TextField(help_text='Comma-separated or template variables')
    recipient_cc = models.TextField(blank=True)
    recipient_bcc = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    execution_count = models.IntegerField(default=0)
    last_executed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'email_actions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['email_account']),
            models.Index(fields=['workflow_node_id']),
        ]
    
    def __str__(self):
        return f'{self.get_action_type_display()} via {self.email_account.email_address}'


class EmailLog(models.Model):
    """Audit log for email triggers and actions"""
    
    LOG_TYPES = [
        ('trigger', 'Trigger Activated'),
        ('action', 'Action Executed'),
        ('webhook', 'Webhook Received'),
        ('error', 'Error'),
    ]
    
    email_account = models.ForeignKey(
        EmailAccount,
        on_delete=models.CASCADE,
        related_name='logs',
    )

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='email_integration_logs',
    )

    log_type = models.CharField(max_length=20, choices=LOG_TYPES)
    workflow_node_id = models.CharField(max_length=255, blank=True)
    
    # Details
    subject = models.CharField(max_length=500, blank=True)
    from_address = models.EmailField(blank=True)
    to_address = models.TextField(blank=True)
    
    # Metadata
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Raw data (for debugging)
    raw_data = models.JSONField(blank=True, null=True)
    
    class Meta:
        db_table = 'email_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', '-created_at']),
            models.Index(fields=['email_account', '-created_at']),
            models.Index(fields=['workflow_node_id', '-created_at']),
            models.Index(fields=['success']),
        ]
    
    def __str__(self):
        status = '✓' if self.success else '✗'
        return f'{status} {self.get_log_type_display()} - {self.subject[:50]}'
