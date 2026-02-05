"""
Config Audit Log model for tracking configuration changes.

Provides a complete audit trail for:
- TenantConfig changes (create, update, delete)
- SystemChoiceList changes
- SystemChoiceItem changes
- SystemFieldSchema changes

Wave 4 Task 4.10: Audit log for admin studio configuration changes.
"""
import uuid
from django.conf import settings
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class ConfigAuditLog(models.Model):
    """
    Audit log entry for configuration changes.
    
    Tracks all modifications to configuration entities with:
    - What changed (entity type, ID, field)
    - Who changed it (user)
    - When it changed (timestamp)
    - Before/after values
    - Change type (create, update, delete)
    """
    
    class ChangeType(models.TextChoices):
        CREATE = 'CREATE', 'Created'
        UPDATE = 'UPDATE', 'Updated'
        DELETE = 'DELETE', 'Deleted'
        IMPORT = 'IMPORT', 'Imported'
        EXPORT = 'EXPORT', 'Exported'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Generic foreign key to track any model
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        help_text="Type of entity that was changed"
    )
    object_id = models.CharField(
        max_length=255,
        help_text="ID of the changed entity"
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Human-readable reference
    entity_type = models.CharField(
        max_length=50,
        help_text="Human-readable entity type (e.g., 'TenantConfig', 'ChoiceList')"
    )
    entity_name = models.CharField(
        max_length=255,
        help_text="Name/key of the entity for display"
    )
    
    # Change details
    change_type = models.CharField(
        max_length=10,
        choices=ChangeType.choices,
        help_text="Type of change"
    )
    field_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Specific field that was changed (for updates)"
    )
    old_value = models.JSONField(
        null=True,
        blank=True,
        help_text="Previous value (JSON)"
    )
    new_value = models.JSONField(
        null=True,
        blank=True,
        help_text="New value (JSON)"
    )
    
    # Full entity snapshot for complex changes
    snapshot_before = models.JSONField(
        null=True,
        blank=True,
        help_text="Complete entity state before change"
    )
    snapshot_after = models.JSONField(
        null=True,
        blank=True,
        help_text="Complete entity state after change"
    )
    
    # Who made the change
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='config_audit_logs',
        help_text="User who made the change"
    )
    user_email = models.EmailField(
        blank=True,
        help_text="Email snapshot for display even if user deleted"
    )
    
    # Tenant context
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='config_audit_logs',
        help_text="Tenant context (null for system-level changes)"
    )
    
    # Additional metadata
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the request"
    )
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string"
    )
    notes = models.TextField(
        blank=True,
        help_text="Additional notes about the change"
    )
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Config Audit Log"
        verbose_name_plural = "Config Audit Logs"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity_type', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['tenant', '-created_at']),
            models.Index(fields=['change_type', '-created_at']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"{self.change_type} {self.entity_type}:{self.entity_name} by {self.user_email or 'system'}"
    
    @classmethod
    def log_change(
        cls,
        entity,
        change_type: str,
        user=None,
        tenant=None,
        field_name: str = '',
        old_value=None,
        new_value=None,
        snapshot_before=None,
        snapshot_after=None,
        request=None,
        notes: str = ''
    ):
        """
        Convenience method to create an audit log entry.
        
        Args:
            entity: The Django model instance that was changed
            change_type: One of CREATE, UPDATE, DELETE, IMPORT, EXPORT
            user: The user who made the change
            tenant: The tenant context (optional)
            field_name: Specific field changed (for UPDATE)
            old_value: Previous value
            new_value: New value
            snapshot_before: Complete entity state before
            snapshot_after: Complete entity state after
            request: HTTP request for IP/user agent extraction
            notes: Additional notes
        """
        content_type = ContentType.objects.get_for_model(entity)
        
        # Extract entity name based on model type
        entity_name = str(entity)
        if hasattr(entity, 'key'):
            entity_name = entity.key
        elif hasattr(entity, 'name'):
            entity_name = entity.name
        elif hasattr(entity, 'slug'):
            entity_name = entity.slug
        
        # Extract request metadata
        ip_address = None
        user_agent = ''
        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
        
        return cls.objects.create(
            content_type=content_type,
            object_id=str(entity.pk),
            entity_type=entity.__class__.__name__,
            entity_name=entity_name[:255],
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            snapshot_before=snapshot_before,
            snapshot_after=snapshot_after,
            user=user,
            user_email=user.email if user else '',
            tenant=tenant,
            ip_address=ip_address,
            user_agent=user_agent,
            notes=notes
        )
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request, handling proxies."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
