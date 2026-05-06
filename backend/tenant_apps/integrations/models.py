import hashlib
import secrets
import uuid
from typing import Optional, Tuple

from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
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


class SettlementSourceAuthMode(models.TextChoices):
    TENANT_API_KEY = 'tenant_api_key', 'Tenant API Key'
    PROVIDER_HMAC_SIGNATURE = 'provider_hmac_signature', 'Provider HMAC Signature'


class SettlementEventState(models.TextChoices):
    RECEIVED = 'received', 'Received'
    VALIDATED = 'validated', 'Validated'
    DUPLICATE = 'duplicate', 'Duplicate'
    READY_TO_POST = 'ready_to_post', 'Ready to Post'
    POSTED = 'posted', 'Posted'
    IGNORED = 'ignored', 'Ignored'
    FAILED = 'failed', 'Failed'


class SettlementSource(TenantAwareModel):
    """Tenant-scoped settlement ingress source configuration."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    name = models.CharField(max_length=120)
    provider_code = models.CharField(max_length=64)
    provider_account_reference = models.CharField(max_length=120)
    auth_mode = models.CharField(
        max_length=32,
        choices=SettlementSourceAuthMode.choices,
        default=SettlementSourceAuthMode.TENANT_API_KEY,
    )
    api_key = models.ForeignKey(
        TenantAPIKey,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settlement_sources',
    )
    signing_secret = models.CharField(max_length=128, blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True)
    last_received_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settlement_sources_created',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'provider_code', 'provider_account_reference'],
                name='unique_tenant_settlement_source_provider_account',
            ),
        ]
        indexes = [
            models.Index(fields=['tenant', 'provider_code', 'is_active']),
            models.Index(fields=['tenant', 'public_id']),
        ]

    def __str__(self) -> str:
        return f'{self.tenant_id} {self.provider_code}:{self.provider_account_reference}'

    def provision_credential(self, *, created_by: Optional[User] = None) -> tuple[str, str]:
        if self.auth_mode == SettlementSourceAuthMode.TENANT_API_KEY:
            full_key, prefix, secret_hash = generate_api_key()
            if self.api_key and self.api_key.is_active:
                self.api_key.revoke()
            api_key = TenantAPIKey.objects.create(
                tenant=self.tenant,
                name=f'Settlement Source: {self.name}',
                key_prefix=prefix,
                key_hash=secret_hash,
                created_by=created_by,
            )
            self.api_key = api_key
            self.signing_secret = ''
            self.save(update_fields=['api_key', 'signing_secret', 'modified_on'])
            return 'api_key', full_key

        signing_secret = generate_webhook_secret()
        if self.api_key and self.api_key.is_active:
            self.api_key.revoke()
        self.api_key = None
        self.signing_secret = signing_secret
        self.save(update_fields=['api_key', 'signing_secret', 'modified_on'])
        return 'signing_secret', signing_secret


class SettlementEvent(TenantAwareModel):
    """Replay-safe raw settlement event journal."""

    source = models.ForeignKey(SettlementSource, on_delete=models.CASCADE, related_name='events')
    provider_code = models.CharField(max_length=64)
    provider_account_reference = models.CharField(max_length=120)
    external_event_id = models.CharField(max_length=120, blank=True, default='')
    event_type = models.CharField(max_length=64)
    direction = models.CharField(max_length=32)
    occurred_at = models.DateTimeField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    raw_payload = models.TextField()
    raw_payload_sha256 = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=64)
    state = models.CharField(
        max_length=32,
        choices=SettlementEventState.choices,
        default=SettlementEventState.RECEIVED,
        db_index=True,
    )
    normalized_payload = models.JSONField(default=dict, blank=True)
    delivery_count = models.PositiveIntegerField(default=1)
    received_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_received_at = models.DateTimeField(default=timezone.now)
    processed_at = models.DateTimeField(null=True, blank=True)
    processing_task_id = models.CharField(max_length=64, blank=True, default='')
    last_error = models.TextField(blank=True, default='')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'idempotency_key'],
                name='unique_tenant_settlement_event_idempotency',
            ),
            models.UniqueConstraint(
                fields=['tenant', 'provider_code', 'external_event_id'],
                condition=~Q(external_event_id=''),
                name='unique_tenant_settlement_provider_event',
            ),
        ]
        indexes = [
            models.Index(fields=['tenant', 'state', 'received_at']),
            models.Index(fields=['tenant', 'source', 'occurred_at']),
            models.Index(fields=['tenant', 'provider_code', 'external_event_id']),
        ]

    def __str__(self) -> str:
        return f'{self.provider_code}:{self.external_event_id or self.idempotency_key[:8]}'
