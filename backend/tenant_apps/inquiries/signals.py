"""Signal handlers for Inquiries app activity logging."""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Inquiry, InquiryProduct

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Inquiry)
def track_inquiry_status_change(sender, instance, **kwargs):
    """Track status changes before save."""
    if instance.pk:
        try:
            old_instance = Inquiry.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
        except Inquiry.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender=Inquiry)
def log_inquiry_activity(sender, instance, created, **kwargs):
    """Log inquiry creation and status changes to activity log."""
    from tenant_apps.cockpit.models import ActivityLog
    
    if created:
        # Log inquiry creation
        entity_type = instance.entity_type
        entity_id = instance.supplier_id if instance.supplier else instance.customer_id
        
        if entity_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type=entity_type,
                entity_id=entity_id,
                title=f"New Inquiry: {instance.inquiry_number}",
                content=f"Inquiry created from {instance.get_source_type_display()}. Contact: {instance.contact_name or 'N/A'}",
                created_by=instance.created_by
            )
        
        # Also log to contact if present
        if instance.contact_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type='contact',
                entity_id=instance.contact_id,
                title=f"New Inquiry: {instance.inquiry_number}",
                content=f"Inquiry created with this contact",
                created_by=instance.created_by
            )
    
    else:
        # Check for status changes
        old_status = getattr(instance, '_old_status', None)
        if old_status and old_status != instance.status:
            entity_type = instance.entity_type
            entity_id = instance.supplier_id if instance.supplier else instance.customer_id
            
            if entity_id:
                ActivityLog.objects.create(
                    tenant=instance.tenant,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    title=f"Inquiry Status: {instance.inquiry_number}",
                    content=f"Status changed from {old_status} to {instance.status}",
                    created_by=None  # Could be system or user
                )
            
            # Auto-create follow-up call when status changes to 'quoted'
            if instance.status == 'quoted' and old_status != 'quoted':
                try:
                    from .services.auto_followup import create_followup_call
                    call = create_followup_call(instance, created_by=instance.created_by)
                    if call:
                        logger.info(
                            f"Auto-created follow-up call for inquiry {instance.inquiry_number}: "
                            f"scheduled for {call.scheduled_for}"
                        )
                except Exception as e:
                    logger.error(f"Failed to create follow-up call for inquiry {instance.inquiry_number}: {e}")


@receiver(post_save, sender=InquiryProduct)
def log_inquiry_product_activity(sender, instance, created, **kwargs):
    """Log when products are added to an inquiry."""
    from tenant_apps.cockpit.models import ActivityLog
    
    if created:
        inquiry = instance.inquiry
        entity_type = inquiry.entity_type
        entity_id = inquiry.supplier_id if inquiry.supplier else inquiry.customer_id
        
        if entity_id:
            product_name = instance.product.description_of_product_item[:50]
            ActivityLog.objects.create(
                tenant=inquiry.tenant,
                entity_type=entity_type,
                entity_id=entity_id,
                title=f"Product Added: {inquiry.inquiry_number}",
                content=f"Added product: {product_name} (Qty: {instance.quantity})",
                created_by=None
            )
