"""
Django signals for integrations app.

Post-save hooks for EmailLog to trigger AI processing.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.tenants.models import TenantUser
from django.utils import timezone
from tenant_apps.workflows.models import NotificationPriority, NotificationType, UserNotification

from .ai_classification import classify_ingested_email
from .models import EmailLog, EmailReviewDraft

logger = logging.getLogger(__name__)


def _notify_actionable_email(instance: EmailLog, draft: EmailReviewDraft, category: str) -> None:
    recipients = TenantUser.objects.filter(
        tenant=instance.tenant,
        is_active=True,
        role__in=['owner', 'admin'],
    ).select_related('user')

    category_label = category.lower()
    title = f'Potential {category_label} received'
    message = (
        f'Received potential {category_label} from {instance.sender_email}. '
        'Click here to review and save.'
    )
    action_url = f'/settings/email-integrations?draft={draft.id}'
    metadata = {
        'email_log_id': str(instance.id),
        'draft_id': str(draft.id),
        'category': category,
    }

    for tenant_user in recipients:
        UserNotification.objects.create(
            user=tenant_user.user,
            tenant=instance.tenant,
            notification_type=NotificationType.SYSTEM,
            title=title,
            message=message,
            priority=NotificationPriority.HIGH,
            entity_type='email_review_draft',
            entity_id=draft.id,
            action_url=action_url,
            metadata=metadata,
        )

    draft.notification_sent_at = timezone.now()
    draft.save(update_fields=['notification_sent_at', 'updated_at'])


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
        # Mark as processing
        instance.mark_as_processing()
        
        classification = classify_ingested_email(
            subject=instance.subject,
            sender_email=instance.sender_email,
            body_text=instance.body_text or instance.body_html,
            has_attachments=instance.has_attachments,
        )

        if classification.get('actionable') and classification.get('draft_type'):
            draft, _ = EmailReviewDraft.objects.update_or_create(
                tenant=instance.tenant,
                email_log=instance,
                defaults={
                    'draft_type': str(classification['draft_type']),
                    'status': 'pending_review',
                    'summary': str(classification.get('summary') or ''),
                    'classification_confidence': float(classification.get('confidence') or 0.0),
                    'extracted_payload': classification,
                },
            )
            _notify_actionable_email(instance, draft, str(classification['category']))
            instance.mark_as_draft_created(extracted_data=classification)
        else:
            logger.info(
                "Email %s classified as %s; marking as ignored",
                instance.id,
                classification.get('category'),
            )
            instance.mark_as_completed(extracted_data=classification)
            
    except Exception as e:
        logger.error(f"AI extraction failed for email {instance.id}: {str(e)}", exc_info=True)
        instance.mark_as_failed(str(e))
