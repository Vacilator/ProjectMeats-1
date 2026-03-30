"""Invitation email helpers.

Centralizes invitation email sending so the same logic can be reused from:
- post_save signals (send on create)
- API resend action

Email failures must never break invitation creation/resend.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from .email_utils import is_sendgrid_quota_exceeded
from .models import TenantInvitation

logger = logging.getLogger(__name__)


def _build_invitation_message(invitation: TenantInvitation) -> tuple[str, str]:
    """Return ``(subject, message)`` for an invitation email."""
    base_url = getattr(settings, "FRONTEND_URL", "https://meatscentral.com")
    invite_url = f"{base_url}/signup?token={invitation.token}"

    subject = f"You've been invited to join {invitation.tenant.name} on Meats Central"
    message = (
        "Hello,\n\n\n"
        f"You have been invited to join '{invitation.tenant.name}' as a {invitation.role}. "
        "Join us on Meats Central!\n\n\n"
        "Click the link below to accept the invitation and set up your account:\n"
        f"{invite_url}\n\n"
        f"This link expires on {invitation.expires_at.strftime('%Y-%m-%d')}.\n\n\n"
        "Welcome to easy,\n\n"
        "The Meats Central Team"
    )
    return subject, message


def schedule_invitation_email(invitation: TenantInvitation) -> None:
    """Best-effort: send the invitation email after commit.

    Dispatches a Celery task (``tenants.send_invitation_email``) when Celery is
    available so the email is retried on transient failures.  Falls back to a
    direct inline send when the task queue is unavailable.

    Safe to call multiple times. No-op if the invitation is not a pending 1:1
    email invite.
    """

    if invitation.status != "pending" or not invitation.email:
        return

    invitation_id = str(invitation.id)

    def _enqueue() -> None:
        """Dispatch to Celery after the DB transaction commits.

        The import is intentionally deferred to avoid a circular-import at
        module load time: tasks.py <- invitation_email.py <- signals.py.
        Python caches module objects so the cost of repeated deferred imports
        is negligible.
        """
        try:
            from .tasks import send_invitation_email_task  # noqa: PLC0415

            send_invitation_email_task.delay(invitation_id)
            logger.info(
                "📬 Invitation email queued for %s (invitation=%s)",
                invitation.email,
                invitation_id,
            )
        except Exception:
            # Celery is unavailable (e.g. broker not configured in some
            # environments). Fall back to a direct send so invitation emails
            # are never silently dropped.
            logger.warning(
                "Celery unavailable — falling back to direct invitation email send for %s",
                invitation.email,
            )
            _send_direct(invitation)

    transaction.on_commit(_enqueue)


def _send_direct(invitation: TenantInvitation) -> None:
    """Inline (synchronous) invitation email send — used as a fallback.

    Quota-exceeded errors are logged at CRITICAL level so they are captured by
    Sentry with high priority.  All other failures are logged as errors.
    """
    subject, message = _build_invitation_message(invitation)

    try:
        logger.info(
            "📤 Sending invitation email to %s (tenant=%s, role=%s)",
            invitation.email,
            invitation.tenant_id,
            invitation.role,
        )
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            fail_silently=False,
        )
    except Exception as exc:
        if is_sendgrid_quota_exceeded(exc):
            logger.critical(
                "🚨 SendGrid quota exceeded — invitation email to %s NOT sent. "
                "Please upgrade the SendGrid plan or wait for the quota to reset. "
                "Error: %s",
                invitation.email,
                exc,
            )
        else:
            logger.exception("❌ Failed to send invitation email to %s", invitation.email)
