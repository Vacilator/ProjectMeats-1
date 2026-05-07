import logging
import uuid

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.tenants.models import TenantUser
from tenant_apps.inquiries.services import parse_supplier_quote_reply
from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.workflows.models import NotificationPriority, NotificationType, UserNotification

from .ai_classification import classify_ingested_email
from .inquiry_drafts import upsert_inquiry_draft_from_email
from .models import EmailLog, EmailReviewDraft

logger = logging.getLogger(__name__)


def _email_feedback_document_id(instance: EmailLog) -> uuid.UUID:
    identifier = instance.message_id or str(instance.pk or uuid.uuid4())
    return uuid.uuid5(uuid.NAMESPACE_URL, f'apps.integrations.EmailLog:{identifier}')


def _upsert_action_required_feedback(instance: EmailLog, extracted_data: dict | None) -> None:
    payload = dict(extracted_data or {})
    subject = str(payload.get('subject') or instance.subject or '').strip()
    if subject:
        payload.setdefault('subject', subject)
    sender_email = str(payload.get('sender_email') or instance.sender_email or '').strip()
    if sender_email:
        payload.setdefault('sender_email', sender_email)

    AIFeedbackLog.objects.update_or_create(
        tenant=instance.tenant,
        document_id=_email_feedback_document_id(instance),
        defaults={
            'document_type': payload.get('document_type') or payload.get('draft_type') or payload.get('category') or 'purchase_order',
            'original_extracted_data': payload,
            'user_corrected_data': {},
            'confidence_score': float(payload.get('confidence_score') or payload.get('confidence') or 0.0),
            'resolved_by': None,
        },
    )


def _notify_actionable_email(instance: EmailLog, draft: EmailReviewDraft, classification: dict) -> None:
    reviewer_qs = (
        TenantUser.objects.select_related('user')
        .filter(tenant=instance.tenant, is_active=True)
        .exclude(user__isnull=True)
    )
    recipients = []
    for membership in reviewer_qs:
        user = membership.user
        if not user:
            continue
        if user.is_superuser or user.is_staff or membership.role in {'owner', 'admin', 'manager'}:
            recipients.append(user)

    if not recipients:
        logger.info('No actionable-email reviewers found for tenant %s', instance.tenant_id)
        return

    title = f'AI review required: {draft.get_draft_type_display()}'
    subject = (instance.subject or '').strip() or 'Email review item'
    category = classification.get('category') or 'actionable'
    message = (
        f'{subject} from {instance.sender_email} requires review '
        f'({category.replace("_", " ")}).'
    )
    action_url = f'/my-tasks?tab=ai-review&draft={draft.id}'

    now = timezone.now()
    notifications = [
        UserNotification(
            tenant=instance.tenant,
            user=user,
            notification_type=NotificationType.SYSTEM,
            priority=NotificationPriority.HIGH,
            title=title,
            message=message,
            entity_type='email_review_draft',
            entity_id=draft.id,
            action_url=action_url,
            is_read=False,
            created_at=now,
        )
        for user in recipients
    ]
    UserNotification.objects.bulk_create(notifications, ignore_conflicts=False)
    EmailReviewDraft.objects.filter(pk=draft.pk).update(notification_sent_at=now)

    logger.info(
        'Queued %s actionable-email notifications for tenant %s draft=%s',
        len(notifications),
        instance.tenant_id,
        draft.id,
    )


@receiver(post_save, sender=EmailLog)
def trigger_ai_extraction(sender, instance, created, **kwargs):
    """
    Automatically trigger AI extraction when a new EmailLog is created.

    This signal fires after an email is logged from OAuth sync.
    In production, should be replaced with Celery task for async processing.
    """
    if not created:
        return

    if instance.status != 'logged':
        return

    try:
        instance.mark_as_processing()

        supplier_reply = parse_supplier_quote_reply(email_log=instance)
        if supplier_reply is not None:
            _upsert_action_required_feedback(instance, supplier_reply)
            logger.info(
                'Email %s matched supplier RFQ reply flow with parse_status=%s',
                instance.id,
                supplier_reply.get('supplier_reply_parse', {}).get('parse_status'),
            )
            instance.mark_as_completed(extracted_data=supplier_reply)
            return

        classification = classify_ingested_email(
            subject=instance.subject,
            body_text=instance.body_text,
            sender_email=instance.sender_email,
            has_attachments=instance.has_attachments,
        )

        inquiry, _ = upsert_inquiry_draft_from_email(instance, classification)
        if inquiry is not None:
            classification = {
                **classification,
                'inquiry_id': str(inquiry.id),
                'inquiry_number': inquiry.inquiry_number,
            }

        _upsert_action_required_feedback(instance, classification)

        if classification.get('actionable') and classification.get('draft_type'):
            draft, _ = EmailReviewDraft.objects.update_or_create(
                email_log=instance,
                defaults={
                    'tenant': instance.tenant,
                    'draft_type': classification['draft_type'],
                    'summary': str(classification.get('summary') or '').strip(),
                    'extracted_payload': classification,
                    'classification_confidence': float(
                        classification.get('confidence_score') or classification.get('confidence') or 0.0
                    ),
                    'status': 'pending_review',
                },
            )
            _notify_actionable_email(instance, draft, classification)
            instance.mark_as_draft_created(extracted_data=classification)
        else:
            logger.info(
                'Email %s classified as %s; leaving operator-visible for follow-up',
                instance.id,
                classification.get('category'),
            )
            instance.mark_as_completed(extracted_data=classification)

    except Exception as e:
        logger.exception('AI extraction failed for email %s', instance.id)
        instance.mark_as_failed(str(e))
