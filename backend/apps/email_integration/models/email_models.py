"""
Email Integration Models

Manages OAuth connections and email account integrations for Outlook and Gmail.
Enables trigger/action nodes in Workforms for email automation.

Created: 2026-02-23 - Email Integrations Phase 1
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

from cryptography.fernet import Fernet, InvalidToken

from apps.integrations.models import ExternalAuthProvider

logger = logging.getLogger(__name__)

User = get_user_model()


class EmailAccount(models.Model):
    """OAuth-connected email account for workflow automation"""

    PROVIDER_CHOICES = [
        ("outlook", "Microsoft Outlook"),
        ("gmail", "Google Gmail"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("expired", "Token Expired"),
        ("revoked", "Access Revoked"),
        ("error", "Error"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_accounts",
        help_text="User who owns this email connection",
    )

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_integration_accounts",
        help_text="Tenant that owns this email connection",
    )

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, help_text="Email service provider")

    email_address = models.EmailField(help_text="Connected email address")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    # OAuth tokens (stored encrypted via settings.SECRET_KEY / OAUTH_ENCRYPTION_KEY)
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)

    # Provider-specific IDs
    provider_user_id = models.CharField(max_length=255, blank=True)

    # Metadata
    display_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    # Webhook configuration
    webhook_id = models.CharField(max_length=255, blank=True, help_text="Provider webhook/subscription ID")
    webhook_expires_at = models.DateTimeField(null=True, blank=True)
    webhook_client_state_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 hash of Microsoft Graph webhook clientState",
    )

    class Meta:
        db_table = "email_accounts"
        ordering = ["-created_at"]
        unique_together = [["user", "provider", "email_address"]]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["provider", "email_address"]),
            models.Index(fields=["tenant", "provider", "email_address"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "provider", "email_address"],
                condition=Q(tenant__isnull=False),
                name="uniq_emailaccount_tenant_provider_email",
            ),
        ]

    def __str__(self):
        return f"{self.email_address} ({self.get_provider_display()})"

    @staticmethod
    def _token_field_name(token_type: str) -> str:
        if token_type == "access":
            return "access_token"
        if token_type == "refresh":
            return "refresh_token"
        raise ValueError(f"Invalid token type: {token_type}")

    @staticmethod
    def _looks_encrypted(value: str) -> bool:
        return str(value or "").startswith("gAAAAA")

    def set_encrypted_token(self, token_type: str, token: str) -> None:
        if not token:
            return

        encrypted = Fernet(ExternalAuthProvider._get_primary_encryption_key()).encrypt(token.encode("utf-8"))
        setattr(self, self._token_field_name(token_type), encrypted.decode("utf-8"))

    def get_decrypted_token(self, token_type: str) -> str:
        encrypted = getattr(self, self._token_field_name(token_type), "") or ""
        if not encrypted:
            return ""

        if not self._looks_encrypted(encrypted):
            logger.warning(
                "Legacy plaintext %s token detected for EmailAccount id=%s; re-encryption required.",
                token_type,
                self.id,
            )
            return str(encrypted)

        last_error: Exception | None = None
        for key in ExternalAuthProvider._get_decryption_keys():
            try:
                return Fernet(key).decrypt(str(encrypted).encode("utf-8")).decode("utf-8")
            except InvalidToken as exc:
                last_error = exc
            except Exception as exc:
                last_error = exc

        if last_error is not None:
            raise InvalidToken() from last_error
        raise InvalidToken()

    def ensure_tokens_encrypted(self, *, save: bool = True) -> bool:
        changed_fields: list[str] = []
        for token_type in ("access", "refresh"):
            field_name = self._token_field_name(token_type)
            raw_value = getattr(self, field_name, "") or ""
            if raw_value and not self._looks_encrypted(raw_value):
                self.set_encrypted_token(token_type, str(raw_value))
                changed_fields.append(field_name)

        if changed_fields and save:
            self.save(update_fields=[*changed_fields, "updated_at"])

        return bool(changed_fields)

    def sync_external_provider_credentials(self):
        if not self.tenant_id:
            return None

        self.ensure_tokens_encrypted(save=False)

        provider_type = {
            "outlook": "microsoft",
            "gmail": "google",
        }.get(self.provider, self.provider)

        access_token = self.get_decrypted_token("access")
        if not access_token:
            return None

        with transaction.atomic():
            provider, _ = ExternalAuthProvider.objects.select_for_update().update_or_create(
                tenant=self.tenant,
                provider_type=provider_type,
                defaults={
                    "is_active": self.status not in {"revoked", "error"},
                    "token_expiry": self.token_expires_at or timezone.now(),
                    "connected_email": self.email_address,
                    "connected_name": self.display_name or self.email_address,
                    "access_token": self.access_token,
                    "refresh_token": self.refresh_token or None,
                },
            )
        return provider

    def refresh_if_needed(self) -> bool:
        self.ensure_tokens_encrypted()
        if not self.is_token_expired:
            return False

        if self.provider != "outlook" or not self.tenant_id:
            return False

        refresh_token = self.get_decrypted_token("refresh")
        if not refresh_token:
            self.status = "expired"
            self.save(update_fields=["status", "updated_at"])
            return False

        from apps.integrations.providers import MicrosoftGraphProvider

        provider = MicrosoftGraphProvider(self.tenant_id)
        token_response = provider.refresh_token(refresh_token)

        self.set_encrypted_token("access", token_response.access_token)
        if token_response.refresh_token:
            self.set_encrypted_token("refresh", token_response.refresh_token)
        self.token_expires_at = timezone.now() + timedelta(seconds=token_response.expires_in)
        self.status = "active"
        self.save(
            update_fields=[
                "access_token",
                "refresh_token",
                "token_expires_at",
                "status",
                "updated_at",
            ]
        )
        self.sync_external_provider_credentials()
        return True

    def get_valid_access_token(self) -> str:
        self.ensure_tokens_encrypted()
        if self.is_token_expired:
            self.refresh_if_needed()
        if self.is_token_expired:
            return ""
        return self.get_decrypted_token("access")

    def build_google_credentials(self):
        from google.oauth2.credentials import Credentials

        self.ensure_tokens_encrypted()
        access_token = self.get_decrypted_token("access")
        if not access_token:
            return None

        return Credentials(
            token=access_token,
            refresh_token=self.get_decrypted_token("refresh") or None,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
        )

    @property
    def is_token_expired(self):
        """Check if access token has expired"""
        if not self.token_expires_at:
            return False
        return timezone.now() >= (self.token_expires_at - timedelta(minutes=5))

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
        ("new_email", "New Email Received"),
        ("new_thread", "New Email Thread"),
        ("reply_received", "Reply Received"),
        ("attachment_received", "Email with Attachment"),
    ]

    email_account = models.ForeignKey(
        EmailAccount,
        on_delete=models.CASCADE,
        related_name="triggers",
    )

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_integration_triggers",
    )

    workflow_node_id = models.CharField(max_length=255, help_text="ID of the Workforms node this trigger activates")

    trigger_type = models.CharField(max_length=50, choices=TRIGGER_TYPES)

    # Filter configuration (JSON)
    filter_from = models.CharField(max_length=255, blank=True, help_text="Filter by sender email/domain")
    filter_subject = models.CharField(max_length=255, blank=True, help_text="Filter by subject keywords")
    filter_has_attachment = models.BooleanField(default=False)

    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    trigger_count = models.IntegerField(default=0)

    class Meta:
        db_table = "email_triggers"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "is_active"]),
            models.Index(fields=["email_account", "is_active"]),
            models.Index(fields=["workflow_node_id"]),
        ]

    def __str__(self):
        return f"{self.get_trigger_type_display()} for {self.email_account.email_address}"


class EmailAction(models.Model):
    """Email action configuration for workflow nodes"""

    ACTION_TYPES = [
        ("send_email", "Send Email"),
        ("reply", "Reply to Email"),
        ("forward", "Forward Email"),
    ]

    email_account = models.ForeignKey(
        EmailAccount,
        on_delete=models.CASCADE,
        related_name="actions",
    )

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_integration_actions",
    )

    workflow_node_id = models.CharField(max_length=255, help_text="ID of the Workforms node this action belongs to")

    action_type = models.CharField(max_length=50, choices=ACTION_TYPES)

    # Template configuration
    template_subject = models.CharField(max_length=255, blank=True)
    template_body = models.TextField(blank=True)
    use_html = models.BooleanField(default=True)

    # Recipients (supports variables: {{customer.email}}, etc.)
    recipient_to = models.TextField(help_text="Comma-separated or template variables")
    recipient_cc = models.TextField(blank=True)
    recipient_bcc = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    execution_count = models.IntegerField(default=0)
    last_executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "email_actions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant"]),
            models.Index(fields=["email_account"]),
            models.Index(fields=["workflow_node_id"]),
        ]

    def __str__(self):
        return f"{self.get_action_type_display()} via {self.email_account.email_address}"


class EmailLog(models.Model):
    """Audit log for email triggers and actions"""

    LOG_TYPES = [
        ("trigger", "Trigger Activated"),
        ("action", "Action Executed"),
        ("webhook", "Webhook Received"),
        ("error", "Error"),
    ]

    email_account = models.ForeignKey(
        EmailAccount,
        on_delete=models.CASCADE,
        related_name="logs",
    )

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_integration_logs",
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
        db_table = "email_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "-created_at"]),
            models.Index(fields=["email_account", "-created_at"]),
            models.Index(fields=["workflow_node_id", "-created_at"]),
            models.Index(fields=["success"]),
        ]

    def __str__(self):
        status = "✓" if self.success else "✗"
        return f"{status} {self.get_log_type_display()} - {self.subject[:50]}"
