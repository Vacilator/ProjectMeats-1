"""
Celery tasks for email integrations.

Background tasks for periodic email syncing and order ingestion.
"""
import logging
import random

from celery import group, shared_task

from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant
from apps.tenants.rls import tenant_rls
from tenant_apps.ai_assistant.tasks.watchdog import sync_ai_feedback_queue_for_tenant
from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

logger = logging.getLogger(__name__)


@shared_task(
    name='integrations.sync_tenant_emails',
    bind=True,
    max_retries=3,
    soft_time_limit=60,  # orchestrator should be fast
    time_limit=90,
)
def sync_tenant_emails(self):
    """Orchestrate email polling across tenants (Phase 8.3 fan-out).

    This task runs every 15 minutes via Celery Beat.

    IMPORTANT: ExternalAuthProvider is RLS-protected. Celery workers must set
    tenant context explicitly or queries will return 0 rows under FORCE RLS.

    Returns:
        dict: dispatch metadata (provider count + group id)
    """
    try:
        tenant_ids = list(Tenant.objects.filter(is_active=True).values_list('id', flat=True))
        tasks = []

        for tenant_id in tenant_ids:
            with tenant_rls(str(tenant_id)):
                provider_ids = list(
                    ExternalAuthProvider.objects.filter(
                        tenant_id=tenant_id,
                        provider_type='microsoft',
                        is_active=True,
                    ).values_list('id', flat=True)
                )

            for pid in provider_ids:
                # Jitter dispatch slightly to avoid stampedes against Graph API.
                tasks.append(sync_email_provider_inbox.s(pid, str(tenant_id)).set(countdown=random.randint(0, 15)))

        if not tasks:
            logger.info('No active Microsoft providers found; skipping email sync dispatch')
            return {
                'success': True,
                'providers_dispatched': 0,
                'group_id': None,
            }

        job = group(tasks)
        async_result = job.apply_async(expires=240)  # if beat lags, drop stale work

        logger.info('Dispatched email sync fan-out: %s providers (group=%s)', len(tasks), async_result.id)

        return {
            'success': True,
            'providers_dispatched': len(tasks),
            'group_id': async_result.id,
        }

    except Exception as e:
        logger.error('Email sync dispatch failed: %s', str(e), exc_info=True)
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(
    name='integrations.sync_email_provider_inbox',
    bind=True,
    max_retries=3,
    soft_time_limit=300,  # 5 minutes
    time_limit=360,  # 6 minutes hard limit
)
def sync_email_provider_inbox(self, provider_id: int, tenant_id: str):
    """Poll inbox for a single ExternalAuthProvider (tenant-scoped)."""
    try:
        with tenant_rls(str(tenant_id)):
            service = EmailIngestionService()
            stats = service.poll_provider_by_id(provider_id, tenant_id=str(tenant_id))
            ai_inbox = sync_ai_feedback_queue_for_tenant(str(tenant_id))

        logger.info(
            'Email sync provider complete: provider_id=%s tenant=%s saved=%s fetched=%s errors=%s',
            provider_id,
            stats.get('tenant_id'),
            stats.get('emails_saved'),
            stats.get('emails_fetched'),
            stats.get('errors'),
        )

        return {
            'success': True,
            'provider_id': provider_id,
            'stats': stats,
            'ai_inbox': ai_inbox,
        }

    except Exception as e:
        logger.error('Provider sync failed provider_id=%s: %s', provider_id, str(e), exc_info=True)
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(
    name='integrations.sync_single_tenant',
    bind=True,
    max_retries=2,
)
def sync_single_tenant(self, tenant_id: str):
    """Manually trigger email sync for a specific tenant.

    Used by the frontend "Sync Now" button or for debugging.

    Note: This intentionally runs a single-tenant sync synchronously inside the task.
    The high-volume optimization is handled by sync_tenant_emails fan-out.
    """
    try:
        logger.info('Manual sync triggered for tenant %s', tenant_id)

        with tenant_rls(str(tenant_id)):
            service = EmailIngestionService()
            stats = service.poll_tenant_by_id(tenant_id)
            ai_inbox = sync_ai_feedback_queue_for_tenant(str(tenant_id))

        logger.info(
            'Manual sync completed for tenant %s: saved=%s fetched=%s errors=%s',
            tenant_id,
            stats.get('emails_saved'),
            stats.get('emails_fetched'),
            stats.get('errors'),
        )

        return {
            'success': True,
            'tenant_id': tenant_id,
            'stats': stats,
            'ai_inbox': ai_inbox,
        }

    except Exception as e:
        logger.error('Manual sync failed for tenant %s: %s', tenant_id, str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30)
