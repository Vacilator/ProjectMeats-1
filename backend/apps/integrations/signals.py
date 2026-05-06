"""
Django signals for integrations app.

Post-save hooks for EmailLog to trigger AI processing.
"""
import logging
import uuid

from django.db.models.signals import post_save
from django.dispatch import receiver

from tenant_apps.ai_assistant.models import AIFeedbackLog

from .models import EmailLog

logger = logging.getLogger(__name__)


def _email_feedback_document_id(instance: EmailLog) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"apps.integrations.EmailLog:{instance.message_id}")


def _upsert_action_required_feedback(instance: EmailLog, extracted_data: dict) -> None:
    confidence = float((extracted_data or {}).get('confidence') or 0.0)
    document_type = str((extracted_data or {}).get('document_type') or 'purchase_order').strip() or 'purchase_order'

    AIFeedbackLog.objects.update_or_create(
        tenant=instance.tenant,
        document_id=_email_feedback_document_id(instance),
        defaults={
            'document_type': document_type,
            'original_extracted_data': extracted_data or {},
            'user_corrected_data': {},
            'confidence_score': confidence,
            'resolved_by': None,
        },
    )


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
        
        confidence = float(extracted_data.get('confidence', 0) or 0.0)
        _upsert_action_required_feedback(instance, extracted_data)

        if confidence > 0.7:
            logger.info(
                "High confidence extraction for email %s queued for operator review pending PO creation",
                instance.id,
            )
        else:
            logger.info(
                "Low confidence extraction for email %s queued for manual review",
                instance.id,
            )

        instance.mark_as_completed(extracted_data=extracted_data)
            
    except Exception as e:
        logger.error(f"AI extraction failed for email {instance.id}: {str(e)}", exc_info=True)
        instance.mark_as_failed(str(e))
