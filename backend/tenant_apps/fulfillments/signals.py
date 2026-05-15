"""Signal handlers for Fulfillments app activity logging."""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Fulfillment, FulfillmentStatusChoices


@receiver(pre_save, sender=Fulfillment)
def track_fulfillment_status_change(sender, instance, **kwargs):
    """Track status changes before save."""
    if instance.pk:
        try:
            old_instance = Fulfillment.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
        except Fulfillment.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender=Fulfillment)
def log_fulfillment_activity(sender, instance, created, **kwargs):
    """Log fulfillment creation and status changes to activity log."""
    from tenant_apps.cockpit.models import ActivityLog
    
    inquiry = instance.inquiry
    
    if created:
        # Log fulfillment creation on the inquiry's entity
        entity_type = inquiry.entity_type
        entity_id = inquiry.supplier_id if inquiry.supplier else inquiry.customer_id
        
        if entity_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type=entity_type,
                entity_id=entity_id,
                title=f"Fulfillment Created: {instance.fulfillment_number}",
                content=f"Fulfillment created for inquiry {inquiry.inquiry_number}",
                created_by=instance.created_by
            )
        
        # Also log on customer if different from entity
        if instance.customer_id and instance.customer_id != inquiry.customer_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type='customer',
                entity_id=instance.customer_id,
                title=f"Fulfillment Created: {instance.fulfillment_number}",
                content=f"Receiving fulfillment from inquiry {inquiry.inquiry_number}",
                created_by=instance.created_by
            )
        
        # Also log on supplier if different from entity
        if instance.supplier_id and instance.supplier_id != inquiry.supplier_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type='supplier',
                entity_id=instance.supplier_id,
                title=f"Fulfillment Created: {instance.fulfillment_number}",
                content=f"Fulfilling inquiry {inquiry.inquiry_number}",
                created_by=instance.created_by
            )
    
    else:
        # Check for status changes
        old_status = getattr(instance, '_old_status', None)
        if old_status and old_status != instance.status:
            entity_type = inquiry.entity_type
            entity_id = inquiry.supplier_id if inquiry.supplier else inquiry.customer_id
            
            # Build content based on status
            content = f"Status changed from {old_status} to {instance.status}"
            if instance.status == FulfillmentStatusChoices.SHIPPED:
                if instance.tracking_numbers:
                    content += f". Tracking: {', '.join(instance.tracking_numbers[:3])}"
                    if len(instance.tracking_numbers) > 3:
                        content += f" (+{len(instance.tracking_numbers) - 3} more)"
                # Dispatch shipment notification email (best-effort, non-blocking)
                _dispatch_fulfillment_email(instance, notification_type="shipped")
            elif instance.status == FulfillmentStatusChoices.DELIVERED:
                if instance.actual_delivery:
                    content += f". Delivered on {instance.actual_delivery}"
                # Dispatch delivery confirmation email (best-effort, non-blocking)
                _dispatch_fulfillment_email(instance, notification_type="delivered")
            
            if entity_id:
                ActivityLog.objects.create(
                    tenant=instance.tenant,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    title=f"Fulfillment {instance.status.title()}: {instance.fulfillment_number}",
                    content=content,
                    created_by=instance.shipped_by if instance.status == FulfillmentStatusChoices.SHIPPED else None
                )


def _dispatch_fulfillment_email(fulfillment, *, notification_type: str) -> None:
    """Best-effort email dispatch — logs failures but never blocks the save."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        from tenant_apps.fulfillments.services.fulfillment_email import send_fulfillment_notification
        result = send_fulfillment_notification(
            tenant=fulfillment.tenant,
            fulfillment=fulfillment,
            notification_type=notification_type,
        )
        if not result.success:
            logger.warning(
                "fulfillment_signal.email_dispatch_failed fulfillment=%s type=%s reason=%s",
                fulfillment.fulfillment_number,
                notification_type,
                result.error_message,
            )
    except Exception:
        logger.exception(
            "fulfillment_signal.email_dispatch_error fulfillment=%s type=%s",
            fulfillment.fulfillment_number,
            notification_type,
        )
