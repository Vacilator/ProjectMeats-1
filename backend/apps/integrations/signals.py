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
            supplier_reply_parse = supplier_reply.get('supplier_reply_parse') or {}
            supplier_lineage = supplier_reply_parse.get('lineage') or {}
            _record_email_lineage_event(
                instance,
                event_type='supplier_reply_parsed',
                summary=str(supplier_reply.get('summary') or 'AI parsed supplier quote reply.'),
                target_type='inquiry' if supplier_lineage.get('inquiry_id') else '',
                target_id=str(supplier_lineage.get('inquiry_id') or ''),
                metadata={
                    'category': str(supplier_reply.get('category') or ''),
                    'parse_status': str(supplier_reply_parse.get('parse_status') or ''),
                    'correlation_status': str(supplier_reply_parse.get('correlation_status') or ''),
                    'supplier_id': supplier_lineage.get('supplier_id'),
                    'rfq_id': supplier_lineage.get('rfq_id'),
                    'inquiry_id': supplier_lineage.get('inquiry_id'),
                },
            )
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
            _record_email_lineage_event(
                instance,
                event_type='inquiry_draft_created_from_email',
                summary=f'Created inquiry draft {inquiry.inquiry_number} from inbound email.',
                target_type='inquiry',
                target_id=str(inquiry.id),
                metadata={
                    'inquiry_id': str(inquiry.id),
                    'inquiry_number': str(inquiry.inquiry_number or ''),
                    'draft_type': str(classification.get('draft_type') or ''),
                    'category': str(classification.get('category') or ''),
                },
            )

        _upsert_action_required_feedback(instance, classification)
        _record_email_lineage_event(
            instance,
            event_type='email_classified',
            summary=str(classification.get('summary') or 'AI classified inbound email.'),
            target_type='inquiry' if inquiry is not None else '',
            target_id=str(getattr(inquiry, 'id', '') or ''),
            metadata={
                'category': str(classification.get('category') or ''),
                'draft_type': str(classification.get('draft_type') or ''),
                'actionable': bool(classification.get('actionable')),
                'confidence_score': classification.get('confidence_score') or classification.get('confidence'),
                'inquiry_id': str(getattr(inquiry, 'id', '') or ''),
                'inquiry_number': str(getattr(inquiry, 'inquiry_number', '') or ''),
            },
        )

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
            _record_email_lineage_event(
                instance,
                event_type='email_review_draft_created',
                summary=f'Created AI review draft for {draft.get_draft_type_display()}.',
                target_type='email_review_draft',
                target_id=str(draft.id),
                metadata={
                    'draft_id': str(draft.id),
                    'draft_type': str(draft.draft_type or ''),
                    'category': str(classification.get('category') or ''),
                    'confidence_score': classification.get('confidence_score') or classification.get('confidence'),
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
