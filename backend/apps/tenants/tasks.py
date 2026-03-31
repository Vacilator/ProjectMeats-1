"""
Celery tasks for the tenants application.

Provides background email sending with retry logic for transient failures.
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .email_utils import is_sendgrid_quota_exceeded

logger = logging.getLogger(__name__)


@shared_task(
    name="tenants.send_invitation_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_invitation_email_task(self, invitation_id: str) -> dict:
    """Send an invitation email in the background.

    Retries up to 3 times with exponential back-off for transient failures.
    Quota-exceeded errors from SendGrid are treated as permanent failures and
    logged at CRITICAL level so they surface in Sentry immediately.

    Args:
        invitation_id: Primary-key string of the ``TenantInvitation`` record.

    Returns:
        A dict with ``{"success": True}`` on success.
    """
    # Deferred imports to avoid circular references at module load time.
    from .invitation_email import _build_invitation_email  # noqa: PLC0415
    from .models import TenantInvitation  # noqa: PLC0415

    try:
        invitation = TenantInvitation.objects.get(id=invitation_id)
    except TenantInvitation.DoesNotExist:
        logger.warning("send_invitation_email_task: invitation %s not found", invitation_id)
        return {"success": False, "error": "Invitation not found"}

    if invitation.status != "pending" or not invitation.email:
        logger.info(
            "send_invitation_email_task: skipping invitation %s (status=%s, email=%s)",
            invitation_id,
            invitation.status,
            bool(invitation.email),
        )
        return {"success": False, "error": "Invitation is not sendable"}

    subject, body, _invite_url = _build_invitation_email(invitation)

    try:
        logger.info(
            "📤 [task] Sending invitation email to %s (tenant=%s, role=%s, attempt=%s/%s)",
            invitation.email,
            invitation.tenant_id,
            invitation.role,
            self.request.retries + 1,
            self.max_retries + 1,
        )
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            fail_silently=False,
        )
        logger.info("✅ [task] Invitation email sent to %s", invitation.email)
        return {"success": True}

    except Exception as exc:
        if is_sendgrid_quota_exceeded(exc):
            logger.critical(
                "🚨 SendGrid quota exceeded — invitation email to %s NOT sent. "
                "Please upgrade the SendGrid plan or wait for the quota to reset. "
                "Error: %s",
                invitation.email,
                exc,
            )
            # Do not retry — quota won't be restored by retrying immediately.
            return {"success": False, "error": "SendGrid quota exceeded", "quota_exceeded": True}

        logger.warning(
            "⚠️  Transient failure sending invitation email to %s (attempt %s/%s): %s",
            invitation.email,
            self.request.retries + 1,
            self.max_retries + 1,
            exc,
        )
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
