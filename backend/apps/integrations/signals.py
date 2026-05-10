import logging
import uuid

from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.tenants.models import TenantUser
from tenant_apps.inquiries.services import parse_supplier_quote_reply
from tenant_apps.ai_assistant.models import AIFeedbackLog, AILineageEvent
from tenant_apps.workflows.models import NotificationPriority, NotificationType, UserNotification

from .ai_classification import classify_ingested_email
from .dependency_drafter import build_related_entity_drafts
from .inquiry_drafts import upsert_inquiry_draft_from_email
from .models import EmailLog, EmailReviewDraft, ExternalAuthProvider

logger = logging.getLogger(__name__)


def _email_feedback_document_id(instance: EmailLog) -> uuid.UUID:
    identifier = instance.message_id or str(instance.pk or uuid.uuid4())
    return uuid.uuid5(uuid.NAMESPACE_URL, f'apps.integrations.EmailLog:{identifier}')


def _build_lineage_metadata(instance: EmailLog, **extra) -> dict:
    metadata = {
        'email_log_id': str(instance.pk),
        'message_id': str(instance.message_id or ''),
        'thread_id': str(instance.thread_id or ''),
        'subject': str(instance.subject or ''),
        'sender_email': str(instance.sender_email or ''),
        'sender_name': str(instance.sender_name or ''),
    }
    # Include file/attachment info when present
    att_data = getattr(instance, 'attachment_data', None)
    if isinstance(att_data, list) and att_data:
        metadata['attachment_count'] = len(att_data)
        metadata['attachment_filenames'] = [
            str(a.get('filename', '')) for a in att_data if isinstance(a, dict)
        ]
    elif isinstance(att_data, dict) and att_data.get('files'):
        metadata['attachment_count'] = len(att_data['files'])
    metadata.update({key: value for key, value in extra.items() if value not in (None, '')})
    return metadata


def _record_email_lineage_event(
    instance: EmailLog,
    *,
    event_type: str,
    summary: str,
    target_type: str = '',
    target_id: str = '',
    metadata: dict | None = None,
) -> None:
    AILineageEvent.objects.create(
        tenant=instance.tenant,
        event_type=event_type,
        source_type='email_log',
        source_id=str(instance.pk),
        target_type=str(target_type or ''),
        target_id=str(target_id or ''),
        summary=str(summary or '')[:255],
        metadata=_build_lineage_metadata(instance, **(metadata or {})),
    )


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
        _record_email_lineage_event(
            instance,
            event_type='email_review_notification_skipped',
            summary='Skipped AI review notification because no eligible reviewers were found.',
            target_type='email_review_draft',
            target_id=str(draft.id),
            metadata={
                'draft_id': str(draft.id),
                'draft_type': str(draft.draft_type or ''),
                'category': str(classification.get('category') or ''),
                'recipient_count': 0,
            },
        )
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
    _record_email_lineage_event(
        instance,
        event_type='email_review_notification_queued',
        summary=f'Queued AI review notification for {len(notifications)} reviewer(s).',
        target_type='email_review_draft',
        target_id=str(draft.id),
        metadata={
            'draft_id': str(draft.id),
            'draft_type': str(draft.draft_type or ''),
            'category': str(classification.get('category') or ''),
            'recipient_count': len(notifications),
            'recipient_user_ids': [notification.user_id for notification in notifications],
        },
    )

    logger.info(
        'Queued %s actionable-email notifications for tenant %s draft=%s',
        len(notifications),
        instance.tenant_id,
        draft.id,
    )


@receiver(post_save, sender=EmailLog)
def trigger_ai_extraction(sender, instance, created, **kwargs):
    """
    Dispatch async AI classification when a new EmailLog is created.

    Marks the email as 'processing' and dispatches a Celery task.
    The actual classification (OpenAI call, dependency drafts, lineage) runs
    in the background worker to avoid blocking the save transaction.
    """
    if not created:
        return

    if instance.status != 'logged':
        return

    try:
        instance.mark_as_processing()
        from apps.integrations.tasks import classify_email_async
        classify_email_async.apply_async(
            args=[str(instance.pk), str(instance.tenant_id)],
            countdown=1,
        )
        logger.info('Dispatched async AI classification for email %s', instance.id)
    except Exception as e:
        logger.exception('Failed to dispatch AI classification for email %s', instance.id)
        instance.mark_as_failed(str(e))


@receiver(user_logged_in)
def trigger_email_sync_on_login(sender, request, user, **kwargs):
    """Fire a background email sync for every tenant the user belongs to.

    Idempotent: Celery deduplicates via ``sync_single_tenant`` task-level
    retry/locking. Safe to fire on every login — the worst case is a no-op
    if no Microsoft provider is connected.
    """
    tenant_ids = list(
        TenantUser.objects.filter(user=user, is_active=True)
        .values_list('tenant_id', flat=True)
    )
    if not tenant_ids:
        return

    connected_tenant_ids = set(
        ExternalAuthProvider.objects.filter(
            tenant_id__in=tenant_ids,
            provider_type='microsoft',
            is_active=True,
        ).values_list('tenant_id', flat=True)
    )
    if not connected_tenant_ids:
        return

    try:
        from apps.integrations.tasks import sync_single_tenant

        for tid in connected_tenant_ids:
            sync_single_tenant.apply_async(args=[str(tid)], countdown=3)
        logger.info(
            'Login email-sync queued for user=%s tenants=%s',
            user.pk,
            [str(t) for t in connected_tenant_ids],
        )
    except Exception:
        logger.exception('Failed to queue login email-sync for user=%s', user.pk)
