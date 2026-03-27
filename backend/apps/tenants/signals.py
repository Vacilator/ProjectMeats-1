"""
Signal handlers for tenant models.
Automatically sends invitation emails when TenantInvitation is created.
Ensures owners have Django admin access.
Clears branding cache on tenant updates.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.cache import cache
from django.conf import settings
from django.db import transaction

from .invitation_email import schedule_invitation_email
from .models import TenantInvitation, TenantUser, Tenant

logger = logging.getLogger(__name__)


@receiver(post_save, sender=TenantInvitation, dispatch_uid="send_invitation_email_once")
def send_invitation_email(sender, instance, created, **kwargs):
    """
    Automatically send email when a new invitation is created.
    
    Only sends email if:
    - Invitation was just created
    - Status is 'pending'
    - Email address is provided (not a reusable golden ticket)
    
    Note: dispatch_uid prevents duplicate signal connections during Django reload.
    """
    if created and instance.status == 'pending' and instance.email:
        # Log configuration status
        logger.info("=" * 60)
        logger.info("📧 Preparing to send invitation email")
        logger.info(f"Recipient: {instance.email}")
        logger.info(f"Tenant: {instance.tenant.name}")
        logger.info(f"Role: {instance.role}")
        logger.info(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
        logger.info(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
        logger.info(f"SENDGRID_API_KEY: {'✅ SET' if getattr(settings, 'SENDGRID_API_KEY', '') else '❌ NOT SET'}")
        logger.info("=" * 60)
        
        # Ensure invitation creation isn't rolled back if email fails.
        schedule_invitation_email(instance)


@receiver(post_save, sender=TenantUser, dispatch_uid="ensure_privileged_roles_have_staff_access")
def ensure_privileged_roles_have_staff_access(sender, instance, created, **kwargs):
    """
    Automatically grant Django admin access to users with 'owner' or 'admin' roles.
    
    When a TenantUser is created or updated with role='owner' or role='admin',
    this signal ensures the associated User has is_staff=True so they can access
    the Django admin interface.
    
    Note: dispatch_uid prevents duplicate signal connections during Django reload.
    """
    privileged_roles = ['owner', 'admin']
    if instance.role in privileged_roles and not instance.user.is_staff:
        logger.info(f"🔑 Granting admin access to {instance.role}: {instance.user.username} @ {instance.tenant.slug}")
        instance.user.is_staff = True
        instance.user.save(update_fields=['is_staff'])
        logger.info(f"✅ Admin access granted to {instance.user.username}")


@receiver(post_save, sender=Tenant, dispatch_uid="clear_tenant_branding_cache_on_update")
def clear_tenant_branding_cache(sender, instance, created, **kwargs):
    """
    Clear tenant branding cache when a tenant is updated.
    
    This ensures that logo and color changes are immediately reflected
    in the frontend without requiring manual cache clearing.
    
    Note: dispatch_uid prevents duplicate signal connections during Django reload.
    """
    if not created:  # Only on updates, not creation
        cache_key = f'tenant_branding_{instance.id}'
        cache.delete(cache_key)
        logger.info(f"🎨 Cleared branding cache for tenant: {instance.slug} (key: {cache_key})")
        
        # Also clear any domain-based cache keys
        if instance.domain:
            domain_cache_key = f'tenant_by_domain_{instance.domain}'
            cache.delete(domain_cache_key)
            logger.info(f"🌐 Cleared domain cache for tenant: {instance.domain}")

