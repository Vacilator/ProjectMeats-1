"""
Celery tasks for email integrations.

Background tasks for periodic email syncing and order ingestion.
"""
import logging
from celery import shared_task
from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

logger = logging.getLogger(__name__)


@shared_task(
    name='integrations.sync_tenant_emails',
    bind=True,
    max_retries=3,
    soft_time_limit=300,  # 5 minutes
    time_limit=360,  # 6 minutes hard limit
)
def sync_tenant_emails(self):
    """
    Poll all tenant inboxes for new order-related emails.
    
    This task runs every 5 minutes via Celery Beat.
    It iterates through all active tenants with Microsoft OAuth connections
    and fetches new emails containing order keywords or attachments.
    
    Multi-tenant safe: Each tenant's emails are isolated and linked to their tenant ID.
    
    Returns:
        dict: Statistics about the sync operation
            - tenants_processed: Number of tenants checked
            - total_emails_fetched: Total emails retrieved
            - total_emails_saved: Total new emails saved
            - total_errors: Number of errors encountered
    """
    try:
        logger.info("Starting scheduled email sync for all tenants")
        
        service = EmailIngestionService()
        stats = service.poll_all_tenants()
        
        logger.info(
            f"Email sync completed: {stats['tenants_processed']} tenants, "
            f"{stats['total_emails_saved']}/{stats['total_emails_fetched']} new emails"
        )
        
        return {
            'success': True,
            'stats': stats,
        }
        
    except Exception as e:
        logger.error(f"Email sync task failed: {str(e)}", exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(
    name='integrations.sync_single_tenant',
    bind=True,
    max_retries=2,
)
def sync_single_tenant(self, tenant_id: str):
    """
    Manually trigger email sync for a specific tenant.
    
    Used by the frontend "Sync Now" button or for debugging.
    
    Args:
        tenant_id: UUID of the tenant to sync
        
    Returns:
        dict: Statistics for this tenant's sync operation
    """
    try:
        logger.info(f"Manual sync triggered for tenant {tenant_id}")
        
        service = EmailIngestionService()
        stats = service.poll_tenant_by_id(tenant_id)
        
        logger.info(
            f"Manual sync completed for tenant {tenant_id}: "
            f"{stats['emails_saved']}/{stats['emails_fetched']} new emails"
        )
        
        return {
            'success': True,
            'tenant_id': tenant_id,
            'stats': stats,
        }
        
    except Exception as e:
        logger.error(
            f"Manual sync failed for tenant {tenant_id}: {str(e)}",
            exc_info=True
        )
        raise self.retry(exc=e, countdown=30)
