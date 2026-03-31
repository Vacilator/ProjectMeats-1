import hashlib
import secrets
from typing import Optional, Tuple

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from apps.core.models import TenantAwareModel


class TenantWebhookEventType(models.TextChoices):
    PURCHASE_ORDER_CREATED = 'purchase_order.created', 'Purchase Order Created'
    WORKFORM_COMPLETED = 'workform.completed', 'Workform Completed'


def _generate_prefix() -> str:
    # 8 hex chars is short, human-friendly, and collision-resistant for our scale.
    return secrets.token_hex(4)


def _hash_secret(secret_value: str) -> str:
    return hashlib.sha256(secret_value.encode('utf-8')).hexdigest()


def generate_api_key() -> Tuple[str, str, str]:
    """Generate an API key triple: (full_key, prefix, secret_hash).

    full_key format: pmk_<prefix>.<secret>
    - prefix: used for DB lookup
    - secret: never stored; only shown once
    """

    prefix = f"pmk_{_generate_prefix()}"
    secret_value = secrets.token_urlsafe(32)
    full_key = f"{prefix}.{secret_value}"
    return full_key, prefix, _hash_secret(secret_value)


def generate_webhook_secret() -> str:
    return secrets.token_urlsafe(32)


class TenantAPIKey(TenantAwareModel):
    """Tenant API keys for authenticating external systems.

    Keys are write-once: we store only a SHA256 hash of the secret portion.
    """

    name = models.CharField(max_length=120)

    # Example: "pmk_ab12cd34" (lookup key)
    key_prefix = models.CharField(max_length=20, db_index=True)

    # SHA256(secret) where secret is the portion after the '.'
    key_hash = models.CharField(max_length=64)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenant_api_keys_created',
    )

    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'key_prefix'], name='unique_tenant_api_key_prefix'),
        ]
        indexes = [
            models.Index(fields=['tenant', 'revoked_at']),
            models.Index(fields=['tenant', 'key_prefix']),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.key_prefix} ({'revoked' if self.revoked_at else 'active'})"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None

    def revoke(self, *, at: Optional[timezone.datetime] = None) -> None:
        if self.revoked_at:
            return
        self.revoked_at = at or timezone.now()
        self.save(update_fields=['revoked_at', 'modified_on'])

    def verify(self, full_key: str) -> bool:
        """Verify a presented full key against this record."""
        try:
            prefix, secret_value = full_key.split('.', 1)
        except ValueError:
            return False
        if prefix != self.key_prefix:
            return False
        return _hash_secret(secret_value) == self.key_hash


class TenantWebhook(TenantAwareModel):
    """Outbound webhook subscription (tenant-scoped)."""

    target_url = models.URLField(max_length=500)

    event_type = models.CharField(max_length=64, choices=TenantWebhookEventType.choices)

    is_active = models.BooleanField(default=True, db_index=True)

    # Used to sign outbound requests (HMAC). Do not expose via list endpoints.
    signing_secret = models.CharField(max_length=128, blank=True, default='')

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenant_webhooks_created',
    )

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'event_type', 'is_active']),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.event_type} → {self.target_url}"

    def rotate_secret(self) -> str:
        new_secret = generate_webhook_secret()
        self.signing_secret = new_secret
        self.save(update_fields=['signing_secret', 'modified_on'])
        return new_secret
