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


def _build_invitation_email(invitation: TenantInvitation) -> tuple[str, str, str]:
    base_url = getattr(settings, "FRONTEND_URL", "https://meatscentral.com")
    invite_url = f"{base_url}/signup?token={invitation.token}"

    subject = f"You've been invited to join {invitation.tenant.name} on Meats Central"

    body = (
        "Hello,\n\n\n"
        f"You have been invited to join '{invitation.tenant.name}' as a {invitation.role}. "
        "Join us on Meats Central!\n\n\n"
        "Click the link below to accept the invitation and set up your account:\n"
        f"{invite_url}\n\n"
        f"This link expires on {invitation.expires_at.strftime('%Y-%m-%d')}.\n\n\n"
        "Welcome to easy,\n\n"
        "The Meats Central Team"
    )

    return subject, body, invite_url


def send_invitation_email_now(invitation: TenantInvitation) -> None:
    """Send invitation email immediately.

    Use this when the caller needs immediate feedback (e.g., resend endpoint).

    Raises:
        RuntimeError: If the SendGrid backend is configured but the API key is missing.
        Exception: Re-raises quota-exceeded errors as CRITICAL so Sentry captures them.
    """

    if invitation.status != "pending" or not invitation.email:
        return

    # Common operational misconfig: SendGrid backend enabled but no API key.
    if (
        str(getattr(settings, 'EMAIL_BACKEND', '')).endswith('SendgridBackend')
        and not getattr(settings, 'SENDGRID_API_KEY', '')
    ):
        raise RuntimeError('SENDGRID_API_KEY is not set for SendGrid email backend')

    subject, body, invite_url = _build_invitation_email(invitation)

    logger.info(
        "📤 Sending invitation email to %s (tenant=%s, role=%s, invite_url=%s)",
        invitation.email,
        invitation.tenant_id,
        invitation.role,
        invite_url,
    )

    try:
        send_mail(
            subject=subject,
            message=body,
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
        raise


def schedule_invitation_email(invitation: TenantInvitation) -> None:
    """Best-effort: send the invitation email after commit.

    Dispatches a Celery task (``tenants.send_invitation_email``) when Celery is
    available so the email is retried on transient failures.  Falls back to a
    direct inline send when the task queue is unavailable.

    Safe to call multiple times. No-op if the invitation is not a pending 1:1
    email invite.  Email failures must never break invitation creation/resend.
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
            try:
                send_invitation_email_now(invitation)
            except Exception:
                logger.exception("❌ Failed to send invitation email to %s", invitation.email)

    transaction.on_commit(_enqueue)
