"""
Django signals for integrations app.

Post-save hooks for EmailLog to trigger AI processing.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import EmailLog

logger = logging.getLogger(__name__)


@receiver(post_save, sender=EmailLog)
def trigger_ai_extraction(sender, instance, created, **kwargs):
    """
    Trigger AI extraction when a new email is logged.
    
    Called automatically after EmailLog.save() via Django signals.
    Only processes newly created emails in 'logged' status.
    """
    # Only process newly created emails
    if not created:
        return
    
    # Only process emails in 'logged' status (skip already processed)
    if instance.status != 'logged':
        return
    
    logger.info(f"Triggering AI extraction for email {instance.id}: {instance.subject}")
    
    try:
        # Import here to avoid circular dependency
        from tenant_apps.integrations.services.email_ingestion import ai_extract_order_data
        
        # Mark as processing
        instance.mark_as_processing()
        
        # Extract order data from email body
        email_body = instance.body_text or instance.body_html
        extracted_data = ai_extract_order_data(email_body)
        
        # If high confidence, create order (TODO: implement order creation)
        if extracted_data.get('confidence', 0) > 0.7:
            logger.info(f"High confidence extraction for email {instance.id}, would create order")
            # TODO: Call order creation service
            instance.mark_as_completed(extracted_data=extracted_data)
        else:
            # Low confidence, mark as ignored for manual review
            logger.info(f"Low confidence extraction for email {instance.id}, marking as ignored")
            instance.mark_as_completed(extracted_data=extracted_data)
            
    except Exception as e:
        logger.error(f"AI extraction failed for email {instance.id}: {str(e)}", exc_info=True)
        instance.mark_as_failed(str(e))
