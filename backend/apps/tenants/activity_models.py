"""
Activity logging for audit trail in admin workspace.

Tracks all admin actions for security and compliance.
"""

from django.contrib.auth.models import User
from django.db import models
from .models import Tenant


class ActivityLog(models.Model):
    """
    Activity log for tracking admin actions.
    
    Used for audit trail in admin workspace to track:
    - User management (invitations, role changes, deactivations)
    - Configuration changes
    - Profile updates
    - Customization changes
    """
    
    ACTION_CHOICES = [
        ('user.invite', 'User Invited'),
        ('user.role_change', 'User Role Changed'),
        ('user.deactivate', 'User Deactivated'),
        ('user.activate', 'User Activated'),
        ('profile.update', 'Profile Updated'),
        ('config.update', 'Configuration Updated'),
        ('theme.update', 'Theme Updated'),
        ('optionlist.create', 'Option List Created'),
        ('optionlist.update', 'Option List Updated'),
        ('optionlist.delete', 'Option List Deleted'),
    ]
    
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='activity_logs',
        help_text='Tenant this activity belongs to'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='admin_activities',
        help_text='User who performed the action'
    )
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        help_text='Type of action performed'
    )
    entity_type = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text='Type of entity affected (e.g., "TenantUser", "Tenant")'
    )
    entity_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='ID of the affected entity'
    )
    description = models.TextField(
        help_text='Human-readable description of the action'
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional metadata (old values, new values, etc.)'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address of the user'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'tenants_activity_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]
    
    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.get_action_display()} at {self.created_at}"
    
    @staticmethod
    def log_activity(tenant, user, action, description, entity_type=None, entity_id=None, metadata=None, ip_address=None):
        """
        Helper method to create an activity log entry.
        
        Args:
            tenant: Tenant instance
            user: User instance who performed the action
            action: Action code (from ACTION_CHOICES)
            description: Human-readable description
            entity_type: Type of entity affected (optional)
            entity_id: ID of affected entity (optional)
            metadata: Additional metadata dict (optional)
            ip_address: IP address (optional)
        
        Returns:
            ActivityLog instance
        """
        return ActivityLog.objects.create(
            tenant=tenant,
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            description=description,
            metadata=metadata or {},
            ip_address=ip_address
        )
